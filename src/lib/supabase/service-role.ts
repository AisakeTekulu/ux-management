import "server-only";

/**
 * Server-only service-role Supabase client.
 *
 * This client uses the service-role key, which bypasses Row Level Security. It
 * exists solely for the share-link read/write path, which must work without a
 * user session while scope and read-only enforcement live in the share
 * service code.
 *
 * The `server-only` import above causes a build-time error if this module is
 * ever pulled into a client bundle, ensuring the service-role key never
 * reaches the browser. Do not import this file from Client Components.
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig, getServiceRoleKey } from "@/lib/supabase/env";

/**
 * Create a service-role Supabase client. No session persistence or token
 * auto-refresh is configured because this client is stateless and used only
 * for scoped, server-side share-link operations.
 */
export function createServiceRoleClient() {
  const { url } = getPublicSupabaseConfig();
  const serviceRoleKey = getServiceRoleKey();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
