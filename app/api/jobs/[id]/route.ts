import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { isTerminalJobStatus } from "@/lib/ingestion/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
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

    await requireWorkspaceAccess(job.workspace_id, "viewer");

    // The authenticated request has been checked against this workspace;
    // use the server client for worker-owned item and video rows.
    const adminSupabase = createAdminClient();
    const { data: jobItems, error: itemsError } = await adminSupabase
      .from("ingestion_job_items")
      .select("*")
      .eq("job_id", id)
      .order("id", { ascending: true });

    if (itemsError) {
      return NextResponse.json({ error: "Failed to load ingestion job items" }, { status: 500 });
    }

    const videoIds = (jobItems ?? [])
      .map((item) => item.video_id)
      .filter((videoId): videoId is string => Boolean(videoId));
    const { data: videos, error: videosError } = videoIds.length
      ? await adminSupabase
          .from("videos")
          .select("id, title, canonical_url, platform, platform_video_id")
          .in("id", videoIds)
      : { data: [], error: null };

    if (videosError) {
      return NextResponse.json({ error: "Failed to load videos for this job" }, { status: 500 });
    }

    const videosById = new Map((videos ?? []).map((video) => [video.id, video]));
    const items = (jobItems ?? []).map((item) => ({
      ...item,
      videos: item.video_id ? videosById.get(item.video_id) ?? null : null,
    }));

    return NextResponse.json({
      job,
      items,
      terminal: isTerminalJobStatus(job.status),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch job");
  }
}
