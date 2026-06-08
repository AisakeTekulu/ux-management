import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  buildApproval,
  snapshotChecklist,
  type IdSource,
  type SignoffInput,
} from '@/lib/domain/approval';
import type { ApprovalDecision, ChecklistItem, UUID } from '@/lib/domain/types';

/**
 * Property-based test for approval construction and snapshot (design Property 21).
 *
 * The `buildApproval` function stores decision/name/initials/phase id/UTC
 * timestamp and a snapshot equal to checklist completion at sign-off. No
 * approval is produced if a required field is missing.
 *
 * **Validates: Requirements 9.4, 9.5, 17.6**
 */

// Feature: client-sign-off-dashboard, Property 21: Approval construction and snapshot

// --- Generators ---

const uuidArb: fc.Arbitrary<UUID> = fc.uuid();

const decisionArb: fc.Arbitrary<ApprovalDecision> = fc.constantFrom(
  'Approved',
  'Changes Requested',
);

/** Generate a valid name: trimmed length 1..100 */
const validNameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length >= 1 && s.trim().length <= 100);

/** Generate a valid initials: trimmed length 1..10 */
const validInitialsArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 10 })
  .filter((s) => s.trim().length >= 1 && s.trim().length <= 10);

/** Generate an invalid name: empty after trim or over 100 chars */
const invalidNameArb: fc.Arbitrary<string> = fc.oneof(
  // Empty or whitespace-only
  fc.constantFrom('', '   ', '\t', '\n'),
  // Over 100 characters after trim
  fc.string({ minLength: 101, maxLength: 150 }).map((s) => s.padEnd(101, 'x')),
);

/** Generate invalid initials: empty after trim or over 10 chars */
const invalidInitialsArb: fc.Arbitrary<string> = fc.oneof(
  // Empty or whitespace-only
  fc.constantFrom('', '   ', '\t', '\n'),
  // Over 10 characters after trim
  fc.string({ minLength: 11, maxLength: 30 }).map((s) => s.padEnd(11, 'x')),
);

/** Generate an invalid decision string */
const invalidDecisionArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s !== 'Approved' && s !== 'Changes Requested');

const isoTimestampArb: fc.Arbitrary<string> = fc
  .date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2099-12-31T23:59:59.999Z'),
  })
  .map((d) => d.toISOString());

const checklistItemArb: fc.Arbitrary<ChecklistItem> = fc.record({
  id: uuidArb,
  phaseId: uuidArb,
  text: fc.string({ minLength: 1, maxLength: 500 }),
  complete: fc.boolean(),
  createdAt: isoTimestampArb,
});

const checklistArb: fc.Arbitrary<ChecklistItem[]> = fc.array(checklistItemArb, {
  minLength: 0,
  maxLength: 10,
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

/** Generate a valid SignoffInput */
const validInputArb: fc.Arbitrary<SignoffInput> = fc.record({
  phaseId: uuidArb.filter((id) => id.trim().length > 0),
  decision: decisionArb,
  name: validNameArb,
  initials: validInitialsArb,
});

describe('buildApproval (Property 21)', () => {
  // Feature: client-sign-off-dashboard, Property 21: Approval construction and snapshot
  // Validates: Requirements 9.4, 9.5, 17.6
  it('valid inputs produce an approval with correct fields and a snapshot matching the checklist state', () => {
    fc.assert(
      fc.property(
        validInputArb,
        checklistArb,
        dateArb,
        (input, checklist, now) => {
          const idSource = makeIdSource();
          const result = buildApproval(input, checklist, idSource, now);

          // --- Must succeed ---
          expect(result.ok).toBe(true);
          if (!result.ok) return;

          const approval = result.value;

          // --- Stores decision ---
          expect(approval.decision).toBe(input.decision);

          // --- Stores trimmed name ---
          expect(approval.reviewerName).toBe(input.name.trim());

          // --- Stores trimmed initials ---
          expect(approval.reviewerInitials).toBe(input.initials.trim());

          // --- Stores phase id ---
          expect(approval.phaseId).toBe(input.phaseId.trim());

          // --- Stores UTC timestamp ---
          expect(approval.createdAt).toBe(now.toISOString());

          // --- Snapshot equals checklist completion at sign-off ---
          const expectedSnapshot = snapshotChecklist(checklist);
          expect(approval.checklistSnapshot).toEqual(expectedSnapshot);

          // Verify snapshot captures each item's id, text, and complete state
          expect(approval.checklistSnapshot.length).toBe(checklist.length);
          for (let i = 0; i < checklist.length; i++) {
            expect(approval.checklistSnapshot[i].checklistItemId).toBe(
              checklist[i].id,
            );
            expect(approval.checklistSnapshot[i].text).toBe(checklist[i].text);
            expect(approval.checklistSnapshot[i].complete).toBe(
              checklist[i].complete,
            );
          }

          // --- Has a valid id ---
          expect(approval.id).toBeDefined();
          expect(approval.id.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('no approval is produced if a required field is missing', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Case 1: empty phaseId
          fc.record({
            phaseId: fc.constantFrom('', '   ', '\t'),
            decision: decisionArb,
            name: validNameArb,
            initials: validInitialsArb,
          }),
          // Case 2: invalid decision
          fc.record({
            phaseId: uuidArb.filter((id) => id.trim().length > 0),
            decision: invalidDecisionArb as fc.Arbitrary<ApprovalDecision>,
            name: validNameArb,
            initials: validInitialsArb,
          }),
          // Case 3: invalid name
          fc.record({
            phaseId: uuidArb.filter((id) => id.trim().length > 0),
            decision: decisionArb,
            name: invalidNameArb,
            initials: validInitialsArb,
          }),
          // Case 4: invalid initials
          fc.record({
            phaseId: uuidArb.filter((id) => id.trim().length > 0),
            decision: decisionArb,
            name: validNameArb,
            initials: invalidInitialsArb,
          }),
        ),
        checklistArb,
        dateArb,
        (input, checklist, now) => {
          const idSource = makeIdSource();
          const result = buildApproval(
            input as SignoffInput,
            checklist,
            idSource,
            now,
          );

          // --- Must fail: no approval produced ---
          expect(result.ok).toBe(false);
          if (result.ok) return;

          // --- Error identifies the problem ---
          expect(result.error.kind).toBe('validation');
          expect(result.error.fields.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
