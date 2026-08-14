import type { Metadata } from "next";
import { ReportsPage } from "@/components/reports/reports-page";
import { getActiveWorkspaceId, listWorkspaceReports } from "@/lib/workspace/server";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPageServer() {
  const workspaceId = await getActiveWorkspaceId();
  const reports = workspaceId ? await listWorkspaceReports(workspaceId) : [];

  return (
    <div className="p-4 animate-fade-in sm:p-6 xl:p-8">
      <ReportsPage reports={reports} workspaceId={workspaceId} />
    </div>
  );
}
