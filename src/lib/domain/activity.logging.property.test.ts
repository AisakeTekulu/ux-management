import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  buildApprovalCreatedLog,
  buildCommentCreatedLog,
  buildPhaseStatusChangedLog,
  toSecondPrecisionIso,
} from '@/lib/domain/activity';
import type {
  ApprovalDecision,
  PhaseStatus,
  UUID,
} from '@/lib/domain/types';

/**
 * Property-based test for activity logging on events (design Property 33).
 *
 * Each activity-log builder (comment/approval/status-change) produces the
 * correct ActivityType, carries the required detail fields, and has a
 * second-precision UTC timestamp.
 *
 * **Validates: Requirements 13.1, 13.2, 13.3**
 */

// Feature: client-sign-off-dashboard, Property 33: Activity logging on events

// --- Generators ---

const uuidArb: fc.Arbitrary<UUID> = fc.uuid();

const actorArb: fc.Arbitrary<string> = fc.oneof(
  fc.emailAddress(),
  fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0),
);

const dateArb: fc.Arbitrary<Date> = fc.date({
  min: new Date('2000-01-01T00:00:00.000Z'),
  max: new Date('2099-12-31T23:59:59.999Z'),
});

const decisionArb: fc.Arbitrary<ApprovalDecision> = fc.constantFrom(
  'Approved',
  'Changes Requested',
);

const phaseStatusArb: fc.Arbitrary<PhaseStatus> = fc.constantFrom(
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
);

const reviewerNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length >= 1);

describe('Activity logging on events (Property 33)', () => {
  // Feature: client-sign-off-dashboard, Property 33: Activity logging on events
  // Validates: Requirements 13.1, 13.2, 13.3
  it('comment/approval/status-change each produce the correct entry type carrying required fields with second-precision UTC timestamp', () => {
    fc.assert(
      fc.property(
        // Common base fields
        uuidArb, // id
        uuidArb, // projectId
        actorArb, // actor
        dateArb, // now
        // Comment-specific
        uuidArb, // commentId
        uuidArb, // phaseId for comment
        // Approval-specific
        uuidArb, // approvalId
        uuidArb, // phaseId for approval
        decisionArb, // decision
        reviewerNameArb, // reviewerName
        // Status-change-specific
        uuidArb, // phaseId for status change
        phaseStatusArb, // from
        phaseStatusArb, // to
        (
          id,
          projectId,
          actor,
          now,
          commentId,
          commentPhaseId,
          approvalId,
          approvalPhaseId,
          decision,
          reviewerName,
          statusPhaseId,
          fromStatus,
          toStatus,
        ) => {
          const expectedTimestamp = toSecondPrecisionIso(now);

          // --- 1. Comment created (R13.1) ---
          const commentLog = buildCommentCreatedLog({
            id,
            projectId,
            actor,
            now,
            commentId,
            phaseId: commentPhaseId,
          });

          // Correct type
          expect(commentLog.type).toBe('comment_created');
          // Carries required fields
          expect(commentLog.id).toBe(id);
          expect(commentLog.projectId).toBe(projectId);
          expect(commentLog.actor).toBe(actor);
          // Detail carries commentId and phaseId
          expect(commentLog.detail.commentId).toBe(commentId);
          expect(commentLog.detail.phaseId).toBe(commentPhaseId);
          // Second-precision UTC timestamp
          expect(commentLog.createdAt).toBe(expectedTimestamp);
          // Verify second-precision: no sub-second component
          const commentDate = new Date(commentLog.createdAt);
          expect(commentDate.getMilliseconds()).toBe(0);

          // --- 2. Approval created (R13.2) ---
          const approvalLog = buildApprovalCreatedLog({
            id,
            projectId,
            actor,
            now,
            approvalId,
            phaseId: approvalPhaseId,
            decision,
            reviewerName,
          });

          // Correct type
          expect(approvalLog.type).toBe('approval_created');
          // Carries required fields
          expect(approvalLog.id).toBe(id);
          expect(approvalLog.projectId).toBe(projectId);
          expect(approvalLog.actor).toBe(actor);
          // Detail carries decision and reviewer name
          expect(approvalLog.detail.approvalId).toBe(approvalId);
          expect(approvalLog.detail.phaseId).toBe(approvalPhaseId);
          expect(approvalLog.detail.decision).toBe(decision);
          expect(approvalLog.detail.reviewerName).toBe(reviewerName);
          // Second-precision UTC timestamp
          expect(approvalLog.createdAt).toBe(expectedTimestamp);
          const approvalDate = new Date(approvalLog.createdAt);
          expect(approvalDate.getMilliseconds()).toBe(0);

          // --- 3. Phase status changed (R13.3) ---
          const statusLog = buildPhaseStatusChangedLog({
            id,
            projectId,
            actor,
            now,
            phaseId: statusPhaseId,
            from: fromStatus,
            to: toStatus,
          });

          // Correct type
          expect(statusLog.type).toBe('phase_status_changed');
          // Carries required fields
          expect(statusLog.id).toBe(id);
          expect(statusLog.projectId).toBe(projectId);
          expect(statusLog.actor).toBe(actor);
          // Detail carries from/to statuses and phaseId
          expect(statusLog.detail.phaseId).toBe(statusPhaseId);
          expect(statusLog.detail.from).toBe(fromStatus);
          expect(statusLog.detail.to).toBe(toStatus);
          // Second-precision UTC timestamp
          expect(statusLog.createdAt).toBe(expectedTimestamp);
          const statusDate = new Date(statusLog.createdAt);
          expect(statusDate.getMilliseconds()).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
