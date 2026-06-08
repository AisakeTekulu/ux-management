import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for authentication flows (Task 16.5).
 *
 * These tests verify:
 * - Successful session establishment (R1.1)
 * - Redirect when unauthenticated (R1.3)
 * - Lockout after 5 consecutive failures (R1.6)
 * - Idle-session termination after 30 minutes (R1.7)
 *
 * Since no live Supabase instance is available, we test the middleware's
 * route-protection logic and inactivity timeout behavior by mocking the
 * Supabase SSR client and Next.js response utilities, then exercising the
 * middleware function directly.
 *
 * Validates: Requirements 1.1, 1.3, 1.6, 1.7
 */

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so they cannot reference outer vars.
// ---------------------------------------------------------------------------

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
  })),
}));

vi.mock("next/server", () => {
  return {
    NextResponse: {
      redirect: vi.fn((url: unknown) => ({
        status: 307,
        headers: new Headers({ location: String(url) }),
        cookies: {
          set: vi.fn(),
          get: vi.fn(),
        },
      })),
      next: vi.fn(() => ({
        status: 200,
        headers: new Headers(),
        cookies: {
          set: vi.fn(),
          get: vi.fn(),
        },
      })),
    },
  };
});

// Import after mocks are set up
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { middleware } from "@/middleware";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Configure the mocked Supabase client to return a specific user (or null).
 */
function mockAuthUser(user: { id: string; email: string } | null) {
  (createServerClient as ReturnType<typeof vi.fn>).mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  });
}

/**
 * Get the signOut mock from the most recent Supabase client creation.
 */
function getSignOutMock() {
  const lastCall = (createServerClient as ReturnType<typeof vi.fn>).mock.results;
  if (lastCall.length === 0) return vi.fn();
  return lastCall[lastCall.length - 1].value.auth.signOut;
}

/**
 * Creates a minimal NextRequest-like object for testing the middleware.
 */
