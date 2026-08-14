import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock3, Eye, Heart, MessageCircle, Subtitles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ComparisonRefreshPoller } from "@/components/compare/comparison-refresh-poller";
import { ComparisonRetryButton } from "@/components/compare/comparison-retry-button";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceAccess } from "@/lib/auth/server";
import { formatDuration, formatNumber, relativeTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Comparison" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ComparisonVideo = Record<string, unknown> & { id?: string };
type ComparisonAnalysis = Record<string, unknown> & {
  strengths?: Array<{ videoId?: string; points?: string[] }>;
  weaknesses?: Array<{ videoId?: string; points?: string[] }>;
  recommendations?: string[];
};

export default async function ComparisonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: comparison, error } = await supabase
    .from("comparisons")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !comparison) notFound();
  await requireWorkspaceAccess(comparison.workspace_id, "viewer");

  const comparisonData = (comparison.comparison_data ?? {}) as Record<string, unknown>;
  const videos = (Array.isArray(comparisonData.videos) ? comparisonData.videos : []) as ComparisonVideo[];
  const aiAnalysis = comparisonData.aiAnalysis as ComparisonAnalysis | null;
  const savedStatus = comparisonData.status;
  const hasCompletedPayload = Boolean(comparisonData.generatedAt && videos.length);
  const state = savedStatus === "error"
    ? "error"
    : savedStatus === "generating"
      ? "generating"
      : savedStatus === "pending"
        ? hasCompletedPayload && !aiAnalysis ? "error" : "pending"
        : savedStatus === "ready"
          ? aiAnalysis ? "ready" : "error"
          : aiAnalysis
            ? "ready"
            : hasCompletedPayload
              ? "error"
              : "pending";
  const isWorking = state === "pending" || state === "generating";
  const isError = state === "error";
  const videoTitles = new Map(videos.map((video) => [video.id ?? "", String(video.title ?? "Untitled video")] as const));

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 animate-fade-in sm:p-6 xl:p-8">
      <ComparisonRefreshPoller active={isWorking} />
      <Button variant="ghost" size="sm" asChild>
        <Link href="/compare"><ArrowLeft className="h-3.5 w-3.5" /> Back to comparisons</Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title break-words">{comparison.title}</h1>
          <p className="mt-2 text-sm text-zinc-500">
            {videos.length || comparison.selected_video_ids?.length || 0} videos <span aria-hidden="true">·</span> Created {relativeTime(comparison.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isError ? "destructive" : aiAnalysis ? "success" : "secondary"}>
            {isError ? "Analysis needs attention" : aiAnalysis ? "Analysis ready" : "Generating analysis"}
          </Badge>
          {isError && <ComparisonRetryButton comparisonId={comparison.id} />}
        </div>
      </div>

      {isError && (
        <div className="comparison-error rounded-xl border border-red-300/15 bg-red-300/[0.045] p-4 text-sm text-red-300">
          <p className="font-medium">The video comparison was saved, but AI analysis did not finish.</p>
          <p className="mt-1 text-xs opacity-80">
            {String(comparisonData.aiError ?? "Check your Groq API key, model configuration, free-tier limits, and Inngest worker, then retry analysis.")}
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Video comparison</CardTitle>
          <p className="text-xs text-zinc-500">Compare the available details for each video. Missing provider metrics are shown as unavailable.</p>
        </CardHeader>
        <CardContent>
          {videos.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {videos.map((video, index) => {
                const videoId = video.id;
                const title = String(video.title ?? "Untitled video");
                const platform = String(video.platform ?? "").replaceAll("_", " ");
                return (
                  <article key={String(videoId ?? index)} className="min-w-0 rounded-xl border border-white/[0.08] bg-[linear-gradient(155deg,rgba(255,255,255,.035),rgba(255,255,255,.012)_42%,rgba(255,255,255,.018))] p-4 shadow-sm sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300">Video {String(index + 1).padStart(2, "0")}</p>
                        <h2 className="break-words text-base font-semibold leading-6 text-zinc-100">{title}</h2>
                        <p className="mt-1 text-xs capitalize text-zinc-500">{platform} <span aria-hidden="true">·</span> {String(video.creatorName ?? "Creator unavailable")}</p>
                      </div>
                      {typeof videoId === "string" && (
                        <Link href={`/library/${videoId}`} aria-label={`Open ${title}`} className="shrink-0 rounded-lg border border-white/10 p-2 text-zinc-500 transition hover:border-violet-300 hover:text-violet-400">
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Metric icon={<Eye className="h-3.5 w-3.5" />} label="Views" value={formatNumber(numberOrNull(video.views))} />
                      <Metric icon={<Heart className="h-3.5 w-3.5" />} label="Likes" value={formatNumber(numberOrNull(video.likes))} />
                      <Metric icon={<MessageCircle className="h-3.5 w-3.5" />} label="Comments" value={formatNumber(numberOrNull(video.commentsCount))} />
                      <Metric icon={<Clock3 className="h-3.5 w-3.5" />} label="Duration" value={formatDuration(numberOrNull(video.durationSeconds))} />
                    </div>
                    <div className="mt-4 flex items-center gap-2 border-t border-white/[0.07] pt-3 text-xs text-zinc-500">
                      <Subtitles className="h-3.5 w-3.5" />
                      Transcript {String(video.transcriptStatus ?? "unavailable")}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
              Video details are still loading. This page refreshes automatically while the comparison runs.
            </p>
          )}
          <p className="mt-4 text-xs leading-5 text-zinc-500">
            View counts are not directly comparable across platforms because providers may measure them differently.
          </p>
        </CardContent>
      </Card>

      {aiAnalysis ? (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Executive summary</CardTitle></CardHeader>
            <CardContent><p className="text-sm leading-6 text-zinc-300">{String(aiAnalysis.summary ?? "No summary was returned.")}</p></CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { label: "Opening hooks", value: aiAnalysis.hookComparison },
              { label: "Content themes", value: aiAnalysis.themeComparison },
              { label: "Story structure", value: aiAnalysis.structureComparison },
              { label: "Calls to action", value: aiAnalysis.ctaComparison },
            ].map((item) => (
              <Card key={item.label}>
                <CardHeader><CardTitle className="text-sm">{item.label}</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-6 text-zinc-300">{String(item.value ?? "Not enough evidence to compare this area.")}</p></CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <PointGroups title="Strengths by video" groups={aiAnalysis.strengths ?? []} videoTitles={videoTitles} />
            <PointGroups title="Opportunities by video" groups={aiAnalysis.weaknesses ?? []} videoTitles={videoTitles} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm">Evidence based recommendations</CardTitle></CardHeader>
            <CardContent>
              {aiAnalysis.recommendations?.length ? (
                <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-zinc-300">
                  {aiAnalysis.recommendations.map((recommendation, index) => <li key={index}>{recommendation}</li>)}
                </ol>
              ) : <p className="text-sm text-zinc-500">No recommendations were returned.</p>}
            </CardContent>
          </Card>

          {aiAnalysis.hasSufficientEvidence === false && (
            <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-4 text-sm leading-6 text-amber-200">
              Some creative observations are limited because one or more videos have no transcript or saved analysis.
            </div>
          )}
        </div>
      ) : isWorking ? (
        <Card><CardContent className="py-10 pt-10 text-center text-sm text-zinc-500 sm:pt-10">The comparison is being generated. This page will update automatically.</CardContent></Card>
      ) : !isError ? (
        <Card><CardContent className="py-10 pt-10 text-center text-sm text-zinc-500 sm:pt-10">AI comparison is not available yet.</CardContent></Card>
      ) : null}
    </div>
  );
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-white/[0.035] px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">{icon}{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-zinc-200">{value}</p>
    </div>
  );
}

function PointGroups({
  title,
  groups,
  videoTitles,
}: {
  title: string;
  groups: Array<{ videoId?: string; points?: string[] }>;
  videoTitles: Map<string, string>;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {groups.length ? groups.map((group, index) => (
          <div key={group.videoId ?? index} className="space-y-2">
            <p className="text-xs font-medium text-zinc-500">{videoTitles.get(group.videoId ?? "") ?? `Video ${index + 1}`}</p>
            {group.points?.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm leading-5 text-zinc-300">
                {group.points.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}
              </ul>
            ) : <p className="text-sm text-zinc-500">No points returned.</p>}
          </div>
        )) : <p className="text-sm text-zinc-500">No video-specific observations returned.</p>}
      </CardContent>
    </Card>
  );
}
