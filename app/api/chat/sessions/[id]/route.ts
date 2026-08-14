import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renameChatSchema } from "@/lib/schemas";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsed = await parseJsonBody(request, renameChatSchema);
  if (parsed.response) return parsed.response;

  try {
    const user = await requireUser();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .select("workspace_id, user_id")
      .eq("id", id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Only the session owner can rename
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await requireWorkspaceAccess(session.workspace_id, "viewer");

    const { error: updateError } = await supabase
      .from("chat_sessions")
      .update({ title: parsed.data.title })
      .eq("id", id);

    if (updateError) throw new Error("Failed to rename session");

    return NextResponse.json({ renamed: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to rename session");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .select("workspace_id, user_id")
      .eq("id", id)
      .single();

    if (error || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await requireWorkspaceAccess(session.workspace_id, "editor");

    // Delete messages first (FK constraint may handle this, but be explicit)
    await supabase.from("chat_messages").delete().eq("session_id", id);
    await supabase.from("chat_sessions").delete().eq("id", id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to delete session");
  }
}
