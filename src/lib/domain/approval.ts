/**
 * Pure domain logic for constructing approvals and the change-request task
 * they imply.
 *
 * This module is part of the pure domain layer: it has **no** Supabase (or any
 * other infrastructure) imports and performs no I/O. The identifier and the
 * current time are injected (an {@link IdSource} and a `Date`) so the functions
 * stay deterministic and property-testable.
 *
 * Responsibilities:
 * - `buildApproval` mints an immutable {@link Approval} record from a validated
 *   sign-off, capturing the decision, reviewer name, reviewer initials, the
 *   associated phase identifier, a UTC timestamp, and a snapshot of the
 *   checklist completion state *at sign-off time*. The snapshot is denormalized
 *   onto the approval so it cannot drift when checklist items later change
 *   (R9.4, R9.5, R17.6). Any missing or empty required field is rejected and no
 *   approval is produced (Property 21).
 * - `buildChangeRequestTask` / `tasksForApproval` encode the rule that an
 *   approval whose decision is `Changes Requested` yields exactly one open task
 *   for the designer referencing the affected phase, while an `Approved`
 *   decision yields none (R12.5, Property 32).
 *
 * See design "Components and Interfaces → Domain Layer (Approval snapshot)",
 * "Data Models → Approval", and Properties 21 and 32.
 */

import type {
  Approval,
  ApprovalDecision,
  ChecklistItem,
  Task,
  UUID,
} from '@/lib/domain/types';
import {
  err,
  ok,
  validationError,
  type FieldError,
  type Result,
  type ValidationError,
} from '@/lib/domain/result';
import { validateSignoff } from '@/lib/domain/validators';

/**
 * A source of unique identifiers.
 *
 * Injected (rather than imported) so the construction functions remain pure and
 * deterministic under test. In production this is typically backed by
 * `crypto.randomUUID()` or the database's `gen_random_uuid()`.
 */
export type IdSource = () => UUID;

/** The set of decisions a reviewer may record. */
const APPROVAL_DECISIONS: ReadonlySet<string> = new Set<ApprovalDecision>([
  'Approved',
  'Changes Requested',
]);

/** Maximum allowed length, in code points, of a task title (R12.1). */
const MAX_TASK_TITLE_LENGTH = 200;

/**
 * The sign-off details required to construct an approval.
 *
 * `name` and `initials` are the raw reviewer inputs; they are validated and
 * trimmed by {@link buildApproval}. `phaseId` ties the approval to the phase
 * being signed off.
 */
export interface SignoffInput {
  /** Identifier of the phase being approved. */
  phaseId: UUID;
  /** The reviewer's decision. */
  decision: ApprovalDecision;
  /** Reviewer's full name (raw); validated to 1..100 trimmed characters. */
  name: string;
  /** Reviewer's initials (raw); validated to 1..10 trimmed characters. */
  initials: string;
}

/** A single entry in an approval's checklist snapshot. */
export interface ChecklistSnapshotEntry {
  checklistItemId: UUID;
  text: string;
  complete: boolean;
}

/**
 * Capture an immutable snapshot of the checklist completion state.
 *
 * Each entry records the checklist item's identifier, its text, and whether it
 * was complete at the moment of capture. The result is a fresh array of fresh
 * objects so it cannot share structure with — and therefore cannot drift
 * alongside — the live checklist (R9.4, R9.5, R17.6).
 */
export function snapshotChecklist(
  checklist: readonly ChecklistItem[],
): ChecklistSnapshotEntry[] {
  return checklist.map((item) => ({
    checklistItemId: item.id,
    text: item.text,
    complete: item.complete,
  }));
}

/**
 * Build an immutable {@link Approval} from a sign-off.
 *
 * Accepts if and only if all required fields are present and valid:
 * - `phaseId` is a non-empty identifier,
 * - `decision` is `Approved` or `Changes Requested`,
 * - `name` trims to 1..100 characters, and
 * - `initials` trims to 1..10 characters.
 *
 * On success the approval stores the decision, the trimmed name and initials,
 * the phase identifier, a UTC timestamp derived from `now`, and a checklist
 * snapshot equal to the completion state of every checklist item at sign-off
 * time. On failure a {@link ValidationError} identifies each invalid field and
 * **no approval is produced** (R9.4, R9.5, R17.6; Property 21). Inputs are
 * never mutated.
 *
 * @param input - The sign-off details (phase, decision, raw name/initials).
 * @param checklist - The phase's checklist items at sign-off time.
 * @param newId - Identifier source for the new approval.
 * @param now - The approval instant; serialized to a UTC ISO-8601 timestamp.
 */
export function buildApproval(
  input: SignoffInput,
  checklist: readonly ChecklistItem[],
  newId: IdSource,
  now: Date,
): Result<Approval, ValidationError> {
  const fields: FieldError[] = [];

  const phaseId = input.phaseId?.trim() ?? '';
  if (phaseId.length === 0) {
    fields.push({ field: 'phaseId', message: 'A phase identifier is required.' });
  }

  if (!APPROVAL_DECISIONS.has(input.decision)) {
    fields.push({
      field: 'decision',
      message: 'Decision must be either Approved or Changes Requested.',
    });
  }

  // Delegate name/initials validation to the shared sign-off validator so the
  // same rules run everywhere; fold its field errors into ours.
  const signoff = validateSignoff(input.name, input.initials);
  if (!signoff.ok) {
    fields.push(...signoff.error.fields);
  }

  if (fields.length > 0 || !signoff.ok) {
    return err(
      validationError('The sign-off is missing or has invalid fields.', fields),
    );
  }

  const approval: Approval = {
    id: newId(),
    phaseId,
    decision: input.decision,
    reviewerName: signoff.value.name,
    reviewerInitials: signoff.value.initials,
    checklistSnapshot: snapshotChecklist(checklist),
    createdAt: now.toISOString(),
  };

  return ok(approval);
}

