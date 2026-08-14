import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  extractVideoId,
  detectProvider,
  formatNumber,
  formatDuration,
  truncate,
} from "../lib/utils.ts";

describe("URL parsing & provider detection", () => {
  test("detects YouTube Shorts URLs correctly", () => {
    assert.equal(
      detectProvider("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
      "youtube_shorts"
    );
    assert.equal(
      detectProvider("https://youtu.be/dQw4w9WgXcQ"),
      "youtube_shorts"
    );
  });

  test("detects Instagram Reels URLs correctly", () => {
    assert.equal(
      detectProvider("https://www.instagram.com/reel/C3x4yZ1v2wQ/"),
      "instagram_reels"
    );
    assert.equal(
      detectProvider("https://instagram.com/reels/C3x4yZ1v2wQ"),
      "instagram_reels"
    );
  });

  test("returns null for unsupported URLs", () => {
    assert.equal(detectProvider("https://tiktok.com/@user/video/123"), null);
    assert.equal(detectProvider("https://twitter.com/i/status/123"), null);
  });

  test("extracts YouTube Shorts video ID", () => {
    assert.equal(
      extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
      "dQw4w9WgXcQ"
    );
  });

  test("extracts Instagram Reels shortcode", () => {
    assert.equal(
      extractVideoId("https://www.instagram.com/reel/C3x4yZ1v2wQ/"),
      "C3x4yZ1v2wQ"
    );
  });
});

describe("Formatting utilities", () => {
  test("formatNumber returns formatted metrics", () => {
    assert.equal(formatNumber(null), "—");
    assert.equal(formatNumber(undefined), "—");
    assert.equal(formatNumber(450), "450");
    assert.equal(formatNumber(1500), "1.5K");
    assert.equal(formatNumber(2400000), "2.4M");
  });

  test("formatDuration formats seconds to m:ss", () => {
    assert.equal(formatDuration(null), "—");
    assert.equal(formatDuration(45), "0:45");
    assert.equal(formatDuration(75), "1:15");
    assert.equal(formatDuration(360), "6:00");
  });

  test("truncate handles string limits cleanly", () => {
    assert.equal(truncate("Hello world", 20), "Hello world");
    assert.equal(truncate("This is a long sentence that exceeds the limit", 15), "This is a lo…");
  });
});
