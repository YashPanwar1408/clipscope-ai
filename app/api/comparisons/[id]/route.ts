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
      return NextResponse.json({ error: "Invalid comparison ID" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: comparison, error } = await supabase
      .from("comparisons")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !comparison) {
      return NextResponse.json({ error: "Comparison not found" }, { status: 404 });
    }

    await requireWorkspaceAccess(comparison.workspace_id, "viewer");

    return NextResponse.json({ comparison });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch comparison");
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
      return NextResponse.json({ error: "Invalid comparison ID" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: comparison, error } = await supabase
      .from("comparisons")
      .select("workspace_id")
      .eq("id", id)
      .single();

    if (error || !comparison) {
      return NextResponse.json({ error: "Comparison not found" }, { status: 404 });
    }

    await requireWorkspaceAccess(comparison.workspace_id, "editor");

    await supabase.from("comparisons").delete().eq("id", id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to delete comparison");
  }
}
