import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PHASE_TITLES,
  initializeDefaultPhases,
  INITIAL_PHASE_STATUS,
} from '@/lib/domain/phase-structure';

/**
 * Property-based test for default phase initialization (design Property 5).
 *
 * The function under test is `initializeDefaultPhases`, which produces the ten
 * default phases for a newly created project. This property verifies that for
 * any arbitrary projectId and timestamp, the function returns exactly 10 phases
 * matching the DEFAULT_PHASE_TITLES in order, with ordinals 1–10, each in Draft
 * status.
 *
 * **Validates: Requirements 3.7, 10.1**
 */

/** Generate a UUID-shaped string for projectId. */
const arbitraryUUID = fc
  .uuid()
  .map((id) => id as string);

/** Generate an ISO timestamp string from a valid millisecond epoch range. */
const arbitraryTimestamp = fc
  .integer({
    min: new Date('2000-01-01T00:00:00Z').getTime(),
    max: new Date('2099-12-31T23:59:59Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

describe('initializeDefaultPhases (Property 5: Default phase initialization)', () => {
  // Feature: client-sign-off-dashboard, Property 5: Default phase initialization
  it('produces exactly the ten named defaults, ordinals 1–10 in order, each Draft', () => {
    fc.assert(
      fc.property(arbitraryUUID, arbitraryTimestamp, (projectId, now) => {
        // Create a simple sequential ID source for the test
        let idCounter = 0;
        const newId = () => `phase-id-${++idCounter}`;

        const phases = initializeDefaultPhases(projectId, newId, now);

        // Exactly 10 phases
        expect(phases).toHaveLength(10);

        // Each phase matches the expected default
        for (let i = 0; i < 10; i++) {
          const phase = phases[i];

          // Correct title from DEFAULT_PHASE_TITLES
          expect(phase.title).toBe(DEFAULT_PHASE_TITLES[i]);

          // Ordinals are 1–10 in order
          expect(phase.ordinal).toBe(i + 1);

          // Each phase has status Draft (R10.1)
          expect(phase.status).toBe(INITIAL_PHASE_STATUS);
          expect(phase.status).toBe('Draft');

          // Each phase is associated with the given projectId
          expect(phase.projectId).toBe(projectId);

          // Each phase has the provided timestamp
          expect(phase.createdAt).toBe(now);

          // Each phase has empty description and notes
          expect(phase.description).toBe('');
          expect(phase.internalNotes).toBe('');

          // No due date
          expect(phase.dueDate).toBeNull();

          // No approval data
          expect(phase.approvedByName).toBeNull();
          expect(phase.approvedInitials).toBeNull();
          expect(phase.approvedAt).toBeNull();

          // Unique ID was generated
          expect(phase.id).toBe(`phase-id-${i + 1}`);
        }
      }),
      { numRuns: 100 },
    );
  });
});
