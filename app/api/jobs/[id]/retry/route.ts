import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";
import {
  createIngestionOutboxEvent,
  dispatchOutboxEvent,
} from "@/lib/ingestion/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: job, error: jobError } = await supabase
      .from("ingestion_jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    await requireWorkspaceAccess(job.workspace_id, "editor");

    // Only allow retry on terminal failed/partial states
    if (!["failed", "partial", "cancelled"].includes(job.status)) {
      return NextResponse.json(
        { error: "Only failed, partial, or cancelled jobs can be retried" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();

    // Reset failed items to queued
    const { error: itemsError } = await supabase
      .from("ingestion_job_items")
      .update({
        status: "queued",
        current_stage: "queued",
        error_code: null,
        error_message: null,
        started_at: null,
        completed_at: null,
      })
      .eq("job_id", id)
      .in("status", ["failed", "cancelled", "skipped"]);

    if (itemsError) throw new Error("Failed to reset ingestion job items");

    // Claim the retry before dispatching so concurrent requests cannot enqueue
    // duplicate retries for the same terminal job.
    const { data: updatedJob, error: jobUpdateError } = await supabase
      .from("ingestion_jobs")
      .update({
        status: "queued",
        current_stage: "queued",
        attempt_count: job.attempt_count + 1,
        last_error_code: null,
        last_error_message: null,
        started_at: null,
        completed_at: null,
        progress_pct: 0,
        updated_at: now,
      })
      .eq("id", id)
      .in("status", ["failed", "partial", "cancelled"])
      .select("id")
      .maybeSingle();

    if (jobUpdateError) throw new Error("Failed to reset ingestion job");
    if (!updatedJob) {
      return NextResponse.json(
        { error: "This job has already been retried" },
        { status: 409 }
      );
    }

    // Create a fresh outbox event for the retry
    const outboxId = await createIngestionOutboxEvent(
      job.workspace_id,
      id,
      user.id,
      `${id}-retry-${job.attempt_count + 1}`
    );
    await dispatchOutboxEvent(outboxId);

    return NextResponse.json({ jobId: id, retried: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to retry job");
  }
}
