import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  getStatusPresentation,
  OVERDUE_BADGE,
  STATUS_PRESENTATION,
  type StatusBadgeKey,
} from '@/lib/domain/status-presentation';
import type { PhaseStatus } from '@/lib/domain/types';

/**
 * Property-based test for status presentation map totality and distinctness
 * (design Property 36).
 *
 * The STATUS_PRESENTATION map and getStatusPresentation function must:
 * - Map exactly one label and one color token per status (including Overdue)
 * - Be deterministic across repeated lookups
 * - Have pairwise-distinct color tokens
 *
 * **Validates: Requirements 14.4**
 */

// Feature: client-sign-off-dashboard, Property 36: Status presentation map totality and distinctness

const ALL_PHASE_STATUSES: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
];

const ALL_BADGE_KEYS: StatusBadgeKey[] = [
  ...ALL_PHASE_STATUSES,
  OVERDUE_BADGE,
];

/** Arbitrary that picks any StatusBadgeKey uniformly. */
const statusBadgeKeyArb: fc.Arbitrary<StatusBadgeKey> = fc.constantFrom(
  ...ALL_BADGE_KEYS,
);

describe('STATUS_PRESENTATION / getStatusPresentation (Property 36)', () => {
  // Feature: client-sign-off-dashboard, Property 36: Status presentation map totality and distinctness
  // Validates: Requirements 14.4

  it('each StatusBadgeKey maps to exactly one label and one color token, the mapping is deterministic, and color tokens are pairwise distinct', () => {
    fc.assert(
      fc.property(statusBadgeKeyArb, (status) => {
        // --- Totality: every key has a presentation ---
        const presentation = getStatusPresentation(status);
        expect(presentation).toBeDefined();

        // --- Exactly one label (non-empty string) ---
        expect(typeof presentation.label).toBe('string');
        expect(presentation.label.length).toBeGreaterThan(0);

        // --- Exactly one color token (non-empty string) ---
        expect(typeof presentation.colorToken).toBe('string');
        expect(presentation.colorToken.length).toBeGreaterThan(0);

        // --- Exactly one color class (non-empty string) ---
        expect(typeof presentation.colorClass).toBe('string');
        expect(presentation.colorClass.length).toBeGreaterThan(0);

        // --- Deterministic: repeated lookups yield the same result ---
        const second = getStatusPresentation(status);
        expect(second).toStrictEqual(presentation);

        const fromMap = STATUS_PRESENTATION[status];
        expect(fromMap).toStrictEqual(presentation);

        // --- Pairwise-distinct colors: this status's color token is unique ---
        const otherKeys = ALL_BADGE_KEYS.filter((k) => k !== status);
        for (const other of otherKeys) {
          const otherPresentation = getStatusPresentation(other);
          expect(otherPresentation.colorToken).not.toBe(
            presentation.colorToken,
          );
        }
      }),
      { numRuns: 100 },
    );
  });
});
