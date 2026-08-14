import "server-only";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireWorkspaceAccess } from "@/lib/auth/server";
import type {
  Workspace,
  WorkspaceMember,
  Video,
  IngestionJob,
  Comparison,
  ChatSession,
  Report,
} from "@/lib/types/domain";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/auth/server";

const ACTIVE_WORKSPACE_COOKIE = "cs_active_workspace_id";

/**
 * Get active workspace ID from cookie or fallback to user's first accessible workspace
 */
export async function getActiveWorkspaceId(): Promise<string | null> {
  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const workspaces = await listUserWorkspaces();
  if (activeId && workspaces.some((workspace) => workspace.id === activeId)) return activeId;
  return workspaces[0]?.id ?? null;
}

/**
 * Set active workspace cookie
 */
export async function setActiveWorkspaceCookie(workspaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

async function clearActiveWorkspaceCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

/**
 * List all workspaces accessible by the current user
 */
export async function listUserWorkspaces(): Promise<Workspace[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ data: workspaces, error: workspacesError }, { data: memberships, error: membershipsError }] =
    await Promise.all([
      supabase
        .from("workspaces")
        .select("id, owner_id, name, description, created_at, updated_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id),
    ]);

  if (workspacesError || membershipsError) {
    throw new Error("Failed to load workspaces");
  }

  const roleByWorkspace = new Map(
    (memberships ?? []).map((membership) => [membership.workspace_id, membership.role as Workspace["role"]])
  );

  return (workspaces ?? []).map((workspace) => {
    const isOwner = workspace.owner_id === user.id;
    return {
      id: workspace.id,
      ownerId: workspace.owner_id,
      name: workspace.name,
      description: workspace.description,
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at,
      role: isOwner ? "owner" : roleByWorkspace.get(workspace.id),
      isOwner,
    };
  });
}

/**
 * Create a new workspace in PostgreSQL
 */
export async function createWorkspace(name: string, description?: string | null): Promise<Workspace> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspaces")
    .insert({
      owner_id: user.id,
      name: name.trim(),
      description: description?.trim() || null,
    })
    .select("id, owner_id, name, description, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to create workspace");
  }

  await setActiveWorkspaceCookie(data.id);

  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    role: "owner",
    isOwner: true,
  };
}

/**
 * Update an existing workspace (requires owner or admin role)
 */
export async function updateWorkspace(
  workspaceId: string,
  updates: { name?: string; description?: string | null }
): Promise<Workspace> {
  await requireWorkspaceAccess(workspaceId, "admin");
  const supabase = await createClient();

  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name.trim();
  if (updates.description !== undefined) payload.description = updates.description?.trim() || null;

  const { data, error } = await supabase
    .from("workspaces")
    .update(payload)
    .eq("id", workspaceId)
    .select("id, owner_id, name, description, created_at, updated_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update workspace");
  }

  return {
    id: data.id,
    ownerId: data.owner_id,
    name: data.name,
    description: data.description,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Delete a workspace with confirmation (requires owner)
 */
export async function deleteWorkspace(workspaceId: string, confirmName: string): Promise<void> {
  const { workspace } = await requireWorkspaceAccess(workspaceId, "owner");

  if (workspace.name.trim() !== confirmName.trim()) {
    throw new ValidationError("Confirmation name does not match workspace name");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").delete().eq("id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }

  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value === workspaceId) {
    await clearActiveWorkspaceCookie();
  }
}

/**
 * List members of a workspace
 */
export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  await requireWorkspaceAccess(workspaceId, "viewer");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, user_id, role, created_at")
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role as WorkspaceMember["role"],
    createdAt: row.created_at,
    profile: null,
  }));
}

export async function manageWorkspaceMember(
  workspaceId: string,
  userId: string,
  role: "admin" | "editor" | "viewer" | null
) {
  await requireWorkspaceAccess(workspaceId, "admin");
  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_workspace_member", {
    target_workspace_id: workspaceId,
    target_user_id: userId,
    target_role: role,
  });
  if (error) {
    if (error.code === "42501") throw new ForbiddenError("You do not have permission to manage this member");
    if (error.code === "23503") throw new ValidationError("The account ID was not found");
    if (error.code === "P0002") throw new NotFoundError("Workspace not found");
    if (error.code === "22023") throw new ValidationError("Choose a valid workspace role");
    throw new Error("Failed to update workspace membership");
  }
}

