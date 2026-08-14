import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatMessageSchema } from "@/lib/schemas";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { generateGroundedAnswer } from "@/lib/chat/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("workspace_id")
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await requireWorkspaceAccess(session.workspace_id, "viewer");

    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", id)
      .order("created_at", { ascending: true });

    if (error) throw new Error("Failed to fetch messages");

    return NextResponse.json({ messages: messages ?? [] });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch messages");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsed = await parseJsonBody(request, chatMessageSchema);
  if (parsed.response) return parsed.response;

  try {
    const user = await requireUser();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .select("workspace_id, user_id")
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await requireWorkspaceAccess(session.workspace_id, "editor");

    const { message } = parsed.data;

    // Persist the user message
    const { error: userMessageError } = await supabase.from("chat_messages").insert({
      session_id: id,
      role: "user",
      content: message,
    });
    if (userMessageError) throw new Error(`Could not save your message: ${userMessageError.message}`);

    // Generate grounded answer
    const { answer, hasSufficientEvidence, citations } = await generateGroundedAnswer(
      session.workspace_id,
      message
    );

    // Persist the assistant response with citations
    const { error: assistantMessageError } = await supabase.from("chat_messages").insert({
      session_id: id,
      role: "assistant",
      content: answer,
      citations_json: citations as never,
    });
    if (assistantMessageError) throw new Error(`Could not save the research answer: ${assistantMessageError.message}`);

    // Update session timestamp
    const { error: sessionUpdateError } = await supabase
      .from("chat_sessions")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);
    if (sessionUpdateError) throw new Error(`Could not update the conversation: ${sessionUpdateError.message}`);

    return NextResponse.json({
      answer,
      hasSufficientEvidence,
      citations,
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to send message");
  }
}
