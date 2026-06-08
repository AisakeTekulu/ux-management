"use client";

/**
 * Sign-in form (Requirement 1).
 *
 * A Client Component that drives the `signIn` Server Action through
 * `useActionState`, so validation/auth failures re-render with the generic
 * error banner and the previously entered email, while the password field is
 * always cleared (R1.2). On success the action redirects server-side, so this
 * component renders no success branch.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn } from "@/lib/auth/actions";
import {
  initialSignInFormState,
  type SignInFormState,
} from "@/lib/auth/sign-in-state";

/**
 * Submit button that reflects the pending state of the enclosing form so the
 * Designer gets immediate feedback and cannot double-submit.
 */
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-token-5 py-token-3 font-medium text-text-on-primary transition-colors hover:bg-primary-hovered disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export function SignInForm() {
  const [state, formAction] = useActionState<SignInFormState, FormData>(
    signIn,
    initialSignInFormState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-token-4" noValidate>
      {state.error ? (
        // Generic authentication banner; never names the offending field (R1.2).
        <div
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-token-4 py-token-3 text-sm text-status-red"
        >
          {state.error}
        </div>
      ) : null}

      <div className="flex flex-col gap-token-2">
        <label htmlFor="email" className="text-sm font-medium text-text">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          required
          className="rounded-md border border-border bg-surface px-token-3 py-token-2 text-text outline-none focus:border-focus focus:ring-2 focus:ring-focus/30"
        />
      </div>

      <div className="flex flex-col gap-token-2">
        <label htmlFor="password" className="text-sm font-medium text-text">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-border bg-surface px-token-3 py-token-2 text-text outline-none focus:border-focus focus:ring-2 focus:ring-focus/30"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
