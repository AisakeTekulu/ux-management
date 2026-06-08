import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests for the authentication Server Actions (Requirement 1).
 *
 * These cover the observable behavior of sign-in/sign-out without a live
 * Supabase instance: the Supabase server client and Next.js `redirect` are
 * mocked so we can assert on credential handling, the generic error message
 * (R1.2), the post-success redirect (R1.1), and session termination (R1.4).
 */

// --- Mocks -----------------------------------------------------------------

const signInWithPassword = vi.fn();
const signOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signInWithPassword, signOut },
  })),
}));

// `redirect` throws in Next.js to short-circuit rendering; emulate that so the
// action's control flow matches production.
class RedirectError extends Error {
  constructor(public readonly path: string) {
    super(`NEXT_REDIRECT:${path}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new RedirectError(path);
  }),
}));

import {
  signIn,
  signOut as signOutAction,
} from "@/lib/auth/actions";
import {
  GENERIC_SIGN_IN_ERROR,
  initialSignInFormState,
} from "@/lib/auth/sign-in-state";

// --- Helpers ---------------------------------------------------------------

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }
  return fd;
}

afterEach(() => {
  vi.clearAllMocks();
});

// --- signIn ----------------------------------------------------------------

describe("signIn", () => {
  it("redirects to the dashboard on valid credentials (R1.1)", async () => {
    signInWithPassword.mockResolvedValue({ error: null });

    await expect(
      signIn(initialSignInFormState, formData({ email: "d@x.com", password: "pw" })),
    ).rejects.toMatchObject({ path: "/dashboard" });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "d@x.com",
      password: "pw",
    });
  });

  it("returns the generic error on invalid credentials without naming the field (R1.2)", async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials", status: 400 },
    });

    const state = await signIn(
      initialSignInFormState,
      formData({ email: "d@x.com", password: "wrong" }),
    );

    expect(state.error).toBe(GENERIC_SIGN_IN_ERROR);
    // The message must not single out one field: it either names both equally
    // ("email or password") or names neither. It must never name just one.
    const message = state.error?.toLowerCase() ?? "";
    const namesEmail = message.includes("email");
    const namesPassword = message.includes("password");
    expect(namesEmail).toBe(namesPassword);
  });

  it("retains the entered email but never the password on failure (R1.2)", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "nope" } });

    const state = await signIn(
      initialSignInFormState,
      formData({ email: "  Designer@x.com  ", password: "secret" }),
    );

    expect(state.email).toBe("Designer@x.com");
    expect(JSON.stringify(state)).not.toContain("secret");
  });

  it("rejects empty input with the same generic message and skips Supabase (R1.2)", async () => {
    const missingPassword = await signIn(
      initialSignInFormState,
      formData({ email: "d@x.com", password: "" }),
    );
    const missingEmail = await signIn(
      initialSignInFormState,
      formData({ email: "   ", password: "pw" }),
    );

    expect(missingPassword.error).toBe(GENERIC_SIGN_IN_ERROR);
    expect(missingEmail.error).toBe(GENERIC_SIGN_IN_ERROR);
    // Empty/blank input must not reach the auth backend.
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("produces an identical message for empty input and rejected credentials", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    const empty = await signIn(initialSignInFormState, formData({ email: "", password: "" }));
    const rejected = await signIn(
      initialSignInFormState,
      formData({ email: "d@x.com", password: "wrong" }),
    );

    expect(empty.error).toBe(rejected.error);
  });
});

// --- signOut ---------------------------------------------------------------

describe("signOut", () => {
  it("terminates the session and redirects to sign-in (R1.4)", async () => {
    signOut.mockResolvedValue({ error: null });

    await expect(signOutAction()).rejects.toMatchObject({ path: "/sign-in" });
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
