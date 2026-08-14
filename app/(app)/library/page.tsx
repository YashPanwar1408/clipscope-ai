import type { Metadata } from "next";
import { VideoLibrary } from "@/components/library/video-library";
import { getActiveWorkspaceId, listWorkspaceVideos } from "@/lib/workspace/server";

export const metadata: Metadata = { title: "Video Library" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const [{ action }, workspaceId] = await Promise.all([searchParams, getActiveWorkspaceId()]);
  const videos = workspaceId ? await listWorkspaceVideos(workspaceId) : [];
  const videosKey = videos.map((video) => video.id).join(",");
  return (
    <div className="p-4 animate-fade-in sm:p-6 xl:p-8">
      <VideoLibrary key={videosKey} initialVideos={videos} workspaceId={workspaceId} initialOpen={action === "import"} />
    </div>
  );
}
