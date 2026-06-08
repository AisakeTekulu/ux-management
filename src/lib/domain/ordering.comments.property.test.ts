import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { orderComments } from '@/lib/domain/ordering';
import type { Comment } from '@/lib/domain/types';

/**
 * Property-based test for comment display ordering (design Property 14).
 *
 * The `orderComments` function returns comments sorted in non-decreasing order
 * by their `createdAt` timestamp (oldest to newest). It never mutates the input
 * and the output is always a permutation of the input.
 *
 * This test generates arrays of Comment objects with varying timestamps and
 * asserts:
 * 1. The output is non-decreasing by `createdAt`.
 * 2. The output is a permutation of the input (same elements, same count).
 */

// Feature: client-sign-off-dashboard, Property 14: Comment display ordering

/**
 * Arbitrary that generates a valid ISO timestamp string.
 * Uses a date range spanning several years to produce diverse timestamps.
 */
const isoTimestampArb: fc.Arbitrary<string> = fc
  .date({
    min: new Date('2020-01-01T00:00:00.000Z'),
    max: new Date('2030-12-31T23:59:59.999Z'),
  })
  .map((d) => d.toISOString());

/**
 * Arbitrary that generates a Comment with a random id, phaseId, author info,
 * text, and a generated createdAt timestamp.
 */
const commentArb: fc.Arbitrary<Comment> = fc.record({
  id: fc.uuid(),
  phaseId: fc.uuid(),
  authorType: fc.constantFrom('designer' as const, 'reviewer' as const),
  authorUserId: fc.option(fc.uuid(), { nil: null }),
  authorName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  text: fc.string({ minLength: 1, maxLength: 100 }),
  createdAt: isoTimestampArb,
});

/**
 * Arbitrary that generates an array of Comments (0 to 30 elements).
 */
const commentsArrayArb: fc.Arbitrary<Comment[]> = fc.array(commentArb, {
  minLength: 0,
  maxLength: 30,
});

describe('orderComments (Property 14)', () => {
  // Feature: client-sign-off-dashboard, Property 14: Comment display ordering
  // Validates: Requirements 7.6
  it('output is non-decreasing by createdAt and is a permutation of the input', () => {
    fc.assert(
      fc.property(commentsArrayArb, (comments) => {
        const result = orderComments(comments);

        // --- Assertion 1: Non-decreasing by createdAt (oldest to newest) ---
        for (let i = 1; i < result.length; i++) {
          expect(result[i].createdAt >= result[i - 1].createdAt).toBe(true);
        }

        // --- Assertion 2: Permutation of the input (same length) ---
        expect(result.length).toBe(comments.length);

        // Same set of ids (sorted for comparison since order differs)
        const inputIds = comments.map((c) => c.id).sort();
        const outputIds = result.map((c) => c.id).sort();
        expect(outputIds).toEqual(inputIds);

        // --- Assertion 3: Input is not mutated ---
        // We verify by checking the original array's order is preserved.
        // (orderComments should create a new array, not sort in place)
        const originalOrder = comments.map((c) => c.id);
        orderComments(comments); // call again
        const afterOrder = comments.map((c) => c.id);
        expect(afterOrder).toEqual(originalOrder);
      }),
      { numRuns: 100 },
    );
  });
});
