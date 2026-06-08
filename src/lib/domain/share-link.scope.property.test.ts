import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { ShareLink, UUID } from '@/lib/domain/types';
import {
  isPhaseAccessibleThroughLink,
  isProjectAccessibleThroughLink,
  scopedPhaseIds,
} from '@/lib/domain/share-link';

/**
 * Property-based test for phase-scoped link isolation (design Property 17).
 *
 * Exercises the three scope-enforcement functions across generated phase-scoped
 * and project-scoped ShareLinks with various phase/project ids. The property
 * verifies:
 *
 * - A phase-scoped link exposes exactly its one in-scope phase (R8.3).
 * - A phase-scoped link denies access to all other phases (R8.3).
 * - A phase-scoped link denies all project-level access (R8.3).
 * - scopedPhaseIds for a phase-scoped link returns exactly one id (R8.3).
 *
 * **Validates: Requirements 8.3**
 */

// Feature: client-sign-off-dashboard, Property 17: Phase-scoped link isolation

/** Arbitrary UUID generator. */
const uuidArb = fc.uuid();

/** Arbitrary ISO timestamp. */
const isoTimestampArb = fc.date().map((d) => d.toISOString());

/** Arbitrary URL-safe token (>= 32 chars). */
const tokenArb = fc.string({ minLength: 32, maxLength: 64 }).map((s) =>
  s.replace(/[^A-Za-z0-9\-_]/g, 'x'),
);

/** Generate a phase-scoped ShareLink with a specific phaseId and projectId. */
function phaseScopedLinkArb(phaseId: fc.Arbitrary<UUID>, projectId?: fc.Arbitrary<UUID>) {
  return fc.record({
    id: uuidArb,
    ownerId: uuidArb,
    token: tokenArb,
    scopeType: fc.constant('phase' as const),
    projectId: projectId ?? fc.constant(null),
    phaseId: phaseId.map((id) => id as string | null),
    revokedAt: fc.constant(null),
    firstAccessedAt: fc.constant(null),
    createdAt: isoTimestampArb,
  }) as fc.Arbitrary<ShareLink>;
}

describe('Phase-scoped link isolation (Property 17)', () => {
  // Feature: client-sign-off-dashboard, Property 17: Phase-scoped link isolation
  // Validates: Requirements 8.3
  it('a phase-scoped link exposes exactly its one in-scope phase and denies all other phase/project requests', () => {
    fc.assert(
      fc.property(
        // The in-scope phase id
        uuidArb,
        // A different phase id (guaranteed distinct by filtering)
        uuidArb,
        // A project id for the in-scope phase
        uuidArb,
        // Another project id
        uuidArb,
        // Additional phase ids that belong to the same project (for scopedPhaseIds)
        fc.array(uuidArb, { minLength: 0, maxLength: 5 }),
        (inScopePhaseId, otherPhaseId, projectId, otherProjectId, extraPhaseIds) => {
          // Ensure distinct ids for meaningful assertions
          fc.pre(inScopePhaseId !== otherPhaseId);
          fc.pre(projectId !== otherProjectId);

          // Build a phase-scoped link targeting inScopePhaseId
          const link: ShareLink = {
            id: 'link-id',
            ownerId: 'owner-id',
            token: 'a'.repeat(32),
            scopeType: 'phase',
            projectId: null,
            phaseId: inScopePhaseId,
            revokedAt: null,
            firstAccessedAt: null,
            createdAt: new Date().toISOString(),
          };

          // --- isPhaseAccessibleThroughLink ---

          // The in-scope phase is accessible
          const inScopePhase = { id: inScopePhaseId, projectId };
          expect(isPhaseAccessibleThroughLink(link, inScopePhase)).toBe(true);

          // A different phase (even in the same project) is NOT accessible
          const otherPhase = { id: otherPhaseId, projectId };
          expect(isPhaseAccessibleThroughLink(link, otherPhase)).toBe(false);

          // A phase in a different project is NOT accessible
          const otherProjectPhase = { id: otherPhaseId, projectId: otherProjectId };
          expect(isPhaseAccessibleThroughLink(link, otherProjectPhase)).toBe(false);

          // --- isProjectAccessibleThroughLink ---

          // A phase-scoped link denies ALL project-level access
          expect(isProjectAccessibleThroughLink(link, projectId)).toBe(false);
          expect(isProjectAccessibleThroughLink(link, otherProjectId)).toBe(false);

          // --- scopedPhaseIds ---

          // For a phase-scoped link, scopedPhaseIds returns exactly the one in-scope phase
          const allProjectPhaseIds = [inScopePhaseId, ...extraPhaseIds];
          const scoped = scopedPhaseIds(link, allProjectPhaseIds);
          expect(scoped).toEqual([inScopePhaseId]);
          expect(scoped).toHaveLength(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});
