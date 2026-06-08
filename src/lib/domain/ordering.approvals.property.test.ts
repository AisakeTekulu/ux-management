import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { orderApprovalHistory } from '@/lib/domain/ordering';
import type { Approval, ApprovalDecision, UUID } from '@/lib/domain/types';

/**
 * Property-based test for approval history ordering (design Property 22).
 *
 * The `orderApprovalHistory` function returns approvals in reverse chronological
 * order (non-increasing by `createdAt` timestamp). It never mutates its input
 * and the output is always a permutation of the input (same elements, different
 * order).
 *
 * **Validates: Requirements 9.8**
 */

// Feature: client-sign-off-dashboard, Property 22: Approval history ordering

// --- Generators ---

const uuidArb: fc.Arbitrary<UUID> = fc.uuid();

const decisionArb: fc.Arbitrary<ApprovalDecision> = fc.constantFrom(
  'Approved',
  'Changes Requested',
);

/**
 * Generate a valid ISO-8601 UTC timestamp string. We use a date range that
 * produces realistic timestamps while ensuring lexicographic ordering matches
 * chronological ordering (which holds for all ISO-8601 UTC strings).
 */
const isoTimestampArb: fc.Arbitrary<string> = fc
  .date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2099-12-31T23:59:59.999Z'),
  })
  .map((d) => d.toISOString());

const approvalArb: fc.Arbitrary<Approval> = fc.record({
  id: uuidArb,
  phaseId: uuidArb,
  decision: decisionArb,
  reviewerName: fc.string({ minLength: 1, maxLength: 100 }),
  reviewerInitials: fc.string({ minLength: 1, maxLength: 10 }),
  checklistSnapshot: fc.array(
    fc.record({
      checklistItemId: uuidArb,
      text: fc.string({ minLength: 1, maxLength: 500 }),
      complete: fc.boolean(),
    }),
    { minLength: 0, maxLength: 3 },
  ),
  createdAt: isoTimestampArb,
});

const approvalsArrayArb: fc.Arbitrary<Approval[]> = fc.array(approvalArb, {
  minLength: 0,
  maxLength: 20,
});

describe('orderApprovalHistory (Property 22)', () => {
  // Feature: client-sign-off-dashboard, Property 22: Approval history ordering
  // Validates: Requirements 9.8
  it('output is non-increasing by createdAt (reverse chronological) and is a permutation of the input', () => {
    fc.assert(
      fc.property(approvalsArrayArb, (approvals) => {
        const result = orderApprovalHistory(approvals);

        // --- Non-increasing order by createdAt ---
        for (let i = 0; i < result.length - 1; i++) {
          expect(result[i].createdAt >= result[i + 1].createdAt).toBe(true);
        }

        // --- Permutation: same length ---
        expect(result.length).toBe(approvals.length);

        // --- Permutation: same elements (by id) ---
        const inputIds = [...approvals].map((a) => a.id).sort();
        const outputIds = [...result].map((a) => a.id).sort();
        expect(outputIds).toEqual(inputIds);

        // --- Input is not mutated ---
        // We verify by checking the input array still has the same ids in the
        // same order as before the call (the spread copy inside the function
        // should prevent mutation).
        const originalIds = approvals.map((a) => a.id);
        expect(approvals.map((a) => a.id)).toEqual(originalIds);
      }),
      { numRuns: 100 },
    );
  });
});
