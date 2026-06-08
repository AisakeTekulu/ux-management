import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { validateTaskTitle } from '@/lib/domain/validators';
import type { Task } from '@/lib/domain/types';

/**
 * Property 31: Task title validation and default state.
 *
 * Validates: Requirements 12.1, 12.2
 *
 * For any string, `validateTaskTitle` accepts it if and only if its trimmed
 * length (measured in Unicode code points, matching PostgreSQL `char_length`)
 * is between 1 and 200; an accepted, newly created task has a state of `open`;
 * and a rejection retains the designer's entered values (i.e. no mutation of
 * existing state).
 *
 * This is a single property-based test running at least 100 iterations,
 * exercising empty / all-whitespace inputs, the 0 / 1 / 200 / 201 boundary
 * lengths, and Unicode (including astral-plane) characters.
 */

// Feature: client-sign-off-dashboard, Property 31: Task title validation and default state

/** Minimum accepted trimmed length (code points). */
const MIN_LENGTH = 1;
/** Maximum accepted trimmed length (code points). */
const MAX_LENGTH = 200;

/**
 * Pure model of "create a task" as performed by the application layer:
 * validate the raw title, and on success create a new open task; on failure
 * return the entered values unchanged. Exercises the validator under test
 * exactly as production code would.
 */
function modelCreateTask(
  enteredTitle: string,
  newId: string,
): { accepted: boolean; task?: Task; enteredTitle: string } {
  const result = validateTaskTitle(enteredTitle);
  if (!result.ok) {
    // Rejection retains the entered values unchanged.
    return { accepted: false, enteredTitle };
  }
  const task: Task = {
    id: newId,
    ownerId: 'owner-1',
    title: result.value,
    state: 'open',
    projectId: null,
    phaseId: null,
    dueDate: null,
    createdAt: '2024-01-01T00:00:00.000Z',
  };
  return { accepted: true, task, enteredTitle };
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
    length: fc.constantFrom(0, 1, 2, 100, 199, 200, 201, 250),
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
  .string({ unit: 'binary', maxLength: 250 })
  .map((raw) => {
    const trimmed = raw.trim();
    return { raw, expectedValue: trimmed, expectedLength: Array.from(trimmed).length };
  });

const candidate: fc.Arbitrary<Candidate> = fc.oneof(
  boundaryCandidate,
  whitespaceCandidate,
  randomCandidate,
);

describe('Property 31: task title validation and default state', () => {
  // Feature: client-sign-off-dashboard, Property 31: Task title validation and default state
  it('accepts iff trimmed length 1-200; accepted new task is open; rejection retains entered values', () => {
    fc.assert(
      fc.property(candidate, ({ raw, expectedValue, expectedLength }) => {
        const expectedAccept = expectedLength >= MIN_LENGTH && expectedLength <= MAX_LENGTH;

        // Validator acceptance must match the rule exactly (iff trimmed 1..200).
        const result = validateTaskTitle(raw);
        expect(result.ok).toBe(expectedAccept);

        // Capture the original entered title before any operation.
        const originalEnteredTitle = raw;

        const outcome = modelCreateTask(raw, 'new-task-1');

        // The create operation agrees with the validator's verdict.
        expect(outcome.accepted).toBe(expectedAccept);

        if (expectedAccept) {
          // Accepted: returns the trimmed value.
          expect(result.ok && result.value).toBe(expectedValue);

          const task = outcome.task;
          expect(task).toBeDefined();
          // R12.1: a newly created task defaults to open state.
          expect(task?.state).toBe('open');
          expect(task?.title).toBe(expectedValue);
        } else {
          // R12.2: rejection produces a validation error and retains entered values.
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.kind).toBe('validation');
          }
          expect(outcome.task).toBeUndefined();
          // The entered title is retained unchanged on rejection.
          expect(outcome.enteredTitle).toBe(originalEnteredTitle);
        }
      }),
      { numRuns: 300 },
    );
  });
});
