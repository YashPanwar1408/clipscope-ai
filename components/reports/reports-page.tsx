"use client";

import * as React from "react";
import { Download, FileText, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/status";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import type { Report } from "@/lib/types/domain";

export function ReportsPage({
  reports,
  workspaceId,
}: {
  reports: Report[];
  workspaceId: string | null;
}) {
  const [items, setItems] = React.useState(reports);
  const [generating, setGenerating] = React.useState(false);
  const hasActiveReports = items.some(
    (report) => report.status === "pending" || report.status === "generating"
  );

  React.useEffect(() => {
    if (!workspaceId || !hasActiveReports) return;

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const refreshReports = async () => {
      try {
        const response = await fetch(`/api/reports?workspaceId=${workspaceId}`);
        if (!response.ok) throw new Error("Failed to refresh reports");
        const result = await response.json();
        if (cancelled) return;

        const nextReports = result.reports as Report[];
        setItems(nextReports);
        if (nextReports.some((report) => report.status === "pending" || report.status === "generating")) {
          timeout = setTimeout(() => void refreshReports(), 2000);
        }
      } catch {
        if (!cancelled) timeout = setTimeout(() => void refreshReports(), 4000);
      }
    };

    void refreshReports();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [workspaceId, hasActiveReports]);

  const generateReport = async () => {
    if (!workspaceId) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, reportType: "summary" }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error ?? "Failed to start report");
      toast({ title: "Report generation started" });
      const listRes = await fetch(`/api/reports?workspaceId=${workspaceId}`);
      if (listRes.ok) {
        const result = await listRes.json();
        setItems(result.reports);
      }
    } catch (error) {
      toast({
        title: "Failed to start report",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const download = async (id: string, format: "md" | "csv" | "pdf") => {
    try {
      const res = await fetch(`/api/reports/${id}?format=${format}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Download failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${id}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Exportable research"
        title="Reports"
        description="Report history in the active workspace."
        actions={<Button size="sm" onClick={generateReport} disabled={!workspaceId || generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Generate report
        </Button>}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-5 w-5" />}
          title="No reports yet"
          description="Generate a report to export your workspace's videos, metrics, and analysis in CSV and PDF formats."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))] gap-4">
          {items.map((report) => (
            <Card key={report.id} className="transition-colors hover:border-white/[0.13]">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium capitalize text-zinc-100">
                    {report.reportType} report
                  </span>
                  <Badge
                    variant={
                      report.status === "ready"
                        ? "success"
                        : report.status === "error"
                          ? "destructive"
                          : "secondary"
                    }
                    className="capitalize"
                  >
                    {report.status}
                  </Badge>
                </div>
                <p className="text-sm text-zinc-500">
                  Created {formatDate(report.createdAt)}
                </p>
                {report.status === "ready" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => download(report.id, "pdf")}
                    >
                      <Download className="h-3 w-3" /> PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => download(report.id, "csv")}
                    >
                      <Download className="h-3 w-3" /> CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => download(report.id, "md")}
                    >
                      <Download className="h-3 w-3" /> MD
                    </Button>
                  </div>
                )}
                {report.status === "error" && (
                  <p className="text-xs text-red-400">
                    Report generation failed. Try again.
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
