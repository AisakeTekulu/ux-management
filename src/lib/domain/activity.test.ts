import { describe, expect, it } from 'vitest';

import {
  AUDIT_IMMUTABLE_MESSAGE,
  NOT_OWNER_MESSAGE,
  authorizeInternalNotesEdit,
  authorizeOwnership,
  buildApprovalCreatedLog,
  buildCommentCreatedLog,
  buildPhaseStatusChangedLog,
  guardAuditImmutability,
  isOwner,
  ownsResource,
  toSecondPrecisionIso,
} from '@/lib/domain/activity';

/**
 * Unit tests for the activity-log builders, audit-immutability guard, and
 * ownership predicate. Properties 33, 34, and 35 are implemented separately in
 * tasks 10.11–10.13.
 */

const base = {
  id: 'log-1',
  projectId: 'proj-1',
  actor: 'designer@example.com',
  now: new Date('2024-05-01T12:34:56.789Z'),
};

describe('toSecondPrecisionIso', () => {
  it('truncates sub-second precision to whole seconds in UTC', () => {
    expect(toSecondPrecisionIso(new Date('2024-05-01T12:34:56.789Z'))).toBe(
      '2024-05-01T12:34:56.000Z',
    );
  });
});

describe('activity-log builders', () => {
  it('builds a comment_created entry with required fields (R13.1)', () => {
    const log = buildCommentCreatedLog({
      ...base,
      commentId: 'cmt-1',
      phaseId: 'phase-1',
    });
    expect(log).toMatchObject({
      id: 'log-1',
      projectId: 'proj-1',
      type: 'comment_created',
      actor: 'designer@example.com',
      createdAt: '2024-05-01T12:34:56.000Z',
      detail: { commentId: 'cmt-1', phaseId: 'phase-1' },
    });
  });

  it('builds an approval_created entry carrying decision and reviewer (R13.2)', () => {
    const log = buildApprovalCreatedLog({
      ...base,
      actor: 'Jane Reviewer',
      approvalId: 'app-1',
      phaseId: 'phase-1',
      decision: 'Changes Requested',
      reviewerName: 'Jane Reviewer',
    });
    expect(log.type).toBe('approval_created');
    expect(log.detail).toMatchObject({
      decision: 'Changes Requested',
      reviewerName: 'Jane Reviewer',
      phaseId: 'phase-1',
    });
  });

  it('builds a phase_status_changed entry carrying from/to (R13.3)', () => {
    const log = buildPhaseStatusChangedLog({
      ...base,
      phaseId: 'phase-1',
      from: 'Draft',
      to: 'Sent to Client',
    });
    expect(log.type).toBe('phase_status_changed');
    expect(log.detail).toMatchObject({ from: 'Draft', to: 'Sent to Client' });
  });
});

describe('guardAuditImmutability', () => {
  it('rejects modify/delete and preserves the original (R7.8, R9.7, R13.7)', () => {
    const original = { id: 'a', text: 'unchanged' };
    const result = guardAuditImmutability('comment', 'modify', original);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('immutable');
      expect(result.error.message).toBe(AUDIT_IMMUTABLE_MESSAGE);
      expect(result.error.detail).toMatchObject({
        entityType: 'comment',
        mutation: 'modify',
        original,
      });
    }
    // Original object is untouched.
    expect(original).toEqual({ id: 'a', text: 'unchanged' });
  });

  it('rejects deletes of activity-log and approval entries too', () => {
    expect(guardAuditImmutability('activity_log', 'delete', {}).ok).toBe(false);
    expect(guardAuditImmutability('approval', 'delete', {}).ok).toBe(false);
  });
});

describe('ownership authorization', () => {
  it('isOwner is true only for the matching, non-empty requester (R1.5)', () => {
    expect(isOwner('owner-1', 'owner-1')).toBe(true);
    expect(isOwner('owner-1', 'someone-else')).toBe(false);
    expect(isOwner('owner-1', null)).toBe(false);
    expect(isOwner('owner-1', undefined)).toBe(false);
    expect(isOwner('owner-1', '')).toBe(false);
  });

  it('ownsResource reads ownerId off the resource', () => {
    expect(ownsResource({ ownerId: 'o' }, 'o')).toBe(true);
    expect(ownsResource({ ownerId: 'o' }, 'x')).toBe(false);
  });

  it('authorizeOwnership permits the owner and rejects others', () => {
    expect(authorizeOwnership('o', 'o').ok).toBe(true);
    const denied = authorizeOwnership('o', 'x');
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.error.code).toBe('forbidden');
      expect(denied.error.message).toBe(NOT_OWNER_MESSAGE);
    }
  });

  it('authorizeInternalNotesEdit blocks non-owners (R4.8)', () => {
    expect(authorizeInternalNotesEdit('owner-1', 'owner-1').ok).toBe(true);
    expect(authorizeInternalNotesEdit('owner-1', 'intruder').ok).toBe(false);
  });
});
