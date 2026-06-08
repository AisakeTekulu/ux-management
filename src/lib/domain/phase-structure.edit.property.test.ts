import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { applyProjectNameEdit } from '@/lib/domain/phase-structure';
import type { Phase, PhaseStatus, Project } from '@/lib/domain/types';

/**
 * Property-based test for project edit preserving phases (design Property 4).
 *
 * The `applyProjectNameEdit` function takes a project with its phases and a new
 * name, and returns a new ProjectWithPhases whose project carries the new name
 * while the phases remain deeply equal to the originals — identities, ordinals,
 * and all contents unchanged.
 *
 * This test generates projects with varying phase sets (0 to many phases, with
 * diverse statuses, descriptions, due dates, and approval data) and arbitrary
 * new names, then asserts that the phases array is deeply equal before and after
 * the edit.
 *
 * Validates: Requirements 3.6
 */

// Feature: client-sign-off-dashboard, Property 4: Project edit preserves phases

/** All valid phase statuses for generating realistic phase data. */
const phaseStatuses: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
];

/** Arbitrary UUID-like string generator. */
const arbUUID = fc.uuid();

/** Arbitrary ISO timestamp generator using integer milliseconds to avoid invalid dates. */
const arbTimestamp = fc
  .integer({
    min: new Date('2020-01-01T00:00:00Z').getTime(),
    max: new Date('2030-12-31T23:59:59Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

/** Arbitrary ISO date (YYYY-MM-DD) or null. */
const arbDueDate = fc.oneof(
  fc.constant(null),
  fc
    .integer({
      min: new Date('2020-01-01T00:00:00Z').getTime(),
      max: new Date('2030-12-31T23:59:59Z').getTime(),
    })
    .map((ms) => new Date(ms).toISOString().slice(0, 10)),
);

/** Arbitrary phase status. */
const arbPhaseStatus = fc.constantFrom(...phaseStatuses);

/** Arbitrary text up to 200 chars for descriptions/notes. */
const arbText = fc.string({ minLength: 0, maxLength: 200 });

/** Arbitrary phase title. */
const arbTitle = fc.string({ minLength: 1, maxLength: 50 });

/** Arbitrary approval data (either all null or all populated). */
const arbApprovalData = fc.oneof(
  fc.constant({
    approvedByName: null as string | null,
    approvedInitials: null as string | null,
    approvedAt: null as string | null,
  }),
  fc.tuple(
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.string({ minLength: 1, maxLength: 10 }),
    arbTimestamp,
  ).map(([name, initials, at]) => ({
    approvedByName: name,
    approvedInitials: initials,
    approvedAt: at,
  })),
);

/** Generate a single Phase with realistic, varied data. */
const arbPhase = (projectId: string): fc.Arbitrary<Phase> =>
  fc
    .tuple(
      arbUUID,
      arbTitle,
      fc.integer({ min: 1, max: 100 }),
      arbText,
      arbText,
      arbPhaseStatus,
      arbDueDate,
      arbApprovalData,
      arbTimestamp,
    )
    .map(
      ([id, title, ordinal, description, internalNotes, status, dueDate, approval, createdAt]) => ({
        id,
        projectId,
        title,
        ordinal,
        description,
        internalNotes,
        status,
        dueDate,
        ...approval,
        createdAt,
      }),
    );

/** Generate a Project. */
const arbProject: fc.Arbitrary<Project> = fc
  .tuple(arbUUID, arbUUID, arbUUID, fc.string({ minLength: 1, maxLength: 120 }), arbTimestamp)
  .map(([id, clientId, ownerId, name, createdAt]) => ({
    id,
    clientId,
    ownerId,
    name,
    createdAt,
  }));

/** Generate a project with a varying number of phases (0 to 15). */
const arbProjectWithPhases = arbProject.chain((project) =>
  fc
    .array(arbPhase(project.id), { minLength: 0, maxLength: 15 })
    .map((phases) => ({ project, phases })),
);

/** Arbitrary new name for the project edit. */
const arbNewName = fc.oneof(
  fc.string({ minLength: 1, maxLength: 120 }),
  fc.constantFrom('Renamed Project', 'New Name', '  trimmed  ', 'X'),
);

describe('applyProjectNameEdit (Property 4: Project edit preserves phases)', () => {
  // Feature: client-sign-off-dashboard, Property 4: Project edit preserves phases
  it('editing the name leaves phase identities, ordinals, and contents unchanged', () => {
    fc.assert(
      fc.property(arbProjectWithPhases, arbNewName, (current, newName) => {
        // Capture the original phases for comparison (deep copy to ensure no mutation)
        const originalPhases = current.phases.map((p) => ({ ...p }));

        const result = applyProjectNameEdit(current, newName);

        // The project name should be updated
        expect(result.project.name).toBe(newName);

        // The project's other fields should be preserved
        expect(result.project.id).toBe(current.project.id);
        expect(result.project.clientId).toBe(current.project.clientId);
        expect(result.project.ownerId).toBe(current.project.ownerId);
        expect(result.project.createdAt).toBe(current.project.createdAt);

        // Phases must be deeply equal — same length, same identities, ordinals, and contents
        expect(result.phases).toHaveLength(originalPhases.length);
        expect(result.phases).toEqual(originalPhases);

        // Verify the original input was not mutated
        expect(current.phases).toEqual(originalPhases);
      }),
      { numRuns: 200 },
    );
  });
});
