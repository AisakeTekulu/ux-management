import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  guardAuditImmutability,
  AUDIT_IMMUTABLE_MESSAGE,
  type AuditEntityType,
  type AuditMutation,
} from '@/lib/domain/activity';

/**
 * Property-based test for audit immutability (design Property 34).
 *
 * The `guardAuditImmutability` function rejects every modify/delete attempt
 * against activity-log, comment, or approval entries. The original is preserved
 * unchanged in the error detail, and the immutability indication message is
 * returned.
 *
 * **Validates: Requirements 7.8, 9.7, 9.10, 13.7**
 */

// Feature: client-sign-off-dashboard, Property 34: Audit immutability

// --- Generators ---

/** All valid AuditEntityType values. */
const entityTypeArb: fc.Arbitrary<AuditEntityType> = fc.constantFrom(
  'activity_log',
  'comment',
  'approval',
);

/** Both valid AuditMutation values. */
const mutationArb: fc.Arbitrary<AuditMutation> = fc.constantFrom(
  'modify',
  'delete',
);

/** Arbitrary original objects representing the audit entry being guarded. */
const originalArb: fc.Arbitrary<unknown> = fc.oneof(
  // Plain objects with various shapes
  fc.record({
    id: fc.uuid(),
    text: fc.string({ minLength: 0, maxLength: 200 }),
    createdAt: fc.date().map((d) => d.toISOString()),
  }),
  // Nested objects
  fc.record({
    id: fc.uuid(),
    detail: fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string()),
    actor: fc.string({ minLength: 1, maxLength: 50 }),
  }),
  // Arrays
  fc.array(fc.integer(), { minLength: 0, maxLength: 5 }),
  // Primitives
  fc.string(),
  fc.integer(),
  fc.boolean(),
  // Null
  fc.constant(null),
);

describe('guardAuditImmutability (Property 34)', () => {
  // Feature: client-sign-off-dashboard, Property 34: Audit immutability
  // Validates: Requirements 7.8, 9.7, 9.10, 13.7
  it('every modify/delete attempt on any audit entity type is rejected with an immutable error, preserves the original, and returns the immutability message', () => {
    fc.assert(
      fc.property(
        entityTypeArb,
        mutationArb,
        originalArb,
        (entityType, mutation, original) => {
          // Deep-clone the original to verify it is not mutated
          const originalSnapshot = JSON.parse(JSON.stringify(original));

          const result = guardAuditImmutability(entityType, mutation, original);

          // --- Must always be rejected (err) ---
          expect(result.ok).toBe(false);
          if (result.ok) return;

          // --- Error is an AppError with code 'immutable' ---
          expect(result.error.kind).toBe('app');
          expect(result.error.code).toBe('immutable');

          // --- Immutability message is returned ---
          expect(result.error.message).toBe(AUDIT_IMMUTABLE_MESSAGE);

          // --- Error detail contains the entityType and mutation ---
          expect(result.error.detail).toBeDefined();
          expect(result.error.detail!.entityType).toBe(entityType);
          expect(result.error.detail!.mutation).toBe(mutation);

          // --- Original is preserved unchanged in the error detail ---
          expect(result.error.detail!.original).toEqual(originalSnapshot);

          // --- The original value passed in was not mutated ---
          expect(original).toEqual(originalSnapshot);
        },
      ),
      { numRuns: 100 },
    );
  });
});
