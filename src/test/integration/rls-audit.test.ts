/**
 * Integration tests for RLS isolation and audit immutability.
 *
 * Since no live Supabase instance is available, these tests exercise the
 * application-layer enforcement predicates that mirror the database-level RLS
 * policies and audit immutability grants:
 *
 * - `authorizeOwnership` / `authorizeInternalNotesEdit` — domain-layer
 *   ownership predicates that enforce "designer owns their data" (R1.5, R4.8).
 * - `guardAuditImmutability` — rejects UPDATE/DELETE on activity_logs,
 *   comments, and approvals (R13.7).
 *
 * Requirements: 1.5, 4.8, 13.7
 */

import { describe, expect, it } from 'vitest';

import {
  AUDIT_IMMUTABLE_MESSAGE,
  NOT_OWNER_MESSAGE,
  authorizeInternalNotesEdit,
  authorizeOwnership,
  guardAuditImmutability,
} from '@/lib/domain/activity';
import type { ActivityLog } from '@/lib/domain/types';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const DESIGNER_A = 'designer-a-uuid';
const DESIGNER_B = 'designer-b-uuid';

/** A sample activity log entry owned (via project) by Designer A. */
const sampleActivityLog: ActivityLog = {
  id: 'log-001',
  projectId: 'proj-a-1',
  type: 'comment_created',
  actor: 'designerA@example.com',
  detail: { commentId: 'cmt-1', phaseId: 'phase-1' },
  createdAt: '2024-06-01T10:00:00.000Z',
};

/** A sample comment record (simplified for guard testing). */
const sampleComment = {
  id: 'cmt-001',
  phaseId: 'phase-1',
  authorType: 'designer' as const,
  authorUserId: DESIGNER_A,
  authorName: null,
  text: 'Looks good!',
  createdAt: '2024-06-01T10:05:00.000Z',
};

/** A sample approval record (simplified for guard testing). */
const sampleApproval = {
  id: 'app-001',
  phaseId: 'phase-1',
  decision: 'Approved' as const,
  reviewerName: 'Jane Client',
  reviewerInitials: 'JC',
  checklistSnapshot: [{ checklistItemId: 'ci-1', text: 'Item 1', complete: true }],
  createdAt: '2024-06-01T11:00:00.000Z',
};

// ---------------------------------------------------------------------------
// RLS Isolation: Ownership authorization (R1.5, R4.8)
// ---------------------------------------------------------------------------

