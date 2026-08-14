import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { addMemberSchema } from "@/lib/schemas";
import {
  listWorkspaceMembers,
  manageWorkspaceMember,
} from "@/lib/workspace/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return NextResponse.json({ members: await listWorkspaceMembers(id) });
  } catch (error) {
    return apiErrorResponse(error, "Failed to load workspace members");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const parsed = await parseJsonBody(request, addMemberSchema);
  if (parsed.response) return parsed.response;

  try {
    const { id } = await params;
    await manageWorkspaceMember(id, parsed.data.userId, parsed.data.role);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Failed to add workspace member");
  }
}
