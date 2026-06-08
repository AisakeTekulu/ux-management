/**
 * Settings view — account and session settings (Requirement 1.4).
 *
 * Provides a minimal MVP settings page with a sign-out action. The sign-out
 * button invokes the `signOut` server action which terminates the authenticated
 * session and redirects to the sign-in page (R1.4).
 *
 * Composed from PageHeader and Card per the admin interface design (R14).
 */

import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { signOut } from "@/lib/auth/actions";

export default function SettingsPage() {
  return (
    <div className="space-y-token-4">
      <PageHeader title="Settings" subtitle="Account and session settings" />

      <Card title="Session">
        <p className="mb-token-4 text-sm text-text-subdued">
          Sign out to end your current session. You will need to sign in again
          to access the dashboard.
        </p>

        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-border bg-surface px-token-4 py-token-2 text-sm font-medium text-critical shadow-sm transition-colors hover:bg-surface-subdued focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive focus-visible:ring-offset-2"
          >
            Sign out
          </button>
        </form>
      </Card>
    </div>
  );
}