/**
 * List videos in a workspace
 */
export async function listWorkspaceVideos(workspaceId: string): Promise<Video[]> {
  await requireWorkspaceAccess(workspaceId, "viewer");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("videos")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    workspaceId: row.workspace_id,
    platform: row.platform,
    canonicalUrl: row.canonical_url,
    platformVideoId: row.platform_video_id,
    title: row.title,
    description: row.description,
    creatorName: row.creator_name,
    thumbnailUrl: row.thumbnail_url,
    durationSeconds: row.duration_seconds,
    publishedAt: row.published_at,
    views: row.views,
    likes: row.likes,
    commentsCount: row.comments_count,
    metadataStatus: row.metadata_status,
    transcriptStatus: row.transcript_status,
    analysisStatus: row.analysis_status,
    metadataJson: row.metadata_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Aliases
    url: row.canonical_url,
    provider: row.platform,
    providerId: row.platform_video_id,
    channelName: row.creator_name,
    viewCount: row.views,
    likeCount: row.likes,
    commentCount: row.comments_count,
    status: row.metadata_status,
  }));
}

/**
 * List ingestion jobs in a workspace
 */
export async function listWorkspaceJobs(workspaceId: string): Promise<IngestionJob[]> {
  await requireWorkspaceAccess(workspaceId, "viewer");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ingestion_jobs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((j) => ({
    id: j.id,
    workspaceId: j.workspace_id,
    requestedBy: j.requested_by,
    status: j.status,
    totalVideos: j.total_videos,
    processedVideos: j.processed_videos,
    failedVideos: j.failed_videos,
    progressPct: j.progress_pct,
    currentStage: j.current_stage,
    attemptCount: j.attempt_count,
    lastErrorCode: j.last_error_code,
    lastErrorMessage: j.last_error_message,
    idempotencyKey: j.idempotency_key ?? null,
    createdAt: j.created_at,
    startedAt: j.started_at,
    completedAt: j.completed_at,
    updatedAt: j.updated_at,
  }));
}

/**
 * List comparisons in a workspace
 */
export async function listWorkspaceComparisons(workspaceId: string): Promise<Comparison[]> {
  await requireWorkspaceAccess(workspaceId, "viewer");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("comparisons")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => {
    const comparisonData = (c.comparison_data ?? {}) as Record<string, unknown>;
    const hasAnalysis = Boolean(comparisonData.aiAnalysis);
    const hasCompletedPayload = Boolean(comparisonData.generatedAt && Array.isArray(comparisonData.videos) && comparisonData.videos.length);
    const status = comparisonData.status === "error"
      ? "error"
      : comparisonData.status === "generating"
        ? "pending"
        : comparisonData.status === "pending"
          ? hasCompletedPayload && !hasAnalysis ? "error" : "pending"
          : comparisonData.status === "ready"
            ? hasAnalysis ? "ready" : "error"
            : hasAnalysis
              ? "ready"
              : hasCompletedPayload
                ? "error"
                : "pending";

    return {
      id: c.id,
      workspaceId: c.workspace_id,
      title: c.title,
      selectedVideoIds: c.selected_video_ids ?? [],
      comparisonData: c.comparison_data,
      createdBy: c.created_by,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      videoIds: c.selected_video_ids ?? [],
      status,
    };
  });
}

/**
 * List chat sessions in a workspace
 */
export async function listWorkspaceChatSessions(workspaceId: string): Promise<ChatSession[]> {
  await requireWorkspaceAccess(workspaceId, "viewer");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((cs) => ({
    id: cs.id,
    workspaceId: cs.workspace_id,
    userId: cs.user_id,
    title: cs.title,
    createdAt: cs.created_at,
    updatedAt: cs.updated_at,
  }));
}

/**
 * List reports in a workspace
 */
export async function listWorkspaceReports(workspaceId: string): Promise<Report[]> {
  await requireWorkspaceAccess(workspaceId, "viewer");
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    createdBy: r.created_by,
    reportType: r.report_type,
    status: r.status,
    storagePath: r.storage_path,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    format: r.report_type,
  }));
}
