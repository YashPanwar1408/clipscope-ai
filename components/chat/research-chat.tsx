"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/status";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/utils";

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
}

interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations_json: Array<{ videoId: string; excerpt: string; relevance: number }> | null;
  created_at: string;
}

export function ResearchChat({
  initialSessions,
  initialMessages,
  selectedSessionId,
  workspaceId,
}: {
  initialSessions: ChatSession[];
  initialMessages: ChatMessageData[];
  selectedSessionId: string | null;
  workspaceId: string | null;
}) {
  const router = useRouter();
  const [sessions, setSessions] = React.useState(initialSessions);
  const [messages, setMessages] = React.useState<ChatMessageData[]>(initialMessages);
  const [selectedId, setSelectedId] = React.useState(selectedSessionId);
  const [input, setInput] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createSession = async () => {
    if (!workspaceId) return;
    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, title: "New conversation" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessions((prev) => [data.session, ...prev]);
      setSelectedId(data.session.id);
      setMessages([]);
      router.push(`/chat?session=${data.session.id}`);
    } catch {
      toast({ title: "Failed to create session", variant: "destructive" });
    }
  };

  const loadSession = async (id: string) => {
    setSelectedId(id);
    setLoadingMessages(true);
    router.push(`/chat?session=${id}`);
    try {
      const res = await fetch(`/api/chat/sessions/${id}/messages`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load conversation");
      setMessages(data.messages ?? []);
    } catch (error) {
      toast({
        title: "Could not load conversation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingMessages(false);
    }
  };

  const renameSession = async (id: string) => {
    const newTitle = window.prompt("New title:");
    if (!newTitle) return;
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to rename conversation");
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, title: newTitle } : s))
      );
    } catch (error) {
      toast({
        title: "Could not rename conversation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const deleteSession = async (id: string) => {
    if (!window.confirm("Delete this conversation?")) return;
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete conversation");
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setMessages([]);
        router.push("/chat");
      }
    } catch (error) {
      toast({
        title: "Could not delete conversation",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const sendMessage = async (messageOverride?: string, isRetry = false) => {
    const msg = (messageOverride ?? input).trim();
    if (!selectedId || !msg || sending) return;
    setInput("");
    setSending(true);
    if (!isRetry) {
      setMessages((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          role: "user",
          content: msg,
          citations_json: null,
          created_at: new Date().toISOString(),
        },
      ]);
    }

    try {
      const res = await fetch(`/api/chat/sessions/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId: selectedId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages((prev) => [
        ...prev,
        {
          id: `resp-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          citations_json: data.citations,
          created_at: new Date().toISOString(),
        },
      ]);

      // Update session title if it's the default
      setSessions((prev) =>
        prev.map((s) =>
          s.id === selectedId && s.title === "New conversation"
            ? { ...s, title: msg.slice(0, 50) }
            : s
        )
      );
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const retryLast = async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || !selectedId || sending) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      return last?.role === "assistant" ? prev.slice(0, -1) : prev;
    });
    await sendMessage(lastUser.content, true);
  };

  const copyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard access was denied by the browser.",
        variant: "destructive",
      });
    }
  };

  const selectedSession = sessions.find((s) => s.id === selectedId);

  return (
    <div className="flex h-[calc(100dvh-64px)] min-h-[480px] animate-fade-in">
      {/* Sidebar */}
      <aside className="hidden w-[272px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0b0d11] lg:flex">
        <div className="flex h-14 items-center justify-between border-b border-white/[0.07] px-4">
          <span className="text-xs font-medium text-zinc-400">Chat history</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={createSession}
            disabled={!workspaceId}
            aria-label="New conversation"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {sessions.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-zinc-500">
              No saved sessions.
            </p>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-1 rounded-lg px-2.5 py-2 ${
                  session.id === selectedId
                    ? "bg-white/[0.07] text-violet-100"
                    : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
                }`}
              >
                <button
                  onClick={() => loadSession(session.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-xs font-medium">{session.title}</p>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    {formatDateTime(session.updated_at)}
                  </p>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => renameSession(session.id)}>
                      <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteSession(session.id)}
                      className="text-red-400"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center justify-between border-b border-white/[0.07] px-4 sm:px-6">
          <span className="truncate text-sm font-medium text-zinc-200">
            {selectedSession?.title ?? "Research chat"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={createSession}
              className="lg:hidden"
              disabled={!workspaceId}
            >
              <Plus className="h-3.5 w-3.5" /> New
            </Button>
          </div>
        </div>
        {sessions.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-b border-white/[0.06] px-4 py-2 lg:hidden" aria-label="Conversation history">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => void loadSession(session.id)}
                aria-current={session.id === selectedId ? "page" : undefined}
                className={`max-w-[200px] shrink-0 truncate rounded-lg border px-3 py-1.5 text-xs transition-colors ${session.id === selectedId ? "border-violet-200/20 bg-violet-200/[0.08] text-violet-100" : "border-white/[0.07] text-zinc-500 hover:text-zinc-200"}`}
              >
                {session.title}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title={selectedSession ? "Start the conversation" : "Select or create a conversation"}
              description={
                selectedSession
                  ? "Ask a question about the videos in this workspace. Answers are grounded in retrieved transcripts and metadata."
                  : "Create a new conversation to start researching your video content."
              }
            />
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-4 py-3 ${
                      msg.role === "user"
                        ? "border border-violet-200/10 bg-violet-200/[0.08] text-violet-50"
                        : "border border-white/[0.065] bg-[#11141a] text-zinc-200"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {msg.content}
                    </p>
                    {msg.role === "assistant" && msg.citations_json && msg.citations_json.length > 0 && (
                      <div className="mt-3 border-t border-zinc-800 pt-3">
                        <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                          Sources
                        </p>
                        <div className="mt-1.5 space-y-1">
                          {msg.citations_json.map((c, i) => (
                            <Link
                              key={i}
                              href={`/library/${c.videoId}`}
                              className="block truncate text-xs text-zinc-400 hover:text-violet-300"
                              title={c.excerpt}
                            >
                              [{i + 1}] {c.excerpt.slice(0, 80)}…
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => copyMessage(msg.content)}
                        aria-label="Copy"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-lg bg-zinc-900 px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-white/[0.07] bg-[#090b0f]/80 p-3 sm:p-4">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-end gap-2 rounded-xl border border-white/[0.09] bg-[#101217] px-3 py-2 shadow-[0_8px_28px_rgba(0,0,0,.2)] focus-within:border-violet-200/25">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={selectedSession ? "Ask about your videos..." : "Select a conversation first"}
                className="min-h-5 max-h-[120px] flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
                rows={1}
                disabled={!selectedSession || sending}
              />
              <Button size="sm" onClick={() => void sendMessage()} disabled={!selectedSession || !input.trim() || sending}>
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {messages.length > 0 && (
              <div className="mt-2 flex justify-between">
                <p className="text-xs text-zinc-600">
                  Answers are grounded in workspace transcripts and metadata.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void retryLast()}
                  disabled={sending}
                  className="text-xs"
                >
                  Retry last
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
