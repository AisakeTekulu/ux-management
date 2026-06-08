import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateProjectName } from '@/lib/domain/validators';

/**
 * Property-based test for project name validation (design Property 2).
 *
 * The validator is an oracle-checkable pure function: it trims the input and
 * accepts it iff the trimmed *code-point* length is within 1..120, returning
 * the trimmed value. We re-derive the expectation from the same `trim()` +
 * code-point-count model the validator uses, so the test confirms the
 * validator agrees with that model across a wide, edge-biased input space.
 *
 * Lives in a dedicated file to avoid collisions with the other 5.x property
 * test tasks that target sibling validators in the same module.
 */

/** Count Unicode code points, matching the validator's `Array.from` semantics. */
function codePointLength(value: string): number {
  return Array.from(value).length;
}

/**
 * Whitespace code points that `String.prototype.trim()` strips, including
 * exotic ones (NBSP, line/paragraph separators, ideographic space) so the
 * generator stresses the trimming boundary, not just ASCII spaces.
 */
const trimmableWhitespace = fc.constantFrom(
  ' ',
  '\t',
  '\n',
  '\r',
  '\f',
  '\v',
  '\u00A0', // no-break space
  '\u2028', // line separator
  '\u2029', // paragraph separator
  '\u3000', // ideographic space
  '\uFEFF', // BOM / zero-width no-break space
);

/** A run of trimmable whitespace, possibly empty, used to pad cores. */
const whitespaceRun = fc
  .array(trimmableWhitespace, { maxLength: 6 })
  .map((parts) => parts.join(''));

/**
 * A single non-whitespace code point spanning ASCII, Latin-1/extended, a
 * handful of CJK/Greek/sharp-s letters, and astral-plane emoji (which occupy
 * two UTF-16 units but one code point — exercising code-point vs. length math).
 */
const nonWhitespaceCodePoint = fc.oneof(
  fc.integer({ min: 0x21, max: 0x7e }).map((c) => String.fromCodePoint(c)),
  fc.integer({ min: 0xa1, max: 0x024f }).map((c) => String.fromCodePoint(c)),
  fc.constantFrom('é', 'ñ', 'ß', 'Ω', '中', '文', '日', '本', '你', '好'),
  fc.integer({ min: 0x1f300, max: 0x1f600 }).map((c) => String.fromCodePoint(c)),
);

/**
 * Target trimmed length, biased toward the boundaries that matter for this
 * property: empty (0), minimum (1), and around the 120-code-point maximum
 * (119/120/121/122), plus a uniform spread up to well past the limit.
 */
const targetLength = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom(0, 1, 2, 118, 119, 120, 121, 122) },
  { weight: 1, arbitrary: fc.integer({ min: 0, max: 200 }) },
);

/** A core string of exactly `n` non-whitespace code points (no edge whitespace). */
const coreOfTargetLength = targetLength.chain((n) =>
  fc
    .array(nonWhitespaceCodePoint, { minLength: n, maxLength: n })
    .map((chars) => chars.join('')),
);

/** A core padded with leading/trailing trimmable whitespace. */
const paddedCore = fc
  .tuple(whitespaceRun, coreOfTargetLength, whitespaceRun)
  .map(([left, core, right]) => left + core + right);

/** All-whitespace strings, which must always be rejected (trim to empty). */
const allWhitespace = fc
  .array(trimmableWhitespace, { minLength: 1, maxLength: 10 })
  .map((parts) => parts.join(''));

/** The full, edge-biased input space for project-name validation. */
const projectNameInput = fc.oneof(
  { weight: 5, arbitrary: paddedCore },
  { weight: 1, arbitrary: allWhitespace },
  { weight: 1, arbitrary: fc.constant('') },
  { weight: 2, arbitrary: fc.string({ maxLength: 200 }) },
  // `unit: 'binary'` yields full-Unicode strings, including astral-plane chars.
  { weight: 2, arbitrary: fc.string({ unit: 'binary', maxLength: 200 }) },
);

describe('validateProjectName (Property 2: Project name validation)', () => {
  // Feature: client-sign-off-dashboard, Property 2: Project name validation
  it('accepts iff trimmed length is 1..120 and returns the trimmed value, else identifies the name violation', () => {
    fc.assert(
      fc.property(projectNameInput, (raw) => {
        const result = validateProjectName(raw);
        const trimmed = raw.trim();
        const length = codePointLength(trimmed);
        const shouldAccept = length >= 1 && length <= 120;

        if (shouldAccept) {
          expect(result.ok).toBe(true);
          if (result.ok) {
            // Returns the trimmed value (R3.1).
            expect(result.value).toBe(trimmed);
          }
        } else {
          // Empty/whitespace-only (R3.2) or over 120 code points (R3.4) is rejected.
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.kind).toBe('validation');
            // Rejection identifies the offending name field.
            expect(result.error.fields.some((f) => f.field === 'name')).toBe(true);
          }
        }
      }),
      { numRuns: 1000 },
    );
  });
});
