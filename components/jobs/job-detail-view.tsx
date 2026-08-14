"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  RotateCcw,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, formatNumber } from "@/lib/utils";

// ─── Types (match API response) ─────────────────────────────────────────────

interface JobRow {
  id: string;
  workspace_id: string;
  requested_by: string;
  status: string;
  total_videos: number;
  processed_videos: number;
  failed_videos: number;
  progress_pct: number;
  current_stage: string | null;
  attempt_count: number;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

interface ItemVideo {
  id: string;
  title: string | null;
  canonical_url: string;
  platform: string;
  platform_video_id: string;
}

interface JobItemRow {
  id: string;
  job_id: string;
  video_id: string | null;
  status: string;
  current_stage: string | null;
  attempt_count: number;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  videos: ItemVideo | null;
}

interface JobDetailResponse {
  job: JobRow;
  items: JobItemRow[];
  terminal: boolean;
}

const TERMINAL_STATUSES = ["completed", "partial", "failed", "cancelled"];

// ─── Status helpers ──────────────────────────────────────────────────────────

function statusVariant(status: string): "success" | "destructive" | "warning" | "secondary" | "info" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
    case "cancelled":
      return "destructive";
    case "partial":
      return "warning";
    case "running":
    case "retrying":
      return "info";
    default:
      return "secondary";
  }
}

function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ─── Job Detail View ─────────────────────────────────────────────────────────

export function JobDetailView({ initialData }: { initialData: JobDetailResponse }) {
  const [data, setData] = React.useState<JobDetailResponse>(initialData);
  const [polling, setPolling] = React.useState(!initialData.terminal);
  const [pollError, setPollError] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState(false);

  const job = data.job;
  const isTerminal = TERMINAL_STATUSES.includes(job.status);

  // Poll with exponential backoff: 2s, 4s, 8s, 16s, max 30s
  const pollRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pollDelay, setPollDelay] = React.useState(2000);

  const poll = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${job.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const next: JobDetailResponse = await res.json();
      setData(next);
      setPollError(null);

      if (next.terminal || TERMINAL_STATUSES.includes(next.job.status)) {
        setPolling(false);
        return;
      }
      setPollDelay((d) => Math.min(d * 1.5, 30000));
    } catch (err) {
      setPollError(err instanceof Error ? err.message : "Poll failed");
      setPollDelay((d) => Math.min(d * 1.5, 30000));
    }
  }, [job.id]);

  React.useEffect(() => {
    if (!polling) return;
    pollRef.current = setTimeout(() => void poll(), pollDelay);
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [polling, pollDelay, poll]);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/retry`, { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Re-fetch immediately and resume polling
      setPollDelay(2000);
      setPolling(true);
      await poll();
    } catch (err) {
      setPollError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  const handleManualRefresh = async () => {
    await poll();
  };

  const canRetry =
    ["failed", "partial", "cancelled"].includes(job.status) && data.items.length > 0;

  return (
    <div className="space-y-6 p-4 animate-fade-in sm:p-6 xl:p-8">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to dashboard
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {canRetry && (
            <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying}>
              {retrying ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="h-3.5 w-3.5" />
              )}
              Retry job
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={handleManualRefresh} disabled={polling}>
            <RefreshCw className={`h-3.5 w-3.5 ${polling ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Ingestion job</h1>
          <p className="mt-1 font-mono text-xs text-zinc-600">{job.id}</p>
        </div>
        <Badge variant={statusVariant(job.status)} className="capitalize">
          {statusLabel(job.status)}
        </Badge>
      </div>

      {/* Progress card */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Progress</CardTitle>
          <span className="text-sm font-medium text-zinc-300">{job.progress_pct}%</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-300 to-sky-300 transition-all duration-500"
              style={{ width: `${job.progress_pct}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="Total" value={job.total_videos} />
            <Stat label="Processed" value={job.processed_videos} />
            <Stat label="Failed" value={job.failed_videos} />
            <Stat label="Attempts" value={job.attempt_count} />
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Created {formatDateTime(job.created_at)}
            </span>
            {job.started_at && <span>Started {formatDateTime(job.started_at)}</span>}
            {job.completed_at && <span>Completed {formatDateTime(job.completed_at)}</span>}
            {job.current_stage && !isTerminal && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> {job.current_stage}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error banner */}
      {job.last_error_message && (
        <div className="rounded-xl border border-red-300/10 bg-red-300/[0.035] p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <div>
              <p className="text-sm font-medium text-red-300">
                {job.last_error_code ?? "Error"}
              </p>
              <p className="mt-1 text-sm text-red-400/80">{job.last_error_message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Per-video items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Videos ({data.items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-zinc-800">
            {data.items.map((item) => (
              <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-zinc-200">
                      {item.videos?.title ?? item.videos?.canonical_url ?? "Video"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {item.videos?.platform.replace("_", " ")} ·{" "}
                      {item.current_stage ?? item.status}
                      {item.attempt_count > 1 && ` · ${item.attempt_count} attempts`}
                    </p>
                    {item.error_message && (
                      <p className="mt-1 text-xs text-red-400/80">
                        {item.error_code}: {item.error_message}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.status === "completed" && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                    {item.status === "failed" && (
                      <XCircle className="h-4 w-4 text-red-400" />
                    )}
                    {(item.status === "running" || item.status === "retrying") && (
                      <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                    )}
                    <Badge variant={statusVariant(item.status)} className="capitalize">
                      {statusLabel(item.status)}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {pollError && (
        <p className="text-center text-xs text-amber-400">
          Live update paused: {pollError}. Click Refresh to retry.
        </p>
      )}
      {polling && !pollError && (
        <p className="text-center text-xs text-zinc-600">
          Updating automatically…
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-zinc-100">{formatNumber(Number(value) || 0)}</p>
    </div>
  );
}
