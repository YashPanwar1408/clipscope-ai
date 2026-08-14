import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/auth/redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeInternalPath(searchParams.get("next"));

  try {
    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, origin));
    }
  } catch {
    // Send users back to sign-in without exposing provider details in the URL.
  }

  const failureUrl = new URL("/auth/login", origin);
  failureUrl.searchParams.set("error", "auth_callback_failed");
  return NextResponse.redirect(failureUrl);
}
