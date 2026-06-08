import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateSignoff } from '@/lib/domain/validators';

/**
 * Property-based test for sign-off validation (design Property 20).
 *
 * The validator accepts if and only if the name's trimmed code-point length is
 * 1..100 and the initials' trimmed code-point length is 1..10. On rejection,
 * every invalid field is identified in the returned ValidationError; inputs are
 * never mutated, so the caller can retain the originally entered values.
 *
 * Length is measured in Unicode code points (via Array.from) to mirror the
 * validator's semantics and PostgreSQL char_length. Generators deliberately
 * include astral-plane characters whose UTF-16 length differs from their
 * code-point count.
 */

// Feature: client-sign-off-dashboard, Property 20: Sign-off validation
// Validates: Requirements 9.2, 9.3, 15.6

// --- Generators ---

// Non-whitespace characters spanning ASCII, accented Latin, CJK, and astral-plane.
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

// Whitespace characters that String.prototype.trim() strips.
const whitespaceChar = fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\u000b');

const whitespaceRun = fc
  .array(whitespaceChar, { minLength: 0, maxLength: 6 })
  .map((chars) => chars.join(''));

// A core (non-whitespace) string of an exact code-point length.
const coreOfLength = (length: number) =>
  fc
    .array(nonWhitespaceChar, { minLength: length, maxLength: length })
    .map((chars) => chars.join(''));

// A purely whitespace string (trims to length 0 -> must be rejected).
const allWhitespace = fc
  .array(whitespaceChar, { minLength: 1, maxLength: 12 })
  .map((chars) => chars.join(''));

// Name inputs: boundary lengths 0, 1, 50, 99, 100, 101 wrapped in whitespace.
const nameBoundaryCandidate = fc
  .tuple(
    whitespaceRun,
    fc.constantFrom(0, 1, 2, 50, 99, 100, 101, 150).chain((n) => coreOfLength(n)),
    whitespaceRun,
  )
  .map(([lead, core, trail]) => lead + core + trail);

// Initials inputs: boundary lengths 0, 1, 5, 9, 10, 11 wrapped in whitespace.
const initialsBoundaryCandidate = fc
  .tuple(
    whitespaceRun,
    fc.constantFrom(0, 1, 2, 5, 9, 10, 11, 20).chain((n) => coreOfLength(n)),
    whitespaceRun,
  )
  .map(([lead, core, trail]) => lead + core + trail);

// Full input space for name: empty, all-whitespace, boundary, and arbitrary.
const nameInput = fc.oneof(
  fc.constant(''),
  allWhitespace,
  nameBoundaryCandidate,
  fc.string({ maxLength: 130 }),
  fc.string({ unit: 'grapheme', maxLength: 130 }),
);

// Full input space for initials: empty, all-whitespace, boundary, and arbitrary.
const initialsInput = fc.oneof(
  fc.constant(''),
  allWhitespace,
  initialsBoundaryCandidate,
  fc.string({ maxLength: 25 }),
  fc.string({ unit: 'grapheme', maxLength: 25 }),
);

describe('validateSignoff (Property 20)', () => {
  // Feature: client-sign-off-dashboard, Property 20: Sign-off validation
  it('accepts iff name trimmed 1–100 and initials trimmed 1–10; identifies each invalid field and retains values on rejection', () => {
    fc.assert(
      fc.property(nameInput, initialsInput, (rawName, rawInitials) => {
        // Preserve originals to verify no mutation.
        const originalName = rawName;
        const originalInitials = rawInitials;

        // Oracle: compute expected acceptance independently.
        const trimmedName = rawName.trim();
        const trimmedInitials = rawInitials.trim();
        const nameLength = Array.from(trimmedName).length;
        const initialsLength = Array.from(trimmedInitials).length;

        const nameValid = nameLength >= 1 && nameLength <= 100;
        const initialsValid = initialsLength >= 1 && initialsLength <= 10;
        const shouldAccept = nameValid && initialsValid;

        const result = validateSignoff(rawName, rawInitials);

        // Acceptance holds if and only if both fields are within bounds.
        expect(result.ok).toBe(shouldAccept);

        if (result.ok) {
          // Accepted: returns the trimmed name and initials.
          expect(result.value.name).toBe(trimmedName);
          expect(result.value.initials).toBe(trimmedInitials);
        } else {
          // Rejected: produces a validation error identifying each invalid field.
          expect(result.error.kind).toBe('validation');

          const errorFields = result.error.fields.map((f) => f.field);

          // If name is invalid, it must be identified.
          if (!nameValid) {
            expect(errorFields).toContain('name');
          }
          // If initials are invalid, they must be identified.
          if (!initialsValid) {
            expect(errorFields).toContain('initials');
          }
          // Only invalid fields should appear in the error.
          for (const f of result.error.fields) {
            if (f.field === 'name') {
              expect(nameValid).toBe(false);
            } else if (f.field === 'initials') {
              expect(initialsValid).toBe(false);
            }
          }
        }

        // Inputs are never mutated (caller retains entered values on rejection).
        expect(rawName).toBe(originalName);
        expect(rawInitials).toBe(originalInitials);
      }),
      { numRuns: 100 },
    );
  });
});
