import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { listUserWorkspaces, getActiveWorkspaceId } from "@/lib/workspace/server";
import { requireUser } from "@/lib/auth/server";

// Protected routes depend on the authenticated session, so they cannot be
// statically prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    template: "%s | ClipScope AI",
    default: "ClipScope AI",
  },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/auth/login");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const userName = profile?.full_name ?? user.user_metadata?.full_name ?? null;
  const userEmail = user.email ?? null;

  // Load workspaces and active workspace ID
  const workspaces = await listUserWorkspaces();
  const activeWorkspaceId = await getActiveWorkspaceId();

  return (
    <AppShell
      userEmail={userEmail}
      userName={userName}
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
    >
      {children}
    </AppShell>
  );
}
