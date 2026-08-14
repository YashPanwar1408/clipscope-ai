import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { safeInternalPath } from "@/lib/auth/redirect";

const AUTH_ENTRY_ROUTES = new Set([
  "/auth/login",
  "/auth/register",
  "/auth/recover",
]);

function isPublicRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/auth/callback" ||
    pathname === "/auth/reset" ||
    pathname === "/auth/signout" ||
    pathname === "/auth/unconfigured" ||
    pathname === "/api/inngest" ||
    pathname.startsWith("/api/inngest/")
  );
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");
  const config = getSupabasePublicConfig();

  if (!config) {
    if (isApiRoute || isPublicRoute(pathname) || AUTH_ENTRY_ROUTES.has(pathname)) {
      return response;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("error", "supabase_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
        for (const [name, value] of Object.entries(headers ?? {})) {
          response.headers.set(name, value);
        }
      },
    },
  });

  let hasVerifiedUser = false;
  try {
    const { data, error } = await supabase.auth.getClaims();
    hasVerifiedUser = !error && typeof data?.claims?.sub === "string";
  } catch {
    hasVerifiedUser = false;
  }

  // Route handlers check their own auth and return JSON 401 responses.
  if (isApiRoute) return response;

  if (!hasVerifiedUser && !AUTH_ENTRY_ROUTES.has(pathname) && !isPublicRoute(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      safeInternalPath(`${pathname}${request.nextUrl.search}`)
    );
    return redirectWithAuthCookies(loginUrl, response);
  }

  if (hasVerifiedUser && AUTH_ENTRY_ROUTES.has(pathname)) {
    const next = safeInternalPath(request.nextUrl.searchParams.get("next"), "/dashboard");
    return redirectWithAuthCookies(new URL(next, request.url), response);
  }

  return response;
}

function redirectWithAuthCookies(url: URL, response: NextResponse) {
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
