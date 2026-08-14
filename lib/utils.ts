import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function parseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(dateStr: string | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function formatDateTime(dateStr: string | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function extractVideoId(url: string): string | null {
  // YouTube Shorts
  const ytMatch = url.match(
    /youtube\.com\/shorts\/([A-Za-z0-9_-]+)|youtu\.be\/([A-Za-z0-9_-]+)/
  );
  if (ytMatch) return ytMatch[1] ?? ytMatch[2];

  // Instagram Reels
  const igMatch = url.match(/instagram\.com\/reels?\/([A-Za-z0-9_-]+)/);
  if (igMatch) return igMatch[1];

  return null;
}

export function detectProvider(
  url: string
): "youtube_shorts" | "instagram_reels" | null {
  if (/youtube\.com\/shorts\/|youtu\.be\//i.test(url)) return "youtube_shorts";
  if (/instagram\.com\/reels?\//i.test(url)) return "instagram_reels";
  return null;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "…";
}

export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return "just now";
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
