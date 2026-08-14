import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { detectProvider, extractVideoId } from "@/lib/utils";
import type { Database } from "@/lib/types/database";
import type { JobStatus } from "@/lib/types/database";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NormalizedVideo {
  url: string;
  canonicalUrl: string;
  provider: "youtube_shorts" | "instagram_reels";
  providerId: string;
}

export interface CreateIngestionJobResult {
  jobId: string;
  videoIds: string[];
  skippedUrls: string[];
  created: boolean;
  outboxId?: string;
}

// ─── URL normalization ────────────────────────────────────────────────────────

export function normalizeVideoUrl(rawUrl: string): NormalizedVideo | null {
  const provider = detectProvider(rawUrl);
  const providerId = extractVideoId(rawUrl);
  if (!provider || !providerId) return null;

  const canonicalUrl =
    provider === "youtube_shorts"
      ? `https://www.youtube.com/shorts/${providerId}`
      : `https://www.instagram.com/reel/${providerId}/`;

  return { url: rawUrl, canonicalUrl, provider, providerId };
}

// ─── Job creation (batch, idempotent, with outbox) ───────────────────────────

/**
 * Creates videos, an ingestion job, job items, and a server-owned outbox event.
 *
 * Idempotency:
 *  - If an idempotencyKey is provided and a job with that key exists in the
 *    workspace, the existing job is returned without creating duplicates.
 *  - Duplicate videos within the same workspace (by platform + provider_id) are
 *    skipped and reported via `skippedUrls`.
 *
 * Outbox:
 *  - An outbox event is persisted after the job records are created.
 *  - The caller is responsible for dispatching it (best-effort) right after;
 *    the reconciliation function picks up any unsent outbox events.
 */
export async function createIngestionJob(
  workspaceId: string,
  userId: string,
  rawUrls: string[],
  idempotencyKey?: string
): Promise<CreateIngestionJobResult> {
  const supabase = await createClient();

  // Idempotency short-circuit
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("ingestion_jobs")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existing) {
      const { data: items } = await supabase
        .from("ingestion_job_items")
        .select("video_id")
        .eq("job_id", existing.id);
      return {
        jobId: existing.id,
        videoIds: (items ?? []).map((i) => i.video_id).filter((v): v is string => v !== null),
        skippedUrls: [],
        created: false,
      };
    }
  }

  const normalized = rawUrls
    .map(normalizeVideoUrl)
    .filter((v): v is NormalizedVideo => v !== null);

  if (normalized.length === 0) {
    throw new Error("No supported video URLs provided");
  }

  // Deduplicate within the request by canonical URL
  const uniqueByCanonical = new Map<string, NormalizedVideo>();
  for (const v of normalized) uniqueByCanonical.set(v.canonicalUrl, v);
  const uniqueVideos = Array.from(uniqueByCanonical.values());

  // Find existing videos in the workspace (duplicates)
  const existingChecks = await Promise.all(
    uniqueVideos.map((v) =>
      supabase
        .from("videos")
        .select("id, platform_video_id")
        .eq("workspace_id", workspaceId)
        .eq("platform", v.provider)
        .eq("platform_video_id", v.providerId)
        .maybeSingle()
    )
  );

  const toCreate: NormalizedVideo[] = [];
  const skippedUrls: string[] = [];
  for (let i = 0; i < uniqueVideos.length; i++) {
    if (existingChecks[i].data) {
      skippedUrls.push(uniqueVideos[i].url);
    } else {
      toCreate.push(uniqueVideos[i]);
    }
  }

  // If every URL is a duplicate, there is nothing to do.
  if (toCreate.length === 0) {
    throw new Error("All provided videos already exist in this workspace");
  }

  // Insert video records
  const { data: insertedVideos, error: videoError } = await supabase
    .from("videos")
    .insert(
      toCreate.map((v) => ({
        workspace_id: workspaceId,
        platform: v.provider,
        canonical_url: v.canonicalUrl,
        platform_video_id: v.providerId,
        metadata_status: "pending",
        transcript_status: "pending",
        analysis_status: "none",
      }))
    )
    .select("id, canonical_url");

  if (videoError || !insertedVideos) {
    throw new Error("Failed to persist video records");
  }

  const videoIds = insertedVideos.map((v) => v.id);

  // Create the ingestion job
  const { data: job, error: jobError } = await supabase
    .from("ingestion_jobs")
    .insert({
      workspace_id: workspaceId,
      requested_by: userId,
      status: "queued",
      total_videos: videoIds.length,
      processed_videos: 0,
      failed_videos: 0,
      progress_pct: 0,
      current_stage: "queued",
      idempotency_key: idempotencyKey ?? null,
    })
    .select("id")
    .single();

  if (jobError || !job) {
    // Roll back videos
    await supabase.from("videos").delete().in("id", videoIds);
    throw new Error("Failed to create the ingestion job");
  }

  // Create job items
  const { error: itemError } = await supabase.from("ingestion_job_items").insert(
    videoIds.map((videoId) => ({
      job_id: job.id,
      video_id: videoId,
      status: "queued",
      current_stage: "queued",
    }))
  );

  if (itemError) {
    await supabase.from("ingestion_jobs").delete().eq("id", job.id);
    await supabase.from("videos").delete().in("id", videoIds);
    throw new Error("Failed to create ingestion job items");
  }

  // Outbox events are server-only. Workspace authorization is checked by the
  // calling route before this helper is used.
  let outboxId: string;
  try {
    outboxId = await createIngestionOutboxEvent(workspaceId, job.id, userId);
  } catch {
    await supabase.from("ingestion_job_items").delete().eq("job_id", job.id);
    await supabase.from("ingestion_jobs").delete().eq("id", job.id);
    await supabase.from("videos").delete().in("id", videoIds);
    throw new Error("Failed to create outbox event");
  }

  return { jobId: job.id, videoIds, skippedUrls, created: true, outboxId };
}

