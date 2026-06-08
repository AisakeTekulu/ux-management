import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { completePhase } from '@/lib/domain/phase-status';
import type { PhaseStatus } from '@/lib/domain/types';

/**
 * Property-based test for phase completion guard (design Property 25).
 *
 * The `completePhase` function is a pure guard that succeeds with 'Completed'
 * if and only if the current phase status is 'Approved'. For all other statuses
 * the operation is rejected with an AppError and the original status is retained
 * (the function never mutates its input and returns no new status on failure).
 *
 * This test exercises all 6 PhaseStatus values to confirm the guard holds
 * universally.
 */

// Feature: client-sign-off-dashboard, Property 25: Phase completion guard

const ALL_PHASE_STATUSES: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
];

// Generator that produces any of the 6 valid PhaseStatus values uniformly.
const phaseStatusArb: fc.Arbitrary<PhaseStatus> = fc.constantFrom(...ALL_PHASE_STATUSES);

describe('completePhase (Property 25)', () => {
  // Feature: client-sign-off-dashboard, Property 25: Phase completion guard
  // Validates: Requirements 10.8, 10.9
  it('yields Completed iff current status is Approved; otherwise rejected and status retained', () => {
    fc.assert(
      fc.property(phaseStatusArb, (status) => {
        const result = completePhase(status);

        if (status === 'Approved') {
          // R10.8: Approved phases can be completed -> yields 'Completed'
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.value).toBe('Completed');
          }
        } else {
          // R10.9: Non-Approved phases are rejected, status retained
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.kind).toBe('app');
            expect(result.error.code).toBe('invalid_state');
            // The error detail carries the rejected status for display
            expect(result.error.detail).toBeDefined();
            expect(result.error.detail?.currentStatus).toBe(status);
          }
        }

        // The input is never mutated (status is a string primitive, but we
        // verify the function does not return a new status on failure).
        // On rejection, no 'value' field exists — the caller retains the
        // original status.
        if (!result.ok) {
          expect('value' in result).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
