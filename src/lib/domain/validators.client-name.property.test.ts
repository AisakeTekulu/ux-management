import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateClientName } from '@/lib/domain/validators';

/**
 * Property-based test for client name validation (design Property 1).
 *
 * The validator is a pure function over a raw string, so "no client field is
 * mutated on rejection" (R2.4) is exercised at this layer as: a rejected input
 * yields an error result that produces no accepted value, and the input itself
 * is left unchanged. Length is measured in Unicode code points to mirror the
 * validator's `Array.from`/PostgreSQL `char_length` semantics, so the generators
 * deliberately include astral-plane characters whose UTF-16 length differs from
 * their code-point count.
 */

// A pool of non-whitespace characters spanning ASCII, accented Latin, CJK, and
// astral-plane (emoji / Mathematical Alphanumeric) code points. Each element is
// exactly one Unicode code point, so an array of N of them trims to N code
// points. None are treated as whitespace by String.prototype.trim().
const nonWhitespaceChar = fc.constantFrom(
  'a',
  'B',
  '7',
  '#',
  '-',
  'é',
  'ñ',
  'Ω',
  '字',
  '🎨',
  '😀',
  '𝔘',
);

// Whitespace characters that String.prototype.trim() strips. The oracle below
// recomputes `raw.trim()` independently, so the exact set only needs to steer
// generation toward interesting padding, not match the validator's internals.
const whitespaceChar = fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\u000b');

const whitespaceRun = fc
  .array(whitespaceChar, { minLength: 0, maxLength: 6 })
  .map((chars) => chars.join(''));

// A core (non-whitespace) string of an exact code-point length.
const coreOfLength = (length: number) =>
  fc
    .array(nonWhitespaceChar, { minLength: length, maxLength: length })
    .map((chars) => chars.join(''));

// Inputs that land on or near the 1..100 acceptance boundary after trimming,
// wrapped in random leading/trailing whitespace. A core length of 0 collapses
// to an all-whitespace (or empty) string, covering that edge directly.
const boundaryCandidate = fc
  .tuple(
    whitespaceRun,
    fc.constantFrom(0, 1, 2, 50, 99, 100, 101, 150).chain((n) => coreOfLength(n)),
    whitespaceRun,
  )
  .map(([lead, core, trail]) => lead + core + trail);

// A purely whitespace string (trims to length 0 -> must be rejected).
const allWhitespace = fc
  .array(whitespaceChar, { minLength: 1, maxLength: 12 })
  .map((chars) => chars.join(''));

// The full input space: explicit empty string, all-whitespace, boundary-tuned
// inputs, and broad arbitrary/Unicode strings for unconstrained coverage.
const clientNameInput = fc.oneof(
  fc.constant(''),
  allWhitespace,
  boundaryCandidate,
  fc.string(),
  fc.string({ unit: 'binary', maxLength: 130 }),
  fc.string({ unit: 'grapheme', maxLength: 130 }),
);

describe('validateClientName (Property 1)', () => {
  // Feature: client-sign-off-dashboard, Property 1: Client name validation
  // Validates: Requirements 2.1, 2.2, 2.3, 2.4
  it('accepts iff trimmed code-point length is 1..100, returns the trimmed value, and never mutates the input on rejection', () => {
    fc.assert(
      fc.property(clientNameInput, (raw) => {
        const original = raw;
        const trimmed = raw.trim();
        const trimmedLength = Array.from(trimmed).length;
        const shouldAccept = trimmedLength >= 1 && trimmedLength <= 100;

        const result = validateClientName(raw);

        // Acceptance holds if and only if the boundary condition holds.
        expect(result.ok).toBe(shouldAccept);

        if (result.ok) {
          // Accepted inputs return exactly the trimmed value.
          expect(result.value).toBe(trimmed);
        } else {
          // Rejected inputs produce a validation error identifying `name` and
          // yield no accepted value (the caller can retain what was entered).
          expect(result.error.kind).toBe('validation');
          expect(result.error.fields.some((field) => field.field === 'name')).toBe(true);
        }

        // The input string is left unchanged on every path.
        expect(raw).toBe(original);
      }),
      { numRuns: 100 },
    );
  });
});
