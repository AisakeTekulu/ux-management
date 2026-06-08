import "server-only";

/**
 * Cookie-based SSR Supabase client for the App Router.
 *
 * This client reads and writes the auth session through Next.js request
 * cookies, so authenticated Server Components, Server Actions, and Route
 * Handlers operate as the signed-in Designer and Row Level Security applies.
 *
 * In Next.js 15 `cookies()` is async, so this factory is async too. The cookie
 * `setAll` may throw when called from a Server Component (cookies are
 * read-only there); that case is intentionally ignored because session
 * refresh is handled by middleware.
 */

import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";

/**
 * Create a request-scoped Supabase client bound to the current request's
 * cookies. Call this per request rather than caching a module-level instance,
 * so each request reads its own session.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` was called from a Server Component where cookies are
          // read-only. Session refresh happens in middleware, so this is safe
          // to ignore.
        }
      },
    },
  });
}
