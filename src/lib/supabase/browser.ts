"use client";

/**
 * Browser Supabase client for use in Client Components.
 *
 * Uses the public URL + anon key and the cookie-aware browser client from
 * `@supabase/ssr` so the session stays in sync with the SSR server client.
 */

import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";

/**
 * Create a Supabase client for the browser. `createBrowserClient` is safe to
 * call repeatedly: it returns a singleton per set of arguments within the
 * browser context, so callers can invoke this wherever a client is needed.
 */
export function createClient() {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient(url, anonKey);
}
