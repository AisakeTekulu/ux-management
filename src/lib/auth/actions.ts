"use server";

/**
 * Designer authentication Server Actions (Requirement 1).
 *
 * Implements email/password sign-in and sign-out on top of Supabase Auth using
 * the cookie-based SSR client, so a successful sign-in establishes a session in
 * `httpOnly` cookies (R1.1) and sign-out terminates it (R1.4).
 *
 * Account lockout (R1.6): after 5 consecutive invalid-credential submissions
 * within a 15-minute window the account is locked for 15 minutes. During
 * lockout, all sign-in attempts are rejected with a generic "temporarily
 * locked" message BEFORE credentials are checked against Supabase.
 *
 * Scope note: route protection/session refresh (task 16.2) and inactivity
 * timeout (16.4) are intentionally NOT handled here.
 *
 * Security: invalid credentials always yield the same generic message
 * regardless of which field was wrong, so the response never discloses whether
 * the email exists or which field failed (R1.2). Shared types/constants live in
 * `./sign-in-state` because a `"use server"` file may only export async
 * functions.
 */

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  GENERIC_SIGN_IN_ERROR,
  type SignInFormState,
} from "@/lib/auth/sign-in-state";
import {
  isLocked,
  LOCKOUT_MESSAGE,
  recordFailure,
  recordSuccess,
} from "@/lib/auth/lockout";

/** Path the Designer lands on after a successful sign-in. */
const POST_SIGN_IN_PATH = "/dashboard";

/** Path the Designer returns to after signing out. */
const SIGN_IN_PATH = "/sign-in";

/** Read a `FormData` field as a string, treating files/absence as empty. */
function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Authenticate a Designer with email and password via Supabase Auth.
 *
 * On success the SSR client writes the session cookies and the action
 * redirects to the Admin_Dashboard (R1.1). On any failure — empty input or
 * rejected credentials — it returns the generic error and retains only the
 * entered email (R1.2).
 *
 * Account lockout (R1.6): if the account is locked, the attempt is rejected
 * with a generic "temporarily locked" message BEFORE credentials are checked.
 *
 * Shaped for React's `useActionState`: it takes the previous state and the
 * submitted `FormData` and returns the next state.
 */
export async function signIn(
  _prevState: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const email = readField(formData, "email").trim();
  const password = readField(formData, "password");

  // Reject empty input with the same generic message used for bad credentials
  // so missing-vs-wrong fields are indistinguishable (R1.2).
  if (email.length === 0 || password.length === 0) {
    return { error: GENERIC_SIGN_IN_ERROR, email };
  }

  // Account lockout check (R1.6): reject BEFORE credential verification so
  // locked accounts never hit Supabase Auth.
  if (isLocked(email)) {
    return { error: LOCKOUT_MESSAGE, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Record the failure for lockout tracking (R1.6).
    recordFailure(email);
    return { error: GENERIC_SIGN_IN_ERROR, email };
  }

  // Successful authentication — clear any accumulated failure state.
  recordSuccess(email);

  // `redirect` throws a control-flow signal that must propagate, so it is
  // intentionally outside any try/catch.
  redirect(POST_SIGN_IN_PATH);
}

/**
 * Terminate the current Designer session and return to the sign-in page.
 *
 * `signOut()` clears the Supabase auth cookies, after which subsequent
 * Admin_Dashboard access requires re-authentication (R1.4).
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(SIGN_IN_PATH);
}