/** The default title for the task generated when changes are requested. */
export const CHANGE_REQUEST_TASK_TITLE = 'Address requested changes';

/** Truncate a title to {@link MAX_TASK_TITLE_LENGTH} code points. */
function boundTitle(title: string): string {
  const codePoints = Array.from(title);
  return codePoints.length <= MAX_TASK_TITLE_LENGTH
    ? title
    : codePoints.slice(0, MAX_TASK_TITLE_LENGTH).join('');
}

/** The inputs needed to build the designer's change-request follow-up task. */
export interface ChangeRequestTaskInput {
  /** The designer who owns the task. */
  ownerId: UUID;
  /** The affected phase the task references. */
  phaseId: UUID;
  /** The project the phase belongs to, when known. */
  projectId?: UUID | null;
  /** Optional phase title, used to make the task title more descriptive. */
  phaseTitle?: string;
}

/**
 * Build the single open task a designer must act on after a reviewer requests
 * changes (R12.5).
 *
 * The task is created in the `open` state for `ownerId` and references the
 * affected `phaseId` (and `projectId` when supplied). When a `phaseTitle` is
 * provided it is woven into the title for clarity; otherwise a generic title is
 * used. The title is bounded to {@link MAX_TASK_TITLE_LENGTH} characters.
 *
 * @param input - Owner, affected phase/project, and optional phase title.
 * @param newId - Identifier source for the new task.
 * @param now - Creation instant; serialized to a UTC ISO-8601 timestamp.
 */
export function buildChangeRequestTask(
  input: ChangeRequestTaskInput,
  newId: IdSource,
  now: Date,
): Task {
  const trimmedPhaseTitle = input.phaseTitle?.trim() ?? '';
  const title =
    trimmedPhaseTitle.length > 0
      ? boundTitle(`${CHANGE_REQUEST_TASK_TITLE} for "${trimmedPhaseTitle}"`)
      : CHANGE_REQUEST_TASK_TITLE;

  return {
    id: newId(),
    ownerId: input.ownerId,
    title,
    state: 'open',
    projectId: input.projectId ?? null,
    phaseId: input.phaseId,
    dueDate: null,
    createdAt: now.toISOString(),
  };
}

/** Context needed to derive the tasks implied by an approval. */
export interface ApprovalTaskContext {
  /** The designer who owns any generated task. */
  ownerId: UUID;
  /** The project the approved phase belongs to, when known. */
  projectId?: UUID | null;
  /** Optional phase title used to make a generated task title descriptive. */
  phaseTitle?: string;
}

/**
 * Derive the tasks implied by an approval.
 *
 * Returns exactly one open task referencing the approval's phase when the
 * decision is `Changes Requested`, and an empty array otherwise (R12.5;
 * Property 32). The approval is read-only and never mutated.
 *
 * @param approval - The approval just recorded.
 * @param context - Owner and optional project/phase-title for the task.
 * @param newId - Identifier source for any generated task.
 * @param now - Creation instant for any generated task.
 */
export function tasksForApproval(
  approval: Approval,
  context: ApprovalTaskContext,
  newId: IdSource,
  now: Date,
): Task[] {
  if (approval.decision !== 'Changes Requested') {
    return [];
  }
  return [
    buildChangeRequestTask(
      {
        ownerId: context.ownerId,
        phaseId: approval.phaseId,
        projectId: context.projectId ?? null,
        phaseTitle: context.phaseTitle,
      },
      newId,
      now,
    ),
  ];
}

/** The combined outcome of recording a sign-off: the approval and its tasks. */
export interface ApprovalOutcome {
  /** The constructed approval record. */
  approval: Approval;
  /**
   * Tasks implied by the approval: exactly one open task for a
   * `Changes Requested` decision, empty for `Approved`.
   */
  tasks: Task[];
}

/**
 * Build an approval together with the tasks it implies.
 *
 * A convenience that composes {@link buildApproval} and {@link tasksForApproval}
 * for the sign-off path (used by the portal sign-off handler). Validation
 * failures short-circuit: when the sign-off is invalid no approval and no task
 * are produced (Property 21). When valid and the decision is
 * `Changes Requested`, the outcome carries exactly one open task referencing
 * the phase (R12.5; Property 32).
 *
 * The same injected `newId` source mints the approval id first, then any task
 * id; supply a source that yields distinct values per call.
 *
 * @param input - The sign-off details.
 * @param checklist - The phase's checklist items at sign-off time.
 * @param context - Owner and optional project/phase-title for any task.
 * @param newId - Identifier source for the approval and any task.
 * @param now - The sign-off instant.
 */
export function buildApprovalOutcome(
  input: SignoffInput,
  checklist: readonly ChecklistItem[],
  context: ApprovalTaskContext,
  newId: IdSource,
  now: Date,
): Result<ApprovalOutcome, ValidationError> {
  const approvalResult = buildApproval(input, checklist, newId, now);
  if (!approvalResult.ok) {
    return approvalResult;
  }
  const approval = approvalResult.value;
  return ok({ approval, tasks: tasksForApproval(approval, context, newId, now) });
}
