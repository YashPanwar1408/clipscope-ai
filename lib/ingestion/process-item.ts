import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchYouTubeMetadata,
  fetchYouTubeTranscript,
  fetchInstagramMetadata,
} from "@/lib/adapters";
import type { IngestionJobItem } from "@/lib/types/domain";

// Common shape shared by both provider metadata results.
type ProviderMetadata = {
  title: string | null;
  description: string | null;
  channelName: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  error: string | null;
} | null;

// ─── Error classification ─────────────────────────────────────────────────────

export type ProviderErrorCode =
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_NOT_FOUND"
  | "PROVIDER_NOT_CONFIGURED"
  | "EXTRACTION_FAILED"
  | "UNKNOWN";

export interface ProviderError {
  code: ProviderErrorCode;
  message: string;
}

const MAX_METADATA_FETCH_MS = 15_000;
const MAX_TRANSCRIPT_FETCH_MS = 30_000;

function classifyProviderError(err: unknown, stage: "metadata" | "transcript"): ProviderError {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("abort")) {
      return { code: "PROVIDER_TIMEOUT", message: `${stage} fetch timed out` };
    }
    if (msg.includes("429") || msg.includes("rate")) {
      const providerDetail = err.message.replace(/\s+/g, " ").trim().slice(0, 180);
      return {
        code: "PROVIDER_RATE_LIMITED",
        message: `${stage} provider rate limited${providerDetail ? `: ${providerDetail}` : ""}`,
      };
    }
    if (msg.includes("404") || msg.includes("not found")) {
      return { code: "PROVIDER_NOT_FOUND", message: "Video not found or is private" };
    }
    if (msg.includes("not configured")) {
      return { code: "PROVIDER_NOT_CONFIGURED", message: `${stage} provider not configured` };
    }
  }
  return {
    code: "EXTRACTION_FAILED",
    message: err instanceof Error ? err.message : `${stage} extraction failed`,
  };
}

// ─── Fetch with timeout ───────────────────────────────────────────────────────

async function withTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Process a single ingestion item ──────────────────────────────────────────

export interface ProcessItemResult {
  success: boolean;
  stage: string;
  errorCode?: ProviderErrorCode;
  errorMessage?: string;
}

/**
 * Processes a single ingestion job item: fetches metadata, fetches transcript,
 * persists results to the videos and transcripts tables, and updates the item
 * status. Designed to be called from an Inngest step.
 *
 * Idempotent: if the item is already completed, returns early.
 */
