import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceIdSchema } from "@/lib/schemas";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const workspaceId = workspaceIdSchema.safeParse(body.workspaceId);
    if (!workspaceId.success) {
      return NextResponse.json({ error: "A valid workspaceId is required" }, { status: 400 });
    }

    await requireWorkspaceAccess(workspaceId.data, "editor");

    const supabase = await createClient();
    const title = (body.title as string | undefined)?.trim() || "New conversation";

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .insert({
        workspace_id: workspaceId.data,
        user_id: user.id,
        title: title.slice(0, 120),
      })
      .select("*")
      .single();

    if (error || !session) throw new Error("Failed to create chat session");

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Failed to create chat session");
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

    const { data: sessions, error } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("workspace_id", parsedId.data)
      .order("updated_at", { ascending: false });

    if (error) throw new Error("Failed to fetch chat sessions");

    return NextResponse.json({ sessions: sessions ?? [] });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch chat sessions");
  }
}
