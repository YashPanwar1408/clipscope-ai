"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/status";
import { formatNumber } from "@/lib/utils";
import type { Video, IngestionJob, Comparison } from "@/lib/types/domain";

const COLORS = ["var(--chart-violet)", "var(--chart-sky)", "var(--chart-green)", "var(--chart-amber)", "var(--chart-red)"];
const TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: 12,
  color: "var(--text-primary)",
  boxShadow: "var(--chart-tooltip-shadow)",
};

export function AnalyticsDashboard({
  videos,
  jobs,
  comparisons,
}: {
  videos: Video[];
  jobs: IngestionJob[];
  comparisons: Comparison[];
}) {
  // Platform distribution
  const platformData = React.useMemo(() => {
    const yt = videos.filter((v) => v.platform === "youtube_shorts").length;
    const ig = videos.filter((v) => v.platform === "instagram_reels").length;
    return [
      { name: "YouTube Shorts", value: yt },
      { name: "Instagram Reels", value: ig },
    ].filter((d) => d.value > 0);
  }, [videos]);

  // Transcript coverage
  const transcriptCoverage = React.useMemo(() => {
    const ready = videos.filter((v) => v.transcriptStatus === "ready").length;
    const unavailable = videos.filter((v) => v.transcriptStatus === "unavailable").length;
    const error = videos.filter((v) => v.transcriptStatus === "error").length;
    const pending = videos.filter((v) => v.transcriptStatus === "pending" || v.transcriptStatus === "fetching").length;
    return { ready, unavailable, error, pending, total: videos.length };
  }, [videos]);

  // Analysis coverage
  const analysisCoverage = React.useMemo(() => {
    const ready = videos.filter((v) => v.analysisStatus === "ready").length;
    const error = videos.filter((v) => v.analysisStatus === "error").length;
    const none = videos.filter((v) => v.analysisStatus === "none").length;
    const pending = videos.filter(
      (v) => v.analysisStatus === "pending" || v.analysisStatus === "processing"
    ).length;
    return { ready, error, none, pending, total: videos.length };
  }, [videos]);

  // Job stats
  const jobStats = React.useMemo(() => {
    const completed = jobs.filter((j) => j.status === "completed").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const partial = jobs.filter((j) => j.status === "partial").length;
    const running = jobs.filter((j) => ["running", "queued", "retrying"].includes(j.status)).length;
    return { completed, failed, partial, running, total: jobs.length };
  }, [jobs]);

  // Metrics comparison (only videos with non-null metrics)
  const metricsByPlatform = React.useMemo(() => {
    const ytVideos = videos.filter((v) => v.platform === "youtube_shorts" && v.views != null);
    const igVideos = videos.filter((v) => v.platform === "instagram_reels" && v.views != null);

    const avg = (arr: Video[], field: "views" | "likes" | "commentsCount") => {
      const vals = arr.map((v) => v[field]).filter((n): n is number => n != null);
      if (vals.length === 0) return 0;
      return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    };

    return [
      {
        metric: "Avg Views",
        youtube: avg(ytVideos, "views"),
        instagram: avg(igVideos, "views"),
      },
      {
        metric: "Avg Likes",
        youtube: avg(ytVideos, "likes"),
        instagram: avg(igVideos, "likes"),
      },
      {
        metric: "Avg Comments",
        youtube: avg(ytVideos, "commentsCount"),
        instagram: avg(igVideos, "commentsCount"),
      },
    ];
  }, [videos]);

  // Engagement ratio (likes/views) — only when both inputs exist
  const engagementData = React.useMemo(() => {
    return videos
      .filter((v) => v.views != null && v.likes != null && v.views > 0)
      .map((v) => ({
        name: (v.title ?? "Video").slice(0, 20),
        ratio: Math.round((v.likes! / v.views!) * 1000) / 10, // like rate as percentage
        platform: v.platform,
      }))
      .slice(0, 15);
  }, [videos]);

  if (videos.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total videos", value: 0 },
            { label: "Completed jobs", value: 0 },
            { label: "Transcript coverage", value: "0%" },
            { label: "Analysis coverage", value: "0%" },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-5 sm:p-6">
                <p className="text-xs text-zinc-500">{s.label}</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-100">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent>
            <EmptyState
              title="No analytics data yet"
              description="Import videos and allow metadata retrieval to complete. Only real, retrieved data is shown — no invented metrics."
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total videos" value={videos.length} />
        <StatCard label="Completed jobs" value={jobStats.completed} />
        <StatCard
          label="Transcript coverage"
          value={`${transcriptCoverage.total ? Math.round((transcriptCoverage.ready / transcriptCoverage.total) * 100) : 0}%`}
        />
        <StatCard
          label="Analysis coverage"
          value={`${analysisCoverage.total ? Math.round((analysisCoverage.ready / analysisCoverage.total) * 100) : 0}%`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Platform distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Platform distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {platformData.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={platformData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {platformData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Job outcomes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Job outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            {jobStats.total === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-500">No jobs yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={[
                  { name: "Completed", value: jobStats.completed },
                  { name: "Failed", value: jobStats.failed },
                  { name: "Partial", value: jobStats.partial },
                  { name: "Running", value: jobStats.running },
                ].filter((d) => d.value > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                  />
                  <Bar dataKey="value" fill="var(--chart-violet)" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metric comparison across platforms */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Average metrics by platform</CardTitle>
        </CardHeader>
        <CardContent>
          {metricsByPlatform.every((m) => m.youtube === 0 && m.instagram === 0) ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              No retrieved metrics available. Metrics appear once provider data is fetched.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={metricsByPlatform}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="metric" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => formatNumber(v)} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: unknown) => formatNumber(typeof value === 'number' ? value : 0)}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Legend />
                <Bar dataKey="youtube" name="YouTube Shorts" fill="var(--chart-violet)" radius={[5, 5, 0, 0]} />
                <Bar dataKey="instagram" name="Instagram Reels" fill="var(--chart-sky)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="mt-3 text-xs text-zinc-600">
            Raw view counts are not directly comparable across platforms. Averages shown only for videos with retrieved metrics.
          </p>
        </CardContent>
      </Card>

      {/* Engagement ratio */}
      {engagementData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Engagement ratio (likes / views, %)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} angle={-20} textAnchor="end" height={60} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} unit="%" tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: unknown) => `${typeof value === 'number' ? value : 0}%`}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="ratio" name="Like rate" radius={[4, 4, 0, 0]}>
                  {engagementData.map((d, i) => (
                    <Cell key={i} fill={d.platform === "youtube_shorts" ? "var(--chart-violet)" : "var(--chart-sky)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="mt-3 text-xs text-zinc-600">
              Derived ratio calculated only when both views and likes are available.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Coverage breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Transcript status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "Ready", value: transcriptCoverage.ready, color: "text-emerald-400" },
                { label: "Unavailable", value: transcriptCoverage.unavailable, color: "text-zinc-400" },
                { label: "Error", value: transcriptCoverage.error, color: "text-red-400" },
                { label: "Pending", value: transcriptCoverage.pending, color: "text-amber-400" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{row.label}</span>
                  <span className={`font-medium ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Analysis status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[
                { label: "Ready", value: analysisCoverage.ready, color: "text-emerald-400" },
                { label: "Error", value: analysisCoverage.error, color: "text-red-400" },
                { label: "No transcript", value: analysisCoverage.none, color: "text-zinc-400" },
                { label: "Pending", value: analysisCoverage.pending, color: "text-amber-400" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{row.label}</span>
                  <span className={`font-medium ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent comparisons */}
      {comparisons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent comparisons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {comparisons.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-zinc-300">{c.title}</span>
                  <span className="text-zinc-500">{c.selectedVideoIds.length} videos</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-5 sm:p-6">
        <p className="text-xs text-zinc-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-zinc-100">{value}</p>
      </CardContent>
    </Card>
  );
}
