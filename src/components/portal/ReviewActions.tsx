"use client";

/**
 * ReviewActions — Client Portal approve/request-changes controls (Requirements 9.1, 15.4).
 *
 * Renders two separate action buttons:
 *   - "Approve" — primary styling (filled action button)
 *   - "Request Changes" — secondary styling (outlined/subdued button)
 *
 * Each button invokes the `onAction` callback with the corresponding decision.
 * This is a presentation-only Client Component.
 */

import type { ApprovalDecision } from "@/lib/domain/types";

export interface ReviewActionsProps {
  /** Called when the reviewer selects an action (Approved or Changes Requested). */
  onAction: (decision: ApprovalDecision) => void;
  /** Whether the controls are disabled (e.g., after sign-off is complete). */
  disabled?: boolean;
}

export function ReviewActions({ onAction, disabled = false }: ReviewActionsProps) {
  return (
    <div className="flex flex-wrap gap-token-3">
      {/* Primary action: Approve */}
      <button
        type="button"
        onClick={() => onAction("Approved")}
        disabled={disabled}
        className="rounded-md bg-action-primary px-token-5 py-token-2 text-sm font-medium text-on-primary transition-colors hover:bg-action-primary-hovered focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
      >
        Approve
      </button>

      {/* Secondary action: Request Changes */}
      <button
        type="button"
        onClick={() => onAction("Changes Requested")}
        disabled={disabled}
        className="rounded-md border border-border bg-surface px-token-5 py-token-2 text-sm font-medium text-text transition-colors hover:bg-surface-hovered focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
      >
        Request Changes
      </button>
    </div>
  );
}
