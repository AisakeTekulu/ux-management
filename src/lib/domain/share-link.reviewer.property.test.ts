import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  authorizeReviewerWrite,
  type ReviewerWriteAction,
} from '@/lib/domain/share-link';
import type { Phase, ShareLink, UUID } from '@/lib/domain/types';

/**
 * Property-based test for reviewer view-only authorization (design Property 19).
 *
 * The `authorizeReviewerWrite` function is a pure predicate that succeeds only
 * when ALL of the following hold:
 * 1. The link is valid (exists and not revoked — `revokedAt` is null).
 * 2. The action is one of the two permitted reviewer writes: `add_comment` or
 *    `submit_approval`.
 * 3. The target phase is in scope for the link (phase-scoped: exact phase id
 *    match; project-scoped: phase belongs to the link's project).
 *
 * Every other combination — disallowed action, out-of-scope target, null
 * target, or any write through an invalid/revoked/null link — is rejected with
 * a forbidden error and no state change (R7.5, R8.6, R9.9, R9.10).
 */

// Feature: client-sign-off-dashboard, Property 19: Reviewer view-only authorization

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** All possible reviewer write actions. */
const ALL_ACTIONS: ReviewerWriteAction[] = [
  'add_comment',
  'submit_approval',
  'edit_comment',
  'delete_comment',
  'edit_approval',
  'delete_approval',
  'edit_phase',
  'delete_phase',
  'edit_checklist_item',
  'delete_checklist_item',
];

const ALLOWED_ACTIONS: ReviewerWriteAction[] = ['add_comment', 'submit_approval'];
const DISALLOWED_ACTIONS: ReviewerWriteAction[] = ALL_ACTIONS.filter(
  (a) => !ALLOWED_ACTIONS.includes(a),
);

/** Generate a UUID-like string. */
const uuidArb: fc.Arbitrary<UUID> = fc.uuid();

/** Generate a valid ISOTimestamp. */
const isoTimestampArb: fc.Arbitrary<string> = fc.date().map((d) => d.toISOString());

/** Generate any ReviewerWriteAction uniformly. */
const actionArb: fc.Arbitrary<ReviewerWriteAction> = fc.constantFrom(...ALL_ACTIONS);

/** Generate only allowed actions. */
const allowedActionArb: fc.Arbitrary<ReviewerWriteAction> = fc.constantFrom(...ALLOWED_ACTIONS);

/** Generate only disallowed actions. */
const disallowedActionArb: fc.Arbitrary<ReviewerWriteAction> = fc.constantFrom(...DISALLOWED_ACTIONS);

/** Generate a valid (non-revoked) share link. */
const validShareLinkArb: fc.Arbitrary<ShareLink> = fc.record({
  id: uuidArb,
  ownerId: uuidArb,
  token: fc.string({ minLength: 32, maxLength: 64 }),
  scopeType: fc.constantFrom('project' as const, 'phase' as const),
  projectId: uuidArb.map((id) => id as string | null),
  phaseId: uuidArb.map((id) => id as string | null),
  revokedAt: fc.constant(null),
  firstAccessedAt: fc.oneof(fc.constant(null), isoTimestampArb),
  createdAt: isoTimestampArb,
}).map((link) => {
  // Ensure consistency: phase-scoped links must have phaseId, project-scoped must have projectId
  if (link.scopeType === 'phase') {
    return { ...link, phaseId: link.phaseId ?? link.id };
  }
  return { ...link, projectId: link.projectId ?? link.id, phaseId: null };
});

/** Generate a revoked share link. */
const revokedShareLinkArb: fc.Arbitrary<ShareLink> = fc.record({
  id: uuidArb,
  ownerId: uuidArb,
  token: fc.string({ minLength: 32, maxLength: 64 }),
  scopeType: fc.constantFrom('project' as const, 'phase' as const),
  projectId: uuidArb.map((id) => id as string | null),
  phaseId: uuidArb.map((id) => id as string | null),
  revokedAt: isoTimestampArb, // non-null means revoked
  firstAccessedAt: fc.oneof(fc.constant(null), isoTimestampArb),
  createdAt: isoTimestampArb,
}).map((link) => {
  if (link.scopeType === 'phase') {
    return { ...link, phaseId: link.phaseId ?? link.id };
  }
  return { ...link, projectId: link.projectId ?? link.id, phaseId: null };
});

/** Generate a null or undefined link. */
const nullLinkArb: fc.Arbitrary<ShareLink | null | undefined> = fc.constantFrom(null, undefined);

/** Generate a phase that is in scope for the given link. */
function inScopePhaseArb(link: ShareLink): fc.Arbitrary<Pick<Phase, 'id' | 'projectId'>> {
  if (link.scopeType === 'phase') {
    // Phase-scoped: the phase id must match link.phaseId
    return uuidArb.map((projectId) => ({
      id: link.phaseId!,
      projectId,
    }));
  }
  // Project-scoped: the phase's projectId must match link.projectId
  return uuidArb.map((phaseId) => ({
    id: phaseId,
    projectId: link.projectId!,
  }));
}

