/**
 * Shared types and constants for the sign-in flow (Requirement 1).
 *
 * These live outside `actions.ts` because a `"use server"` module may only
 * export async functions. The Server Action, the form Client Component, and
 * the tests all import these stable values from here.
 */

/**
 * The single, generic authentication error surfaced for every failed sign-in
 * (missing input or rejected credentials). Keeping one message guarantees the
 * UI cannot disclose which field was incorrect (R1.2).
 */
export const GENERIC_SIGN_IN_ERROR =
  "Invalid email or password. Please try again.";

/**
 * Form state threaded through `useActionState` for the sign-in form.
 *
 * `error` carries the generic message (or `null` when there is nothing to
 * show). `email` echoes the last submitted address so the field can be
 * repopulated on failure without ever retaining the password.
 */
export interface SignInFormState {
  error: string | null;
  email: string;
}

/** The initial, untouched sign-in form state. */
export const initialSignInFormState: SignInFormState = {
  error: null,
  email: "",
};
