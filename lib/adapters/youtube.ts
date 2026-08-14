import "server-only";
import { safeFetch } from "@/lib/api/ssrf-protection";

export interface YouTubeMetadataResult {
  videoId: string;
  title: string | null;
  description: string | null;
  channelName: string | null;
  channelId: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  publishedAt: string | null;
  error: string | null;
}

export interface YouTubeTranscriptResult {
  transcript: string | null;
  language?: string | null;
  status: "ready" | "unavailable" | "error";
  error: string | null;
}

const MAX_METADATA_FETCH_MS = 15_000;
const MAX_TRANSCRIPT_FETCH_MS = 12_000;

/**
 * Parses duration string (e.g. PT45S, PT1M15S) into seconds.
 */
export function parseISO8601Duration(durationStr: string): number | null {
  const match = durationStr.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const minutes = parseInt(match[1] ?? "0", 10);
  const seconds = parseInt(match[2] ?? "0", 10);
  return minutes * 60 + seconds;
}

/**
 * Fetch video metadata using the official YouTube Data API v3.
 * Adheres to data honesty: does not fabricate missing metrics.
 */
export async function fetchYouTubeMetadata(
  urlOrId: string,
  signal?: AbortSignal
): Promise<YouTubeMetadataResult | null> {
  const match = urlOrId.match(
    /youtube\.com\/shorts\/([A-Za-z0-9_-]+)|youtu\.be\/([A-Za-z0-9_-]+)/
  );
  const videoId = match ? match[1] ?? match[2] : urlOrId;

  if (!videoId || videoId.length < 5) return null;

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || apiKey.includes("your-")) {
    return {
      videoId,
      title: null,
      description: null,
      channelName: null,
      channelId: null,
      thumbnailUrl: null,
      durationSeconds: null,
      viewCount: null,
      likeCount: null,
      commentCount: null,
      publishedAt: null,
      error: "YouTube API key not configured in environment (YOUTUBE_API_KEY)",
    };
  }

  try {
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics,contentDetails&key=${apiKey}`;
    const res = await safeFetch(apiUrl, { signal }, MAX_METADATA_FETCH_MS);

    if (!res.ok) {
      let errorMsg = `YouTube API returned status ${res.status}: ${res.statusText}`;
      // Detect quota exhaustion for explicit error classification.
      if (res.status === 403) {
        try {
          const errBody = await res.json();
          const reason = errBody?.error?.errors?.[0]?.reason;
          if (reason === "quotaExceeded" || reason === "dailyLimitExceeded") {
            errorMsg = "YouTube API quota exceeded. Try again later.";
          }
        } catch {
          // Ignore body parse errors; fall back to status message.
        }
      }
      return {
        videoId,
        title: null,
        description: null,
        channelName: null,
        channelId: null,
        thumbnailUrl: null,
        durationSeconds: null,
        viewCount: null,
        likeCount: null,
        commentCount: null,
        publishedAt: null,
        error: errorMsg,
      };
    }

    const data = await res.json();
    const item = data.items?.[0];

    if (!item) {
      return {
        videoId,
        title: null,
        description: null,
        channelName: null,
        channelId: null,
        thumbnailUrl: null,
        durationSeconds: null,
        viewCount: null,
        likeCount: null,
        commentCount: null,
        publishedAt: null,
        error: "Video not found or is set to private",
      };
    }

    const durationSeconds = item.contentDetails?.duration
      ? parseISO8601Duration(item.contentDetails.duration)
      : null;

    return {
      videoId,
      title: item.snippet?.title ?? null,
      description: item.snippet?.description ?? null,
      channelName: item.snippet?.channelTitle ?? null,
      channelId: item.snippet?.channelId ?? null,
      thumbnailUrl:
        item.snippet?.thumbnails?.maxres?.url ??
        item.snippet?.thumbnails?.high?.url ??
        item.snippet?.thumbnails?.medium?.url ??
        null,
      durationSeconds,
      viewCount: item.statistics?.viewCount
        ? parseInt(item.statistics.viewCount, 10)
        : null,
      likeCount: item.statistics?.likeCount
        ? parseInt(item.statistics.likeCount, 10)
        : null,
      commentCount: item.statistics?.commentCount
        ? parseInt(item.statistics.commentCount, 10)
        : null,
      publishedAt: item.snippet?.publishedAt ?? null,
      error: null,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      videoId,
      title: null,
      description: null,
      channelName: null,
      channelId: null,
      thumbnailUrl: null,
      durationSeconds: null,
      viewCount: null,
      likeCount: null,
      commentCount: null,
      publishedAt: null,
      error: isAbort
        ? "YouTube metadata fetch timed out"
        : err instanceof Error
          ? err.message
          : "Failed to fetch YouTube metadata",
    };
  }
}

function parsePlayerResponse(html: string): Record<string, unknown> | null {
  const assignment = html.indexOf("ytInitialPlayerResponse");
  if (assignment < 0) return null;
  const equals = html.indexOf("=", assignment);
  const start = equals < 0 ? -1 : html.indexOf("{", equals + 1);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      try {
        const parsed: unknown = JSON.parse(html.slice(start, index + 1));
        return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function transcriptFromJson3(value: unknown): string | null {
  const events = (value as { events?: Array<{ segs?: Array<{ utf8?: string }> }> } | null)?.events;
  if (!Array.isArray(events)) return null;
  const text = events
    .flatMap((event) => event.segs ?? [])
    .map((segment) => segment.utf8 ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

function transcriptFromXml(xml: string): string | null {
  const text = [...xml.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)]
    .map((match) => decodeHtmlEntities(match[1].replace(/<[^>]+>/g, "")))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text || null;
}

/** Fetch an available public caption track from the YouTube player. */
export async function fetchYouTubeTranscript(
  videoId: string | null
): Promise<YouTubeTranscriptResult> {
  if (!videoId) {
    return {
      transcript: null,
      status: "unavailable",
      error: "No video ID provided",
    };
  }

  try {
    const watchUrl = new URL("https://www.youtube.com/watch");
    watchUrl.searchParams.set("v", videoId);
    watchUrl.searchParams.set("hl", "en");
    const page = await safeFetch(
      watchUrl.toString(),
      {
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; ClipScopeAI/1.0)",
          "accept-language": "en-US,en;q=0.9",
        },
      },
      MAX_TRANSCRIPT_FETCH_MS
    );
    if (!page.ok) {
      return { transcript: null, status: "unavailable", error: `YouTube captions could not be loaded (${page.status})` };
    }

    const player = parsePlayerResponse(await page.text());
    const captions = (player?.captions as {
      playerCaptionsTracklistRenderer?: { captionTracks?: Array<{ baseUrl?: string; languageCode?: string }> };
    } | undefined)?.playerCaptionsTracklistRenderer?.captionTracks;
    if (!captions?.length) {
      return { transcript: null, status: "unavailable", error: "No public caption track is available for this video" };
    }

    const track = captions.find((candidate) => candidate.languageCode?.toLowerCase().startsWith("en")) ?? captions[0];
    if (!track.baseUrl) {
      return { transcript: null, status: "unavailable", error: "YouTube did not expose a caption URL" };
    }

    const captionUrl = new URL(track.baseUrl);
    captionUrl.searchParams.set("fmt", "json3");
    const response = await safeFetch(captionUrl.toString(), {}, MAX_TRANSCRIPT_FETCH_MS);
    if (!response.ok) {
      return { transcript: null, status: "unavailable", error: `YouTube caption track returned ${response.status}` };
    }

    const body = await response.text();
    let transcript: string | null = null;
    try {
      transcript = transcriptFromJson3(JSON.parse(body));
    } catch {
      transcript = transcriptFromXml(body);
    }
    return transcript
      ? { transcript, language: track.languageCode ?? null, status: "ready", error: null }
      : { transcript: null, status: "unavailable", error: "The available caption track was empty" };
  } catch (error) {
    return {
      transcript: null,
      status: error instanceof Error && error.name === "AbortError" ? "error" : "unavailable",
      error: error instanceof Error ? error.message : "Failed to fetch YouTube captions",
    };
  }
}
