import { SignInForm } from "./SignInForm";

/**
 * Designer sign-in route segment (Requirement 1).
 *
 * Renders the sign-in card and delegates submission to the `signIn` Server
 * Action via {@link SignInForm}. Successful authentication establishes a
 * session and redirects to the Admin_Dashboard (R1.1); invalid credentials
 * surface a generic error that does not disclose the failing field (R1.2).
 */
export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-token-4">
      <div className="rounded-lg border border-border bg-surface p-token-8 shadow-card">
        <h1 className="text-2xl font-semibold text-text">Sign in</h1>
        <p className="mt-token-2 mb-token-6 text-text-subdued">
          Sign in to manage your clients, projects, and sign-offs.
        </p>
        <SignInForm />
      </div>
    </main>
  );
}
