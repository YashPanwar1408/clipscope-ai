import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { fetchInstagramMetadata, fetchYouTubeMetadata, fetchYouTubeTranscript } from "@/lib/adapters";
import { inngest } from "@/lib/inngest/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;
    if (!UUID_RE.test(id)) return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });

    const supabase = await createClient();
    const { data: video, error: videoError } = await supabase
      .from("videos")
      .select("id, workspace_id, platform, canonical_url, platform_video_id, title, description")
      .eq("id", id)
      .single();
    if (videoError || !video) return NextResponse.json({ error: "Video not found" }, { status: 404 });
    await requireWorkspaceAccess(video.workspace_id, "editor");

    const isYoutube = video.platform === "youtube_shorts";
    const metadata = isYoutube
      ? await fetchYouTubeMetadata(video.canonical_url)
      : await fetchInstagramMetadata(video.canonical_url);
    if (!metadata) return NextResponse.json({ error: "Could not read this video URL" }, { status: 422 });

    const update: Record<string, unknown> = {
      metadata_status: metadata.error ? "partial" : "ready",
      metadata_json: {
        source: isYoutube ? "youtube_data_api" : "instagram_api",
        fetchedAt: new Date().toISOString(),
      },
    };
    if (metadata.title !== null) update.title = metadata.title;
    if (metadata.description !== null) update.description = metadata.description;
    if (metadata.channelName !== null) update.creator_name = metadata.channelName;
    if (metadata.thumbnailUrl !== null) update.thumbnail_url = metadata.thumbnailUrl;
    if (metadata.durationSeconds !== null) update.duration_seconds = metadata.durationSeconds;
    if (metadata.publishedAt !== null) update.published_at = metadata.publishedAt;
    if (metadata.viewCount !== null) update.views = metadata.viewCount;
    if (metadata.likeCount !== null) update.likes = metadata.likeCount;
    if (metadata.commentCount !== null) update.comments_count = metadata.commentCount;
    const { error: updateError } = await supabase.from("videos").update(update as never).eq("id", id);
    if (updateError) throw updateError;

    let transcriptStatus: "ready" | "unavailable" | "error" | null = null;
    let transcriptWarning: string | null = null;
    if (isYoutube) {
      const transcriptResult = await fetchYouTubeTranscript(video.platform_video_id);
      if (transcriptResult.status === "ready" && transcriptResult.transcript) {
        const language = transcriptResult.language ?? "en";
        const { data: savedTranscript } = await supabase
          .from("transcripts")
          .select("id, source")
          .eq("video_id", id)
          .eq("language", language)
          .maybeSingle();
        if (savedTranscript?.source !== "manual") {
          const { error: transcriptError } = await supabase.from("transcripts").upsert({
            video_id: id,
            language,
            transcript_text: transcriptResult.transcript,
            source: "youtube_auto",
            confidence: 0.8,
          }, { onConflict: "video_id,language" });
          if (transcriptError) throw transcriptError;
        }
        transcriptStatus = "ready";
      } else {
        const { data: savedTranscript } = await supabase
          .from("transcripts")
          .select("id")
          .eq("video_id", id)
          .limit(1)
          .maybeSingle();
        transcriptStatus = savedTranscript ? "ready" : transcriptResult.status;
        transcriptWarning = transcriptResult.error;
      }
      if (transcriptStatus) {
        const { error: statusError } = await supabase
          .from("videos")
          .update({ transcript_status: transcriptStatus })
          .eq("id", id);
        if (statusError) throw statusError;
      }
    }

    const hasAnalysisEvidence = Boolean(metadata.title || metadata.description || video.title || video.description);
    if (hasAnalysisEvidence) {
      const { error: deleteError } = await supabase.from("video_analyses").delete().eq("video_id", id);
      if (deleteError) throw deleteError;
      const { error: statusError } = await supabase.from("videos").update({ analysis_status: "pending" }).eq("id", id);
      if (statusError) throw statusError;
      await inngest.send({
        name: "video/analysis.requested",
        data: { videoId: id, workspaceId: video.workspace_id },
      });
    }

    return NextResponse.json({
      metadataStatus: metadata.error ? "partial" : "ready",
      transcriptStatus,
      analysisQueued: hasAnalysisEvidence,
      metadataWarning: metadata.error,
      transcriptWarning,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to refresh video data");
  }
}
