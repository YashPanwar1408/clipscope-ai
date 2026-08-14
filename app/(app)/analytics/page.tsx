import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import {
  getActiveWorkspaceId,
  listWorkspaceVideos,
  listWorkspaceJobs,
  listWorkspaceComparisons,
} from "@/lib/workspace/server";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const workspaceId = await getActiveWorkspaceId();
  const [videos, jobs, comparisons] = workspaceId
    ? await Promise.all([
        listWorkspaceVideos(workspaceId),
        listWorkspaceJobs(workspaceId),
        listWorkspaceComparisons(workspaceId),
      ])
    : [[], [], []];

  return (
    <div className="space-y-6 p-4 animate-fade-in sm:p-6 xl:p-8">
      <PageHeader
        eyebrow="Workspace data"
        title="Analytics"
        description="Content coverage and retrieved metrics across the active workspace."
      />
      <AnalyticsDashboard videos={videos} jobs={jobs} comparisons={comparisons} />
    </div>
  );
}
