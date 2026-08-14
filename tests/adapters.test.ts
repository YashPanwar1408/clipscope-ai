import { describe, it, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  fetchYouTubeMetadata,
  fetchYouTubeTranscript,
  parseISO8601Duration,
} from "../lib/adapters/youtube.ts";
import { fetchInstagramMetadata } from "../lib/adapters/instagram.ts";

describe("parseISO8601Duration", () => {
  it("parses seconds-only duration", () => {
    assert.equal(parseISO8601Duration("PT45S"), 45);
  });

  it("parses minutes and seconds", () => {
    assert.equal(parseISO8601Duration("PT1M15S"), 75);
  });

  it("parses minutes only", () => {
    assert.equal(parseISO8601Duration("PT2M"), 120);
  });

  it("returns null for invalid format", () => {
    assert.equal(parseISO8601Duration("invalid"), null);
  });
});

describe("fetchYouTubeMetadata", () => {
  const originalApiKey = process.env.YOUTUBE_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "test-api-key-12345";
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.YOUTUBE_API_KEY;
    } else {
      process.env.YOUTUBE_API_KEY = originalApiKey;
    }
    global.fetch = originalFetch;
  });

  it("returns null for invalid video ID", async () => {
    const result = await fetchYouTubeMetadata("ab");
    assert.equal(result, null);
  });

  it("returns error when API key is not configured", async () => {
    delete process.env.YOUTUBE_API_KEY;
    const result = await fetchYouTubeMetadata("dQw4w9WgXcQ");
    assert.notEqual(result, null);
    assert.match(result!.error!, /not configured/);
  });

  it("parses successful YouTube API response", async () => {
    global.fetch = mock.fn(async () =>
      Response.json({
        items: [
          {
            id: "dQw4w9WgXcQ",
            snippet: {
              title: "Test Video",
              description: "A test video",
              channelTitle: "Test Channel",
              channelId: "UC123",
              publishedAt: "2024-01-01T00:00:00Z",
              thumbnails: { high: { url: "https://img.example.com/hq.jpg" } },
            },
            statistics: {
              viewCount: "1000",
              likeCount: "50",
              commentCount: "10",
            },
            contentDetails: { duration: "PT45S" },
          },
        ],
      })
    ) as unknown as typeof fetch;

    const result = await fetchYouTubeMetadata("dQw4w9WgXcQ");
    assert.notEqual(result, null);
    assert.equal(result!.title, "Test Video");
    assert.equal(result!.channelName, "Test Channel");
    assert.equal(result!.viewCount, 1000);
    assert.equal(result!.likeCount, 50);
    assert.equal(result!.commentCount, 10);
    assert.equal(result!.durationSeconds, 45);
    assert.equal(result!.publishedAt, "2024-01-01T00:00:00Z");
    assert.equal(result!.error, null);
  });

  it("preserves null for missing metrics", async () => {
    global.fetch = mock.fn(async () =>
      Response.json({
        items: [
          {
            id: "dQw4w9WgXcQ",
            snippet: { title: "No Stats" },
            statistics: {},
            contentDetails: {},
          },
        ],
      })
    ) as unknown as typeof fetch;

    const result = await fetchYouTubeMetadata("dQw4w9WgXcQ");
    assert.notEqual(result, null);
    assert.equal(result!.viewCount, null);
    assert.equal(result!.likeCount, null);
    assert.equal(result!.durationSeconds, null);
    assert.equal(result!.error, null);
  });

  it("detects YouTube API quota exceeded (403)", async () => {
    global.fetch = mock.fn(async () =>
      new Response(
        JSON.stringify({
          error: {
            errors: [{ reason: "quotaExceeded", message: "Quota exceeded" }],
          },
        }),
        { status: 403 }
      )
    ) as unknown as typeof fetch;

    const result = await fetchYouTubeMetadata("dQw4w9WgXcQ");
    assert.notEqual(result, null);
    assert.match(result!.error!, /quota exceeded/i);
  });

  it("handles video not found (empty items)", async () => {
    global.fetch = mock.fn(async () =>
      Response.json({ items: [] })
    ) as unknown as typeof fetch;

    const result = await fetchYouTubeMetadata("dQw4w9WgXcQ");
    assert.notEqual(result, null);
    assert.match(result!.error!, /not found/i);
  });

  it("handles AbortError as timeout", async () => {
    global.fetch = mock.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      // Simulate abort
      if (init?.signal) {
        (init.signal as AbortSignal).dispatchEvent(new Event("abort"));
      }
      throw new DOMException("Aborted", "AbortError");
    }) as unknown as typeof fetch;

    const result = await fetchYouTubeMetadata("dQw4w9WgXcQ");
    assert.notEqual(result, null);
    assert.match(result!.error!, /timed out/i);
  });

  it("extracts video ID from shorts URL", async () => {
    global.fetch = mock.fn(async () =>
      Response.json({
        items: [
          {
            id: "abc123",
            snippet: { title: "Short" },
            statistics: {},
            contentDetails: {},
          },
        ],
      })
    ) as unknown as typeof fetch;

    const result = await fetchYouTubeMetadata("https://youtube.com/shorts/abc123");
    assert.notEqual(result, null);
    assert.equal(result!.videoId, "abc123");
  });
});

