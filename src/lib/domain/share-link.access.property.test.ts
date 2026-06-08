import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  isShareLinkAccessible,
  resolveShareLink,
} from '@/lib/domain/share-link';
import type { ShareLink, UUID, ISOTimestamp } from '@/lib/domain/types';

/**
 * Property-based test for share-link access predicate (design Property 16).
 *
 * The `isShareLinkAccessible` function returns true if and only if the link
 * exists (non-null/undefined) and has `revokedAt` equal to null.
 *
 * The `resolveShareLink` function resolves an accessible link to a read-only
 * view model (`readOnly: true`), and resolves inaccessible/null/undefined
 * inputs to the generic invalid response.
 *
 * **Validates: Requirements 8.2, 8.5**
 */

// Feature: client-sign-off-dashboard, Property 16: Share-link access predicate

// --- Generators ---

const uuidArb: fc.Arbitrary<UUID> = fc.uuid();

const isoTimestampArb: fc.Arbitrary<ISOTimestamp> = fc
  .date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2099-12-31T23:59:59.999Z'),
  })
  .map((d) => d.toISOString());

const scopeTypeArb = fc.constantFrom<'project' | 'phase'>('project', 'phase');

/**
 * Generate a URL-safe token string of at least 32 characters using only
 * characters from the base64url alphabet (A-Z, a-z, 0-9, -, _).
 */
const urlSafeTokenArb: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom(
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split(''),
    ),
    { minLength: 32, maxLength: 64 },
  )
  .map((chars) => chars.join(''));

/**
 * Generate a valid ShareLink with revokedAt explicitly set to null (not revoked).
 */
const accessibleShareLinkArb: fc.Arbitrary<ShareLink> = fc
  .record({
    id: uuidArb,
    ownerId: uuidArb,
    token: urlSafeTokenArb,
    scopeType: scopeTypeArb,
    projectId: uuidArb.map((id) => id as UUID | null),
    phaseId: fc.oneof(uuidArb, fc.constant(null as UUID | null)),
    revokedAt: fc.constant(null as ISOTimestamp | null),
    firstAccessedAt: fc.oneof(isoTimestampArb, fc.constant(null as ISOTimestamp | null)),
    createdAt: isoTimestampArb,
  })
  .map((rec) => {
    // Ensure scope consistency: phase-scoped links must have phaseId set
    if (rec.scopeType === 'phase' && rec.phaseId === null) {
      return { ...rec, phaseId: rec.id } as ShareLink;
    }
    return rec as ShareLink;
  });

/**
 * Generate a ShareLink with revokedAt set to a non-null timestamp (revoked).
 */
const revokedShareLinkArb: fc.Arbitrary<ShareLink> = fc
  .record({
    id: uuidArb,
    ownerId: uuidArb,
    token: urlSafeTokenArb,
    scopeType: scopeTypeArb,
    projectId: uuidArb.map((id) => id as UUID | null),
    phaseId: fc.oneof(uuidArb, fc.constant(null as UUID | null)),
    revokedAt: isoTimestampArb.map((ts) => ts as ISOTimestamp | null),
    firstAccessedAt: fc.oneof(isoTimestampArb, fc.constant(null as ISOTimestamp | null)),
    createdAt: isoTimestampArb,
  })
  .map((rec) => {
    if (rec.scopeType === 'phase' && rec.phaseId === null) {
      return { ...rec, phaseId: rec.id } as ShareLink;
    }
    return rec as ShareLink;
  });

/**
 * Generate a ShareLink with revokedAt either null or set (mixed).
 */
const anyShareLinkArb: fc.Arbitrary<ShareLink> = fc.oneof(
  accessibleShareLinkArb,
  revokedShareLinkArb,
);

/**
 * Generate null or undefined inputs to represent nonexistent links.
 */
const nullishArb: fc.Arbitrary<null | undefined> = fc.constantFrom(
  null,
  undefined,
);

describe('Share-link access predicate (Property 16)', () => {
  // Feature: client-sign-off-dashboard, Property 16: Share-link access predicate
  // Validates: Requirements 8.2, 8.5
  it('accessible iff exists and revokedAt null; accessible resolves to readOnly:true', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          anyShareLinkArb.map((link) => link as ShareLink | null | undefined),
          nullishArb,
        ),
        (input) => {
          const accessible = isShareLinkAccessible(input);

          // --- Core predicate: accessible iff exists AND revokedAt is null ---
          const expectedAccessible =
            input != null && input.revokedAt === null;
          expect(accessible).toBe(expectedAccessible);

          // --- Resolution behavior ---
          const resolution = resolveShareLink(input);

          if (expectedAccessible) {
            // Accessible links resolve to a read-only view model
            expect(resolution.ok).toBe(true);
            if (resolution.ok) {
              expect(resolution.readOnly).toBe(true);
              expect(resolution.link).toBe(input);
            }
          } else {
            // Inaccessible (null, undefined, or revoked) links resolve to
            // the generic invalid response
            expect(resolution.ok).toBe(false);
            if (!resolution.ok) {
              expect(resolution.reason).toBe('invalid');
              expect(typeof resolution.message).toBe('string');
              expect(resolution.message.length).toBeGreaterThan(0);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
