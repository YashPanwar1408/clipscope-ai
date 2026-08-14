import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  processIngestionItem,
  type ProcessItemResult,
} from "@/lib/ingestion/process-item";
import {
  reconcileOutboxAndStaleJobs,
  recomputeJobProgress,
} from "@/lib/ingestion/server";
import {
  analyzeVideo,
  analyzeComparison,
  type VideoAnalysisResult,
} from "@/lib/ai/groq";
import type { IngestionJobItem } from "@/lib/types/domain";
import { buildReportBundle, type ReportVideo } from "@/lib/reports/generator";

type StoredVideoAnalysis = {
  analysis_version: string | null;
  hook_summary: string | null;
  content_theme: string | null;
  target_audience: string | null;
  narrative_structure: string | null;
  call_to_action: string | null;
  pacing_observations: string | null;
  content_strengths: string[] | null;
  content_weaknesses: string[] | null;
  model_name: string | null;
};

function mapStoredVideoAnalysis(row: StoredVideoAnalysis | null): VideoAnalysisResult | null {
  if (!row) return null;

  return {
    hookSummary: row.hook_summary ?? "",
    hookStrength: "moderate",
    contentTheme: row.content_theme ?? "",
    targetAudience: row.target_audience ?? "",
    narrativeStructure: row.narrative_structure ?? "",
    callToAction: row.call_to_action ?? "",
    pacingObservations: row.pacing_observations ?? "",
    contentStrengths: Array.isArray(row.content_strengths) ? row.content_strengths : [],
    contentWeaknesses: Array.isArray(row.content_weaknesses) ? row.content_weaknesses : [],
    improvementOpportunities: [],
    evidence: [],
    hasSufficientEvidence: true,
    modelName: row.model_name ?? "",
    analysisVersion: row.analysis_version ?? "legacy",
  };
}

// ─── Ingest Job (orchestrator) ───────────────────────────────────────────────

