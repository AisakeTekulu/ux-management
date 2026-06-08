import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  authorizeInternalNotesEdit,
  authorizeOwnership,
  isOwner,
  ownsResource,
  NOT_OWNER_MESSAGE,
} from '@/lib/domain/activity';
import type { UUID } from '@/lib/domain/types';

/**
 * Property-based test for ownership authorization (design Property 35).
 *
 * Access/mutation is permitted if and only if the requester is the owner.
 * A non-owner cannot edit internal notes.
 *
 * **Validates: Requirements 1.5, 4.8**
 */

// Feature: client-sign-off-dashboard, Property 35: Ownership authorization

// --- Generators ---

const uuidArb: fc.Arbitrary<UUID> = fc.uuid();

/** Generate a non-empty, non-whitespace-only string id (valid requester). */
const nonEmptyIdArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 64 })
  .filter((s) => s.trim().length > 0);

/** Generate null, undefined, or empty string (invalid/absent requester). */
const absentRequesterArb: fc.Arbitrary<string | null | undefined> = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(''),
);

describe('Ownership authorization (Property 35)', () => {
  // Feature: client-sign-off-dashboard, Property 35: Ownership authorization
  // Validates: Requirements 1.5, 4.8

  it('access/mutation permitted iff requester is owner; non-owner cannot edit internal notes', () => {
    fc.assert(
      fc.property(
        uuidArb,
        uuidArb,
        absentRequesterArb,
        nonEmptyIdArb,
        (ownerId, differentId, absentRequester, validNonOwner) => {
          // --- isOwner: matching requester returns true ---
          expect(isOwner(ownerId, ownerId)).toBe(true);

          // --- isOwner: null/undefined/empty requester returns false ---
          expect(isOwner(ownerId, absentRequester)).toBe(false);

          // --- isOwner: different requester returns false ---
          // Ensure differentId is actually different from ownerId
          if (differentId !== ownerId) {
            expect(isOwner(ownerId, differentId)).toBe(false);
          }

          // --- ownsResource: matching requester returns true ---
          const resource = { ownerId };
          expect(ownsResource(resource, ownerId)).toBe(true);

          // --- ownsResource: absent requester returns false ---
          expect(ownsResource(resource, absentRequester)).toBe(false);

          // --- authorizeOwnership: owner is permitted (ok) ---
          const ownerResult = authorizeOwnership(ownerId, ownerId);
          expect(ownerResult.ok).toBe(true);

          // --- authorizeOwnership: absent requester is rejected ---
          const absentResult = authorizeOwnership(ownerId, absentRequester);
          expect(absentResult.ok).toBe(false);
          if (!absentResult.ok) {
            expect(absentResult.error.code).toBe('forbidden');
            expect(absentResult.error.message).toBe(NOT_OWNER_MESSAGE);
          }

          // --- authorizeOwnership: different requester is rejected ---
          if (differentId !== ownerId) {
            const nonOwnerResult = authorizeOwnership(ownerId, differentId);
            expect(nonOwnerResult.ok).toBe(false);
            if (!nonOwnerResult.ok) {
              expect(nonOwnerResult.error.code).toBe('forbidden');
              expect(nonOwnerResult.error.message).toBe(NOT_OWNER_MESSAGE);
            }
          }

          // --- authorizeInternalNotesEdit: owner is permitted (R4.8) ---
          const notesOwnerResult = authorizeInternalNotesEdit(ownerId, ownerId);
          expect(notesOwnerResult.ok).toBe(true);

          // --- authorizeInternalNotesEdit: absent requester is rejected (R4.8) ---
          const notesAbsentResult = authorizeInternalNotesEdit(
            ownerId,
            absentRequester,
          );
          expect(notesAbsentResult.ok).toBe(false);
          if (!notesAbsentResult.ok) {
            expect(notesAbsentResult.error.code).toBe('forbidden');
          }

          // --- authorizeInternalNotesEdit: non-owner is rejected (R4.8) ---
          // Use validNonOwner only if it differs from ownerId
          if (validNonOwner !== ownerId) {
            const notesNonOwnerResult = authorizeInternalNotesEdit(
              ownerId,
              validNonOwner,
            );
            expect(notesNonOwnerResult.ok).toBe(false);
            if (!notesNonOwnerResult.ok) {
              expect(notesNonOwnerResult.error.code).toBe('forbidden');
              expect(notesNonOwnerResult.error.message).toBe(NOT_OWNER_MESSAGE);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
