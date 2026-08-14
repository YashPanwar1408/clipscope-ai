import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BarChart3, Clock, FileText, GitCompare, Library, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/status";
import { getActiveWorkspaceId, listWorkspaceComparisons, listWorkspaceJobs, listWorkspaceReports, listWorkspaceVideos } from "@/lib/workspace/server";
import { formatNumber, relativeTime } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const workspaceId = await getActiveWorkspaceId();
  const [videos, jobs, comparisons, reports] = workspaceId
    ? await Promise.all([
        listWorkspaceVideos(workspaceId),
        listWorkspaceJobs(workspaceId),
        listWorkspaceComparisons(workspaceId),
        listWorkspaceReports(workspaceId),
      ])
    : [[], [], [], []];
  const readyInsights = videos.filter((video) => video.analysisStatus === "ready").length;

  return (
    <div className="space-y-7 p-4 animate-fade-in sm:p-6 xl:p-8">
      <PageHeader
        eyebrow="Workspace overview"
        title="Research dashboard"
        description="A live overview of the videos, jobs, and research in your active workspace."
        actions={<Button asChild size="sm"><Link href="/library?action=import"><Plus className="h-3.5 w-3.5" />Import a video</Link></Button>}
      />

      {!workspaceId && (
        <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.045] p-4 text-sm leading-6 text-amber-200/90">
          Create or join a workspace to start storing research. <Link className="underline" href="/workspaces">Manage workspaces</Link>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Videos imported", value: videos.length, icon: Library },
          { label: "Comparisons saved", value: comparisons.length, icon: GitCompare },
          { label: "AI insights", value: readyInsights, icon: Sparkles },
          { label: "Reports generated", value: reports.length, icon: BarChart3 },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="transition-colors hover:border-white/[0.12]">
            <CardContent className="flex items-center justify-between p-5 sm:p-6">
              <div><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-2xl font-semibold text-zinc-100">{formatNumber(value)}</p></div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.035] text-violet-200/80"><Icon className="h-4 w-4" strokeWidth={1.8} /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-zinc-500" />Recent videos</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link href="/library">View library</Link></Button>
          </CardHeader>
          <CardContent>
            {videos.length === 0 ? (
              <EmptyState title="No videos imported yet" description="Import a YouTube Short or Instagram Reel to get started." action={<Button size="sm" asChild><Link href="/library?action=import"><Plus className="h-3.5 w-3.5" />Import video</Link></Button>} />
            ) : (
              <div className="divide-y divide-zinc-800">
                {videos.slice(0, 5).map((video) => (
                  <Link key={video.id} href={`/library/${video.id}`} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="min-w-0 truncate text-sm text-zinc-200">{video.title ?? video.canonicalUrl}</span>
                    <Badge variant="secondary" className="shrink-0 capitalize">{video.metadataStatus}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Ingestion job history</CardTitle>
            <span className="text-xs text-zinc-500">{jobs.length} jobs</span>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <EmptyState title="No ingestion jobs" description="Video processing jobs will appear here when you import videos." />
            ) : (
              <div className="space-y-3">
                {jobs.slice(0, 8).map((job) => (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 px-3 py-2 transition-colors hover:border-zinc-700 hover:bg-zinc-900/40">
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200">{job.totalVideos} {job.totalVideos === 1 ? "video" : "videos"}</p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{job.currentStage ?? job.status} · {relativeTime(job.createdAt)}</p>
                    </div>
                    <Badge variant={job.status === "completed" ? "success" : job.status === "failed" || job.status === "cancelled" ? "destructive" : job.status === "partial" ? "warning" : "secondary"} className="capitalize">{job.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm"><GitCompare className="h-4 w-4 text-violet-200/70" />Recent comparisons</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link href="/compare">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {comparisons.length === 0 ? <EmptyState title="No comparisons yet" description="Create a comparison from videos in your workspace." action={<Button size="sm" variant="outline" asChild><Link href="/compare"><ArrowUpRight className="h-3.5 w-3.5" />Explore comparisons</Link></Button>} /> : (
              <div className="divide-y divide-white/[0.06]">
                {comparisons.slice(0, 5).map((comparison) => (
                  <Link key={comparison.id} href={`/compare/${comparison.id}`} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="min-w-0 truncate text-sm text-zinc-200">{comparison.title}</span>
                    <Badge variant="secondary" className="shrink-0">{comparison.selectedVideoIds.length} videos</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-violet-200/70" />Recent reports</CardTitle>
            <Button asChild size="sm" variant="ghost"><Link href="/reports">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? <EmptyState title="No reports yet" description="Reports generated for this workspace will appear here." /> : (
              <div className="divide-y divide-white/[0.06]">
                {reports.slice(0, 5).map((report) => (
                  <div key={report.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0"><p className="truncate text-sm text-zinc-200">{report.reportType} report</p><p className="mt-1 text-xs text-zinc-600">{relativeTime(report.createdAt)}</p></div>
                    <Badge variant={report.status === "ready" ? "success" : report.status === "error" ? "destructive" : "secondary"} className="capitalize">{report.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
