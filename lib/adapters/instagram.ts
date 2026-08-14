import "server-only";
import { safeFetch } from "@/lib/api/ssrf-protection";

const INSTAGRAM_LOOTER_HOST = "instagram-looter2.p.rapidapi.com";
const INSTAGRAM_LOOTER_URL = `https://${INSTAGRAM_LOOTER_HOST}/post`;

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function firstString(...values: unknown[]): string | null {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim() ?? null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const match = value.trim().replace(/,/g, "").match(/^(\d+(?:\.\d+)?)\s*([kmb])?$/i);
      if (!match) continue;
      const suffix = match[2]?.toLowerCase();
      const multiplier = suffix === "k" ? 1_000 : suffix === "m" ? 1_000_000 : suffix === "b" ? 1_000_000_000 : 1;
      const parsed = Number(match[1]) * multiplier;
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function nestedString(value: unknown, key: string): string | null {
  return firstString(asRecord(value)?.[key]);
}

function nestedCount(value: unknown): number | null {
  const record = asRecord(value);
  return firstNumber(record?.count, record?.value, record?.total);
}

function firstEdgeText(value: unknown): string | null {
  const first = Array.isArray(value) ? asRecord(value[0]) : null;
  return nestedString(first?.node, "text");
}

function firstMediaRecord(value: unknown, depth = 0): JsonRecord | null {
  if (depth > 5) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstMediaRecord(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  const record = asRecord(value);
  if (!record) return null;
  if (isMediaRecord(record)) return record;
  for (const key of ["data", "result", "response", "post", "media", "item", "items", "post_info", "media_info", "graphql", "shortcode_media", "node"]) {
    const found = firstMediaRecord(record[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function isMediaRecord(record: JsonRecord): boolean {
  return [
    "caption",
    "owner",
    "user",
    "author",
    "display_url",
    "image_versions2",
    "video_duration",
    "like_count",
    "play_count",
    "video_play_count",
    "viewCount",
    "likesCount",
    "commentsCount",
    "caption_text",
    "edge_media_to_caption",
    "edge_media_preview_like",
    "edge_liked_by",
    "edge_media_to_comment",
    "shortcode",
    "code",
  ].some((key) => key in record);
}

function firstImageUrl(media: JsonRecord): string | null {
  const versions = asRecord(media.image_versions2);
  const candidates = versions?.candidates;
  const firstCandidate = Array.isArray(candidates) ? asRecord(candidates[0]) : null;
  const thumbnails = media.thumbnail_resources;
  const firstThumbnail = Array.isArray(thumbnails) ? asRecord(thumbnails[0]) : null;

  return firstString(
    media.display_url,
    media.thumbnail_url,
    media.thumbnailUrl,
    media.thumbnail,
    media.thumbnail_src,
    media.displayUrl,
    firstCandidate?.url,
    firstThumbnail?.src
  );
}

function parsePublishedAt(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      const date = new Date(value < 10_000_000_000 ? value * 1000 : value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
    if (typeof value === "string" && value) {
      if (/^\d{10,13}$/.test(value)) {
        const numeric = Number(value);
        const timestamp = new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
        if (!Number.isNaN(timestamp.getTime())) return timestamp.toISOString();
      }
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }
  }
  return null;
}

function providerErrorMessage(body: string): string | null {
  if (!body) return null;
  try {
    const parsed = asRecord(JSON.parse(body));
    const nestedError = asRecord(parsed?.error);
    const message = firstString(
      parsed?.message,
      parsed?.detail,
      nestedError?.message,
      nestedError?.detail,
      nestedError?.code
    );
    if (message) return message.slice(0, 240);
  } catch {
    // Some RapidAPI errors are plain text rather than JSON.
  }

  return body.replace(/\s+/g, " ").replace(/<[^>]*>/g, "").trim().slice(0, 240) || null;
}

export interface InstagramMetadataResult {
  shortcode: string;
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

/**
 * Fetch public Instagram Reel metadata through Instagram Looter on RapidAPI.
 * Preserves data honesty: missing view counts or likes remain null, never fabricated.
 */
export async function fetchInstagramMetadata(
  urlOrCode: string,
  signal?: AbortSignal
): Promise<InstagramMetadataResult | null> {
  const match = urlOrCode.match(/instagram\.com\/(?:reels?|p)\/([A-Za-z0-9_-]+)/i);
  const shortcode = match ? match[1] : urlOrCode;

  if (!shortcode || shortcode.length < 3) return null;

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey || apiKey.includes("your-")) {
    return {
      shortcode,
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
      error: "RapidAPI key not configured in environment (RAPIDAPI_KEY)",
    };
  }

  try {
    const instagramUrl = /^https?:\/\//i.test(urlOrCode)
      ? urlOrCode
      : `https://www.instagram.com/reel/${encodeURIComponent(shortcode)}/`;
    const requestUrl = new URL(INSTAGRAM_LOOTER_URL);
    requestUrl.searchParams.set("url", instagramUrl);

    const res = await safeFetch(
      requestUrl.toString(),
      {
        signal,
        headers: {
          "x-rapidapi-key": apiKey,
          "x-rapidapi-host": INSTAGRAM_LOOTER_HOST,
        },
      },
      15000
    );

    if (!res.ok) {
      const details = providerErrorMessage(await res.text());
      const retryAfter = res.headers.get("retry-after");
      const retryHint = retryAfter ? `; retry after ${retryAfter}` : "";
      return {
        shortcode,
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
        error: `Instagram Looter returned status ${res.status}${res.statusText ? ` ${res.statusText}` : ""}${retryHint}${details ? `: ${details}` : ""}`,
      };
    }

    const responseData: unknown = await res.json();
    const responseRecord = asRecord(responseData);
    const responseError = asRecord(responseRecord?.error);
    if (responseRecord?.success === false || responseRecord?.status === "error" || responseError) {
      const message = firstString(
        responseRecord?.message,
        responseRecord?.detail,
        responseError?.message,
        responseError?.detail,
        responseError?.code
      );
      return {
        shortcode,
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
        error: message ? `Instagram Looter: ${message}` : "Instagram Looter could not retrieve this Reel",
      };
    }

    const data = firstMediaRecord(responseData);
    if (!data) {
      return {
        shortcode,
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
        error: "Instagram Looter returned an unrecognized response for this Reel",
      };
    }

    const caption = data.caption;
    const captionText = firstString(
      typeof caption === "string" ? caption : null,
      nestedString(caption, "text"),
      typeof data.caption_text === "string" ? data.caption_text : null,
      nestedString(data.caption_text, "text"),
      firstEdgeText(asRecord(data.edge_media_to_caption)?.edges)
    );
    const owner = asRecord(data.owner) ?? asRecord(data.user) ?? asRecord(data.author) ?? asRecord(data.user_info);
    const durationSeconds = firstNumber(data.video_duration, data.duration, asRecord(data.clips_metadata)?.duration);

    return {
      shortcode,
      title: firstString(data.title, data.video_title, captionText?.split(/\r?\n/, 1)[0]?.slice(0, 160)),
      description: captionText,
      channelName: firstString(owner?.username, owner?.full_name, owner?.name),
      channelId: firstString(owner?.id, owner?.pk, owner?.user_id),
      thumbnailUrl: firstImageUrl(data),
      durationSeconds: durationSeconds === null ? null : Math.round(durationSeconds),
      viewCount: firstNumber(data.video_view_count, data.view_count, data.viewCount, data.views, data.play_count, data.video_play_count, nestedCount(data.video_view_count)),
      likeCount: firstNumber(data.like_count, data.likeCount, data.likes_count, data.likesCount, data.likes, nestedCount(data.edge_media_preview_like), nestedCount(data.edge_liked_by)),
      commentCount: firstNumber(data.comment_count, data.commentCount, data.comments_count, data.commentsCount, data.comments, nestedCount(data.edge_media_to_comment)),
      publishedAt: parsePublishedAt(data.taken_at_timestamp, data.taken_at, data.timestamp, data.created_at, data.published_at, data.publishedAt),
      error: null,
    };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      shortcode,
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
        ? "Instagram metadata fetch timed out"
        : err instanceof Error
          ? err.message
          : "Failed to fetch Instagram Reel metadata",
    };
  }
}
