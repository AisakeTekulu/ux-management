import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateCommentText } from '@/lib/domain/validators';
import type { Author, Comment } from '@/lib/domain/types';

/**
 * Property 13: Comment text validation and attribution.
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4
 *
 * For any string, `validateCommentText` accepts it if and only if its trimmed
 * length (measured in Unicode code points, matching PostgreSQL `char_length`)
 * is between 1 and 5000. An accepted comment is attributed to the submitting
 * author (designer or reviewer) with a UTC timestamp. A rejection produces a
 * validation error and creates no comment.
 *
 * This is a single property-based test running at least 100 iterations,
 * exercising empty / all-whitespace inputs, the 0 / 1 / 5000 / 5001 boundary
 * lengths, and Unicode (including astral-plane) characters.
 */

/** Minimum accepted trimmed length (code points). */
const MIN_LENGTH = 1;
/** Maximum accepted trimmed length (code points). */
const MAX_LENGTH = 5000;

/**
 * Pure model of "add a comment" as performed by the application layer:
 * validate the raw text, and on success create a comment attributed to the
 * given author with a UTC timestamp; on failure return no comment.
 */
function modelAddComment(
  raw: string,
  author: Author,
  newId: string,
  phaseId: string,
  now: string,
): { accepted: boolean; comment?: Comment } {
  const result = validateCommentText(raw);
  if (!result.ok) {
    return { accepted: false };
  }
  const comment: Comment = {
    id: newId,
    phaseId,
    authorType: author.type,
    authorUserId: author.type === 'designer' ? author.userId : null,
    authorName: author.type === 'reviewer' ? author.name : null,
    text: result.value,
    createdAt: now,
  };
  return { accepted: true, comment };
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
    length: fc.constantFrom(0, 1, 2, 500, 4999, 5000, 5001, 5100),
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
  .string({ unit: 'binary', maxLength: 5100 })
  .map((raw) => {
    const trimmed = raw.trim();
    return { raw, expectedValue: trimmed, expectedLength: Array.from(trimmed).length };
  });

const candidate: fc.Arbitrary<Candidate> = fc.oneof(
  boundaryCandidate,
  whitespaceCandidate,
  randomCandidate,
);

/** Generate an Author (designer or reviewer). */
const authorArb: fc.Arbitrary<Author> = fc.oneof(
  fc.record({ type: fc.constant('designer' as const), userId: fc.uuid() }),
  fc.record({ type: fc.constant('reviewer' as const), name: fc.string({ minLength: 1, maxLength: 50 }) }),
);

/** Generate a UTC ISO timestamp. */
const utcTimestamp: fc.Arbitrary<string> = fc
  .date({ min: new Date('2020-01-01T00:00:00Z'), max: new Date('2030-12-31T23:59:59Z') })
  .map((d) => d.toISOString());

describe('Property 13: comment text validation and attribution', () => {
  // Feature: client-sign-off-dashboard, Property 13: Comment text validation and attribution
  it('accepts iff trimmed length 1-5000; accepted comment attributed to submitting author with UTC timestamp', () => {
    fc.assert(
      fc.property(candidate, authorArb, utcTimestamp, fc.uuid(), ({ raw, expectedValue, expectedLength }, author, now, newId) => {
        const expectedAccept = expectedLength >= MIN_LENGTH && expectedLength <= MAX_LENGTH;
        const phaseId = 'phase-1';

        // Validator acceptance must match the rule exactly (iff trimmed 1..5000).
        const result = validateCommentText(raw);
        expect(result.ok).toBe(expectedAccept);

        const outcome = modelAddComment(raw, author, newId, phaseId, now);

        // The add operation agrees with the validator's verdict.
        expect(outcome.accepted).toBe(expectedAccept);

        if (expectedAccept) {
          // Accepted: returns the trimmed value.
          expect(result.ok && result.value).toBe(expectedValue);

          const comment = outcome.comment;
          expect(comment).toBeDefined();

          // R7.1/R7.2: comment text is the validated trimmed value.
          expect(comment!.text).toBe(expectedValue);

          // R7.1/R7.2: comment is attributed to the submitting author.
          expect(comment!.authorType).toBe(author.type);
          if (author.type === 'designer') {
            expect(comment!.authorUserId).toBe(author.userId);
            expect(comment!.authorName).toBeNull();
          } else {
            expect(comment!.authorName).toBe(author.name);
            expect(comment!.authorUserId).toBeNull();
          }

          // R7.1/R7.2: comment has a UTC timestamp.
          expect(comment!.createdAt).toBe(now);
          // Verify the timestamp ends with 'Z' (UTC indicator).
          expect(comment!.createdAt.endsWith('Z')).toBe(true);
        } else {
          // R7.3/R7.4: rejection produces a validation error and no comment.
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.kind).toBe('validation');
            expect(result.error.fields.length).toBeGreaterThan(0);
            expect(result.error.fields[0].field).toBe('text');
          }
          expect(outcome.comment).toBeUndefined();
        }
      }),
      { numRuns: 300 },
    );
  });
});
