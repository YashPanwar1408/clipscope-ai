import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/status";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace/server";
import { requireWorkspaceAccess } from "@/lib/auth/server";

export const metadata: Metadata = { title: "AI Insights" };

export default async function InsightsPage() {
  const workspaceId = await getActiveWorkspaceId();

  let videos: {
    id: string;
    title: string | null;
    platform: string;
    creator_name: string | null;
    analysis: {
      hook_summary: string | null;
      content_theme: string | null;
      content_strengths: string[] | null;
      content_weaknesses: string[] | null;
      created_at: string;
    } | null;
  }[] = [];

  if (workspaceId) {
    await requireWorkspaceAccess(workspaceId, "viewer");
    const supabase = await createClient();
    const { data } = await supabase
      .from("videos")
      .select(
        "id, title, platform, creator_name, analysis:video_analyses(hook_summary, content_theme, content_strengths, content_weaknesses, created_at)"
      )
      .eq("workspace_id", workspaceId)
      .eq("analysis_status", "ready")
      .order("created_at", { ascending: false });

    // Supabase returns nested relations as arrays, so we need to extract the first item
    videos = (data ?? []).map((v: { analysis?: { hook_summary: string | null; content_theme: string | null; content_strengths: string[] | null; content_weaknesses: string[] | null; created_at: string }[] | null }) => ({
      ...v,
      analysis: v.analysis?.[0] ?? null,
    })) as typeof videos;
  }

  return (
    <div className="space-y-6 p-4 animate-fade-in sm:p-6 xl:p-8">
      <PageHeader
        eyebrow="Evidence-based observations"
        title="AI insights"
        description="Hook, theme, and storytelling observations from analyzed videos in your workspace."
      />

      <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.045] px-4 py-3 text-sm leading-6 text-amber-200/90">
        <strong>Note:</strong> AI insights are generated only from retrieved transcripts and
        available metadata. Videos without transcripts will produce partial or no insights.
      </div>

      {videos.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="No insights generated yet"
          description="Import videos and ensure transcripts are available. Then run an analysis to see hook patterns, storytelling structure, and narrative observations."
          action={
            <Link className="text-violet-400 hover:text-violet-300" href="/library">
              Go to Video Library
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,32rem),1fr))] gap-4">
          {videos.map((video) => (
            <Card key={video.id} className="min-w-0 transition-colors hover:border-white/[0.12]">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/library/${video.id}`}
                    className="line-clamp-2 text-base font-medium leading-snug text-zinc-100 hover:text-violet-300"
                  >
                    {video.title ?? "Untitled"}
                  </Link>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {video.platform === "youtube_shorts" ? "YT" : "IG"}
                  </Badge>
                </div>
                {video.analysis?.hook_summary && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">Hook</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-300">
                      {video.analysis.hook_summary}
                    </p>
                  </div>
                )}
                {video.analysis?.content_theme && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">Theme</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-300">
                      {video.analysis.content_theme}
                    </p>
                  </div>
                )}
                {video.analysis?.content_strengths &&
                  video.analysis.content_strengths.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-zinc-500">Strengths</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-5 text-emerald-400">
                        {video.analysis.content_strengths.slice(0, 3).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                {video.analysis?.content_weaknesses &&
                  video.analysis.content_weaknesses.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-zinc-500">Weaknesses</p>
                      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-5 text-amber-400">
                        {video.analysis.content_weaknesses.slice(0, 3).map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
