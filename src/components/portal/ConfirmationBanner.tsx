/**
 * ConfirmationBanner — Client Portal sign-off confirmation (Requirement 9.6).
 *
 * Displays a success confirmation message after a Client_Reviewer completes
 * a sign-off. The banner states:
 *   - The recorded decision (Approved / Changes Requested)
 *   - The reviewer name
 *   - The approval timestamp
 *
 * This is a presentation-only component: it receives data via props and
 * performs no side effects or data fetching. It wraps the shared Banner
 * component with the `success` tone.
 */

import { Banner } from "@/components/ui/Banner";
import type { ApprovalDecision } from "@/lib/domain/types";

export interface ConfirmationBannerProps {
  /** The recorded approval decision. */
  decision: ApprovalDecision;
  /** The reviewer name that was submitted. */
  name: string;
  /** The UTC timestamp when the sign-off was recorded. */
  timestamp: string;
  /** Optional callback to dismiss the banner. */
  onDismiss?: () => void;
}

/**
 * Format an ISO timestamp into a human-readable date/time string.
 */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ConfirmationBanner({
  decision,
  name,
  timestamp,
  onDismiss,
}: ConfirmationBannerProps) {
  const decisionLabel =
    decision === "Approved" ? "Approved" : "Changes Requested";

  return (
    <Banner
      tone="success"
      title="Sign-off recorded"
      onDismiss={onDismiss}
    >
      <p>
        <strong>{name}</strong> recorded{" "}
        <strong>{decisionLabel}</strong> on{" "}
        <time dateTime={timestamp}>{formatTimestamp(timestamp)}</time>.
      </p>
    </Banner>
  );
}
