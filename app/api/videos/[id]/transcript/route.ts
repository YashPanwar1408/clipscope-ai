import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { manualTranscriptSchema } from "@/lib/schemas";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsed = await parseJsonBody(request, manualTranscriptSchema);
  if (parsed.response) return parsed.response;

  try {
    await requireUser();
    const { id } = await params;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("id, workspace_id")
      .eq("id", id)
      .single();

    if (videoError || !video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    await requireWorkspaceAccess(video.workspace_id, "editor");

    const { transcriptText, language } = parsed.data;

    // Insert the manual transcript
    const { data: transcript, error: insertError } = await supabase
      .from("transcripts")
      .upsert({
        video_id: id,
        language,
        transcript_text: transcriptText,
        source: "manual",
        confidence: 1.0,
      }, { onConflict: "video_id,language" })
      .select("id")
      .single();

    if (insertError || !transcript) {
      throw new Error("Failed to save transcript");
    }

    const { error: deleteAnalysisError } = await supabase.from("video_analyses").delete().eq("video_id", id);
    if (deleteAnalysisError) throw new Error("Transcript saved, but existing analysis could not be cleared");

    const { error: statusError } = await supabase
      .from("videos")
      .update({ transcript_status: "ready", analysis_status: "pending" })
      .eq("id", id);
    if (statusError) throw new Error("Transcript saved, but video status could not be updated");

    // Trigger AI analysis since we now have a transcript
    const { inngest } = await import("@/lib/inngest/client");
    await inngest.send({
      name: "video/analysis.requested",
      data: { videoId: id, workspaceId: video.workspace_id },
    });

    return NextResponse.json({ transcriptId: transcript.id }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Failed to save transcript");
  }
}
