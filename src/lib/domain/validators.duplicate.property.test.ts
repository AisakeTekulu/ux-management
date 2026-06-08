import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { isProjectNameDuplicate } from '@/lib/domain/validators';
import type { Project } from '@/lib/domain/types';

/**
 * Property-based test for project name duplicate detection (design Property 3).
 *
 * `isProjectNameDuplicate(name, siblings)` must return true if and only if some
 * sibling's name equals the candidate after trimming surrounding whitespace and
 * case-folding both, mirroring the database's `lower(btrim(name))` uniqueness
 * index (R3.5). The reference oracle expresses that specification directly as
 * `normalize(x) = x.trim().toLowerCase()` so the test catches defects such as
 * comparing without trimming, comparing case-sensitively, normalizing only one
 * side, or mutating the read-only `siblings` array.
 *
 * The input space is deliberately match-biased: many candidates are generated
 * as case/whitespace variants of an existing sibling so that the "true" branch
 * is exercised frequently, alongside fresh arbitrary names for the "false"
 * branch and empty sibling sets (minLength 0) for the no-match edge.
 */

function project(id: string, name: string): Project {
  return {
    id,
    clientId: 'c1',
    ownerId: 'owner',
    name,
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

const normalize = (value: string): string => value.trim().toLowerCase();

// Whitespace characters that String.prototype.trim() strips. Used to surround
// names with arbitrary leading/trailing padding.
const whitespaceChar = fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\u000b');
const whitespaceRun = fc
  .array(whitespaceChar, { minLength: 0, maxLength: 4 })
  .map((chars) => chars.join(''));

// A pool of representative names spanning ASCII, mixed case, accented Latin,
// CJK, Greek, and names with surrounding whitespace baked in.
const namePool = fc.constantFrom(
  'Homepage redesign',
  'Brand guidelines',
  'Mobile app',
  'Café menu',
  'naïve',
  'Ω project',
  '字体设计',
  'Launch 2024',
  '  spaced name  ',
  'MiXeD CaSe',
  'duplicate',
  'DUPLICATE',
);

// A single project name: pooled, plus broad arbitrary/Unicode coverage.
const nameArb = fc.oneof(
  namePool,
  fc.string({ maxLength: 16 }),
  fc.string({ unit: 'grapheme', maxLength: 16 }),
);

// Produce a variant of `source`: take its trimmed core, randomly re-case each
// code point, then re-pad with arbitrary whitespace. The variant's normalized
// form usually equals the source's, biasing generation toward true matches
// (the oracle remains authoritative for the handful of case-folding cases where
// re-casing changes the folded value, e.g. 'ß' -> 'SS').
function variantOf(source: string): fc.Arbitrary<string> {
  const core = Array.from(source.trim());
  return fc
    .tuple(
      whitespaceRun,
      fc.array(fc.boolean(), { minLength: core.length, maxLength: core.length }),
      whitespaceRun,
    )
    .map(
      ([lead, flags, trail]) =>
        lead +
        core.map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase())).join('') +
        trail,
    );
}

// A scenario is a set of sibling projects plus a candidate name. The candidate
// is either a case/whitespace variant of an existing sibling (match-biased) or
// a fresh arbitrary name (likely non-matching).
const scenarioArb = fc
  .array(nameArb, { minLength: 0, maxLength: 6 })
  .chain((siblingNames) => {
    const siblings = siblingNames.map((name, index) => project(`sib-${index}`, name));

    const candidateArb =
      siblingNames.length === 0
        ? nameArb
        : fc.oneof(
            fc
              .nat({ max: siblingNames.length - 1 })
              .chain((index) => variantOf(siblingNames[index])),
            nameArb,
          );

    return fc.tuple(fc.constant(siblings), candidateArb);
  });

describe('isProjectNameDuplicate (Property 3)', () => {
  // Feature: client-sign-off-dashboard, Property 3: Project name duplicate detection
  // Validates: Requirements 3.5
  it('returns true iff some sibling matches the candidate after trimming and case-folding, without mutating siblings', () => {
    fc.assert(
      fc.property(scenarioArb, ([siblings, candidate]) => {
        const namesBefore = siblings.map((sibling) => sibling.name);

        const expected = siblings.some(
          (sibling) => normalize(sibling.name) === normalize(candidate),
        );

        const result = isProjectNameDuplicate(candidate, siblings);

        // Duplicate detection holds exactly when a normalized sibling matches.
        expect(result).toBe(expected);

        // The read-only siblings array and its elements are never mutated.
        expect(siblings.map((sibling) => sibling.name)).toEqual(namesBefore);
      }),
      { numRuns: 200 },
    );
  });
});
