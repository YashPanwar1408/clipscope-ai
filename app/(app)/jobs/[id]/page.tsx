import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWorkspaceAccess } from "@/lib/auth/server";
import { isTerminalJobStatus } from "@/lib/ingestion/server";
import { JobDetailView } from "@/components/jobs/job-detail-view";

export const metadata: Metadata = { title: "Ingestion Job" };

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id
    )
  ) {
    notFound();
  }

  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase
    .from("ingestion_jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (jobError || !job) notFound();

  await requireWorkspaceAccess(job.workspace_id, "viewer");

  // Verify workspace access first, then load the related worker-owned rows
  // with the server client so user-table grants cannot hide job items.
  const adminSupabase = createAdminClient();
  const { data: jobItems, error: itemsError } = await adminSupabase
    .from("ingestion_job_items")
    .select("*")
    .eq("job_id", id)
    .order("id", { ascending: true });

  if (itemsError) throw new Error("Failed to load ingestion job items.");

  const videoIds = (jobItems ?? [])
    .map((item) => item.video_id)
    .filter((videoId): videoId is string => Boolean(videoId));
  const { data: videos, error: videosError } = videoIds.length
    ? await adminSupabase
        .from("videos")
        .select("id, title, canonical_url, platform, platform_video_id")
        .in("id", videoIds)
    : { data: [], error: null };

  if (videosError) throw new Error("Failed to load videos for this job.");

  const videosById = new Map((videos ?? []).map((video) => [video.id, video]));
  const items = (jobItems ?? []).map((item) => ({
    ...item,
    videos: item.video_id ? videosById.get(item.video_id) ?? null : null,
  }));

  return (
    <JobDetailView
      initialData={{
        job,
        items,
        terminal: isTerminalJobStatus(job.status),
      }}
    />
  );
}