describe("fetchYouTubeTranscript", () => {
  it("returns unavailable for null video ID", async () => {
    const result = await fetchYouTubeTranscript(null);
    assert.equal(result.status, "unavailable");
  });

  it("returns unavailable honestly (no fabrication)", async () => {
    const result = await fetchYouTubeTranscript("dQw4w9WgXcQ");
    assert.equal(result.status, "unavailable");
    assert.equal(result.transcript, null);
  });
});

describe("fetchInstagramMetadata", () => {
  const originalApiKey = process.env.RAPIDAPI_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.RAPIDAPI_KEY = "test-rapid-key-12345";
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.RAPIDAPI_KEY;
    } else {
      process.env.RAPIDAPI_KEY = originalApiKey;
    }
    global.fetch = originalFetch;
  });

  it("returns null for invalid shortcode", async () => {
    const result = await fetchInstagramMetadata("ab");
    assert.equal(result, null);
  });

  it("returns error when RapidAPI key not configured", async () => {
    delete process.env.RAPIDAPI_KEY;
    const result = await fetchInstagramMetadata("ABC123");
    assert.notEqual(result, null);
    assert.match(result!.error!, /not configured/);
  });

  it("parses successful Instagram API response", async () => {
    global.fetch = mock.fn(async () =>
      Response.json({
        caption: "A great reel",
        owner: { username: "creator", id: "456" },
        display_url: "https://img.example.com/reel.jpg",
        video_duration: 30.5,
        video_view_count: 5000,
        like_count: 200,
        comment_count: 15,
        taken_at_timestamp: 1700000000,
      })
    ) as unknown as typeof fetch;

    const result = await fetchInstagramMetadata("ABC123");
    assert.notEqual(result, null);
    assert.equal(result!.title, "A great reel");
    assert.equal(result!.channelName, "creator");
    assert.equal(result!.durationSeconds, 31);
    assert.equal(result!.viewCount, 5000);
    assert.equal(result!.likeCount, 200);
    assert.equal(result!.commentCount, 15);
    assert.equal(result!.error, null);
  });

  it("preserves null for missing Instagram metrics", async () => {
    global.fetch = mock.fn(async () =>
      Response.json({ caption: "Minimal reel" })
    ) as unknown as typeof fetch;

    const result = await fetchInstagramMetadata("ABC123");
    assert.notEqual(result, null);
    assert.equal(result!.viewCount, null);
    assert.equal(result!.likeCount, null);
    assert.equal(result!.durationSeconds, null);
    assert.equal(result!.channelName, null);
    assert.equal(result!.error, null);
  });

  it("handles non-OK API response", async () => {
    global.fetch = mock.fn(async () =>
      new Response("Forbidden", { status: 403, statusText: "Forbidden" })
    ) as unknown as typeof fetch;

    const result = await fetchInstagramMetadata("ABC123");
    assert.notEqual(result, null);
    assert.match(result!.error!, /status 403/);
  });

  it("handles AbortError as timeout", async () => {
    global.fetch = mock.fn(async () => {
      throw new DOMException("Aborted", "AbortError");
    }) as unknown as typeof fetch;

    const result = await fetchInstagramMetadata("ABC123");
    assert.notEqual(result, null);
    assert.match(result!.error!, /timed out/i);
  });
});
