import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  tasksForApproval,
  type ApprovalTaskContext,
  type IdSource,
} from '@/lib/domain/approval';
import type { Approval, ApprovalDecision, UUID } from '@/lib/domain/types';

/**
 * Property-based test for change-request task creation (design Property 32).
 *
 * The `tasksForApproval` function returns exactly one open task referencing the
 * phase when the approval decision is `Changes Requested`, and returns an empty
 * array when the decision is `Approved`.
 *
 * **Validates: Requirements 12.5**
 */

// Feature: client-sign-off-dashboard, Property 32: Change-request creates a task

// --- Generators ---

const uuidArb: fc.Arbitrary<UUID> = fc.uuid();

const decisionArb: fc.Arbitrary<ApprovalDecision> = fc.constantFrom(
  'Approved',
  'Changes Requested',
);

const isoTimestampArb: fc.Arbitrary<string> = fc
  .date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2099-12-31T23:59:59.999Z'),
  })
  .map((d) => d.toISOString());

/** Generate a valid reviewer name (trimmed 1..100). */
const validNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length >= 1 && s.trim().length <= 100);

/** Generate valid initials (trimmed 1..10). */
const validInitialsArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 10 })
  .filter((s) => s.trim().length >= 1 && s.trim().length <= 10);

/** Generate a checklist snapshot entry. */
const snapshotEntryArb = fc.record({
  checklistItemId: uuidArb,
  text: fc.string({ minLength: 1, maxLength: 500 }),
  complete: fc.boolean(),
});

/** Generate a complete Approval object with a given decision. */
function approvalArb(decision: ApprovalDecision): fc.Arbitrary<Approval> {
  return fc.record({
    id: uuidArb,
    phaseId: uuidArb,
    decision: fc.constant(decision),
    reviewerName: validNameArb.map((s) => s.trim()),
    reviewerInitials: validInitialsArb.map((s) => s.trim()),
    checklistSnapshot: fc.array(snapshotEntryArb, { minLength: 0, maxLength: 10 }),
    createdAt: isoTimestampArb,
  });
}

/** Generate an Approval with either decision. */
const anyApprovalArb: fc.Arbitrary<Approval> = decisionArb.chain((d) =>
  approvalArb(d),
);

/** Generate an ApprovalTaskContext. */
const contextArb: fc.Arbitrary<ApprovalTaskContext> = fc.record({
  ownerId: uuidArb,
  projectId: fc.option(uuidArb, { nil: null }),
  phaseTitle: fc.option(fc.string({ minLength: 1, maxLength: 100 }), {
    nil: undefined,
  }),
});

const dateArb: fc.Arbitrary<Date> = fc.date({
  min: new Date('2000-01-01T00:00:00.000Z'),
  max: new Date('2099-12-31T23:59:59.999Z'),
});

/** A deterministic id source that returns sequential UUIDs for testing. */
function makeIdSource(): IdSource {
  let counter = 0;
  return () => `00000000-0000-4000-a000-${String(counter++).padStart(12, '0')}`;
}

describe('tasksForApproval (Property 32)', () => {
  // Feature: client-sign-off-dashboard, Property 32: Change-request creates a task
  // Validates: Requirements 12.5

  it('Changes Requested yields exactly one open task referencing the phase; Approved yields none', () => {
    fc.assert(
      fc.property(anyApprovalArb, contextArb, dateArb, (approval, context, now) => {
        const idSource = makeIdSource();
        const tasks = tasksForApproval(approval, context, idSource, now);

        if (approval.decision === 'Changes Requested') {
          // --- Exactly one task ---
          expect(tasks).toHaveLength(1);

          const task = tasks[0];

          // --- Task is open ---
          expect(task.state).toBe('open');

          // --- Task references the phase ---
          expect(task.phaseId).toBe(approval.phaseId);

          // --- Task is owned by the context owner ---
          expect(task.ownerId).toBe(context.ownerId);

          // --- Task has a valid id ---
          expect(task.id).toBeDefined();
          expect(task.id.length).toBeGreaterThan(0);

          // --- Task has a title ---
          expect(task.title.length).toBeGreaterThan(0);
          expect(task.title.length).toBeLessThanOrEqual(200);

          // --- Task has a creation timestamp ---
          expect(task.createdAt).toBe(now.toISOString());
        } else {
          // Approved decision yields no tasks
          expect(tasks).toHaveLength(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});
