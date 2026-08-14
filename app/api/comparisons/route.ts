import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createComparisonSchema, workspaceIdSchema } from "@/lib/schemas";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createComparisonSchema);
  if (parsed.response) return parsed.response;

  try {
    const user = await requireUser();
    const { workspaceId, videoIds, title } = parsed.data;

    await requireWorkspaceAccess(workspaceId, "editor");

    const supabase = await createClient();

    // Verify all videos belong to the workspace
    const { data: videos, error: videoError } = await supabase
      .from("videos")
      .select("id")
      .eq("workspace_id", workspaceId)
      .in("id", videoIds);

    if (videoError) throw new Error("Failed to verify videos");
    if (!videos || videos.length !== videoIds.length) {
      return NextResponse.json(
        { error: "One or more videos do not belong to this workspace" },
        { status: 400 }
      );
    }

    // Create the comparison record
    const { data: comparison, error: comparisonError } = await supabase
      .from("comparisons")
      .insert({
        workspace_id: workspaceId,
        title: title.trim(),
        selected_video_ids: videoIds,
        created_by: user.id,
        comparison_data: { status: "pending", videos: [], generatedAt: null },
      })
      .select("id")
      .single();

    if (comparisonError || !comparison) {
      throw new Error("Failed to create comparison");
    }

    // Trigger the comparison generation workflow
    try {
      await inngest.send({
        name: "comparison/generate.requested",
        data: {
          comparisonId: comparison.id,
          workspaceId,
          videoIds,
        },
      });
    } catch (error) {
      await supabase
        .from("comparisons")
        .update({
          comparison_data: {
            status: "error",
            videos: [],
            generatedAt: new Date().toISOString(),
            aiError: "Could not start the comparison worker. Check that Inngest is running, then retry analysis.",
          } as never,
        })
        .eq("id", comparison.id);
      throw error;
    }

    return NextResponse.json(
      { comparisonId: comparison.id, title },
      { status: 201 }
    );
  } catch (error) {
    return apiErrorResponse(error, "Failed to create comparison");
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const workspaceId = request.nextUrl.searchParams.get("workspaceId");
    const parsedId = workspaceIdSchema.safeParse(workspaceId);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: "A valid workspaceId is required" },
        { status: 400 }
      );
    }

    await requireWorkspaceAccess(parsedId.data, "viewer");
    const supabase = await createClient();

    const { data: comparisons, error } = await supabase
      .from("comparisons")
      .select("*")
      .eq("workspace_id", parsedId.data)
      .order("created_at", { ascending: false });

    if (error) throw new Error("Failed to fetch comparisons");

    return NextResponse.json({ comparisons: comparisons ?? [] });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch comparisons");
  }
}
