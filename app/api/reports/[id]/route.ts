import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_FORMATS = ["md", "csv", "pdf"] as const;
type Format = (typeof VALID_FORMATS)[number];

const CONTENT_TYPES: Record<Format, string> = {
  md: "text/markdown",
  csv: "text/csv",
  pdf: "application/pdf",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await params;

    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Invalid report ID" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const format = (searchParams.get("format") ?? "pdf") as Format;

    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json(
        { error: "Invalid format. Use md, csv, or pdf." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: report, error } = await supabase
      .from("reports")
      .select("id, workspace_id, status, storage_path")
      .eq("id", id)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    await requireWorkspaceAccess(report.workspace_id, "viewer");

    if (report.status !== "ready" || !report.storage_path) {
      return NextResponse.json(
        { error: `Report is not ready. Status: ${report.status}` },
        { status: 409 }
      );
    }

    const storedBasePath = report.storage_path.replace(/^\/+|\/+$/g, "");
    const storedPathWithoutExtension = storedBasePath.replace(/\.(?:md|csv|pdf)$/i, "");
    const basePaths = [
      storedBasePath,
      storedPathWithoutExtension,
      `${report.workspace_id}/${report.id}`,
      `reports/${report.workspace_id}/${report.id}`,
      storedPathWithoutExtension.replace(/^reports\//, ""),
    ];
    const candidates = [...new Set(basePaths)].map((basePath) => ({
      basePath,
      filePath: `${basePath}.${format}`,
    }));

    // Workspace membership was checked above. Use the server-only client for
    // Storage so downloads don't depend on project-specific object RLS setup.
    const admin = createAdminClient();
    let file: Blob | null = null;
    let resolvedBasePath: string | null = null;
    let lastDownloadError: unknown;

    for (const candidate of candidates) {
      const { data, error: downloadError } = await admin.storage
        .from("reports")
        .download(candidate.filePath);

      if (data) {
        file = data;
        resolvedBasePath = candidate.basePath;
        break;
      }

      lastDownloadError = downloadError;
    }

    if (!file || !resolvedBasePath) {
      console.error("[reports] Storage download failed:", {
        reportId: report.id,
        workspaceId: report.workspace_id,
        paths: candidates.map(({ filePath }) => filePath),
        error: lastDownloadError,
      });
      return NextResponse.json(
        { error: "Report file not found" },
        { status: 404 }
      );
    }

    if (resolvedBasePath !== storedBasePath) {
      const { error: pathUpdateError } = await admin
        .from("reports")
        .update({ storage_path: resolvedBasePath })
        .eq("id", report.id)
        .eq("workspace_id", report.workspace_id);

      if (pathUpdateError) {
        console.warn("[reports] Could not normalize stored file path:", pathUpdateError);
      }
    }

    const arrayBuffer = await file.arrayBuffer();
    const filename = `content-studio-report-${id}.${format}`;

    return new NextResponse(arrayBuffer, {
      headers: {
        "Content-Type": CONTENT_TYPES[format],
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to download report");
  }
}
