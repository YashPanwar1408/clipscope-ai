import type { Metadata } from "next";
import { ResearchChat } from "@/components/chat/research-chat";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId, listWorkspaceChatSessions } from "@/lib/workspace/server";
import { requireUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Research Chat" };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  await requireUser();
  const [{ session: selectedId }, workspaceId] = await Promise.all([
    searchParams,
    getActiveWorkspaceId(),
  ]);

  const sessions = workspaceId ? await listWorkspaceChatSessions(workspaceId) : [];

  // Load messages for the selected session
  let messages: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    citations_json: unknown;
    created_at: string;
  }> = [];

  if (selectedId && workspaceId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", selectedId)
      .order("created_at", { ascending: true });
    messages = data ?? [];
  }

  return (
    <div className="h-full">
    <ResearchChat
      initialSessions={sessions.map((s) => ({
        id: s.id,
        title: s.title,
        updated_at: s.updatedAt,
      }))}
      initialMessages={messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations_json: m.citations_json as Array<{ videoId: string; excerpt: string; relevance: number }> | null,
        created_at: m.created_at,
      }))}
      selectedSessionId={selectedId ?? null}
      workspaceId={workspaceId}
    />
    </div>
  );
}
