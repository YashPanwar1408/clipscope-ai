import "server-only";
import PDFDocument from "pdfkit";

export interface ReportVideo {
  id: string;
  title: string | null;
  platform: string;
  creator_name: string | null;
  views: number | null;
  likes: number | null;
  comments_count: number | null;
  duration_seconds: number | null;
  published_at: string | null;
  transcript_status: string;
  analysis_status: string;
  canonical_url: string;
}

export interface ReportBundle {
  markdown: string;
  csv: string;
  pdf: Buffer;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "N/A";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function buildMarkdownReport(videos: ReportVideo[], workspaceId: string): string {
  const lines: string[] = [
    "# ClipScope AI Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Workspace: ${workspaceId}`,
    "",
    `## Summary`,
    "",
    `- Total videos: ${videos.length}`,
    `- YouTube Shorts: ${videos.filter((v) => v.platform === "youtube_shorts").length}`,
    `- Instagram Reels: ${videos.filter((v) => v.platform === "instagram_reels").length}`,
    `- Transcripts available: ${videos.filter((v) => v.transcript_status === "ready").length}`,
    `- Analyses available: ${videos.filter((v) => v.analysis_status === "ready").length}`,
    "",
    "## Video Details",
    "",
  ];

  for (const v of videos) {
    lines.push(
      `### ${v.title ?? "Untitled"}`,
      "",
      `- Platform: ${v.platform}`,
      `- Creator: ${v.creator_name ?? "N/A"}`,
      `- URL: ${v.canonical_url}`,
      `- Views: ${formatNumber(v.views)}`,
      `- Likes: ${formatNumber(v.likes)}`,
      `- Comments: ${formatNumber(v.comments_count)}`,
      `- Duration: ${formatDuration(v.duration_seconds)}`,
      `- Published: ${v.published_at ?? "N/A"}`,
      `- Transcript: ${v.transcript_status}`,
      `- Analysis: ${v.analysis_status}`,
      ""
    );
  }

  lines.push("## Notes", "", "Metrics shown are observed values retrieved from each platform.");
  return lines.join("\n");
}

export function buildCsvReport(videos: ReportVideo[]): string {
  const headers = [
    "Title",
    "Platform",
    "Creator",
    "Views",
    "Likes",
    "Comments",
    "Duration (s)",
    "Published",
    "Transcript",
    "Analysis",
    "URL",
  ];

  const escape = (value: string | number | null | undefined): string => {
    const s = value == null ? "" : String(value);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = videos.map((v) =>
    [
      escape(v.title),
      escape(v.platform),
      escape(v.creator_name),
      escape(v.views),
      escape(v.likes),
      escape(v.comments_count),
      escape(v.duration_seconds),
      escape(v.published_at),
      escape(v.transcript_status),
      escape(v.analysis_status),
      escape(v.canonical_url),
    ].join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

export function buildPdfReport(videos: ReportVideo[], workspaceId: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("ClipScope AI Report", { align: "left" });
    doc.moveDown();
    doc.fontSize(9).fillColor("#666666").text(`Generated: ${new Date().toISOString()}`);
    doc.text(`Workspace: ${workspaceId}`);
    doc.moveDown();

    doc.fontSize(12).fillColor("#000000").text("Summary");
    doc.moveDown(0.5);
    doc.fontSize(9).text(`Total videos: ${videos.length}`);
    doc.text(
      `YouTube Shorts: ${videos.filter((v) => v.platform === "youtube_shorts").length}`
    );
    doc.text(
      `Instagram Reels: ${videos.filter((v) => v.platform === "instagram_reels").length}`
    );
    doc.text(
      `Transcripts available: ${videos.filter((v) => v.transcript_status === "ready").length}`
    );
    doc.text(
      `Analyses available: ${videos.filter((v) => v.analysis_status === "ready").length}`
    );
    doc.moveDown();

    doc.fontSize(12).text("Video Details");
    doc.moveDown(0.5);

    for (const v of videos) {
      doc.fontSize(10).text(v.title ?? "Untitled", { underline: true });
      doc.fontSize(8).fillColor("#555555");
      doc.text(
        `${v.platform} · Creator: ${v.creator_name ?? "N/A"} · Views: ${formatNumber(v.views)}`
      );
      doc.text(
        `Likes: ${formatNumber(v.likes)} · Comments: ${formatNumber(v.comments_count)} · Duration: ${formatDuration(v.duration_seconds)}`
      );
      doc.text(`Transcript: ${v.transcript_status} · Analysis: ${v.analysis_status}`);
      doc.fillColor("#000000");
      doc.moveDown(0.5);
    }

    doc.moveDown();
    doc
      .fontSize(7)
      .fillColor("#999999")
      .text(
        "Metrics shown are observed values retrieved from each platform. Raw view counts are not directly comparable across platforms."
      );

    doc.end();
  });
}

export async function buildReportBundle(
  videos: ReportVideo[],
  workspaceId: string
): Promise<ReportBundle> {
  const [markdown, csv, pdf] = await Promise.all([
    Promise.resolve(buildMarkdownReport(videos, workspaceId)),
    Promise.resolve(buildCsvReport(videos)),
    buildPdfReport(videos, workspaceId),
  ]);
  return { markdown, csv, pdf };
}
