/**
 * ApprovalHistory — Client Portal approval history list (Requirement 9.8).
 *
 * Renders the approval history for a shared phase in reverse chronological
 * order by approval timestamp. Each entry shows:
 *   - The Approval_Decision (Approved / Changes Requested)
 *   - The reviewer name
 *   - The approval timestamp
 *
 * This is a presentation-only component: it receives data via props and
 * performs no side effects or data fetching.
 *
 * Requirement 9.10 is satisfied structurally — no edit or delete controls
 * are rendered, so there is no means to modify or delete an existing Approval.
 */

import type { Approval } from "@/lib/domain/types";

export interface ApprovalHistoryProps {
  /** Approvals to display, expected in reverse chronological order. */
  approvals: Approval[];
}

/**
 * Format an ISO timestamp into a human-readable date/time string.
 * Uses the browser's locale for formatting.
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

export function ApprovalHistory({ approvals }: ApprovalHistoryProps) {
  if (approvals.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="approval-history-heading" className="mt-token-6">
      <h3
        id="approval-history-heading"
        className="mb-token-3 text-sm font-semibold text-text"
      >
        Approval History
      </h3>

      <ul className="space-y-token-3" role="list">
        {approvals.map((approval) => (
          <li
            key={approval.id}
            className="rounded-md border border-border bg-surface px-token-4 py-token-3"
          >
            <div className="flex items-center gap-token-2">
              <DecisionIndicator decision={approval.decision} />
              <span className="text-sm font-medium text-text">
                {approval.decision}
              </span>
            </div>

            <p className="mt-token-1 text-sm text-text-subdued">
              <span className="font-medium text-text">
                {approval.reviewerName}
              </span>
              {" — "}
              <time dateTime={approval.createdAt}>
                {formatTimestamp(approval.createdAt)}
              </time>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * Decision indicator dot — green for Approved, amber for Changes Requested.
 * ------------------------------------------------------------------------ */

function DecisionIndicator({ decision }: { decision: string }) {
  const colorClass =
    decision === "Approved"
      ? "bg-status-green"
      : "bg-status-amber";

  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colorClass}`}
      aria-hidden="true"
    />
  );
}
