/**
 * Activity logging, audit immutability, and ownership authorization for the
 * Client Sign-Off Dashboard.
 *
 * This module is part of the pure domain layer: it has **no** Supabase (or any
 * other infrastructure) imports and performs no I/O. It provides three groups
 * of pure helpers:
 *
 * 1. **Activity-log entry builders** — construct the append-only
 *    {@link ActivityLog} entries recorded when a comment is created, an
 *    approval is created, or a phase status changes (R13.1, R13.2, R13.3).
 * 2. **Audit-immutability guard** — rejects any attempt to modify or delete an
 *    audit-trail entry (activity log, comment, or approval), returning an
 *    immutability indication while leaving the original untouched
 *    (R7.8, R9.7, R13.7).
 * 3. **Ownership-authorization predicate** — authorizes a designer to access or
 *    mutate a resource if and only if they own it; in particular a non-owner
 *    cannot edit a phase's internal notes (R1.5, R4.8).
 *
 * See design "Components and Interfaces → Domain Layer", "Data Models →
 * Activity log / RLS", and Properties 33, 34, 35.
 */

import type {
  ActivityLog,
  ActivityType,
  ApprovalDecision,
  ISOTimestamp,
  PhaseStatus,
  UUID,
} from '@/lib/domain/types';
import {
  type AppError,
  type Result,
  appError,
  err,
  ok,
} from '@/lib/domain/result';

// ---------------------------------------------------------------------------
// Activity-log entry builders (R13.1, R13.2, R13.3)
// ---------------------------------------------------------------------------

/**
 * Format an instant as a UTC ISO-8601 timestamp truncated to **second-level**
 * precision, matching the activity log's required granularity (R13.1–R13.3).
 *
 * Sub-second components are dropped (zeroed) so two events recorded in the same
 * second share an identical, comparable timestamp.
 */
export function toSecondPrecisionIso(now: Date): ISOTimestamp {
  return new Date(Math.floor(now.getTime() / 1000) * 1000).toISOString();
}

/** Fields common to every activity-log entry builder. */
interface ActivityLogBaseInput {
  /** Identifier for the new entry (assigned by the caller/persistence layer). */
  id: UUID;
  /** The project the event belongs to. */
  projectId: UUID;
  /** The actor's identity: designer email or reviewer name. */
  actor: string;
  /** The instant the event occurred; truncated to second precision. */
  now: Date;
}

/** Structured `detail` payload for a `comment_created` entry. */
export interface CommentCreatedDetail extends Record<string, unknown> {
  commentId: UUID;
  phaseId: UUID;
}

/** Structured `detail` payload for an `approval_created` entry. */
export interface ApprovalCreatedDetail extends Record<string, unknown> {
  approvalId: UUID;
  phaseId: UUID;
  decision: ApprovalDecision;
  reviewerName: string;
}

/** Structured `detail` payload for a `phase_status_changed` entry. */
export interface PhaseStatusChangedDetail extends Record<string, unknown> {
  phaseId: UUID;
  from: PhaseStatus;
  to: PhaseStatus;
}

/**
 * Build the activity-log entry recorded when a comment is created (R13.1).
 *
 * The entry carries the event type (`comment_created`), the actor identity, and
 * a second-precision UTC timestamp, plus the comment/phase ids in `detail`.
 */
export function buildCommentCreatedLog(
  input: ActivityLogBaseInput & { commentId: UUID; phaseId: UUID },
): ActivityLog {
  const detail: CommentCreatedDetail = {
    commentId: input.commentId,
    phaseId: input.phaseId,
  };
  return makeActivityLog(input, 'comment_created', detail);
}

/**
 * Build the activity-log entry recorded when an approval is created (R13.2).
 *
 * The entry carries the approval decision and the reviewer's name (in addition
 * to the actor and a second-precision UTC timestamp).
 */
export function buildApprovalCreatedLog(
  input: ActivityLogBaseInput & {
    approvalId: UUID;
    phaseId: UUID;
    decision: ApprovalDecision;
    reviewerName: string;
  },
): ActivityLog {
  const detail: ApprovalCreatedDetail = {
    approvalId: input.approvalId,
    phaseId: input.phaseId,
    decision: input.decision,
    reviewerName: input.reviewerName,
  };
  return makeActivityLog(input, 'approval_created', detail);
}

/**
 * Build the activity-log entry recorded when a phase status changes (R13.3).
 *
 * The entry carries the previous status (`from`) and the new status (`to`) in
 * addition to the actor and a second-precision UTC timestamp.
 */
