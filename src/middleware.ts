import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

/**
 * Admin routes that require an authenticated Designer session.
 * These correspond to the (admin) route group pages.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/clients",
  "/projects",
  "/tasks",
  "/sign-offs",
  "/activity",
  "/settings",
  "/notifications",
];

/**
 * Inactivity timeout configuration (R1.7).
 * After 30 minutes of no Designer activity, the session is terminated and
 * re-authentication is required.
 */
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const LAST_ACTIVITY_COOKIE = "last_activity_at";

/**
 * Determine whether the request path targets a protected admin route.
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Next.js middleware that:
 * 1. Creates a Supabase SSR client bound to the request/response cookies.
 * 2. Calls `getUser()` which validates and refreshes the session cookie.
 * 3. Redirects unauthenticated requests for admin routes to /sign-in.
 * 4. Tracks inactivity via a `last_activity_at` httpOnly cookie and terminates
 *    sessions idle for 30 minutes, forcing re-authentication (R1.7).
 *
 * The portal route (/review/[token]) and other public routes are not gated.
 *
 * Requirements: 1.3 (redirect unauthenticated admin requests), 1.5 (restrict
 * admin functions to authenticated Designers), 1.7 (inactivity timeout).
 */
export async function middleware(request: NextRequest) {
  // Guard against missing env vars (prevents cryptic crashes in production)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // If env vars are missing, let the request through without auth checks
    // (the app will show appropriate errors on the page level)
    return NextResponse.next({ request });
  }

  // Start with a response that passes through so we can attach updated cookies.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies to the request (for downstream server components)
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // Recreate the response so it carries the updated request cookies
          supabaseResponse = NextResponse.next({ request });
          // Write cookies to the response (for the browser)
          for (const cookie of cookiesToSet) {
            supabaseResponse.cookies.set(
              cookie.name,
              cookie.value,
              cookie.options,
            );
          }
        },
      },
    },
  );

  // getUser() validates the JWT and refreshes the session cookie if needed.
  // Using getUser() instead of getSession() because getSession() doesn't
  // validate the JWT — it only reads from storage.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Redirect unauthenticated requests for protected admin routes to sign-in.
  if (!user && isProtectedRoute(pathname)) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    return NextResponse.redirect(signInUrl);
  }

  // Inactivity timeout (R1.7): for authenticated requests to protected routes,
  // check the last_activity_at cookie. If the session has been idle for more
  // than 30 minutes, sign out and redirect to /sign-in.
  if (user && isProtectedRoute(pathname)) {
    const lastActivityCookie = request.cookies.get(LAST_ACTIVITY_COOKIE);
    const now = Date.now();

    if (lastActivityCookie) {
      const lastActivity = parseInt(lastActivityCookie.value, 10);

      if (!isNaN(lastActivity) && now - lastActivity > INACTIVITY_TIMEOUT_MS) {
        // Session has been idle for more than 30 minutes — terminate it.
        await supabase.auth.signOut();

        // Clear the activity cookie and redirect to sign-in.
        const signInUrl = request.nextUrl.clone();
        signInUrl.pathname = "/sign-in";
        const redirectResponse = NextResponse.redirect(signInUrl);
        redirectResponse.cookies.set(LAST_ACTIVITY_COOKIE, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0, // Delete the cookie
        });
        return redirectResponse;
      }
    }

    // Update the last_activity_at timestamp on every authenticated request
    // to a protected route.
    supabaseResponse.cookies.set(LAST_ACTIVITY_COOKIE, now.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      // Cookie expires after the inactivity timeout so stale cookies are
      // automatically cleaned up by the browser.
      maxAge: Math.ceil(INACTIVITY_TIMEOUT_MS / 1000),
    });
  }

  return supabaseResponse;
}

/**
 * Matcher configuration: run middleware on all routes except static assets,
 * images, and the favicon. This ensures session refresh happens on every
 * navigation while avoiding unnecessary processing for static files.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Public assets with common image extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
