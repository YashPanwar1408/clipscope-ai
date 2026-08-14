"use client";

import * as React from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import type { Workspace } from "@/lib/types/domain";

interface AppShellProps {
  children: React.ReactNode;
  userEmail?: string | null;
  userName?: string | null;
  workspaces?: Workspace[];
  activeWorkspaceId?: string | null;
}

export function AppShell({
  children,
  userEmail,
  userName,
  workspaces = [],
  activeWorkspaceId = null,
}: AppShellProps) {

  return (
    <div className="flex h-dvh overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="hidden lg:flex">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopNav
          userEmail={userEmail}
          userName={userName}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          <div className="mx-auto min-h-full w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
