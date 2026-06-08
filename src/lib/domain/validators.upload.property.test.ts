import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { MAX_UPLOAD_BYTES, isWithinUploadLimit } from '@/lib/domain/validators';
import { createInMemoryRepositories } from '@/lib/repositories/in-memory';
import type { NewDesignLink } from '@/lib/repositories/interfaces';

/**
 * Property-based test for the upload size limit (design Property 12).
 *
 * Lives in a dedicated file so its generators and helpers do not collide with
 * the example/unit tests for the other validators. Property 12 is implemented
 * here as a SINGLE property test running a minimum of 100 iterations.
 */

/**
 * Model the upload gate exactly as the Route Handler does (design "Upload
 * Failure Handling"): a `design_links` row is created only when the size is
 * within the limit; a rejected upload creates no design link. We exercise the
 * real {@link isWithinUploadLimit} predicate against the real in-memory
 * `DesignLinkRepository` so the "creates no design link" half of the property
 * is verified end-to-end rather than asserted by hand.
 */
async function processUpload(
  sizeInBytes: number,
): Promise<{ accepted: boolean; designLinkCount: number }> {
  const repos = createInMemoryRepositories();
  const phaseId = 'phase-under-test';

  const accepted = isWithinUploadLimit(sizeInBytes);
  if (accepted) {
    const link: NewDesignLink = {
      phaseId,
      kind: 'file',
      url: null,
      storagePath: `uploads/${phaseId}/file.png`,
      fileName: 'file.png',
    };
    await repos.designLinks.create(link);
  }

  const designLinkCount = (await repos.designLinks.listByPhase(phaseId)).length;
  return { accepted, designLinkCount };
}

describe('Property 12: Upload size limit', () => {
  // Feature: client-sign-off-dashboard, Property 12: Upload size limit
  it('isWithinUploadLimit is true iff size <= 50 MB, and a rejected upload creates no design link', async () => {
    // Generator biased toward the 50 MB boundary plus 0 and large values, mixed
    // with arbitrary non-negative byte counts to cover the whole input space.
    const sizeArb = fc.oneof(
      // Exact boundary neighbourhood: limit-1, limit, limit+1.
      fc.constantFrom(
        MAX_UPLOAD_BYTES - 1,
        MAX_UPLOAD_BYTES,
        MAX_UPLOAD_BYTES + 1,
      ),
      // Zero-byte and tiny uploads.
      fc.constantFrom(0, 1, 2),
      // Very large uploads well beyond the cap.
      fc.constantFrom(
        MAX_UPLOAD_BYTES * 2,
        MAX_UPLOAD_BYTES * 10,
        Number.MAX_SAFE_INTEGER,
      ),
      // Arbitrary non-negative file sizes across the range.
      fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
    );

    await fc.assert(
      fc.asyncProperty(sizeArb, async (sizeInBytes) => {
        const expectedWithinLimit = sizeInBytes <= MAX_UPLOAD_BYTES;
        const { accepted, designLinkCount } = await processUpload(sizeInBytes);

        // The predicate is true iff the size is at most the 50 MB limit.
        expect(accepted).toBe(expectedWithinLimit);

        // An accepted upload creates exactly one design link; a rejected upload
        // creates none.
        expect(designLinkCount).toBe(expectedWithinLimit ? 1 : 0);
      }),
      { numRuns: 100 },
    );
  });
});
