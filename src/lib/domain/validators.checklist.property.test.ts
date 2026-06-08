import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateChecklistText } from '@/lib/domain/validators';
import type { ChecklistItem } from '@/lib/domain/types';

/**
 * Property 9: Checklist text validation and default state.
 *
 * Validates: Requirements 5.1, 5.2, 5.7
 *
 * For any string, `validateChecklistText` accepts it if and only if its trimmed
 * length (measured in Unicode code points, matching PostgreSQL `char_length`)
 * is between 1 and 500; an accepted, newly created checklist item has a
 * completion state of incomplete; and a rejection leaves the existing checklist
 * items unchanged.
 *
 * This is a single property-based test (per the design's Testing Strategy)
 * running at least 100 iterations, exercising empty / all-whitespace inputs,
 * the 0 / 1 / 500 / 501 boundary lengths, and Unicode (including astral-plane)
 * characters.
 */

/** Minimum accepted trimmed length (code points). */
const MIN_LENGTH = 1;
/** Maximum accepted trimmed length (code points). */
const MAX_LENGTH = 500;

/**
 * Pure model of "add a checklist item" as performed by the application layer:
 * validate the raw text, and on success append a new incomplete item; on
 * failure return the existing items untouched. Exercises the validator under
 * test exactly as production code would.
 */
function modelAddChecklistItem(
  items: readonly ChecklistItem[],
  raw: string,
  newId: string,
): { accepted: boolean; items: ChecklistItem[]; created?: ChecklistItem } {
  const result = validateChecklistText(raw);
  if (!result.ok) {
    return { accepted: false, items: [...items] };
  }
  const created: ChecklistItem = {
    id: newId,
    phaseId: 'phase-1',
    text: result.value,
    complete: false,
    createdAt: '2024-01-01T00:00:00.000Z',
  };
  return { accepted: true, items: [...items, created], created };
}

/** A single non-whitespace code point (mix of ASCII, BMP, and astral chars). */
const nonWhitespaceChar = fc.constantFrom(
  'a',
  'Z',
  '7',
  'é',
  'ñ',
  '中',
  'Ω',
  'π',
  '😀',
  '🚀',
  '𐍈',
);

/** Whitespace fragments that `String.prototype.trim` removes. */
const whitespacePad = fc.constantFrom('', ' ', '  ', '\t', '\n', '\r\n', ' \t ', '\n  \t');

interface Candidate {
  /** The raw input fed to the validator. */
  raw: string;
  /** The expected trimmed value when accepted. */
  expectedValue: string;
  /** The expected trimmed length in code points, known independently. */
  expectedLength: number;
}

/**
 * Boundary-targeted candidates: a non-whitespace core of an exactly-known
 * code-point length, optionally wrapped in whitespace. Because the core has no
 * leading/trailing whitespace, the trimmed value equals the core and its
 * code-point length equals the chosen length — an independent oracle that does
 * not re-derive the answer from the validator's own trim logic.
 */
const boundaryCandidate: fc.Arbitrary<Candidate> = fc
  .record({
    length: fc.constantFrom(0, 1, 2, 250, 499, 500, 501, 520),
    lead: whitespacePad,
    trail: whitespacePad,
  })
  .chain(({ length, lead, trail }) =>
    fc
      .array(nonWhitespaceChar, { minLength: length, maxLength: length })
      .map((chars) => {
        const core = chars.join('');
        return { raw: lead + core + trail, expectedValue: core, expectedLength: length };
      }),
  );

/** Empty / all-whitespace candidates (always rejected). */
const whitespaceCandidate: fc.Arbitrary<Candidate> = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r'), { maxLength: 12 })
  .map((chars) => ({ raw: chars.join(''), expectedValue: '', expectedLength: 0 }));

/** Fully random Unicode candidates; the oracle trims and counts code points. */
const randomCandidate: fc.Arbitrary<Candidate> = fc
  .string({ unit: 'binary', maxLength: 520 })
  .map((raw) => {
    const trimmed = raw.trim();
    return { raw, expectedValue: trimmed, expectedLength: Array.from(trimmed).length };
  });

const candidate: fc.Arbitrary<Candidate> = fc.oneof(
  boundaryCandidate,
  whitespaceCandidate,
  randomCandidate,
);

/** A small set of pre-existing checklist items for the "unchanged" check. */
const existingItems: fc.Arbitrary<ChecklistItem[]> = fc
  .array(
    fc.record({
      text: fc.string({ minLength: 1, maxLength: 20 }),
      complete: fc.boolean(),
    }),
    { maxLength: 5 },
  )
  .map((rows) =>
    rows.map((row, index) => ({
      id: `existing-${index}`,
      phaseId: 'phase-1',
      text: row.text,
      complete: row.complete,
      createdAt: '2024-01-01T00:00:00.000Z',
    })),
  );

describe('Property 9: checklist text validation and default state', () => {
  // Feature: client-sign-off-dashboard, Property 9: Checklist text validation and default state
  it('accepts iff trimmed length 1-500; new item is incomplete; rejection leaves items unchanged', () => {
    fc.assert(
      fc.property(candidate, existingItems, ({ raw, expectedValue, expectedLength }, items) => {
        const expectedAccept = expectedLength >= MIN_LENGTH && expectedLength <= MAX_LENGTH;

        // Validator acceptance must match the rule exactly (iff trimmed 1..500).
        const result = validateChecklistText(raw);
        expect(result.ok).toBe(expectedAccept);

        const before = structuredClone(items);
        const outcome = modelAddChecklistItem(items, raw, 'new-item');

        // The add operation agrees with the validator's verdict.
        expect(outcome.accepted).toBe(expectedAccept);

        if (expectedAccept) {
          // Accepted: returns the trimmed value.
          expect(result.ok && result.value).toBe(expectedValue);

          const created = outcome.created;
          expect(created).toBeDefined();
          // R5.1: a newly created checklist item defaults to incomplete.
          expect(created?.complete).toBe(false);
          expect(created?.text).toBe(expectedValue);

          // Existing items are preserved, with the new item appended at the end.
          expect(outcome.items).toHaveLength(items.length + 1);
          expect(outcome.items.slice(0, items.length)).toEqual(before);
          expect(outcome.items[outcome.items.length - 1]).toBe(created);
        } else {
          // R5.7: rejection produces a validation error and changes nothing.
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.kind).toBe('validation');
          }
          expect(outcome.created).toBeUndefined();
          expect(outcome.items).toEqual(before);
        }

        // The validator never mutates its caller's existing items.
        expect(items).toEqual(before);
      }),
      { numRuns: 300 },
    );
  });
});