export function buildPhaseStatusChangedLog(
  input: ActivityLogBaseInput & {
    phaseId: UUID;
    from: PhaseStatus;
    to: PhaseStatus;
  },
): ActivityLog {
  const detail: PhaseStatusChangedDetail = {
    phaseId: input.phaseId,
    from: input.from,
    to: input.to,
  };
  return makeActivityLog(input, 'phase_status_changed', detail);
}

/** Assemble an {@link ActivityLog} from the common base, a type, and a detail. */
function makeActivityLog(
  base: ActivityLogBaseInput,
  type: ActivityType,
  detail: Record<string, unknown>,
): ActivityLog {
  return {
    id: base.id,
    projectId: base.projectId,
    type,
    actor: base.actor,
    detail,
    createdAt: toSecondPrecisionIso(base.now),
  };
}

// ---------------------------------------------------------------------------
// Audit-immutability guard (R7.8, R9.7, R13.7)
// ---------------------------------------------------------------------------

/** The audit-trail entity kinds that may never be modified or deleted. */
export type AuditEntityType = 'activity_log' | 'comment' | 'approval';

/** A mutation attempted against an audit-trail entry. */
export type AuditMutation = 'modify' | 'delete';

/** The single message returned for every rejected audit mutation (R13.7). */
export const AUDIT_IMMUTABLE_MESSAGE =
  'Audit-trail entries are immutable and cannot be modified or deleted.';

/**
 * Guard a mutation attempted against an audit-trail entry.
 *
 * Activity-log, comment, and approval records form the immutable audit trail,
 * so **every** modify/delete attempt is rejected with an `immutable`
 * {@link AppError}. Because this function is pure it never mutates `original`;
 * the unchanged value is echoed back in the error detail so callers can confirm
 * the record was preserved and surface the immutability indication
 * (R7.8, R9.7, R13.7).
 *
 * @param entityType - The kind of audit entry the caller tried to mutate.
 * @param mutation - Whether a modify or delete was attempted.
 * @param original - The existing entry; returned unchanged in the error detail.
 * @returns Always `err(AppError)` with code `'immutable'`.
 */
export function guardAuditImmutability<T>(
  entityType: AuditEntityType,
  mutation: AuditMutation,
  original: T,
): Result<never, AppError> {
  return err(
    appError('immutable', AUDIT_IMMUTABLE_MESSAGE, {
      entityType,
      mutation,
      original,
    }),
  );
}

// ---------------------------------------------------------------------------
// Ownership authorization (R1.5, R4.8)
// ---------------------------------------------------------------------------

/** A resource that records the id of its owning designer. */
export interface OwnedResource {
  ownerId: UUID;
}

/** The message returned when a non-owner attempts to access or mutate a resource. */
export const NOT_OWNER_MESSAGE =
  'You do not have permission to access this resource.';

/**
 * Whether `requesterId` is the owner identified by `ownerId`.
 *
 * Returns `false` for a missing/empty requester so an unauthenticated or
 * unidentified caller is never treated as an owner.
 */
export function isOwner(
  ownerId: UUID,
  requesterId: UUID | null | undefined,
): boolean {
  return requesterId != null && requesterId !== '' && ownerId === requesterId;
}

/** Whether `requesterId` owns `resource` (convenience over {@link isOwner}). */
export function ownsResource(
  resource: OwnedResource,
  requesterId: UUID | null | undefined,
): boolean {
  return isOwner(resource.ownerId, requesterId);
}

/**
 * Authorize access to or mutation of an owner-scoped resource.
 *
 * Permitted if and only if the requester is the owner (R1.5); otherwise the
 * action is rejected with a `forbidden` {@link AppError} and no state change.
 *
 * @param ownerId - The id of the resource's owning designer.
 * @param requesterId - The id of the requester, if any.
 */
export function authorizeOwnership(
  ownerId: UUID,
  requesterId: UUID | null | undefined,
): Result<void, AppError> {
  return isOwner(ownerId, requesterId)
    ? ok(undefined)
    : err(appError('forbidden', NOT_OWNER_MESSAGE));
}

/**
 * Authorize editing a phase's internal notes.
 *
 * A phase is owned (transitively) by the designer who owns its project, so the
 * edit is permitted only when the requester owns that project; any other user's
 * attempt is rejected and the existing internal notes are retained (R4.8).
 *
 * @param projectOwnerId - The owner id of the phase's project.
 * @param requesterId - The id of the requester attempting the edit.
 */
export function authorizeInternalNotesEdit(
  projectOwnerId: UUID,
  requesterId: UUID | null | undefined,
): Result<void, AppError> {
  return authorizeOwnership(projectOwnerId, requesterId);
}
