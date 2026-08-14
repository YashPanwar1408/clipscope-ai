"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitCompare, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/status";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatDate, formatDuration, formatNumber } from "@/lib/utils";
import type { Video } from "@/lib/types/domain";

export function CompareList({
  comparisons,
  videos,
  workspaceId,
}: {
  comparisons: Array<{
    id: string;
    title: string;
    selectedVideoIds: string[];
    createdAt: string;
    status: "pending" | "ready" | "error";
  }>;
  videos: Video[];
  workspaceId: string | null;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const filteredVideos = videos.filter((v) =>
    `${v.title ?? ""} ${v.creatorName ?? ""} ${v.platform}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const toggleVideo = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    setError(null);
    if (!workspaceId) {
      setError("Select a workspace first.");
      return;
    }
    if (selected.length < 2) {
      setError("Select at least 2 videos to compare.");
      return;
    }
    if (selected.length > 10) {
      setError("You can compare up to 10 videos.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/comparisons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Untitled comparison",
          workspaceId,
          videoIds: selected,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create comparison");

      toast({
        title: "Comparison created",
        description: "AI analysis is being generated.",
      });
      setIsOpen(false);
      setTitle("");
      setSelected([]);
      router.push(`/compare/${data.comparisonId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create comparison");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 animate-fade-in sm:p-6 xl:p-8">
      <PageHeader
        eyebrow="Find the patterns"
        title="Compare videos"
        description="Review saved comparisons across the active workspace."
        actions={<Button size="sm" onClick={() => setIsOpen(true)} disabled={!workspaceId}><Plus className="h-3.5 w-3.5" />New comparison</Button>}
      />

      {comparisons.length === 0 ? (
        <EmptyState
          icon={<GitCompare className="h-5 w-5" />}
          title="No comparisons saved"
          description="Select 2–10 videos to generate an AI-powered comparison."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))] gap-4">
          {comparisons.map((c) => (
            <Link key={c.id} href={`/compare/${c.id}`}>
              <Card className="transition-colors hover:border-white/[0.14] hover:bg-white/[0.025]">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 break-words text-base font-medium leading-snug text-zinc-100">{c.title}</h2>
                    <Badge variant="secondary" className="shrink-0">{c.selectedVideoIds.length} videos</Badge>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-zinc-500">Created {formatDate(c.createdAt)}</p>
                    <Badge variant={c.status === "ready" ? "success" : c.status === "error" ? "destructive" : "info"}>
                      {c.status === "ready" ? "Analysis ready" : c.status === "error" ? "Needs retry" : "Generating"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create comparison</DialogTitle>
            <DialogDescription>
              Select 2–10 videos to compare. AI analysis will run automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="comp-title">Title</Label>
              <Input
                id="comp-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Q3 Shorts vs Reels"
              />
            </div>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selected.map((id) => {
                  const v = videos.find((vid) => vid.id === id);
                  return (
                    <Badge key={id} variant="secondary" className="gap-1">
                      {v?.title?.slice(0, 30) ?? id.slice(0, 8)}
                      <button onClick={() => toggleVideo(id)} aria-label="Remove">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search videos..."
                className="pl-8"
              />
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {filteredVideos.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500">No videos found.</p>
              ) : (
                filteredVideos.map((v) => {
                  const isSelected = selected.includes(v.id);
                  return (
                    <button
                      key={v.id}
                      onClick={() => toggleVideo(v.id)}
                      disabled={!isSelected && selected.length >= 10}
                      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
                        isSelected
                          ? "border-violet-600 bg-violet-600/10"
                          : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/40"
                      } ${!isSelected && selected.length >= 10 ? "opacity-50" : ""}`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-200">
                          {v.title ?? v.canonicalUrl}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {v.platform === "youtube_shorts" ? "YouTube Shorts" : "Instagram Reels"} ·{" "}
                          {formatNumber(v.views)} views · {formatDuration(v.durationSeconds)}
                        </p>
                      </div>
                      {isSelected && (
                        <Badge variant="secondary" className="shrink-0">Selected</Badge>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" size="sm" variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleCreate} disabled={saving || selected.length < 2}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Create comparison
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
