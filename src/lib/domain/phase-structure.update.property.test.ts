import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { updatePhaseFields } from '@/lib/domain/phase-structure';
import type { Phase, PhaseStatus, ISODate } from '@/lib/domain/types';

/**
 * Property-based test for phase partial-update invariant (design Property 7).
 *
 * The `updatePhaseFields` function applies a partial patch to a phase's
 * editable fields (description, internalNotes, dueDate). The invariant under
 * test: patching changes exactly the patched fields and leaves all other
 * fields identical to the original phase.
 *
 * Lives in a dedicated file as specified by the task.
 */

// Feature: client-sign-off-dashboard, Property 7: Phase partial-update invariant

/* ---------- Generators ---------- */

const phaseStatuses: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
];

/** Generate a valid YYYY-MM-DD date string. */
const validDate: fc.Arbitrary<ISODate> = fc
  .record({
    year: fc.integer({ min: 2000, max: 2099 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // 28 avoids invalid day-of-month
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );

/** Generate a valid due date field value (valid date or null). */
const validDueDate: fc.Arbitrary<ISODate | null> = fc.oneof(
  validDate,
  fc.constant(null),
);

/** Generate a valid description or internalNotes value (≤5000 chars). */
const validTextField: fc.Arbitrary<string> = fc.string({
  minLength: 0,
  maxLength: 5000,
});

/** Generate a Phase object with arbitrary but structurally valid data. */
const phaseArb: fc.Arbitrary<Phase> = fc
  .record({
    id: fc.uuid(),
    projectId: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    ordinal: fc.integer({ min: 1, max: 100 }),
    description: fc.string({ minLength: 0, maxLength: 5000 }),
    internalNotes: fc.string({ minLength: 0, maxLength: 5000 }),
    status: fc.constantFrom(...phaseStatuses),
    dueDate: validDueDate,
    approvedByName: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 100 })),
    approvedInitials: fc.oneof(fc.constant(null), fc.string({ minLength: 1, maxLength: 10 })),
    approvedAt: fc.oneof(fc.constant(null), fc.constant('2024-06-15T10:00:00.000Z')),
    createdAt: fc.constant('2024-01-01T00:00:00.000Z'),
  })
  .map((r) => r as Phase);

/**
 * Generate a valid PhaseFieldPatch where each field is independently present
 * or absent, and when present, holds a valid value.
 *
 * At least one field is always present so the patch is non-trivial.
 */
const validPatchArb = fc
  .record({
    description: fc.option(validTextField, { nil: undefined }),
    internalNotes: fc.option(validTextField, { nil: undefined }),
    dueDate: fc.option(validDueDate, { nil: undefined }),
  })
  .filter(
    (patch) =>
      patch.description !== undefined ||
      patch.internalNotes !== undefined ||
      patch.dueDate !== undefined,
  );

/* ---------- Property Test ---------- */

describe('updatePhaseFields (Property 7: Phase partial-update invariant)', () => {
  // Feature: client-sign-off-dashboard, Property 7: Phase partial-update invariant
  it('patch changes exactly the patched fields, leaves others unchanged', () => {
    fc.assert(
      fc.property(phaseArb, validPatchArb, (phase, patch) => {
        const result = updatePhaseFields(phase, patch);

        // With valid patches, the result must always succeed
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const updated = result.value;

        // --- Patched fields should reflect the patch values ---
        if (patch.description !== undefined) {
          expect(updated.description).toBe(patch.description);
        }
        if (patch.internalNotes !== undefined) {
          expect(updated.internalNotes).toBe(patch.internalNotes);
        }
        if (patch.dueDate !== undefined) {
          expect(updated.dueDate).toBe(patch.dueDate);
        }

        // --- Unpatched editable fields should remain identical ---
        if (patch.description === undefined) {
          expect(updated.description).toBe(phase.description);
        }
        if (patch.internalNotes === undefined) {
          expect(updated.internalNotes).toBe(phase.internalNotes);
        }
        if (patch.dueDate === undefined) {
          expect(updated.dueDate).toBe(phase.dueDate);
        }

        // --- All non-editable fields must always remain unchanged ---
        expect(updated.id).toBe(phase.id);
        expect(updated.projectId).toBe(phase.projectId);
        expect(updated.title).toBe(phase.title);
        expect(updated.ordinal).toBe(phase.ordinal);
        expect(updated.status).toBe(phase.status);
        expect(updated.approvedByName).toBe(phase.approvedByName);
        expect(updated.approvedInitials).toBe(phase.approvedInitials);
        expect(updated.approvedAt).toBe(phase.approvedAt);
        expect(updated.createdAt).toBe(phase.createdAt);
      }),
      { numRuns: 200 },
    );
  });
});
