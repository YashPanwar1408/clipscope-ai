import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { inngest } from "@/lib/inngest/client";

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => ({}));
    const workspaceId = body.workspaceId as string | undefined;

    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
    }

    await requireWorkspaceAccess(workspaceId, "editor");

    const supabase = await createClient();

    const reportType = body.reportType === "summary" ? "summary" : "pdf";
    const createReport = (type: string) =>
      supabase
        .from("reports")
        .insert({
          workspace_id: workspaceId,
          created_by: user.id,
          report_type: type,
          status: "pending",
        })
        .select("id")
        .single();

    let insertResult = await createReport(reportType);
    // Older Supabase projects still have the original check constraint, which
    // allows PDF reports but not the newer summary report type.
    if (insertResult.error?.code === "23514" && reportType === "summary") {
      insertResult = await createReport("pdf");
    }

    const { data: report, error } = insertResult;

    if (error || !report) {
      console.error("[reports] Could not create report record:", error);
      throw error ?? new Error("Failed to create report");
    }

    // Trigger the report generation workflow
    await inngest.send({
      name: "report/generate.requested",
      data: { reportId: report.id, workspaceId },
    });

    return NextResponse.json({ id: report.id }, { status: 202 });
  } catch (error) {
    console.error("[reports] Failed to start report generation:", error);
    const message =
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "Failed to create report";
    return apiErrorResponse(error, message);
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json({ error: "Workspace ID is required" }, { status: 400 });
    }

    await requireWorkspaceAccess(workspaceId, "viewer");

    const supabase = await createClient();

    const { data: reports, error } = await supabase
      .from("reports")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({
      reports: (reports ?? []).map((report) => ({
        id: report.id,
        workspaceId: report.workspace_id,
        createdBy: report.created_by,
        reportType: report.report_type,
        status: report.status,
        storagePath: report.storage_path,
        createdAt: report.created_at,
        completedAt: report.completed_at,
        format: report.report_type,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error, "Failed to fetch reports");
  }
}
