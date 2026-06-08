import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { appendPhase, INITIAL_PHASE_STATUS } from '@/lib/domain/phase-structure';
import type { Phase, PhaseStatus, UUID } from '@/lib/domain/types';

/**
 * Property-based test for appended phase ordinal and status (design Property 6).
 *
 * The `appendPhase` function is pure: given an existing set of phases (any
 * order, any ordinals, including empty), it produces a new phase whose ordinal
 * strictly exceeds every existing ordinal and whose status is Draft (R10.1).
 * The function never mutates the input array.
 */

// --- Generators ---

const phaseStatus: fc.Arbitrary<PhaseStatus> = fc.constantFrom(
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
);

const uuid: fc.Arbitrary<UUID> = fc.uuid();

const isoTimestamp = fc
  .integer({ min: 1577836800000, max: 1924991999000 }) // 2020-01-01 to 2030-12-31
  .map((ms) => new Date(ms).toISOString());

/**
 * Generate a single Phase with a given ordinal. Other fields are arbitrary but
 * valid, since the function under test only inspects ordinals.
 */
const phaseWithOrdinal = (ordinal: number): fc.Arbitrary<Phase> =>
  fc.record({
    id: uuid,
    projectId: uuid,
    title: fc.string({ minLength: 1, maxLength: 50 }),
    ordinal: fc.constant(ordinal),
    description: fc.string({ maxLength: 100 }),
    internalNotes: fc.string({ maxLength: 100 }),
    status: phaseStatus,
    dueDate: fc.option(fc.constant('2025-06-15'), { nil: null }),
    approvedByName: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    approvedInitials: fc.option(fc.string({ minLength: 1, maxLength: 5 }), { nil: null }),
    approvedAt: fc.option(isoTimestamp, { nil: null }),
    createdAt: isoTimestamp,
  });

/**
 * Generate a list of phases with varying ordinals. Ordinals can be any positive
 * integers (not necessarily contiguous or starting at 1), which exercises the
 * "max ordinal" logic robustly.
 */
const existingPhases: fc.Arbitrary<Phase[]> = fc
  .array(fc.integer({ min: 1, max: 10_000 }), { minLength: 0, maxLength: 20 })
  .chain((ordinals) => {
    if (ordinals.length === 0) return fc.constant([] as Phase[]);
    return fc.tuple(...ordinals.map((ord) => phaseWithOrdinal(ord))).map((phases) => phases);
  });

// --- Property Test ---

// Feature: client-sign-off-dashboard, Property 6: Appended phase ordinal and status
describe('appendPhase (Property 6)', () => {
  it('new phase ordinal exceeds all existing ordinals and status is Draft', () => {
    fc.assert(
      fc.property(
        existingPhases,
        uuid, // projectId
        fc.string({ minLength: 1, maxLength: 60 }), // title
        uuid, // newId result
        isoTimestamp, // now
        (phases, projectId, title, newId, now) => {
          const result = appendPhase(phases, projectId, title, () => newId, now);

          // The new phase's ordinal must strictly exceed every existing ordinal.
          const maxExisting = phases.reduce(
            (max, p) => (p.ordinal > max ? p.ordinal : max),
            0,
          );
          expect(result.ordinal).toBeGreaterThan(maxExisting);

          // For an empty set, ordinal should be 1 (0 + 1).
          if (phases.length === 0) {
            expect(result.ordinal).toBe(1);
          }

          // The new phase's status must be Draft (R10.1).
          expect(result.status).toBe(INITIAL_PHASE_STATUS);
          expect(result.status).toBe('Draft');
        },
      ),
      { numRuns: 100 },
    );
  });
});
