import { NextResponse, type NextRequest } from "next/server";
import { apiErrorResponse } from "@/lib/api/errors";
import { parseJsonBody } from "@/lib/api/request";
import { updateMemberRoleSchema, userIdSchema } from "@/lib/schemas";
import { manageWorkspaceMember } from "@/lib/workspace/server";

type RouteContext = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const parsed = await parseJsonBody(request, updateMemberRoleSchema);
  if (parsed.response) return parsed.response;

  try {
    const { id, userId } = await params;
    const userIdResult = userIdSchema.safeParse(userId);
    if (!userIdResult.success) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }
    await manageWorkspaceMember(id, userId, parsed.data.role);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to update workspace member");
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id, userId } = await params;
    const userIdResult = userIdSchema.safeParse(userId);
    if (!userIdResult.success) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }
    await manageWorkspaceMember(id, userId, null);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse(error, "Failed to remove workspace member");
  }
}
