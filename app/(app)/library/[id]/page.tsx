import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VideoDetail } from "@/components/library/video-detail";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/server";
import { requireWorkspaceAccess } from "@/lib/auth/server";
import type { Video, Transcript, VideoAnalysis } from "@/lib/types/domain";

export const metadata: Metadata = { title: "Video Details" };

export default async function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, workspaceId] = await Promise.all([
    params,
    getActiveWorkspaceId(),
  ]);
  if (
    !workspaceId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    notFound();
  }
  await requireWorkspaceAccess(workspaceId, "viewer");

  const supabase = await createClient();
  const { data: video, error } = await supabase
    .from("videos")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !video) notFound();

  const [{ data: transcript }, { data: analysis }] = await Promise.all([
    supabase
      .from("transcripts")
      .select(
        "id, language, transcript_text, source, confidence, created_at"
      )
      .eq("video_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("video_analyses")
      .select(
        "hook_summary, content_theme, target_audience, narrative_structure, call_to_action, pacing_observations, content_strengths, content_weaknesses, evidence_json, model_name, created_at"
      )
      .eq("video_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const typedVideo: Video = {
    id: video.id,
    workspaceId: video.workspace_id,
    platform: video.platform,
    platformVideoId: video.platform_video_id,
    canonicalUrl: video.canonical_url,
    title: video.title,
    description: video.description,
    creatorName: video.creator_name,
    thumbnailUrl: video.thumbnail_url,
    durationSeconds: video.duration_seconds,
    views: video.views,
    likes: video.likes,
    commentsCount: video.comments_count,
    publishedAt: video.published_at,
    metadataStatus: video.metadata_status,
    transcriptStatus: video.transcript_status,
    analysisStatus: video.analysis_status,
    metadataJson: video.metadata_json,
    createdAt: video.created_at,
    updatedAt: video.updated_at,
  };

  const typedTranscript: Transcript | null = transcript
    ? {
        id: transcript.id,
        videoId: id,
        language: transcript.language,
        transcriptText: transcript.transcript_text,
        segmentsJson: null,
        source: transcript.source,
        confidence: transcript.confidence,
        createdAt: transcript.created_at,
      }
    : null;

  const typedAnalysis: VideoAnalysis | null = analysis
    ? {
        id: "",
        videoId: id,
        analysisVersion: "v1",
        hookSummary: analysis.hook_summary,
        contentTheme: analysis.content_theme,
        targetAudience: analysis.target_audience,
        narrativeStructure: analysis.narrative_structure,
        callToAction: analysis.call_to_action,
        pacingObservations: analysis.pacing_observations,
        contentStrengths: analysis.content_strengths ?? [],
        contentWeaknesses: analysis.content_weaknesses ?? [],
        evidenceJson: analysis.evidence_json as Record<string, unknown> | null,
        modelName: analysis.model_name,
        createdAt: analysis.created_at,
      }
    : null;

  return (
    <div className="p-4 animate-fade-in sm:p-6 xl:p-8">
      <VideoDetail
        key={`${id}:${typedTranscript?.id ?? "no-transcript"}`}
        video={typedVideo}
        transcript={typedTranscript}
        analysis={typedAnalysis}
      />
    </div>
  );
}
