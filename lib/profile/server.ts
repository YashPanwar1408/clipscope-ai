import "server-only";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import type { Profile } from "@/lib/types/domain";

function toProfile(row: {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}): Profile {
  return {
    id: row.id,
    fullName: row.full_name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getCurrentProfile() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error("Failed to load profile");
  if (!data) throw new Error("Profile was not created for this account");

  return { profile: toProfile(data), email: user.email ?? null };
}

export async function updateCurrentProfile(input: {
  fullName: string;
  avatarUrl?: string | null;
}) {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName.trim(),
      ...(input.avatarUrl !== undefined ? { avatar_url: input.avatarUrl } : {}),
    })
    .eq("id", user.id)
    .select("id, full_name, avatar_url, created_at, updated_at")
    .single();

  if (error || !data) throw new Error("Failed to save profile");

  return toProfile(data);
}
