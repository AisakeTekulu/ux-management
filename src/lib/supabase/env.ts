/**
 * Typed access helpers for Supabase environment configuration.
 *
 * Public values (URL + anon key) are safe to expose to the browser and are
 * read through `NEXT_PUBLIC_*` variables. The service-role key is server-only
 * and is intentionally read through a separate helper that throws if it is
 * accessed without being configured, so it can never silently fall through to
 * a client bundle.
 */

/**
 * Read a required environment variable, throwing a descriptive error when it
 * is missing or empty. Centralizing this keeps failure messages consistent and
 * makes misconfiguration obvious at startup rather than at the first request.
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable "${name}". ` +
        "Add it to your environment (see .env.example).",
    );
  }
  return value;
}

/**
 * Public Supabase configuration that is safe to ship to the browser.
 * Both values are inlined by Next.js at build time via the `NEXT_PUBLIC_`
 * prefix, so they must be referenced statically.
 */
export function getPublicSupabaseConfig(): {
  url: string;
  anonKey: string;
} {
  return {
    url: requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    anonKey: requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    ),
  };
}

/**
 * Server-only service-role key used exclusively by the share-link path, which
 * must operate without a user session. This MUST never be imported into a
 * client bundle. Reading it lazily (rather than at module load) keeps the
 * value out of any code path that does not explicitly need it.
 */
export function getServiceRoleKey(): string {
  return requireEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
