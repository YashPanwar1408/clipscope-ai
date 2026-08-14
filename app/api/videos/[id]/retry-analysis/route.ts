import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { inngest } from "@/lib/inngest/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: video, error } = await supabase
      .from("videos")
      .select("workspace_id, transcript_status, title, description, views, likes, comments_count")
      .eq("id", id)
      .single();

    if (error || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    await requireWorkspaceAccess(video.workspace_id, "editor");

    // Metadata supports a limited analysis when the provider has no transcript.
    const hasMetrics = video.views !== null || video.likes !== null || video.comments_count !== null;
    if (video.transcript_status !== "ready" && !video.title && !video.description && !hasMetrics) {
      return NextResponse.json(
        { error: "Add a transcript or refresh the video metadata before analysis can run" },
        { status: 409 }
      );
    }

    // Keep the last successful analysis visible while a fresh one is generated.
    const { error: statusError } = await supabase
      .from("videos")
      .update({ analysis_status: "pending" })
      .eq("id", id);
    if (statusError) throw new Error("Could not update the analysis status");

    // Trigger the analysis workflow
    try {
      await inngest.send({
        name: "video/analysis.requested",
        data: { videoId: id, workspaceId: video.workspace_id, force: true },
      });
    } catch (sendError) {
      await supabase.from("videos").update({ analysis_status: "error" }).eq("id", id);
      throw sendError;
    }

    return NextResponse.json({ retried: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to retry analysis");
  }
}
