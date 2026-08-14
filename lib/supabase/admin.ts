import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

export function createAdminClient() {
  const config = getSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!config || !serviceRoleKey) {
    throw new Error(
      "Supabase worker access is not configured. Set the server-only service role key."
    );
  }

  // Untyped client (Database = any) — consistent with the rest of the app,
  // which uses @supabase/ssr clients that are intentionally untyped. A service
  // role worker bypasses RLS anyway and does not need table-level typing.
  return createClient(config.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
