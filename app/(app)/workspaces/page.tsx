import type { Metadata } from "next";
import { listUserWorkspaces, getActiveWorkspaceId } from "@/lib/workspace/server";
import { WorkspaceList } from "@/components/workspaces/workspace-list";

export const metadata: Metadata = {
  title: "Workspaces",
  description: "Organize short-form video intelligence into collaborative workspaces",
};

export default async function WorkspacesPage() {
  const workspaces = await listUserWorkspaces();
  const activeWorkspaceId = await getActiveWorkspaceId();

  return (
    <div className="p-4 animate-fade-in sm:p-6 xl:p-8">
      <WorkspaceList
        initialWorkspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
      />
    </div>
  );
}
