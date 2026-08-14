import { NextRequest, NextResponse } from "next/server";
import { createWorkspace, listUserWorkspaces } from "@/lib/workspace/server";
import { createWorkspaceSchema } from "@/lib/schemas";
import { parseJsonBody } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    const workspaces = await listUserWorkspaces();
    return NextResponse.json({ workspaces });
  } catch (error) {
    return apiErrorResponse(error, "Failed to list workspaces");
  }
}

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, createWorkspaceSchema);
  if (parsed.response) return parsed.response;

  try {
    const workspace = await createWorkspace(parsed.data.name, parsed.data.description);
    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Failed to create workspace");
  }
}
