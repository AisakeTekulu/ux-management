import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_ACTIVITY_LIMIT,
  PROJECT_ACTIVITY_LIMIT,
  dashboardActivityTimeline,
  orderActivityTimeline,
  projectActivityTimeline,
} from '@/lib/domain/ordering';
import type { ActivityLog, ActivityType } from '@/lib/domain/types';

/**
 * Property-based test for activity timeline ordering and limit (design Property 30).
 *
 * The activity timeline functions return the N most recent entries in reverse
 * chronological order (non-increasing by createdAt). For the dashboard N=20,
 * for per-project N=50. The output must be:
 *   1. At most N entries long
 *   2. Ordered non-increasing by createdAt (reverse chronological)
 *   3. A subset of the input (every output entry exists in the input)
 *
 * This test generates arrays of ActivityLog entries with varying timestamps and
 * verifies these properties hold for both limit values.
 */

// Feature: client-sign-off-dashboard, Property 30: Activity timeline ordering and limit

const ACTIVITY_TYPES: ActivityType[] = [
  'comment_created',
  'approval_created',
  'phase_status_changed',
];

/**
 * Arbitrary that generates a valid ISO timestamp string within a reasonable
 * range. Uses integer milliseconds to ensure lexicographic ordering matches
 * chronological ordering (ISO-8601 UTC strings are monotonic).
 */
const isoTimestampArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 2_000_000_000_000 }) // ~2033
  .map((ms) => new Date(ms).toISOString());

/**
 * Arbitrary that generates a single ActivityLog entry with a random timestamp,
 * type, and unique id.
 */
const activityLogArb: fc.Arbitrary<ActivityLog> = fc.record({
  id: fc.uuid(),
  projectId: fc.uuid(),
  type: fc.constantFrom(...ACTIVITY_TYPES),
  actor: fc.string({ minLength: 1, maxLength: 50 }),
  detail: fc.constant({}),
  createdAt: isoTimestampArb,
});

/**
 * Arbitrary that generates an array of ActivityLog entries of varying length
 * (0 to 80 entries, covering cases below and above both limits).
 */
const activityLogArrayArb: fc.Arbitrary<ActivityLog[]> = fc.array(activityLogArb, {
  minLength: 0,
  maxLength: 80,
});

describe('Activity timeline ordering and limit (Property 30)', () => {
  // Feature: client-sign-off-dashboard, Property 30: Activity timeline ordering and limit
  // **Validates: Requirements 11.6, 13.4**
  it('N most recent reverse-chronological; N=20 dashboard, N=50 per-project', () => {
    fc.assert(
      fc.property(activityLogArrayArb, (entries) => {
        // Test both limit values
        const limits = [
          { limit: DASHBOARD_ACTIVITY_LIMIT, fn: dashboardActivityTimeline },
          { limit: PROJECT_ACTIVITY_LIMIT, fn: projectActivityTimeline },
        ] as const;

        for (const { limit, fn } of limits) {
          const result = fn(entries);

          // 1. Output length is at most N
          expect(result.length).toBeLessThanOrEqual(limit);

          // 2. Output is non-increasing by createdAt (reverse chronological)
          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].createdAt >= result[i].createdAt).toBe(true);
          }

          // 3. Output is a subset of the input (every output entry exists in input)
          const inputIds = new Set(entries.map((e) => e.id));
          for (const entry of result) {
            expect(inputIds.has(entry.id)).toBe(true);
          }

          // 4. If input has more than N entries, output is exactly N
          if (entries.length >= limit) {
            expect(result.length).toBe(limit);
          } else {
            // If input has fewer than N entries, output contains all of them
            expect(result.length).toBe(entries.length);
          }

          // 5. Verify the result matches orderActivityTimeline with the same limit
          const directResult = orderActivityTimeline(entries, limit);
          expect(result).toEqual(directResult);
        }
      }),
      { numRuns: 100 },
    );
  });
});
