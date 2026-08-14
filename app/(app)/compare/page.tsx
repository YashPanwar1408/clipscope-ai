import type { Metadata } from "next";
import { CompareList } from "@/components/compare/compare-list";
import { getActiveWorkspaceId, listWorkspaceComparisons, listWorkspaceVideos } from "@/lib/workspace/server";

export const metadata: Metadata = { title: "Compare Videos" };

export default async function ComparePage() {
  const workspaceId = await getActiveWorkspaceId();
  const [comparisons, videos] = workspaceId
    ? await Promise.all([
        listWorkspaceComparisons(workspaceId),
        listWorkspaceVideos(workspaceId),
      ])
    : [[], []];

  return (
    <CompareList
      comparisons={comparisons.map((c) => ({
        id: c.id,
        title: c.title,
        selectedVideoIds: c.selectedVideoIds,
        createdAt: c.createdAt,
        status: c.status ?? "pending",
      }))}
      videos={videos}
      workspaceId={workspaceId}
    />
  );
}
