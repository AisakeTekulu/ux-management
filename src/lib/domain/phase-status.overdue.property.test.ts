import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { isOverdue } from '@/lib/domain/phase-status';
import type { PhaseStatus } from '@/lib/domain/types';

/**
 * Property-based test for overdue computation (design Property 24).
 *
 * The `isOverdue` function is a pure derivation: it reads a due date, a stored
 * phase status, and the current instant, then returns a boolean. It never
 * mutates the status or any other state. The property exercises:
 *
 * - Null due dates (never overdue).
 * - Dates before, on, and after `now` (strictly past due date required).
 * - All six PhaseStatus values (Approved/Completed are never overdue).
 * - Near-boundary timestamps: same day, day before, day after.
 *
 * **Validates: Requirements 10.6, 10.7, 11.7**
 */

// All valid PhaseStatus values.
const ALL_STATUSES: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
];

// Statuses that are terminal — Approved/Completed are never overdue.
const TERMINAL_STATUSES: PhaseStatus[] = ['Approved', 'Completed'];

// Statuses that CAN be overdue when past due date.
const NON_TERMINAL_STATUSES: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
];

// Arbitrary for PhaseStatus.
const arbPhaseStatus: fc.Arbitrary<PhaseStatus> = fc.constantFrom(...ALL_STATUSES);

// Generate a Date within a reasonable range (2020–2030) to avoid edge cases
// with extreme dates while still covering a wide range.
const arbDate: fc.Arbitrary<Date> = fc
  .integer({
    min: new Date('2020-01-01T00:00:00Z').getTime(),
    max: new Date('2030-12-31T23:59:59Z').getTime(),
  })
  .map((ms) => new Date(ms));

// Generate a due date that is null or a valid Date.
const arbDueDate: fc.Arbitrary<Date | null> = fc.oneof(
  fc.constant(null),
  arbDate,
);

// Generate near-boundary scenarios: same day, day before, day after the due date.
// This creates a `now` relative to a given due date with controlled day offsets.
const arbDayOffset: fc.Arbitrary<number> = fc.constantFrom(-1, 0, 1);

// Generate a time-of-day offset in milliseconds (0 to just under 24h).
const arbTimeOfDay: fc.Arbitrary<number> = fc.integer({ min: 0, max: 86_399_999 });

describe('isOverdue (Property 24)', () => {
  // Feature: client-sign-off-dashboard, Property 24: Overdue computation
  // Validates: Requirements 10.6, 10.7, 11.7
  it('is true iff now strictly past due date and status not Approved/Completed; never mutates status; Approved/Completed never overdue', () => {
    fc.assert(
      fc.property(
        arbDueDate,
        arbPhaseStatus,
        arbDate,
        arbDayOffset,
        arbTimeOfDay,
        (dueDate, status, arbitraryNow, dayOffset, timeOfDay) => {
          // Determine `now`: if dueDate is non-null, also exercise near-boundary
          // by constructing a `now` that is exactly dayOffset days from dueDate
          // at a specific time of day. We test both the arbitrary `now` and the
          // boundary `now` to maximize coverage.
          const inputs: Array<{ dueDate: Date | null; status: PhaseStatus; now: Date }> = [
            { dueDate, status, now: arbitraryNow },
          ];

          if (dueDate !== null) {
            // Construct a boundary `now` relative to the due date.
            const dueDayStart = Date.UTC(
              dueDate.getUTCFullYear(),
              dueDate.getUTCMonth(),
              dueDate.getUTCDate(),
            );
            const boundaryNow = new Date(dueDayStart + dayOffset * 86_400_000 + timeOfDay);
            inputs.push({ dueDate, status, now: boundaryNow });
          }

          for (const { dueDate: dd, status: st, now } of inputs) {
            // Capture status before call to verify no mutation.
            const statusBefore = st;

            const result = isOverdue(dd, st, now);

            // Status is never mutated (it's a string value, but verify the
            // function doesn't somehow return a different concept).
            expect(st).toBe(statusBefore);

            // Compute the expected result independently (oracle).
            let expected: boolean;

            if (dd === null) {
              // No due date → never overdue.
              expected = false;
            } else if (TERMINAL_STATUSES.includes(st)) {
              // Approved/Completed → never overdue regardless of date.
              expected = false;
            } else {
              // Overdue iff the UTC calendar day of `now` is strictly after
              // the UTC calendar day of the due date.
              const nowDayIndex = Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
              );
              const dueDayIndex = Date.UTC(
                dd.getUTCFullYear(),
                dd.getUTCMonth(),
                dd.getUTCDate(),
              );
              expected = nowDayIndex > dueDayIndex;
            }

            expect(result).toBe(expected);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
