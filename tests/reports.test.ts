import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  buildMarkdownReport,
  buildCsvReport,
  buildPdfReport,
  buildReportBundle,
  type ReportVideo,
} from "../lib/reports/generator.ts";

const sampleVideos: ReportVideo[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    title: "Amazing Hook Tutorial",
    platform: "youtube_shorts",
    creator_name: "Creator One",
    views: 150000,
    likes: 8000,
    comments_count: 450,
    duration_seconds: 58,
    published_at: "2024-03-01T00:00:00Z",
    transcript_status: "ready",
    analysis_status: "ready",
    canonical_url: "https://www.youtube.com/shorts/abc123",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    title: "Viral Reel Strategy",
    platform: "instagram_reels",
    creator_name: "Creator Two",
    views: null,
    likes: null,
    comments_count: null,
    duration_seconds: null,
    published_at: null,
    transcript_status: "unavailable",
    analysis_status: "none",
    canonical_url: "https://www.instagram.com/reel/XYZ789/",
  },
];

describe("buildMarkdownReport", () => {
  test("includes report header and workspace ID", () => {
    const md = buildMarkdownReport(sampleVideos, "ws-123");
    assert.match(md, /# ClipScope AI Report/);
    assert.match(md, /Workspace: ws-123/);
    assert.match(md, /Generated:/);
  });

  test("includes summary counts", () => {
    const md = buildMarkdownReport(sampleVideos, "ws-123");
    assert.match(md, /Total videos: 2/);
    assert.match(md, /YouTube Shorts: 1/);
    assert.match(md, /Instagram Reels: 1/);
    assert.match(md, /Transcripts available: 1/);
    assert.match(md, /Analyses available: 1/);
  });

  test("includes video details with metrics", () => {
    const md = buildMarkdownReport(sampleVideos, "ws-123");
    assert.match(md, /Amazing Hook Tutorial/);
    assert.match(md, /Views: 150,000/);
    assert.match(md, /Likes: 8,000/);
    assert.match(md, /Comments: 450/);
  });

  test("marks null metrics as N/A rather than fabricating values", () => {
    const md = buildMarkdownReport(sampleVideos, "ws-123");
    assert.match(md, /Views: N\/A/);
    assert.match(md, /Likes: N\/A/);
  });

  test("includes note about observed values", () => {
    const md = buildMarkdownReport(sampleVideos, "ws-123");
    assert.match(md, /observed values/);
  });

  test("handles empty video list", () => {
    const md = buildMarkdownReport([], "ws-123");
    assert.match(md, /Total videos: 0/);
  });
});

describe("buildCsvReport", () => {
  test("generates valid CSV with headers", () => {
    const csv = buildCsvReport(sampleVideos);
    const lines = csv.split("\n");
    assert.ok(lines.length >= 3); // header + 2 rows
    assert.ok(lines[0].includes("Title"));
    assert.ok(lines[0].includes("Platform"));
    assert.ok(lines[0].includes("Views"));
    assert.ok(lines[0].includes("URL"));
  });

  test("includes video data rows", () => {
    const csv = buildCsvReport(sampleVideos);
    assert.ok(csv.includes("Amazing Hook Tutorial"));
    assert.ok(csv.includes("Viral Reel Strategy"));
  });

  test("escapes commas in titles", () => {
    const withComma: ReportVideo = {
      ...sampleVideos[0],
      title: "Hook, line, and sinker",
    };
    const csv = buildCsvReport([withComma]);
    assert.ok(csv.includes('"Hook, line, and sinker"'));
  });

  test("handles empty video list with just headers", () => {
    const csv = buildCsvReport([]);
    const lines = csv.split("\n");
    assert.equal(lines.length, 1);
  });
});

describe("buildPdfReport", () => {
  test("generates a non-empty PDF buffer", async () => {
    const pdf = await buildPdfReport(sampleVideos, "ws-123");
    assert.ok(Buffer.isBuffer(pdf));
    assert.ok(pdf.length > 100);
    // PDF magic number
    assert.equal(pdf.slice(0, 5).toString(), "%PDF-");
  });

  test("handles empty video list", async () => {
    const pdf = await buildPdfReport([], "ws-123");
    assert.ok(pdf.length > 0);
    assert.equal(pdf.slice(0, 5).toString(), "%PDF-");
  });
});

describe("buildReportBundle", () => {
  test("produces all three formats", async () => {
    const bundle = await buildReportBundle(sampleVideos, "ws-123");
    assert.ok(bundle.markdown.length > 0);
    assert.ok(bundle.csv.length > 0);
    assert.ok(Buffer.isBuffer(bundle.pdf));
    assert.ok(bundle.pdf.length > 0);
    assert.equal(bundle.pdf.slice(0, 5).toString(), "%PDF-");
  });
});