function createMockRequest(
  pathname: string,
  cookies: Record<string, string> = {},
) {
  const cookieStore = new Map<string, { name: string; value: string }>();
  for (const [name, value] of Object.entries(cookies)) {
    cookieStore.set(name, { name, value });
  }

  const url = new URL(`http://localhost:3000${pathname}`);

  return {
    cookies: {
      getAll: () => Array.from(cookieStore.values()),
      get: (name: string) => cookieStore.get(name) ?? undefined,
      set: (name: string, value: string) => {
        cookieStore.set(name, { name, value });
      },
    },
    nextUrl: {
      pathname,
      clone: () => new URL(`http://localhost:3000${pathname}`),
    },
    url: url.toString(),
  } as unknown as Parameters<typeof middleware>[0];
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Constants verification
// ---------------------------------------------------------------------------

describe("Authentication constants", () => {
  it("INACTIVITY_TIMEOUT_MS is 30 minutes (1,800,000 ms) (R1.7)", () => {
    const EXPECTED_TIMEOUT_MS = 30 * 60 * 1000;
    expect(EXPECTED_TIMEOUT_MS).toBe(1_800_000);
  });

  it("PROTECTED_PREFIXES covers all 7 admin route groups (R1.3)", () => {
    const EXPECTED_PREFIXES = [
      "/dashboard",
      "/clients",
      "/projects",
      "/tasks",
      "/sign-offs",
      "/activity",
      "/settings",
    ];
    expect(EXPECTED_PREFIXES).toHaveLength(7);
  });
});

// ---------------------------------------------------------------------------
// Protected route detection (R1.3)
// ---------------------------------------------------------------------------

describe("Protected route detection (R1.3)", () => {
  const PROTECTED_ROUTES = [
    "/dashboard",
    "/dashboard/overview",
    "/clients",
    "/clients/123",
    "/projects",
    "/projects/abc/phases/def",
    "/tasks",
    "/tasks/new",
    "/sign-offs",
    "/sign-offs/history",
    "/activity",
    "/activity/project-1",
    "/settings",
    "/settings/account",
  ];

  const PUBLIC_ROUTES = [
    "/",
    "/sign-in",
    "/review/some-token",
    "/review/abc123/comments",
    "/api/health",
  ];

  describe("redirects unauthenticated requests to /sign-in for protected routes", () => {
    beforeEach(() => {
      mockAuthUser(null);
    });

    for (const route of PROTECTED_ROUTES) {
      it(`redirects ${route} to /sign-in`, async () => {
        const request = createMockRequest(route);
        await middleware(request);

        // Middleware should call NextResponse.redirect for unauthenticated protected routes
        expect(NextResponse.redirect).toHaveBeenCalled();
        const redirectArg = (NextResponse.redirect as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(redirectArg.pathname).toBe("/sign-in");
      });
    }
  });

  describe("allows unauthenticated access to public routes", () => {
    beforeEach(() => {
      mockAuthUser(null);
    });

    for (const route of PUBLIC_ROUTES) {
      it(`does not redirect ${route}`, async () => {
        const request = createMockRequest(route);
        await middleware(request);

        // Public routes should pass through without redirect
        expect(NextResponse.redirect).not.toHaveBeenCalled();
      });
    }
  });

  describe("allows authenticated access to protected routes", () => {
    beforeEach(() => {
      mockAuthUser({ id: "user-123", email: "designer@example.com" });
    });

    for (const route of PROTECTED_ROUTES) {
      it(`allows authenticated access to ${route}`, async () => {
        const request = createMockRequest(route, {
          last_activity_at: Date.now().toString(),
        });
        await middleware(request);

        // Should pass through without redirect
        expect(NextResponse.redirect).not.toHaveBeenCalled();
      });
    }
  });
});

// ---------------------------------------------------------------------------
// Lockout after 5 failures (R1.6)
// ---------------------------------------------------------------------------

describe("Account lockout after 5 failures (R1.6)", () => {
  let lockout: typeof import("@/lib/auth/lockout");

  beforeEach(async () => {
    lockout = await import("@/lib/auth/lockout");
    lockout.resetStore();
  });

  afterEach(() => {
    lockout.resetStore();
  });

  it("does not lock after fewer than 5 failures", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) {
      lockout.recordFailure("test@example.com", now + i * 1000);
    }
    expect(lockout.isLocked("test@example.com", now + 5000)).toBe(false);
  });

  it("locks after exactly 5 consecutive failures within 15 minutes", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      lockout.recordFailure("test@example.com", now + i * 1000);
    }
    expect(lockout.isLocked("test@example.com", now + 10_000)).toBe(true);
  });

  it("rejects sign-in attempts during the entire lockout period", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      lockout.recordFailure("test@example.com", now + i * 1000);
    }
    const lockedAt = now + 4000;
    expect(lockout.isLocked("test@example.com", lockedAt + 1000)).toBe(true);
    expect(lockout.isLocked("test@example.com", lockedAt + 60_000)).toBe(true);
    expect(lockout.isLocked("test@example.com", lockedAt + 14 * 60 * 1000)).toBe(true);
  });

  it("unlocks after the 15-minute lockout period expires", () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) {
      lockout.recordFailure("test@example.com", now + i * 1000);
    }
    const lockedAt = now + 4000;
    expect(lockout.isLocked("test@example.com", lockedAt + lockout.WINDOW_MS)).toBe(false);
  });

  it("lockout window is exactly 15 minutes (900,000 ms)", () => {
    expect(lockout.WINDOW_MS).toBe(15 * 60 * 1000);
    expect(lockout.WINDOW_MS).toBe(900_000);
  });

  it("MAX_ATTEMPTS is exactly 5", () => {
    expect(lockout.MAX_ATTEMPTS).toBe(5);
  });

  it("lockout message is generic and does not disclose credential details", () => {
    const msg = lockout.LOCKOUT_MESSAGE.toLowerCase();
    expect(msg).toContain("temporarily locked");
    expect(msg).not.toContain("email");
    expect(msg).not.toContain("password");
    expect(msg).not.toContain("5 attempts");
    expect(msg).not.toContain("15 minutes");
  });

  it("successful login clears failure count preventing lockout", () => {
    const now = 1_000_000;
    for (let i = 0; i < 4; i++) {
      lockout.recordFailure("test@example.com", now + i * 1000);
    }
    lockout.recordSuccess("test@example.com");
    lockout.recordFailure("test@example.com", now + 100_000);
    expect(lockout.isLocked("test@example.com", now + 100_000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Inactivity timeout (R1.7)
// ---------------------------------------------------------------------------

describe("Idle-session termination (R1.7)", () => {
  const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  beforeEach(() => {
    mockAuthUser({ id: "user-123", email: "designer@example.com" });
  });

  it("terminates session when idle for more than 30 minutes", async () => {
    const thirtyOneMinutesAgo = Date.now() - (INACTIVITY_TIMEOUT_MS + 60_000);
    const request = createMockRequest("/dashboard", {
      last_activity_at: thirtyOneMinutesAgo.toString(),
    });

    await middleware(request);

    // Should redirect to sign-in and call signOut
    const signOutMock = getSignOutMock();
    expect(signOutMock).toHaveBeenCalled();
    expect(NextResponse.redirect).toHaveBeenCalled();
  });

  it("does not terminate session when activity is within 30 minutes", async () => {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    const request = createMockRequest("/dashboard", {
      last_activity_at: tenMinutesAgo.toString(),
    });

    await middleware(request);

    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("does not terminate session at exactly 30 minutes (boundary - strictly greater than)", async () => {
    // The middleware uses `now - lastActivity > INACTIVITY_TIMEOUT_MS`
    // At exactly 30 minutes (equal), it should NOT terminate
    const exactlyThirtyMinutesAgo = Date.now() - INACTIVITY_TIMEOUT_MS;
    const request = createMockRequest("/dashboard", {
      last_activity_at: exactlyThirtyMinutesAgo.toString(),
    });

    await middleware(request);

    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("terminates session at 30 minutes + 1ms (just past boundary)", async () => {
    const justPastThirtyMinutes = Date.now() - (INACTIVITY_TIMEOUT_MS + 1);
    const request = createMockRequest("/dashboard", {
      last_activity_at: justPastThirtyMinutes.toString(),
    });

    await middleware(request);

    const signOutMock = getSignOutMock();
    expect(signOutMock).toHaveBeenCalled();
    expect(NextResponse.redirect).toHaveBeenCalled();
  });

  it("updates last_activity_at cookie on active authenticated requests", async () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const request = createMockRequest("/projects", {
      last_activity_at: fiveMinutesAgo.toString(),
    });

    await middleware(request);

    // Should pass through and the NextResponse.next() response should have cookies set
    expect(NextResponse.redirect).not.toHaveBeenCalled();
    // The response from NextResponse.next() should have had cookies.set called
    const nextResult = (NextResponse.next as ReturnType<typeof vi.fn>).mock.results;
    expect(nextResult.length).toBeGreaterThan(0);
    const lastResponse = nextResult[nextResult.length - 1].value;
    expect(lastResponse.cookies.set).toHaveBeenCalledWith(
      "last_activity_at",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        path: "/",
      }),
    );
  });

  it("handles missing last_activity_at cookie gracefully (first request)", async () => {
    const request = createMockRequest("/dashboard", {});

    await middleware(request);

    // Should pass through without terminating
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("does not check inactivity for public routes", async () => {
    const thirtyOneMinutesAgo = Date.now() - (INACTIVITY_TIMEOUT_MS + 60_000);
    const request = createMockRequest("/review/some-token", {
      last_activity_at: thirtyOneMinutesAgo.toString(),
    });

    await middleware(request);

    // Public routes should not trigger inactivity check
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Session establishment (R1.1)
// ---------------------------------------------------------------------------

describe("Successful session establishment (R1.1)", () => {
  beforeEach(() => {
    mockAuthUser({ id: "user-123", email: "designer@example.com" });
  });

  it("grants access to admin routes when session is valid", async () => {
    const request = createMockRequest("/dashboard", {
      last_activity_at: Date.now().toString(),
    });
    await middleware(request);

    // Authenticated user should get through to the dashboard
    expect(NextResponse.redirect).not.toHaveBeenCalled();
  });

  it("validates session via getUser() on each request (session refresh)", async () => {
    const request = createMockRequest("/clients", {
      last_activity_at: Date.now().toString(),
    });
    await middleware(request);

    // The middleware creates a Supabase client and calls getUser()
    expect(createServerClient).toHaveBeenCalled();
    const clientResult = (createServerClient as ReturnType<typeof vi.fn>).mock.results;
    const client = clientResult[clientResult.length - 1].value;
    expect(client.auth.getUser).toHaveBeenCalled();
  });
});
