"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatDuration, formatNumber } from "@/lib/utils";
import type { Video, Transcript, VideoAnalysis } from "@/lib/types/domain";

export function VideoDetail({
  video,
  transcript,
  analysis,
}: {
  video: Video;
  transcript: Transcript | null;
  analysis: VideoAnalysis | null;
}) {
  const router = useRouter();
  const [transcriptText, setTranscriptText] = React.useState(transcript?.transcriptText ?? "");
  const [savingTranscript, setSavingTranscript] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    if (video.analysisStatus !== "pending" && video.analysisStatus !== "processing") return;
    const interval = window.setInterval(() => router.refresh(), 2500);
    return () => window.clearInterval(interval);
  }, [router, video.analysisStatus]);

  const hasAnalysisEvidence = Boolean(
    transcript?.transcriptText?.trim() ||
      video.title?.trim() ||
      video.description?.trim() ||
      video.views !== null ||
      video.likes !== null ||
      video.commentsCount !== null
  );
  const analysisRunning = video.analysisStatus === "processing" || video.analysisStatus === "pending";

  const refreshVideoData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/refresh`, { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Failed to refresh video data");
      if (payload?.metadataWarning) {
        toast({ title: `Data refreshed with a provider warning: ${payload.metadataWarning}`, variant: "destructive" });
      } else if (payload?.transcriptWarning) {
        toast({ title: `Metadata refreshed. ${payload.transcriptWarning}` });
      } else {
        toast({ title: payload?.analysisQueued ? "Video data refreshed; AI analysis queued" : "Video data refreshed" });
      }
      router.refresh();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to refresh video data", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const saveTranscript = async () => {
    if (!transcriptText.trim()) return;
    setSavingTranscript(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptText: transcriptText.trim(), language: transcript?.language ?? "en" }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to save transcript");
      }
      toast({ title: "Transcript saved (manual)" });
      router.refresh();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to save transcript", variant: "destructive" });
    } finally {
      setSavingTranscript(false);
    }
  };

  const regenerateAnalysis = async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/videos/${video.id}/retry-analysis`, { method: "POST" });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? "Failed to queue analysis");
      }
      toast({ title: "Analysis re-queued" });
      router.refresh();
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Failed to retry analysis", variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  };

  const deleteVideo = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/videos/${video.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Video deleted" });
      router.push("/library");
    } catch {
      toast({ title: "Failed to delete video", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/library">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to library
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshVideoData} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={deleteVideo}
            disabled={deleting}
            className="text-red-400 hover:text-red-300"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title max-w-4xl break-words">
            {video.title ?? "Untitled video"}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {video.creatorName ?? "Creator unavailable"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {video.platform === "youtube_shorts" ? "YouTube Shorts" : "Instagram Reels"}
          </Badge>
          <Badge
            variant={
              video.metadataStatus === "ready"
                ? "success"
                : video.metadataStatus === "error"
                  ? "destructive"
                  : "secondary"
            }
            className="capitalize"
          >
            {video.metadataStatus}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Video metadata</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Views" value={formatNumber(video.views)} />
          <Metric label="Likes" value={formatNumber(video.likes)} />
          <Metric label="Comments" value={formatNumber(video.commentsCount)} />
          <Metric label="Duration" value={formatDuration(video.durationSeconds)} />
          <Metric
            label="Published"
            value={
              video.publishedAt
                ? formatDate(video.publishedAt)
                : "—"
            }
          />
          <Metric label="Transcript" value={video.transcriptStatus} />
          <Metric label="Analysis" value={video.analysisStatus} />
          <div className="flex items-end">
            <a
              href={video.canonicalUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
            >
              Open source video <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      {video.description && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-400">{video.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Transcript</CardTitle>
          <div className="flex items-center gap-2">
            {transcript?.source === "manual" && (
              <Badge variant="warning" className="text-[10px]">
                Manual
              </Badge>
            )}
            <Button size="sm" variant="outline" onClick={saveTranscript} disabled={savingTranscript}>
              {savingTranscript ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save transcript
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={transcriptText}
            onChange={(e) => setTranscriptText(e.target.value)}
            placeholder={
              video.transcriptStatus === "ready"
                ? "Transcript loaded"
                : "No transcript available. Paste one here and save to enable AI analysis."
            }
            rows={10}
            className="font-mono text-xs"
          />
          <div className="flex items-center justify-between text-xs text-zinc-600">
            <span>
              Language: {transcript?.language ?? "auto"} · Confidence:{" "}
              {transcript?.confidence ?? "N/A"}
            </span>
            <span>{transcriptText.length} chars</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">AI analysis</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={regenerateAnalysis}
            disabled={regenerating || analysisRunning || !hasAnalysisEvidence}
            title={!hasAnalysisEvidence ? "Add a transcript or refresh video data before running analysis" : undefined}
          >
            {regenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {analysis ? "Regenerate" : "Run analysis"}
          </Button>
        </CardHeader>
        <CardContent>
          {video.transcriptStatus !== "ready" && (video.title || video.description) && (
            <p className="mb-3 text-xs text-zinc-500">
              No transcript is available. Analysis will use the title and description, so observations about spoken content and pacing will be limited.
            </p>
          )}
          {analysisRunning ? (
            <div className="flex items-center gap-2 py-6 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysis is running…
            </div>
          ) : analysis ? (
            <div className="space-y-3 text-sm text-zinc-300">
              {analysis.hookSummary && <Detail label="Hook" value={analysis.hookSummary} />}
              {analysis.contentTheme && <Detail label="Theme" value={analysis.contentTheme} />}
              {analysis.targetAudience && (
                <Detail label="Audience" value={analysis.targetAudience} />
              )}
              {analysis.narrativeStructure && (
                <Detail label="Structure" value={analysis.narrativeStructure} />
              )}
              {analysis.callToAction && (
                <Detail label="Call to action" value={analysis.callToAction} />
              )}
              {analysis.pacingObservations && (
                <Detail label="Pacing" value={analysis.pacingObservations} />
              )}
              {analysis.contentStrengths?.length ? (
                <div>
                  <p className="mb-1 text-zinc-500">Strengths</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {analysis.contentStrengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {analysis.contentWeaknesses?.length ? (
                <div>
                  <p className="mb-1 text-zinc-500">Weaknesses</p>
                  <ul className="list-disc space-y-1 pl-5">
                    {analysis.contentWeaknesses.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : video.analysisStatus === "error" ? (
            <div className="space-y-3 py-4">
              <p className="text-sm text-red-500">
                The last analysis attempt failed. Check the Groq API key, model setting, and free-tier limits, then retry.
              </p>
              <p className="text-xs text-zinc-500">
                You can still analyze this video using its saved title, description, transcript, or performance metrics.
              </p>
            </div>
          ) : !hasAnalysisEvidence ? (
            <p className="py-6 text-sm text-zinc-500">
              Add a transcript or video description before running AI analysis.
            </p>
          ) : (
            <p className="py-6 text-sm text-zinc-500">
              No analysis yet. Click &ldquo;Run analysis&rdquo; to generate.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm capitalize text-zinc-200">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-zinc-500">{label}: </span>
      {value}
    </p>
  );
}
