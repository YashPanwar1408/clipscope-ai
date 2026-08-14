"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  GitCompare,
  LayoutDashboard,
  Library,
  MessageSquare,
  Settings,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidebarItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };

const mainItems: SidebarItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Workspaces", href: "/workspaces", icon: FolderOpen },
  { label: "Video library", href: "/library", icon: Library },
  { label: "Compare videos", href: "/compare", icon: GitCompare },
  { label: "AI insights", href: "/insights", icon: Sparkles },
  { label: "Research chat", href: "/chat", icon: MessageSquare },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Reports", href: "/reports", icon: FileText },
];

const utilityItems: SidebarItem[] = [
  { label: "Integrations", href: "/integrations", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
];

function NavigationGroup({
  items,
  collapsed,
  label,
}: {
  items: SidebarItem[];
  collapsed: boolean;
  label: string;
}) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label={label}>
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={cn(
              "group relative flex min-h-10 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70",
              collapsed && "justify-center px-0",
              active
                ? "bg-white/[0.075] text-zinc-50 shadow-[inset_0_0_0_1px_rgba(255,255,255,.06)] before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[2px] before:rounded-full before:bg-violet-300"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
            )}
          >
            <item.icon
              aria-hidden="true"
              className={cn("h-[17px] w-[17px] shrink-0", active ? "text-violet-200" : "text-zinc-500 group-hover:text-zinc-300")}

            />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = React.useState(false);
  return (
    <aside
      className={cn(
        "relative z-10 flex h-full shrink-0 flex-col border-r border-white/[0.07] bg-[#0b0d11] transition-[width] duration-200",
        collapsed ? "w-[76px]" : "w-[252px]"
      )}
    >
      <Link
        href="/dashboard"
        className={cn("flex h-[68px] shrink-0 items-center border-b border-white/[0.07] px-5", collapsed && "justify-center px-0")}
        aria-label="ClipScope AI dashboard"
      >
        <BrandMark compact={collapsed} />
      </Link>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Workspace
          </p>
        )}
        <NavigationGroup items={mainItems} collapsed={collapsed} label="Workspace navigation" />
      </div>

      <div className="border-t border-white/[0.07] px-3 py-4">
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Preferences
          </p>
        )}
        <NavigationGroup items={utilityItems} collapsed={collapsed} label="Preferences navigation" />
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setCollapsed((value) => !value)}
        className="absolute -right-3.5 top-[78px] z-20 h-7 w-7 rounded-full border border-white/10 bg-[#12151b] text-zinc-500 shadow-lg hover:border-violet-300/30 hover:bg-[#191d25] hover:text-zinc-100"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </Button>
    </aside>
  );
}
