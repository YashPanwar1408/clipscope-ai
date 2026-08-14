"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, FolderOpen, Loader2, LogOut, Plus, UserRound } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Workspace } from "@/lib/types/domain";
import { toast } from "@/hooks/use-toast";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

const pageLabels: Record<string, string> = {
  dashboard: "Dashboard",
  workspaces: "Workspaces",
  library: "Video library",
  compare: "Compare videos",
  insights: "AI insights",
  chat: "Research chat",
  analytics: "Analytics",
  reports: "Reports",
  integrations: "Integrations",
  settings: "Settings",
  jobs: "Ingestion job",
};

interface TopNavProps {
  userEmail?: string | null;
  userName?: string | null;
  workspaces?: Workspace[];
  activeWorkspaceId?: string | null;
}

export function TopNav({ userEmail, userName, workspaces = [], activeWorkspaceId = null }: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];
  const pageLabel = pathname.split("/").filter(Boolean).reverse().find((part) => pageLabels[part]) ?? "Workspace";
  const title = pageLabels[pageLabel] ?? pageLabel;
  const initials = (userName ?? userEmail ?? "U").trim().charAt(0).toUpperCase();

  const handleSwitch = async (id: string) => {
    try {
      const response = await fetch(`/api/workspaces/${id}/switch`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to switch workspace");
      toast({ title: "Workspace switched", description: "Active workspace updated." });
      router.refresh();
    } catch {
      toast({ title: "Unable to switch workspace", variant: "destructive" });
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createSupabaseClient();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/auth/login");
      router.refresh();
    } catch {
      setSigningOut(false);
      toast({
        title: "Sign out failed",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-[64px] shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] bg-[#090b0f]/90 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav />
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-[13px] font-medium text-zinc-200">{title}</p>
          <p className="mt-0.5 truncate text-[10px] text-zinc-600">ClipScope AI workspace</p>
        </div>
        <span aria-hidden="true" className="hidden h-5 w-px bg-white/10 sm:block" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 max-w-[min(48vw,260px)] gap-2 px-2.5 text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-100"
              aria-label={`Active workspace: ${activeWorkspace?.name ?? "none selected"}. Switch workspace`}
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-violet-300" strokeWidth={1.8} />
              <span className="truncate text-xs font-medium">{activeWorkspace?.name ?? "Select workspace"}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {workspaces.length ? workspaces.map((workspace) => (
              <DropdownMenuItem key={workspace.id} onClick={() => handleSwitch(workspace.id)} className="justify-between">
                <span className="truncate">{workspace.name}</span>
                {workspace.id === activeWorkspace?.id && <Check className="h-3.5 w-3.5 text-violet-300" />}
              </DropdownMenuItem>
            )) : <DropdownMenuItem disabled>No workspaces available</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/workspaces"><Plus className="h-4 w-4" />Manage workspaces</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 gap-2 px-2 text-zinc-300 hover:bg-white/[0.05] hover:text-zinc-100" aria-label="Open account menu">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-violet-300/20 bg-violet-300/10 text-[11px] font-semibold text-violet-100">{initials}</span>
              <span className="hidden max-w-36 truncate text-xs sm:block">{userName ?? userEmail ?? "Account"}</span>
              <ChevronsUpDown className="hidden h-3.5 w-3.5 text-zinc-600 sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block truncate text-xs font-medium text-zinc-200">{userName ?? "Account"}</span>
              {userEmail && <span className="mt-1 block truncate text-[11px] text-zinc-500">{userEmail}</span>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link href="/settings"><UserRound className="h-4 w-4" />Account settings</Link></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => void handleSignOut()}
              disabled={signingOut}
              className="text-red-300 focus:text-red-200"
            >
              {signingOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              {signingOut ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
