/**
 * Phase-status state machine, derived overdue computation, and completion
 * guard for the Client Sign-Off Dashboard.
 *
 * All functions in this module are pure: they take their inputs, compute a
 * result, and never mutate their arguments or any shared state. They have no
 * Supabase (or other infrastructure) dependencies, which keeps the phase
 * lifecycle deterministic and trivially testable.
 *
 * The lifecycle (Requirement 10):
 *
 *   Draft ──share──▶ Sent to Client ──first access──▶ Waiting for Feedback
 *                                          │
 *                            approval ─────┼───── Approved ──complete──▶ Completed
 *                                          └───── Changes Requested
 *
 * `'Overdue'` is intentionally NOT a {@link PhaseStatus}. Overdue is a derived
 * presentation flag computed from the due date and the stored status via
 * {@link isOverdue}; it never changes the persisted status (R10.6).
 */

import type { ApprovalDecision, PhaseStatus } from '@/lib/domain/types';
import { appError, err, ok, type AppError, type Result } from '@/lib/domain/result';

/**
 * Resolve the status a phase moves to when its share link is generated or
 * activated.
 *
 * Sharing always advances a phase to `'Sent to Client'`, regardless of its
 * current status, so the current value is not needed to compute the result.
 *
 * @returns Always `'Sent to Client'`.
 * @see Requirement 10.2
 */
export function nextStatusOnShare(_current: PhaseStatus): PhaseStatus {
  return 'Sent to Client';
}

/**
 * Resolve the status a phase moves to when a reviewer first accesses it
 * through its share link.
 *
 * If no approval has yet been submitted for the phase, first access advances
 * it to `'Waiting for Feedback'`. If an approval already exists, the status is
 * left unchanged so a recorded decision is never overwritten by a later view.
 *
 * @param current - The phase's current status.
 * @param hasApproval - Whether an approval has already been recorded.
 * @returns `'Waiting for Feedback'` when no approval exists; otherwise `current`.
 * @see Requirement 10.3
 */
export function nextStatusOnFirstAccess(
  current: PhaseStatus,
  hasApproval: boolean,
): PhaseStatus {
  return hasApproval ? current : 'Waiting for Feedback';
}

/**
 * Resolve the status a phase moves to when a reviewer submits an approval.
 *
 * @param decision - The reviewer's decision.
 * @returns `'Approved'` for an `'Approved'` decision; `'Changes Requested'`
 *   for a `'Changes Requested'` decision.
 * @see Requirements 10.4, 10.5
 */
export function nextStatusOnApproval(decision: ApprovalDecision): PhaseStatus {
  return decision === 'Approved' ? 'Approved' : 'Changes Requested';
}

/**
 * Determine whether a phase may be marked as completed.
 *
 * Only a phase whose status is `'Approved'` can be completed.
 *
 * @param status - The phase's current status.
 * @returns `true` if and only if `status` is `'Approved'`.
 * @see Requirements 10.8, 10.9
 */
export function canComplete(status: PhaseStatus): boolean {
  return status === 'Approved';
}

/**
 * Attempt to complete a phase given its current status.
 *
 * Succeeds with `'Completed'` if and only if the current status is
 * `'Approved'` (see {@link canComplete}). Otherwise the operation is rejected
 * with an `invalid_state` {@link AppError}; the caller's existing status is
 * retained because this function never mutates its input and returns no new
 * status on failure. The error detail carries the rejected status for display.
 *
 * @param current - The phase's current status.
 * @returns `ok('Completed')` when completable; otherwise `err(AppError)`.
 * @see Requirements 10.8, 10.9
 */
export function completePhase(
  current: PhaseStatus,
): Result<PhaseStatus, AppError> {
  if (!canComplete(current)) {
    return err(
      appError(
        'invalid_state',
        'Only approved phases can be completed.',
        { currentStatus: current },
      ),
    );
  }
  return ok('Completed');
}

/**
 * Reduce a `Date` to a comparable, time-of-day-independent day index using its
 * UTC calendar components.
 *
 * Domain timestamps are UTC, so deriving the calendar date in UTC keeps
 * comparisons stable regardless of the host machine's local timezone. The
 * returned value is the UTC millisecond timestamp of midnight on that day,
 * which is monotonic in calendar date and therefore safe to compare with `>`.
 */
function toUtcDayIndex(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Derive whether a phase is overdue.
 *
 * A phase is overdue if and only if it has a due date, the current calendar
 * date (UTC) is strictly later than the due date, and the status is neither
 * `'Approved'` nor `'Completed'`. Approved and completed phases are never
 * overdue, and a phase with no due date is never overdue.
 *
 * Overdue is a derived flag: this function reads the stored status but never
 * mutates it (the parameters are values, not references to shared state), so
 * the persisted status is unaffected by overdue computation.
 *
 * @param dueDate - The phase's due date, or `null` when none is set.
 * @param status - The phase's current stored status.
 * @param now - The current instant.
 * @returns `true` if and only if the phase is overdue.
 * @see Requirements 10.6, 10.7, 11.7
 */
export function isOverdue(
  dueDate: Date | null,
  status: PhaseStatus,
  now: Date,
): boolean {
  if (dueDate === null) {
    return false;
  }
  if (status === 'Approved' || status === 'Completed') {
    return false;
  }
  return toUtcDayIndex(now) > toUtcDayIndex(dueDate);
}
