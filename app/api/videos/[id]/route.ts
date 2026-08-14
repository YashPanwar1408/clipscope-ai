import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
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
      .select("*")
      .eq("id", id)
      .single();

    if (error || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    await requireWorkspaceAccess(video.workspace_id, "viewer");

    // Load transcript and analysis
    const [{ data: transcript }, { data: analysis }] = await Promise.all([
      supabase
        .from("transcripts")
        .select("*")
        .eq("video_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("video_analyses")
        .select("*")
        .eq("video_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return NextResponse.json({ video, transcript, analysis });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch video");
  }
}

export async function DELETE(
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
      .select("workspace_id")
      .eq("id", id)
      .single();

    if (error || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    await requireWorkspaceAccess(video.workspace_id, "editor");

    // Delete related records (transcripts, analyses) then the video
    await supabase.from("transcripts").delete().eq("video_id", id);
    await supabase.from("video_analyses").delete().eq("video_id", id);
    await supabase.from("videos").delete().eq("id", id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to delete video");
  }
}
