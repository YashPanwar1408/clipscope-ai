"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  FileText,
  FolderOpen,
  GitCompare,
  LayoutDashboard,
  Library,
  Menu,
  MessageSquare,
  Settings,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Workspaces", href: "/workspaces", icon: FolderOpen },
  { label: "Video library", href: "/library", icon: Library },
  { label: "Compare videos", href: "/compare", icon: GitCompare },
  { label: "AI insights", href: "/insights", icon: Sparkles },
  { label: "Research chat", href: "/chat", icon: MessageSquare },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Reports", href: "/reports", icon: FileText },
  { label: "Integrations", href: "/integrations", icon: Activity },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 h-9 w-9 text-zinc-400 hover:text-zinc-100 lg:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="h-[18px] w-[18px]" />
        </Button>
      </DialogTrigger>
      <DialogContent className="fixed left-0 top-0 flex h-dvh w-[min(86vw,300px)] max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-y-0 border-l-0 border-r border-white/[0.08] bg-[#0b0d11] p-0 shadow-2xl sm:rounded-none">
        <DialogTitle className="sr-only">Application navigation</DialogTitle>
        <DialogDescription className="sr-only">Navigate between ClipScope AI workspace pages.</DialogDescription>
        <div className="flex h-[68px] shrink-0 items-center border-b border-white/[0.07] px-5">
          <Link href="/dashboard" aria-label="ClipScope AI dashboard" onClick={() => setOpen(false)}>
            <BrandMark />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Workspace navigation">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70",
                  active ? "bg-white/[0.075] text-zinc-50" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
                )}
              >
                <item.icon className={cn("h-[17px] w-[17px]", active ? "text-violet-200" : "text-zinc-500")} strokeWidth={1.8} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </DialogContent>
    </Dialog>
  );
}