/** Creates a server-only ingestion event after the caller authorizes the workspace. */
export async function createIngestionOutboxEvent(
  workspaceId: string,
  jobId: string,
  userId: string,
  eventKey = jobId
): Promise<string> {
  const supabase = createAdminClient();
  const payload = {
    jobId,
    workspaceId,
    userId,
  };

  const { data, error } = await supabase
    .from("outbox_events")
    .insert({
      workspace_id: workspaceId,
      event_name: "job/ingest.requested",
      event_key: eventKey,
      payload: payload as unknown as Database["public"]["Tables"]["outbox_events"]["Insert"]["payload"],
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create outbox event${error ? `: ${error.message}` : ""}`);
  }

  return data.id;
}

// ─── Outbox dispatch ──────────────────────────────────────────────────────────

/**
 * Dispatches a pending outbox event to Inngest and marks it as sent.
 * Returns true if dispatched successfully.
 */
export async function dispatchOutboxEvent(outboxId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: event } = await supabase
    .from("outbox_events")
    .select("*")
    .eq("id", outboxId)
    .eq("status", "pending")
    .maybeSingle();

  if (!event) return false;

  try {
    await inngest.send({
      name: event.event_name,
      data: event.payload as Record<string, unknown>,
    });

    await supabase
      .from("outbox_events")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", outboxId);

    return true;
  } catch (err) {
    await supabase
      .from("outbox_events")
      .update({
        attempts: event.attempts + 1,
        last_error: err instanceof Error ? err.message : "Unknown dispatch error",
        status: event.attempts + 1 >= 10 ? "dead" : "pending",
      })
      .eq("id", outboxId);
    return false;
  }
}

/**
 * Reconciliation: finds pending outbox events and dispatches them.
 * Also finds stale jobs (pending/queued for > 60s) and re-triggers them.
 * Safe to call from a cron or from the request path.
 */
export async function reconcileOutboxAndStaleJobs(): Promise<{
  dispatched: number;
  requeuedJobs: number;
  recoveredJobs: number;
}> {
  const supabase = createAdminClient();

  // 1. Dispatch pending outbox events (limit 50 per run)
  const { data: pendingOutbox } = await supabase
    .from("outbox_events")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  let dispatched = 0;
  for (const event of pendingOutbox ?? []) {
    if (await dispatchOutboxEvent(event.id)) dispatched++;
  }

  // 2. Find stale jobs that never started (queued for > 60s with no outbox sent)
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  const { data: staleJobs } = await supabase
    .from("ingestion_jobs")
    .select("id, workspace_id, requested_by")
    .in("status", ["queued", "pending"])
    .lt("created_at", cutoff)
    .is("started_at", null);

  let requeuedJobs = 0;
  for (const job of staleJobs ?? []) {
    // Check if there's already a pending outbox for this job
    const { data: existingOutbox } = await supabase
      .from("outbox_events")
      .select("id")
      .eq("event_key", job.id)
      .in("status", ["pending", "sent"])
      .maybeSingle();

    if (existingOutbox) continue;

    // Create a fresh outbox event for this stale job
    await supabase.from("outbox_events").insert({
      workspace_id: job.workspace_id,
      event_name: "job/ingest.requested",
      event_key: job.id,
      payload: {
        jobId: job.id,
        workspaceId: job.workspace_id,
        userId: job.requested_by,
      } as unknown as Database["public"]["Tables"]["outbox_events"]["Insert"]["payload"],
    });
    requeuedJobs++;
  }

  // A worker can exit without finalizing a job (for example, after a failed
  // database operation). Make those jobs retryable instead of leaving them
  // in "running" forever. Item processing has bounded provider timeouts, so
  // three minutes is well beyond a healthy single attempt.
  const runningCutoff = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data: staleRunningJobs } = await supabase
    .from("ingestion_jobs")
    .select("id, started_at")
    .in("status", ["running", "retrying"])
    .lt("started_at", runningCutoff);

  let recoveredJobs = 0;
  for (const job of staleRunningJobs ?? []) {
    // This finalizes jobs whose items actually finished but whose parent
    // progress update failed. Jobs with unfinished items remain non-terminal.
    await recomputeJobProgress(job.id);

    const { data: currentJob } = await supabase
      .from("ingestion_jobs")
      .select("status")
      .eq("id", job.id)
      .maybeSingle();

    if (!currentJob || !["running", "retrying"].includes(currentJob.status)) {
      continue;
    }

    const { data: recovered } = await supabase
      .from("ingestion_jobs")
      .update({
        status: "failed",
        current_stage: "stalled",
        last_error_code: "PROCESSING_STALLED",
        last_error_message:
          "Processing stopped before the job finished. Retry this job to continue.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("started_at", job.started_at)
      .in("status", ["running", "retrying"])
      .lt("started_at", runningCutoff)
      .select("id")
      .maybeSingle();

    if (recovered) recoveredJobs++;
  }

  return { dispatched, requeuedJobs, recoveredJobs };
}

// ─── Job state transitions ────────────────────────────────────────────────────

export const TERMINAL_JOB_STATUSES: JobStatus[] = [
  "completed",
  "partial",
  "failed",
  "cancelled",
];

export function isTerminalJobStatus(status: string): boolean {
  return (TERMINAL_JOB_STATUSES as string[]).includes(status);
}

/**
 * Recomputes job progress and terminal status from its items.
 * Uses the SQL function `compute_job_progress` for atomicity.
 */
export async function recomputeJobProgress(jobId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("compute_job_progress", { job_id: jobId });
  if (error) {
    throw new Error(`Failed to update ingestion job progress: ${error.message}`);
  }
}