export const ingestJob = inngest.createFunction(
  {
    id: "ingest-job",
    name: "Process ingestion job",
    retries: 2,
    concurrency: { limit: 5 },
    triggers: { event: "job/ingest.requested" },
  },
  async ({ event, step }) => {
    const { jobId, workspaceId } = event.data as {
      jobId: string;
      workspaceId: string;
      userId: string;
    };

    const supabase = createAdminClient();

    // Mark job as running
    const job = await step.run("mark-job-running", async () => {
      const { data, error } = await supabase
        .from("ingestion_jobs")
        .update({
          status: "running",
          current_stage: "processing",
          started_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .select("id, total_videos")
        .maybeSingle();

      if (error) throw new Error(`Could not start ingestion job: ${error.message}`);
      if (!data) throw new Error(`Ingestion job ${jobId} was not found`);

      return { jobId: data.id, totalVideos: data.total_videos };
    });

    // Load job items
    const items = await step.run("load-items", async () => {
      const { data, error } = await supabase
        .from("ingestion_job_items")
        .select("*")
        .eq("job_id", jobId)
        .order("id", { ascending: true });
      if (error) throw new Error(`Could not load ingestion job items: ${error.message}`);

      const loadedItems = (data ?? []) as IngestionJobItem[];
      if (loadedItems.length !== job.totalVideos) {
        throw new Error(
          `Expected ${job.totalVideos} video items, but found ${loadedItems.length}`
        );
      }
      return loadedItems;
    });

    // Process items sequentially to avoid bursts against providers with strict
    // rate limits. Each item remains its own durable step so a retry can resume
    // without repeating items that already completed.
    const results: ProcessItemResult[] = [];
    for (const item of items) {
      const result = await step.run(`process-item-${item.id}`, async () => {
        try {
          return await processIngestionItem(item);
        } catch (err) {
          // Record the failure on the item so partial failures are preserved.
          const supabase = createAdminClient();
          const { error } = await supabase
            .from("ingestion_job_items")
            .update({
              status: "failed",
              current_stage: "error",
              error_code: "INTERNAL_ERROR",
              error_message:
                err instanceof Error ? err.message : "Unexpected processing error",
              completed_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          if (error) throw error;
          return {
            success: false,
            stage: "error",
            errorMessage:
              err instanceof Error ? err.message : "Unexpected processing error",
          };
        }
      });
      results.push(result);
    }

    // Finalize: recompute job progress & terminal status
    await step.run("finalize-job", async () => {
      await recomputeJobProgress(jobId);

      // Metadata supports a limited analysis when a successful item has no transcript.
      for (let i = 0; i < items.length; i++) {
        if (results[i]?.success && items[i].videoId) {
          await inngest.send({
            name: "video/analysis.requested",
            data: { videoId: items[i].videoId, workspaceId },
          });
        }
      }
      return { jobId };
    });

    return { jobId, total: items.length, success: results.filter((r) => r?.success).length };
  }
);

// ─── AI Video Analysis ───────────────────────────────────────────────────────

export const aiAnalysisWorkflow = inngest.createFunction(
  {
    id: "ai-analysis",
    name: "Run AI insight analysis",
    retries: 2,
    concurrency: { limit: 3 },
    triggers: { event: "video/analysis.requested" },
  },
  async ({ event, step }) => {
    const { videoId, workspaceId, force = false } = event.data as {
      videoId: string;
      workspaceId: string;
      force?: boolean;
    };

    const supabase = createAdminClient();

    await step.run("mark-analysis-pending", async () => {
      await supabase
        .from("videos")
        .update({ analysis_status: "processing" })
        .eq("id", videoId);
      return { videoId };
    });

    const analysis = await step.run("generate-insights", async () => {
      try {
      const { data: video, error: videoError } = await supabase
        .from("videos")
        .select("title, description, platform, duration_seconds, views, likes, comments_count")
        .eq("id", videoId)
        .single();
      if (videoError || !video) throw new Error(videoError?.message ?? "Video not found");

      const { data: transcript, error: transcriptError } = await supabase
        .from("transcripts")
        .select("transcript_text")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (transcriptError) throw new Error(transcriptError.message);

      // Reuse existing valid analysis if one exists and no explicit regeneration requested
      const { data: existing, error: existingError } = await supabase
        .from("video_analyses")
        .select("*")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);

      // If a valid analysis already exists and the transcript hasn't changed, reuse it
      if (existing && !force) {
        return { analysis: existing, reused: true } as const;
      }

      const result = await analyzeVideo({
        title: video.title,
        description: video.description,
        transcript: transcript?.transcript_text ?? null,
        platform: video.platform,
        durationSeconds: video.duration_seconds,
        views: video.views,
        likes: video.likes,
        commentsCount: video.comments_count,
      });
      return { analysis: result, reused: false } as const;
      } catch (err) {
        // Return the failure as step data so the status can be persisted instead
        // of leaving the video marked as processing forever.
        console.error("[ai-analysis] analysis failed:", err);
        return { analysis: null, reused: false, error: err instanceof Error ? err.message : "Unknown AI error" } as const;
      }
    });

    await step.run("persist-analysis", async () => {
      if (analysis.reused) {
        const { error } = await supabase
          .from("videos")
          .update({ analysis_status: "ready" })
          .eq("id", videoId);
        if (error) throw new Error(`Could not save analysis status: ${error.message}`);
        return { videoId, reused: true };
      }

      if (!analysis.analysis) {
        const { error } = await supabase
          .from("videos")
          .update({ analysis_status: "error" })
          .eq("id", videoId);
        if (error) throw new Error(`Could not save analysis error status: ${error.message}`);
        return { videoId, error: analysis.error };
      }

      const a = analysis.analysis as VideoAnalysisResult;

      const { error: insertError } = await supabase.from("video_analyses").insert({
        video_id: videoId,
        analysis_version: a.analysisVersion,
        hook_summary: a.hookSummary,
        content_theme: a.contentTheme,
        target_audience: a.targetAudience,
        narrative_structure: a.narrativeStructure,
        call_to_action: a.callToAction,
        pacing_observations: a.pacingObservations,
        content_strengths: a.contentStrengths,
        content_weaknesses: a.contentWeaknesses,
        evidence_json: {
          evidence: a.evidence,
          improvementOpportunities: a.improvementOpportunities,
          hookStrength: a.hookStrength,
          hasSufficientEvidence: a.hasSufficientEvidence,
          modelName: a.modelName,
        } as unknown as Record<string, unknown>,
        model_name: a.modelName,
      });
      if (insertError) {
        const { error: statusError } = await supabase
          .from("videos")
          .update({ analysis_status: "error" })
          .eq("id", videoId);
        if (statusError) throw statusError;
        console.error("[ai-analysis] failed to save generated analysis:", insertError);
        return { videoId, error: insertError.message };
      }

      const { error: statusError } = await supabase
        .from("videos")
        .update({ analysis_status: "ready" })
        .eq("id", videoId);
      if (statusError) throw new Error(`Could not mark analysis ready: ${statusError.message}`);

      return { videoId, saved: true };
    });

    return { videoId, workspaceId, analysis: analysis.reused ? "reused" : analysis.analysis ? "generated" : "skipped" };
  }
);

// ─── Comparison Generation ───────────────────────────────────────────────────

export const generateComparison = inngest.createFunction(
  {
    id: "generate-comparison",
    name: "Generate video comparison",
    retries: 2,
    triggers: { event: "comparison/generate.requested" },
  },
  async ({ event, step }) => {
    const { comparisonId, workspaceId } = event.data as {
      comparisonId: string;
      workspaceId: string;
      videoIds: string[];
    };

    const supabase = createAdminClient();
    const writeState = async (status: string, extras: Record<string, unknown> = {}) => {
      const { data: existing, error: readError } = await supabase
        .from("comparisons")
        .select("comparison_data")
        .eq("id", comparisonId)
        .maybeSingle();
      if (readError) throw new Error(`Could not read comparison state: ${readError.message}`);
      const current = (existing?.comparison_data ?? {}) as Record<string, unknown>;
      const { error } = await supabase
        .from("comparisons")
        .update({ comparison_data: { ...current, status, ...extras } as never })
        .eq("id", comparisonId);
      if (error) throw new Error(`Could not save comparison status: ${error.message}`);
    };

    try {
      await step.run("mark-comparison-generating", async () => {
        await writeState("generating", { aiError: null });
        return { comparisonId };
      });

      const result = await step.run("build-comparison", async () => {
        const { data: comparison, error: comparisonError } = await supabase
          .from("comparisons")
          .select("selected_video_ids, title")
          .eq("id", comparisonId)
          .single();
        if (comparisonError || !comparison) {
          throw new Error(comparisonError?.message ?? "Comparison not found");
        }

        const videoIds = comparison.selected_video_ids ?? [];
        const { data: videos, error: videosError } = await supabase
          .from("videos")
          .select("id, title, description, platform, canonical_url, creator_name, views, likes, comments_count, duration_seconds, published_at, transcript_status, metadata_status")
          .in("id", videoIds);
        if (videosError) throw new Error(`Could not load comparison videos: ${videosError.message}`);

        const videoList = videos ?? [];
        if (videoList.length < 2) throw new Error("At least two videos must still exist in this workspace");

        const videoData = await Promise.all(videoList.map(async (video) => {
          const [transcriptResult, analysisResult] = await Promise.all([
            supabase.from("transcripts").select("transcript_text").eq("video_id", video.id)
              .order("created_at", { ascending: false }).limit(1).maybeSingle(),
            supabase.from("video_analyses").select("*").eq("video_id", video.id)
              .order("created_at", { ascending: false }).limit(1).maybeSingle(),
          ]);
          if (transcriptResult.error) throw new Error(`Could not load a video transcript: ${transcriptResult.error.message}`);
          if (analysisResult.error) throw new Error(`Could not load a video analysis: ${analysisResult.error.message}`);
          return {
            ...video,
            transcript: transcriptResult.data?.transcript_text ?? null,
            analysis: mapStoredVideoAnalysis(analysisResult.data as StoredVideoAnalysis | null),
          };
        }));

        let aiComparison = null;
        let aiError: string | null = null;
        try {
          aiComparison = await analyzeComparison(videoData.map((video) => ({
            id: video.id,
            title: video.title,
            platform: video.platform,
            transcript: video.transcript,
            analysis: video.analysis,
          })));
        } catch (error) {
          aiError = error instanceof Error ? error.message : "AI comparison failed";
          console.error("[comparison] AI analysis failed:", error);
        }

        const comparisonData = {
          status: aiComparison ? "ready" : "error",
          videos: videoList.map((video) => ({
            id: video.id,
            title: video.title,
            platform: video.platform,
            creatorName: video.creator_name,
            views: video.views,
            likes: video.likes,
            commentsCount: video.comments_count,
            durationSeconds: video.duration_seconds,
            publishedAt: video.published_at,
            transcriptStatus: video.transcript_status,
            metadataStatus: video.metadata_status,
          })),
          aiAnalysis: aiComparison,
          aiError,
          generatedAt: new Date().toISOString(),
          notes: "Comparison generated from available metadata and AI analysis. Missing metrics are unavailable.",
        };
        const { error: saveError } = await supabase
          .from("comparisons")
          .update({ comparison_data: comparisonData as never })
          .eq("id", comparisonId);
        if (saveError) throw new Error(`Could not save comparison: ${saveError.message}`);

        return { comparisonId, videoCount: videoList.length, status: comparisonData.status };
      });

      return { workspaceId, ...result, comparisonId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Comparison generation failed";
      console.error("[comparison] generation failed:", error);
      try {
        await step.run("mark-comparison-error", async () => {
          await writeState("error", { aiError: message, generatedAt: new Date().toISOString() });
          return { comparisonId };
        });
      } catch (persistError) {
        console.error("[comparison] could not persist failure state:", persistError);
      }
      return { workspaceId, comparisonId, status: "error", error: message };
    }
  }
);

// ─── Report Generation ───────────────────────────────────────────────────────

export const generateReport = inngest.createFunction(
  {
    id: "generate-report",
    name: "Generate report",
    retries: 2,
    triggers: { event: "report/generate.requested" },
    onFailure: async ({ event, error }) => {
      const { reportId } = event.data.event.data as { reportId?: string };
      console.error("[report] generation exhausted retries:", { reportId, error });

      if (!reportId) return;

      const supabase = createAdminClient();
      const { error: updateError } = await supabase
        .from("reports")
        .update({ status: "error", completed_at: new Date().toISOString() })
        .eq("id", reportId);

      if (updateError) {
        console.error("[report] could not mark report as failed:", updateError);
      }
    },
  },
  async ({ event, step }) => {
    const { reportId, workspaceId } = event.data as {
      reportId: string;
      workspaceId: string;
    };

    const supabase = createAdminClient();

    const result = await step.run("build-report", async () => {
      const { data: report, error: reportError } = await supabase
        .from("reports")
        .select("report_type, workspace_id")
        .eq("id", reportId)
        .single();

      if (reportError || !report) {
        throw reportError ?? new Error("Report not found");
      }
      if (report.workspace_id !== workspaceId) {
        throw new Error("Report does not belong to the requested workspace");
      }

      // Build report data from workspace videos
      const { data: videos, error: videosError } = await supabase
        .from("videos")
        .select(
          "id, title, platform, creator_name, views, likes, comments_count, duration_seconds, published_at, transcript_status, analysis_status, canonical_url"
        )
        .eq("workspace_id", report.workspace_id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (videosError) throw videosError;

      const videoList = (videos ?? []) as unknown as ReportVideo[];
      // The reports bucket already provides the top-level namespace. Keeping
      // the workspace ID as the first object folder matches its RLS policies.
      const basePath = `${report.workspace_id}/${reportId}`;
      const bundle = await buildReportBundle(videoList, report.workspace_id);

      // Upload all three formats privately to Supabase Storage
      const uploads = [
        { path: `${basePath}.md`, content: bundle.markdown, contentType: "text/markdown" },
        { path: `${basePath}.csv`, content: bundle.csv, contentType: "text/csv" },
        { path: `${basePath}.pdf`, content: bundle.pdf, contentType: "application/pdf" },
      ];

      for (const upload of uploads) {
        const { error: storageError } = await supabase.storage
          .from("reports")
          .upload(upload.path, upload.content, {
            contentType: upload.contentType,
            upsert: true,
          });
        if (storageError) throw storageError;
      }

      const { error: updateError } = await supabase
        .from("reports")
        .update({
          status: "ready",
          storage_path: basePath,
          completed_at: new Date().toISOString(),
        })
        .eq("id", reportId);
      if (updateError) throw updateError;

      return { reportId, storagePath: basePath };
    });

    return { workspaceId, ...result, reportId };
  }
);

// ─── Reconciliation (cron) ───────────────────────────────────────────────────

export const reconcileJobs = inngest.createFunction(
  {
    id: "reconcile-jobs",
    name: "Reconcile stale jobs and outbox",
    retries: 0,
    triggers: { cron: "*/5 * * * *" },
  },
  async () => {
    const result = await reconcileOutboxAndStaleJobs();
    return result;
  }
);
