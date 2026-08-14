import { NextRequest, NextResponse } from "next/server";
import { setActiveWorkspaceCookie } from "@/lib/workspace/server";
import { requireWorkspaceAccess, AuthError, NotFoundError } from "@/lib/auth/server";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Verify user has access before setting active cookie
    await requireWorkspaceAccess(id, "viewer");
    await setActiveWorkspaceCookie(id);

    return NextResponse.json({ success: true, activeWorkspaceId: id });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof NotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ error: "Failed to switch workspace" }, { status: 500 });
  }
}
