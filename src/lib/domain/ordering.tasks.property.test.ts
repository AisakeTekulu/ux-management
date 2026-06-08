import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { sortOpenTasks } from '@/lib/domain/ordering';
import type { Task } from '@/lib/domain/types';

/**
 * Property-based test for open-task ordering (design Property 29).
 *
 * The `sortOpenTasks` function filters an array of tasks to include only those
 * in the 'open' state, then orders them by ascending due date with tasks that
 * have no due date (null) listed after all tasks that have one.
 *
 * This test generates arbitrary arrays of tasks (mix of open/complete, with and
 * without due dates) and asserts:
 * 1. The output contains only open tasks.
 * 2. The output is ordered ascending by dueDate with null-due tasks last.
 * 3. The output is a subset of the input (every output task exists in the input).
 */

// Feature: client-sign-off-dashboard, Property 29: Open-task ordering

/**
 * Generator for a valid ISO date string (YYYY-MM-DD).
 * Constrains to realistic date ranges for deterministic lexicographic ordering.
 */
const isoDateArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

/**
 * Generator for a Task with configurable state and optional due date.
 */
const taskArb: fc.Arbitrary<Task> = fc
  .tuple(
    fc.uuid(),
    fc.uuid(),
    fc.string({ minLength: 1, maxLength: 50 }),
    fc.constantFrom<Task['state']>('open', 'complete'),
    fc.option(isoDateArb, { nil: null }),
    fc.option(fc.uuid(), { nil: null }),
    fc.option(fc.uuid(), { nil: null }),
  )
  .map(([id, ownerId, title, state, dueDate, projectId, phaseId]) => ({
    id,
    ownerId,
    title,
    state,
    projectId,
    phaseId,
    dueDate,
    createdAt: '2024-01-01T00:00:00.000Z',
  }));

describe('sortOpenTasks (Property 29)', () => {
  // Feature: client-sign-off-dashboard, Property 29: Open-task ordering
  // Validates: Requirements 11.5, 12.3, 12.4
  it('returns only open tasks, ascending due date, null-due tasks last, and output is a subset of input', () => {
    fc.assert(
      fc.property(fc.array(taskArb, { minLength: 0, maxLength: 30 }), (tasks) => {
        const result = sortOpenTasks(tasks);

        // 1. Output contains only open tasks (R12.3: complete tasks excluded)
        for (const task of result) {
          expect(task.state).toBe('open');
        }

        // 2. Output is ordered ascending by dueDate with null-due tasks last (R11.5, R12.4)
        for (let i = 1; i < result.length; i++) {
          const prev = result[i - 1];
          const curr = result[i];

          if (prev.dueDate === null) {
            // If previous has null due date, current must also have null due date
            // (null-due tasks are grouped at the end)
            expect(curr.dueDate).toBeNull();
          } else if (curr.dueDate !== null) {
            // Both have due dates: ascending order
            expect(prev.dueDate! <= curr.dueDate!).toBe(true);
          }
          // If prev has a date and curr is null, that's valid (null goes last)
        }

        // 3. Output is a subset of the input (every output task exists in the input)
        const inputIds = new Set(tasks.map((t) => t.id));
        for (const task of result) {
          expect(inputIds.has(task.id)).toBe(true);
        }

        // 4. Output contains ALL open tasks from the input (completeness)
        const openInputCount = tasks.filter((t) => t.state === 'open').length;
        expect(result.length).toBe(openInputCount);
      }),
      { numRuns: 100 },
    );
  });
});
