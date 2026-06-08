import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  invalidShareLinkResponse,
  resolveShareLink,
} from '@/lib/domain/share-link';
import type { ShareLink } from '@/lib/domain/types';

/**
 * Property-based test for invalid-link response indistinguishability
 * (design Property 18).
 *
 * Requirement 8.4 mandates that nonexistent and revoked share links yield
 * identical responses that disclose nothing about whether the underlying
 * project or phase exists. This property verifies that:
 *
 * 1. Resolving a null/undefined input (nonexistent token) produces the same
 *    response as resolving a revoked ShareLink (revokedAt set).
 * 2. Both responses are deeply equal to the canonical invalidShareLinkResponse().
 * 3. The response contains no information about the link's scope, project, or
 *    phase — only a generic "invalid or no longer available" message.
 */

// Feature: client-sign-off-dashboard, Property 18: Invalid-link response indistinguishability

// Generator for a valid UUID-like string
const arbUUID = fc
  .uuid()
  .map((u) => u as string);

// Generator for a non-null ISO timestamp (used for revokedAt)
const arbTimestamp = fc
  .date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
  .map((d) => d.toISOString());

// Generator for a revoked ShareLink (revokedAt is set to a non-null timestamp)
const arbRevokedShareLink: fc.Arbitrary<ShareLink> = fc
  .record({
    id: arbUUID,
    ownerId: arbUUID,
    token: fc.string({ minLength: 32, maxLength: 64 }).filter((s) => s.length >= 32),
    scopeType: fc.constantFrom('project' as const, 'phase' as const),
    projectId: fc.option(arbUUID, { nil: null }),
    phaseId: fc.option(arbUUID, { nil: null }),
    revokedAt: arbTimestamp,
    firstAccessedAt: fc.option(arbTimestamp, { nil: null }),
    createdAt: arbTimestamp,
  })
  .map((link) => {
    // Ensure revokedAt is always set (non-null) for revoked links
    return { ...link, revokedAt: link.revokedAt } as ShareLink;
  });

// Generator for null or undefined inputs (nonexistent token lookups)
const arbNonexistent: fc.Arbitrary<null | undefined> = fc.constantFrom(
  null,
  undefined,
);

describe('resolveShareLink / invalidShareLinkResponse (Property 18)', () => {
  // Feature: client-sign-off-dashboard, Property 18: Invalid-link response indistinguishability
  // Validates: Requirements 8.4
  it('nonexistent and revoked tokens yield identical responses that disclose nothing about existence', () => {
    fc.assert(
      fc.property(
        arbRevokedShareLink,
        arbNonexistent,
        (revokedLink, nonexistentInput) => {
          // Resolve a revoked link
          const revokedResponse = resolveShareLink(revokedLink);

          // Resolve a nonexistent link (null or undefined)
          const nonexistentResponse = resolveShareLink(nonexistentInput);

          // The canonical invalid response
          const canonical = invalidShareLinkResponse();

          // Both must be deeply equal to each other
          expect(revokedResponse).toStrictEqual(nonexistentResponse);

          // Both must be deeply equal to the canonical invalid response
          expect(revokedResponse).toStrictEqual(canonical);
          expect(nonexistentResponse).toStrictEqual(canonical);

          // The response must not disclose any information about existence
          expect(revokedResponse).toStrictEqual({
            ok: false,
            reason: 'invalid',
            message: 'This link is invalid or no longer available.',
          });

          // Verify the response contains no reference to project/phase/scope
          const responseStr = JSON.stringify(revokedResponse);
          expect(responseStr).not.toContain('projectId');
          expect(responseStr).not.toContain('phaseId');
          expect(responseStr).not.toContain('scopeType');
          expect(responseStr).not.toContain('token');
          expect(responseStr).not.toContain('ownerId');
        },
      ),
      { numRuns: 100 },
    );
  });
});
