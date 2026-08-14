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
      return NextResponse.json({ error: "Invalid comparison ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: comparison, error } = await supabase
      .from("comparisons")
      .select("workspace_id, selected_video_ids, comparison_data")
      .eq("id", id)
      .single();

    if (error || !comparison) {
      return NextResponse.json({ error: "Comparison not found" }, { status: 404 });
    }

    await requireWorkspaceAccess(comparison.workspace_id, "editor");

    const videoIds = comparison.selected_video_ids ?? [];
    if (videoIds.length < 2) {
      return NextResponse.json({ error: "A comparison needs at least two videos" }, { status: 409 });
    }

    const previousData = (comparison.comparison_data ?? {}) as Record<string, unknown>;
    const { error: updateError } = await supabase
      .from("comparisons")
      .update({
        comparison_data: {
          ...previousData,
          status: "pending",
          aiError: null,
          generatedAt: null,
        } as never,
      })
      .eq("id", id);

    if (updateError) throw new Error(`Could not update comparison status: ${updateError.message}`);

    try {
      await inngest.send({
        name: "comparison/generate.requested",
        data: { comparisonId: id, workspaceId: comparison.workspace_id, videoIds },
      });
    } catch (sendError) {
      await supabase
        .from("comparisons")
        .update({
          comparison_data: {
            ...previousData,
            status: "error",
            aiError: "Could not start the comparison worker. Check the Inngest service and retry.",
          } as never,
        })
        .eq("id", id);
      throw sendError;
    }

    return NextResponse.json({ retried: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to retry comparison analysis");
  }
}