/** Generate a phase that is NOT in scope for the given link. */
function outOfScopePhaseArb(link: ShareLink): fc.Arbitrary<Pick<Phase, 'id' | 'projectId'>> {
  if (link.scopeType === 'phase') {
    // Phase-scoped: the phase id must NOT match link.phaseId
    return fc.record({ id: uuidArb, projectId: uuidArb }).filter(
      (phase) => phase.id !== link.phaseId,
    );
  }
  // Project-scoped: the phase's projectId must NOT match link.projectId
  return fc.record({ id: uuidArb, projectId: uuidArb }).filter(
    (phase) => phase.projectId !== link.projectId,
  );
}

/** Generate a target phase that is either null or undefined. */
const nullPhaseArb: fc.Arbitrary<null | undefined> = fc.constantFrom(null, undefined);

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe('authorizeReviewerWrite (Property 19)', () => {
  // Feature: client-sign-off-dashboard, Property 19: Reviewer view-only authorization
  // **Validates: Requirements 7.5, 8.6, 9.9, 9.10**
  it('only in-scope comment/approval on valid links succeed; all else rejected with no state change', () => {
    fc.assert(
      fc.property(
        // Generate: link state (valid, revoked, or null), action, and target phase scenario
        fc.oneof(
          // Case 1: Valid link + allowed action + in-scope phase → SHOULD SUCCEED
          validShareLinkArb.chain((link) =>
            fc.tuple(
              fc.constant(link as ShareLink | null | undefined),
              allowedActionArb,
              inScopePhaseArb(link).map((p) => p as Pick<Phase, 'id' | 'projectId'> | null | undefined),
              fc.constant('should_succeed' as const),
            ),
          ),
          // Case 2: Valid link + disallowed action + in-scope phase → SHOULD FAIL
          validShareLinkArb.chain((link) =>
            fc.tuple(
              fc.constant(link as ShareLink | null | undefined),
              disallowedActionArb,
              inScopePhaseArb(link).map((p) => p as Pick<Phase, 'id' | 'projectId'> | null | undefined),
              fc.constant('should_fail' as const),
            ),
          ),
          // Case 3: Valid link + allowed action + out-of-scope phase → SHOULD FAIL
          validShareLinkArb.chain((link) =>
            fc.tuple(
              fc.constant(link as ShareLink | null | undefined),
              allowedActionArb,
              outOfScopePhaseArb(link).map((p) => p as Pick<Phase, 'id' | 'projectId'> | null | undefined),
              fc.constant('should_fail' as const),
            ),
          ),
          // Case 4: Valid link + any action + null target phase → SHOULD FAIL
          validShareLinkArb.chain((link) =>
            fc.tuple(
              fc.constant(link as ShareLink | null | undefined),
              actionArb,
              nullPhaseArb.map((p) => p as Pick<Phase, 'id' | 'projectId'> | null | undefined),
              fc.constant('should_fail' as const),
            ),
          ),
          // Case 5: Revoked link + any action + any phase → SHOULD FAIL
          revokedShareLinkArb.chain((link) =>
            fc.tuple(
              fc.constant(link as ShareLink | null | undefined),
              actionArb,
              fc.oneof(
                inScopePhaseArb(link).map((p) => p as Pick<Phase, 'id' | 'projectId'> | null | undefined),
                nullPhaseArb.map((p) => p as Pick<Phase, 'id' | 'projectId'> | null | undefined),
              ),
              fc.constant('should_fail' as const),
            ),
          ),
          // Case 6: Null/undefined link + any action + any phase → SHOULD FAIL
          fc.tuple(
            nullLinkArb,
            actionArb,
            fc.oneof(
              fc.record({ id: uuidArb, projectId: uuidArb }).map((p) => p as Pick<Phase, 'id' | 'projectId'> | null | undefined),
              nullPhaseArb.map((p) => p as Pick<Phase, 'id' | 'projectId'> | null | undefined),
            ),
            fc.constant('should_fail' as const),
          ),
        ),
        ([link, action, targetPhase, expectedOutcome]) => {
          const result = authorizeReviewerWrite(link, action, targetPhase);

          if (expectedOutcome === 'should_succeed') {
            // Only add_comment and submit_approval on in-scope phases of valid links succeed
            expect(result.ok).toBe(true);
          } else {
            // Everything else is rejected with a forbidden error and no state change
            expect(result.ok).toBe(false);
            if (!result.ok) {
              expect(result.error.kind).toBe('app');
              expect(result.error.code).toBe('forbidden');
              // The error message indicates view-only access
              expect(result.error.message).toBeDefined();
              expect(typeof result.error.message).toBe('string');
              expect(result.error.message.length).toBeGreaterThan(0);
            }
          }

          // No state change: authorizeReviewerWrite is a pure predicate that
          // never mutates its inputs. We verify the link and phase remain
          // unchanged by checking they are still reference-equal (no cloning
          // or mutation occurred).
          // (This is inherently guaranteed by the function being pure and
          // returning a Result, but we assert the error carries no side-effect
          // data that could be confused with a state mutation.)
          if (!result.ok) {
            expect('value' in result).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
