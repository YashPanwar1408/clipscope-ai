import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normalizeVideoUrl } from "../lib/ingestion/server.ts";

describe("normalizeVideoUrl", () => {
  test("normalizes YouTube Shorts URL with www subdomain", () => {
    const result = normalizeVideoUrl("https://www.youtube.com/shorts/abc123");
    assert.ok(result);
    assert.equal(result.provider, "youtube_shorts");
    assert.equal(result.providerId, "abc123");
    assert.equal(result.canonicalUrl, "https://www.youtube.com/shorts/abc123");
  });

  test("normalizes YouTube Shorts URL without www subdomain", () => {
    const result = normalizeVideoUrl("https://youtube.com/shorts/xyz789");
    assert.ok(result);
    assert.equal(result.provider, "youtube_shorts");
    assert.equal(result.providerId, "xyz789");
    assert.equal(result.canonicalUrl, "https://www.youtube.com/shorts/xyz789");
  });

  test("normalizes YouTube Shorts URL with m subdomain", () => {
    const result = normalizeVideoUrl("https://m.youtube.com/shorts/def456");
    assert.ok(result);
    assert.equal(result.providerId, "def456");
    assert.equal(result.canonicalUrl, "https://www.youtube.com/shorts/def456");
  });

  test("normalizes YouTube Shorts URL with query params", () => {
    const result = normalizeVideoUrl(
      "https://www.youtube.com/shorts/ghi101?feature=share&si=abc"
    );
    assert.ok(result);
    assert.equal(result.providerId, "ghi101");
    assert.equal(result.canonicalUrl, "https://www.youtube.com/shorts/ghi101");
  });

  test("normalizes Instagram Reels URL", () => {
    const result = normalizeVideoUrl("https://www.instagram.com/reel/ABC123/");
    assert.ok(result);
    assert.equal(result.provider, "instagram_reels");
    assert.equal(result.providerId, "ABC123");
    assert.equal(result.canonicalUrl, "https://www.instagram.com/reel/ABC123/");
  });

  test("normalizes Instagram Reels URL without trailing slash", () => {
    const result = normalizeVideoUrl("https://instagram.com/reel/XYZ789");
    assert.ok(result);
    assert.equal(result.providerId, "XYZ789");
    assert.equal(result.canonicalUrl, "https://www.instagram.com/reel/XYZ789/");
  });

  test("rejects unsupported URL (Vimeo)", () => {
    const result = normalizeVideoUrl("https://vimeo.com/12345678");
    assert.equal(result, null);
  });

  test("rejects unsupported URL (regular YouTube watch)", () => {
    const result = normalizeVideoUrl("https://www.youtube.com/watch?v=abc123");
    assert.equal(result, null);
  });

  test("rejects empty URL", () => {
    const result = normalizeVideoUrl("");
    assert.equal(result, null);
  });

  test("rejects non-URL string", () => {
    const result = normalizeVideoUrl("not a url");
    assert.equal(result, null);
  });
});

describe("canonical URL deduplication", () => {
  test("different URL forms of the same video produce the same canonical URL", () => {
    const forms = [
      "https://www.youtube.com/shorts/abc123",
      "https://youtube.com/shorts/abc123",
      "https://m.youtube.com/shorts/abc123",
      "https://www.youtube.com/shorts/abc123?si=xyz",
    ];

    const canonical = normalizeVideoUrl(forms[0])!.canonicalUrl;
    for (const form of forms) {
      assert.equal(normalizeVideoUrl(form)!.canonicalUrl, canonical);
    }
  });

  test("Instagram reel URL forms normalize to same canonical", () => {
    const withSlash = normalizeVideoUrl("https://www.instagram.com/reel/ABC123/");
    const withoutSlash = normalizeVideoUrl("https://instagram.com/reel/ABC123");
    assert.equal(withSlash!.canonicalUrl, withoutSlash!.canonicalUrl);
  });
});