describe('RLS isolation — ownership authorization', () => {
  describe('authorizeOwnership', () => {
    it('permits the owning designer to access their own records', () => {
      const result = authorizeOwnership(DESIGNER_A, DESIGNER_A);
      expect(result.ok).toBe(true);
    });

    it('rejects a different designer from reading records they do not own', () => {
      const result = authorizeOwnership(DESIGNER_A, DESIGNER_B);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('forbidden');
        expect(result.error.message).toBe(NOT_OWNER_MESSAGE);
      }
    });

    it('rejects a different designer from mutating records they do not own', () => {
      // Mutation and read use the same predicate — both are denied for non-owners
      const result = authorizeOwnership(DESIGNER_A, DESIGNER_B);
      expect(result.ok).toBe(false);
    });

    it('rejects access when requester is null (unauthenticated)', () => {
      const result = authorizeOwnership(DESIGNER_A, null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('forbidden');
      }
    });

    it('rejects access when requester is undefined', () => {
      const result = authorizeOwnership(DESIGNER_A, undefined);
      expect(result.ok).toBe(false);
    });

    it('rejects access when requester is an empty string', () => {
      const result = authorizeOwnership(DESIGNER_A, '');
      expect(result.ok).toBe(false);
    });
  });

  describe('authorizeInternalNotesEdit — non-owner cannot edit internal notes (R4.8)', () => {
    it('permits the project owner to edit internal notes', () => {
      const result = authorizeInternalNotesEdit(DESIGNER_A, DESIGNER_A);
      expect(result.ok).toBe(true);
    });

    it('rejects a non-owner from editing internal notes of a phase they do not own', () => {
      const result = authorizeInternalNotesEdit(DESIGNER_A, DESIGNER_B);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('forbidden');
        expect(result.error.message).toBe(NOT_OWNER_MESSAGE);
      }
    });

    it('rejects an unauthenticated user from editing internal notes', () => {
      const result = authorizeInternalNotesEdit(DESIGNER_A, null);
      expect(result.ok).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Audit immutability: UPDATE/DELETE on activity_logs rejected (R13.7)
// ---------------------------------------------------------------------------

describe('Audit immutability — activity_logs cannot be updated or deleted', () => {
  describe('UPDATE on activity_logs is rejected', () => {
    it('rejects modification of an activity_log entry', () => {
      const result = guardAuditImmutability('activity_log', 'modify', sampleActivityLog);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('immutable');
        expect(result.error.message).toBe(AUDIT_IMMUTABLE_MESSAGE);
        expect(result.error.detail?.entityType).toBe('activity_log');
        expect(result.error.detail?.mutation).toBe('modify');
      }
    });

    it('preserves the original activity_log entry unchanged after rejected modification', () => {
      const original = { ...sampleActivityLog };
      const result = guardAuditImmutability('activity_log', 'modify', original);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.detail?.original).toEqual(sampleActivityLog);
      }
      // The original object reference is untouched
      expect(original).toEqual(sampleActivityLog);
    });
  });

  describe('DELETE on activity_logs is rejected', () => {
    it('rejects deletion of an activity_log entry', () => {
      const result = guardAuditImmutability('activity_log', 'delete', sampleActivityLog);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('immutable');
        expect(result.error.message).toBe(AUDIT_IMMUTABLE_MESSAGE);
        expect(result.error.detail?.entityType).toBe('activity_log');
        expect(result.error.detail?.mutation).toBe('delete');
      }
    });

    it('preserves the original activity_log entry unchanged after rejected deletion', () => {
      const original = { ...sampleActivityLog };
      guardAuditImmutability('activity_log', 'delete', original);
      expect(original).toEqual(sampleActivityLog);
    });
  });

  describe('UPDATE/DELETE on comments is rejected (audit trail)', () => {
    it('rejects modification of a comment', () => {
      const result = guardAuditImmutability('comment', 'modify', sampleComment);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('immutable');
        expect(result.error.detail?.entityType).toBe('comment');
        expect(result.error.detail?.mutation).toBe('modify');
      }
    });

    it('rejects deletion of a comment', () => {
      const result = guardAuditImmutability('comment', 'delete', sampleComment);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('immutable');
        expect(result.error.detail?.mutation).toBe('delete');
      }
    });
  });

  describe('UPDATE/DELETE on approvals is rejected (audit trail)', () => {
    it('rejects modification of an approval', () => {
      const result = guardAuditImmutability('approval', 'modify', sampleApproval);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('immutable');
        expect(result.error.detail?.entityType).toBe('approval');
        expect(result.error.detail?.mutation).toBe('modify');
      }
    });

    it('rejects deletion of an approval', () => {
      const result = guardAuditImmutability('approval', 'delete', sampleApproval);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('immutable');
        expect(result.error.detail?.mutation).toBe('delete');
      }
    });

    it('preserves the original approval unchanged after rejected mutation', () => {
      const original = { ...sampleApproval };
      guardAuditImmutability('approval', 'modify', original);
      expect(original).toEqual(sampleApproval);
    });
  });

  describe('immutability indication is returned', () => {
    it('returns the immutability message for all audit entity types', () => {
      for (const entityType of ['activity_log', 'comment', 'approval'] as const) {
        for (const mutation of ['modify', 'delete'] as const) {
          const result = guardAuditImmutability(entityType, mutation, {});
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.message).toBe(AUDIT_IMMUTABLE_MESSAGE);
          }
        }
      }
    });
  });
});