export async function processIngestionItem(
  item: IngestionJobItem
): Promise<ProcessItemResult> {
  const supabase = createAdminClient();

  // Re-fetch the item from the database for idempotency on retries.
  // The passed-in item may be stale (e.g. a previous attempt already completed it).
  const { data: currentItem } = await supabase
    .from("ingestion_job_items")
    .select("*")
    .eq("id", item.id)
    .single();

  // Already completed — idempotent no-op
  if (currentItem?.status === "completed") {
    return { success: true, stage: "already_completed" };
  }

  const videoId = currentItem?.video_id ?? item.videoId;

  // Mark item as running
  await supabase
    .from("ingestion_job_items")
    .update({
      status: "running",
      current_stage: "metadata",
      started_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  if (!videoId) {
    await supabase
      .from("ingestion_job_items")
      .update({
        status: "failed",
        current_stage: "metadata",
        error_code: "EXTRACTION_FAILED",
        error_message: "No video record associated with this job item",
        completed_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    return {
      success: false,
      stage: "metadata",
      errorCode: "EXTRACTION_FAILED",
      errorMessage: "No video record associated with this job item",
    };
  }

  // Load the video record
  const { data: video } = await supabase
    .from("videos")
    .select("id, platform, canonical_url, platform_video_id")
    .eq("id", videoId)
    .single();

  if (!video) {
    await supabase
      .from("ingestion_job_items")
      .update({
        status: "failed",
        current_stage: "metadata",
        error_code: "EXTRACTION_FAILED",
        error_message: "Video record not found",
        completed_at: new Date().toISOString(),
      })
      .eq("id", item.id);
    return {
      success: false,
      stage: "metadata",
      errorCode: "EXTRACTION_FAILED",
      errorMessage: "Video record not found",
    };
  }

  // ─── Step 1: Metadata ──────────────────────────────────────────────────────
  let metadataSuccess = false;
  let metadataError: ProviderError | null = null;

  try {
    await supabase
      .from("videos")
      .update({ metadata_status: "fetching" })
      .eq("id", video.id);

    const isYt = video.platform === "youtube_shorts";
    const metadata = await withTimeout<ProviderMetadata>(
      async (signal) =>
        (isYt
          ? await fetchYouTubeMetadata(video.canonical_url, signal)
          : await fetchInstagramMetadata(video.canonical_url, signal)) as ProviderMetadata,
      MAX_METADATA_FETCH_MS
    );

    if (metadata) {
      if (metadata.error) {
        metadataError = classifyProviderError(new Error(metadata.error), "metadata");
      }

      const metadataUpdate: Record<string, unknown> = {
        metadata_status: metadata.error ? "partial" : "ready",
        metadata_json: { source: isYt ? "youtube_data_api" : "instagram_api", fetchedAt: new Date().toISOString() },
      };
      if (metadata.title !== null) metadataUpdate.title = metadata.title;
      if (metadata.description !== null) metadataUpdate.description = metadata.description;
      if (metadata.channelName !== null) metadataUpdate.creator_name = metadata.channelName;
      if (metadata.thumbnailUrl !== null) metadataUpdate.thumbnail_url = metadata.thumbnailUrl;
      if (metadata.durationSeconds !== null) metadataUpdate.duration_seconds = metadata.durationSeconds;
      if (metadata.publishedAt !== null) metadataUpdate.published_at = metadata.publishedAt;
      if (metadata.viewCount !== null) metadataUpdate.views = metadata.viewCount;
      if (metadata.likeCount !== null) metadataUpdate.likes = metadata.likeCount;
      if (metadata.commentCount !== null) metadataUpdate.comments_count = metadata.commentCount;
      const { error: saveMetadataError } = await supabase
        .from("videos")
        .update(metadataUpdate as never)
        .eq("id", video.id);
      if (saveMetadataError) throw saveMetadataError;

      metadataSuccess = !metadata.error;
    } else {
      metadataError = { code: "EXTRACTION_FAILED", message: "No metadata returned" };
    }
  } catch (err) {
    metadataError = classifyProviderError(err, "metadata");
  }

  if (metadataError) {
    await supabase
      .from("videos")
      .update({ metadata_status: "error" })
      .eq("id", video.id);
  }

  await supabase
    .from("ingestion_job_items")
    .update({ current_stage: "transcript" })
    .eq("id", item.id);

  // ─── Step 2: Transcript ────────────────────────────────────────────────────
  let transcriptError: ProviderError | null = null;

  try {
    await supabase
      .from("videos")
      .update({ transcript_status: "fetching" })
      .eq("id", video.id);

    const providerId = video.platform_video_id;

    if (video.platform === "youtube_shorts") {
      const transcriptResult = await withTimeout(
        () => fetchYouTubeTranscript(providerId),
        MAX_TRANSCRIPT_FETCH_MS
      );

      if (transcriptResult.status === "ready" && transcriptResult.transcript) {
        const { data: existingTranscript } = await supabase
          .from("transcripts")
          .select("id, source")
          .eq("video_id", video.id)
          .eq("language", transcriptResult.language ?? "en")
          .maybeSingle();
        if (existingTranscript?.source !== "manual") {
          const { error: saveTranscriptError } = await supabase.from("transcripts").upsert({
            video_id: video.id,
            language: transcriptResult.language ?? "en",
            transcript_text: transcriptResult.transcript,
            source: "youtube_auto",
            confidence: 0.8,
          }, { onConflict: "video_id,language" });
          if (saveTranscriptError) throw saveTranscriptError;
        }
        await supabase
          .from("videos")
          .update({ transcript_status: "ready" })
          .eq("id", video.id);
      } else {
        const { data: existingTranscript } = await supabase
          .from("transcripts")
          .select("id")
          .eq("video_id", video.id)
          .limit(1)
          .maybeSingle();
        transcriptError = {
          code: transcriptResult.status === "error" ? "EXTRACTION_FAILED" : "PROVIDER_UNAVAILABLE",
          message: transcriptResult.error ?? "Transcript unavailable",
        };
        await supabase
          .from("videos")
          .update({ transcript_status: existingTranscript ? "ready" : transcriptResult.status === "error" ? "error" : "unavailable" })
          .eq("id", video.id);
      }
    } else {
      // Instagram Reels: transcripts are not publicly available via API.
      // Mark as unavailable honestly rather than fabricating.
      transcriptError = {
        code: "PROVIDER_UNAVAILABLE",
        message: "Instagram Reels transcripts are not available via public API",
      };
      const { data: existingTranscript } = await supabase
        .from("transcripts")
        .select("id")
        .eq("video_id", video.id)
        .limit(1)
        .maybeSingle();
      await supabase
        .from("videos")
        .update({ transcript_status: existingTranscript ? "ready" : "unavailable" })
        .eq("id", video.id);
    }
  } catch (err) {
    transcriptError = classifyProviderError(err, "transcript");
    await supabase
      .from("videos")
      .update({ transcript_status: "error" })
      .eq("id", video.id);
  }

  // ─── Step 3: Finalize item status ──────────────────────────────────────────
  // The item is considered successful if metadata was retrieved (transcript
  // may be unavailable but that is not a failure — it is honest data).
  const itemSuccess = metadataSuccess;
  const finalError = itemSuccess ? null : metadataError ?? transcriptError;

  await supabase
    .from("ingestion_job_items")
    .update({
      status: itemSuccess ? "completed" : "failed",
      current_stage: itemSuccess ? "complete" : finalError?.code === "PROVIDER_TIMEOUT" ? "metadata" : "transcript",
      error_code: finalError?.code ?? null,
      error_message: finalError?.message ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", item.id);

  // Recompute the parent job's progress after each item
  if (item.jobId) {
    const { recomputeJobProgress } = await import("./server");
    await recomputeJobProgress(item.jobId);
  }

  return {
    success: itemSuccess,
    stage: itemSuccess ? "complete" : finalError?.code === "PROVIDER_TIMEOUT" ? "metadata" : "transcript",
    errorCode: finalError?.code,
    errorMessage: finalError?.message,
  };
}
