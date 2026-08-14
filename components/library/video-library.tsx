"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Library,
  Loader2,
  Plus,
  Play,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { batchImportSchema } from "@/lib/schemas";
import { formatDuration, formatNumber } from "@/lib/utils";
import type { Video } from "@/lib/types/domain";

function generateIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const PAGE_SIZE = 12;

type SortOption = "newest" | "oldest" | "views-desc" | "views-asc" | "title-asc" | "title-desc";
type PlatformFilter = "all" | "youtube_shorts" | "instagram_reels";

export function VideoLibrary({
  initialVideos,
  workspaceId,
  initialOpen = false,
}: {
  initialVideos: Video[];
  workspaceId: string | null;
  initialOpen?: boolean;
}) {
  const router = useRouter();
  const [videos, setVideos] = React.useState(initialVideos);
  const [search, setSearch] = React.useState("");
  const [platform, setPlatform] = React.useState<PlatformFilter>("all");
  const [sort, setSort] = React.useState<SortOption>("newest");
  const [page, setPage] = React.useState(1);
  const [isOpen, setIsOpen] = React.useState(initialOpen);
  const [urlInput, setUrlInput] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Derive page from filters - reset to 1 when filters change
  const currentPage = React.useMemo(() => {
    // In a real app, you'd track filter changes separately
    // For now, we keep the current page but the user can navigate back
    return page;
  }, [page]);

  const filteredVideos = React.useMemo(() => {
    let result = videos.filter((video) =>
      `${video.title ?? ""} ${video.creatorName ?? ""} ${video.platform}`
        .toLowerCase()
        .includes(search.toLowerCase())
    );

    if (platform !== "all") {
      result = result.filter((v) => v.platform === platform);
    }

    result = [...result].sort((a, b) => {
      switch (sort) {
        case "newest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "views-desc":
          return (b.views ?? 0) - (a.views ?? 0);
        case "views-asc":
          return (a.views ?? 0) - (b.views ?? 0);
        case "title-asc":
          return (a.title ?? "").localeCompare(b.title ?? "");
        case "title-desc":
          return (b.title ?? "").localeCompare(a.title ?? "");
        default:
          return 0;
      }
    });

    return result;
  }, [videos, search, platform, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / PAGE_SIZE));
  const displayPage = Math.min(currentPage, totalPages);
  const pagedVideos = filteredVideos.slice(
    (displayPage - 1) * PAGE_SIZE,
    displayPage * PAGE_SIZE
  );

  const importVideos = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!workspaceId) {
      setError("Create or select a workspace before importing videos.");
      return;
    }

    const urls = urlInput
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls.length === 0) {
      setError("Enter at least one video URL.");
      return;
    }

    const validation = batchImportSchema.safeParse({
      urls,
      workspaceId,
      idempotencyKey: generateIdempotencyKey(),
    });

    if (!validation.success) {
      setError(validation.error.issues[0]?.message ?? "Enter supported video URLs.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to import videos");
      }

      if (result.skippedUrls?.length) {
        toast({
          title: `${result.videoIds.length} video(s) imported`,
          description: `${result.skippedUrls.length} duplicate(s) were skipped.`,
        });
      } else {
        toast({
          title: "Videos queued",
          description: "The ingestion job has been queued.",
        });
      }

      setIsOpen(false);
      setUrlInput("");
      router.push(`/jobs/${result.jobId}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Failed to import videos"
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteVideo = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setVideos((prev) => prev.filter((v) => v.id !== id));
      toast({ title: "Video deleted" });
    } catch {
      toast({ title: "Failed to delete video", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Research library"
        title="Video library"
        description={`${videos.length} video${videos.length !== 1 ? "s" : ""} in the active workspace`}
        actions={<Button size="sm" onClick={() => setIsOpen(true)} disabled={!workspaceId}><Plus className="h-3.5 w-3.5" />Import videos</Button>}
      />

      {videos.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search videos..."
              className="pl-8"
            />
          </div>
          <Select value={platform} onValueChange={(v) => setPlatform(v as PlatformFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="youtube_shorts">YouTube Shorts</SelectItem>
              <SelectItem value="instagram_reels">Instagram Reels</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="views-desc">Most views</SelectItem>
              <SelectItem value="views-asc">Fewest views</SelectItem>
              <SelectItem value="title-asc">Title A–Z</SelectItem>
              <SelectItem value="title-desc">Title Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {!workspaceId ? (
        <EmptyState
          icon={<Library className="h-5 w-5" />}
          title="Select a workspace"
          description="Create or switch to a workspace to see its video library."
          action={
            <Button asChild size="sm" variant="outline">
              <Link href="/workspaces">Manage workspaces</Link>
            </Button>
          }
        />
      ) : filteredVideos.length === 0 ? (
        <EmptyState
          icon={<Library className="h-5 w-5" />}
          title={videos.length ? "No matching videos" : "No videos imported"}
          description={
            videos.length
              ? "Try another search term or filter."
              : "Import a YouTube Short or Instagram Reel to add it to this workspace."
          }
          action={
            !videos.length ? (
              <Button size="sm" onClick={() => setIsOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Import your first video
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-4">
            {pagedVideos.map((video) => (
              <Card key={video.id} className="group relative overflow-hidden transition-colors hover:border-white/[0.14]">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <div
                    role={video.thumbnailUrl ? "img" : undefined}
                    aria-label={video.thumbnailUrl ? `Thumbnail for ${video.title ?? "video"}` : undefined}
                    className="relative aspect-video overflow-hidden rounded-lg border border-white/[0.07] bg-[radial-gradient(ellipse_at_50%_0%,rgba(155,135,245,.13),transparent_60%),linear-gradient(145deg,#171a22,#0c0e12)] bg-cover bg-center"
                    style={video.thumbnailUrl ? { backgroundImage: `url(${JSON.stringify(video.thumbnailUrl)})` } : undefined}
                  >
                    {!video.thumbnailUrl && <div className="flex h-full items-center justify-center text-zinc-600"><Play className="h-5 w-5" strokeWidth={1.6} /></div>}
                    <span className="absolute bottom-2 left-2 rounded-md border border-white/10 bg-black/55 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.12em] text-zinc-300 backdrop-blur-sm">
                      {video.platform === "youtube_shorts" ? "YouTube Short" : "Instagram Reel"}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/library/${video.id}`}
                        className="line-clamp-2 text-sm font-medium leading-5 text-zinc-100 transition-colors hover:text-violet-200"
                      >
                        {video.title ?? video.canonicalUrl}
                      </Link>
                      <p className="mt-1 truncate text-xs text-zinc-500">
                        {video.creatorName ?? "Creator unavailable"}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {video.platform === "youtube_shorts"
                        ? "YouTube Shorts"
                        : "Instagram Reels"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-800 pt-3 text-xs text-zinc-500">
                    <span>{formatNumber(video.views)} views</span>
                    <span>{formatNumber(video.likes)} likes</span>
                    <span>{formatDuration(video.durationSeconds)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant={video.metadataStatus === "ready" ? "success" : "secondary"}
                        className="capitalize text-[10px]"
                      >
                        {video.metadataStatus}
                      </Badge>
                      <Badge
                        variant={
                          video.transcriptStatus === "ready"
                            ? "success"
                            : video.transcriptStatus === "error"
                              ? "destructive"
                              : "secondary"
                        }
                        className="capitalize text-[10px]"
                      >
                        {video.transcriptStatus}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={video.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-xs text-zinc-500 transition-colors hover:border-white/[0.08] hover:bg-white/[0.04] hover:text-zinc-100"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <button
                        onClick={() => deleteVideo(video.id)}
                        disabled={deletingId === video.id}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-red-400/[0.08] hover:text-red-300 disabled:opacity-50"
                        aria-label="Delete video"
                      >
                        {deletingId === video.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={displayPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-zinc-400">
                Page {displayPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={displayPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import videos</DialogTitle>
            <DialogDescription>
              Paste up to 10 YouTube Shorts or Instagram Reels URLs, one per line.
              Duplicates within the workspace will be skipped.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={importVideos} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="video-urls">Video URLs</Label>
              <Textarea
                id="video-urls"
                value={urlInput}
                onChange={(event) => setUrlInput(event.target.value)}
                placeholder={
                  "https://www.youtube.com/shorts/...\nhttps://www.instagram.com/reel/..."
                }
                rows={6}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-400">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Import
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
