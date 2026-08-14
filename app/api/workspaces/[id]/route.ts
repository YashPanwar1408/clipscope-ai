import { NextRequest, NextResponse } from "next/server";
import { updateWorkspace, deleteWorkspace } from "@/lib/workspace/server";
import { requireWorkspaceAccess } from "@/lib/auth/server";
import { updateWorkspaceSchema, deleteWorkspaceSchema } from "@/lib/schemas";
import { parseJsonBody } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { workspace, role } = await requireWorkspaceAccess(id, "viewer");
    return NextResponse.json({ workspace, role });
  } catch (error) {
    return apiErrorResponse(error, "Failed to retrieve workspace");
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsed = await parseJsonBody(req, updateWorkspaceSchema);
  if (parsed.response) return parsed.response;

  try {
    const { id } = await params;
    const updated = await updateWorkspace(id, parsed.data);
    return NextResponse.json({ workspace: updated });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update workspace");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsed = await parseJsonBody(req, deleteWorkspaceSchema);
  if (parsed.response) return parsed.response;

  try {
    const { id } = await params;
    await deleteWorkspace(id, parsed.data.confirmName);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to delete workspace");
  }
}
