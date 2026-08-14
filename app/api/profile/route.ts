import { NextResponse } from "next/server";
import { getCurrentProfile, updateCurrentProfile } from "@/lib/profile/server";
import { updateProfileSchema } from "@/lib/schemas";
import { parseJsonBody } from "@/lib/api/request";
import { apiErrorResponse } from "@/lib/api/errors";

export async function GET() {
  try {
    return NextResponse.json(await getCurrentProfile());
  } catch (error) {
    return apiErrorResponse(error, "Failed to load profile");
  }
}

export async function PATCH(request: Request) {
  const parsed = await parseJsonBody(request, updateProfileSchema);
  if (parsed.response) return parsed.response;

  try {
    const profile = await updateCurrentProfile(parsed.data);
    return NextResponse.json({ profile });
  } catch (error) {
    return apiErrorResponse(error, "Failed to save profile");
  }
}
