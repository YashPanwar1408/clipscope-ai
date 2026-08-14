import "server-only";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { WorkspaceRole } from "@/lib/types/domain";

export class AuthError extends Error {
  statusCode = 401;

  constructor(message = "Authentication required. Please sign in.") {
    super(message);
    this.name = "AuthError";
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  statusCode = 404;

  constructor(message = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

const ROLE_HIERARCHY: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return value === "owner" || value === "admin" || value === "editor" || value === "viewer";
}

export async function getAuthenticatedUser() {
  if (!isSupabaseConfigured()) return null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getAuthenticatedUser();
  if (!user) throw new AuthError();
  return user;
}

/** Verifies workspace membership and minimum role on the server. */
export async function requireWorkspaceAccess(
  workspaceId: string,
  minRole: WorkspaceRole = "viewer"
) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) {
    throw new NotFoundError("Workspace not found");
  }

  const user = await requireUser();
  const supabase = await createClient();
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, owner_id, name, description, created_at, updated_at")
    .eq("id", workspaceId)
    .maybeSingle();

  if (workspaceError) throw new Error("Failed to verify workspace access");
  if (!workspace) throw new NotFoundError("Workspace not found");

  let role: WorkspaceRole;
  if (workspace.owner_id === user.id) {
    role = "owner";
  } else {
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError) throw new Error("Failed to verify workspace membership");
    if (!member || !isWorkspaceRole(member.role)) {
      throw new NotFoundError("Workspace not found");
    }
    role = member.role;
  }

  if (ROLE_HIERARCHY[role] < ROLE_HIERARCHY[minRole]) {
    throw new ForbiddenError(`Insufficient permissions. Requires '${minRole}' role or higher.`);
  }

  return {
    workspace: {
      id: workspace.id,
      ownerId: workspace.owner_id,
      name: workspace.name,
      description: workspace.description,
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at,
    },
    role,
    user,
  };
}
