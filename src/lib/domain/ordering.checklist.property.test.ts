import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { orderChecklistItems } from '@/lib/domain/ordering';
import type { ChecklistItem } from '@/lib/domain/types';

/**
 * Property-based test for checklist display ordering (design Property 10).
 *
 * The `orderChecklistItems` function returns a new array of ChecklistItems
 * sorted in non-decreasing order by their `createdAt` timestamp. It never
 * mutates the input array. The output must be a permutation of the input
 * (same elements, same count) and must satisfy the non-decreasing ordering
 * invariant on `createdAt`.
 */

// Feature: client-sign-off-dashboard, Property 10: Checklist display ordering

/**
 * Generator for a valid ISO timestamp string. Produces timestamps in the range
 * 2020-01-01 to 2030-12-31 with varying time components, ensuring
 * lexicographic ordering matches chronological ordering (UTC ISO-8601).
 */
const isoTimestampArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }), // year
    fc.integer({ min: 1, max: 12 }),       // month
    fc.integer({ min: 1, max: 28 }),       // day (28 to avoid invalid dates)
    fc.integer({ min: 0, max: 23 }),       // hour
    fc.integer({ min: 0, max: 59 }),       // minute
    fc.integer({ min: 0, max: 59 }),       // second
  )
  .map(([year, month, day, hour, minute, second]) => {
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}.000Z`;
  });

/**
 * Generator for a ChecklistItem with a random id, phaseId, text, completion
 * state, and a generated createdAt timestamp.
 */
const checklistItemArb: fc.Arbitrary<ChecklistItem> = fc
  .tuple(fc.uuid(), fc.uuid(), fc.string({ minLength: 1, maxLength: 50 }), fc.boolean(), isoTimestampArb)
  .map(([id, phaseId, text, complete, createdAt]) => ({
    id,
    phaseId,
    text,
    complete,
    createdAt,
  }));

/**
 * Generator for an array of ChecklistItems with varying lengths (including
 * empty arrays and arrays with items sharing the same timestamp).
 */
const checklistItemsArb: fc.Arbitrary<ChecklistItem[]> = fc.array(checklistItemArb, {
  minLength: 0,
  maxLength: 30,
});

describe('orderChecklistItems (Property 10)', () => {
  // Feature: client-sign-off-dashboard, Property 10: Checklist display ordering
  // **Validates: Requirements 5.5**
  it('orders checklist items non-decreasing by createdAt and output is a permutation of input', () => {
    fc.assert(
      fc.property(checklistItemsArb, (items) => {
        // Capture original array to verify no mutation
        const originalItems = items.map((item) => ({ ...item }));
        const originalLength = items.length;

        const result = orderChecklistItems(items);

        // 1. Output is non-decreasing by createdAt
        for (let i = 1; i < result.length; i++) {
          expect(result[i].createdAt >= result[i - 1].createdAt).toBe(true);
        }

        // 2. Output is a permutation of the input (same length, same elements)
        expect(result.length).toBe(originalLength);

        // Sort both by id to compare as sets (ids are unique UUIDs)
        const sortById = (arr: ChecklistItem[]) =>
          [...arr].sort((a, b) => a.id.localeCompare(b.id));

        const sortedResult = sortById(result);
        const sortedOriginal = sortById(originalItems);

        for (let i = 0; i < sortedResult.length; i++) {
          expect(sortedResult[i].id).toBe(sortedOriginal[i].id);
          expect(sortedResult[i].phaseId).toBe(sortedOriginal[i].phaseId);
          expect(sortedResult[i].text).toBe(sortedOriginal[i].text);
          expect(sortedResult[i].complete).toBe(sortedOriginal[i].complete);
          expect(sortedResult[i].createdAt).toBe(sortedOriginal[i].createdAt);
        }

        // 3. Input array is not mutated
        expect(items.length).toBe(originalLength);
        for (let i = 0; i < items.length; i++) {
          expect(items[i].id).toBe(originalItems[i].id);
          expect(items[i].createdAt).toBe(originalItems[i].createdAt);
        }
      }),
      { numRuns: 100 },
    );
  });
});
