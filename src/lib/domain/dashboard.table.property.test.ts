import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { buildDashboard, NO_NEXT_ACTION } from '@/lib/domain/dashboard';
import type { WorkspaceSnapshot } from '@/lib/domain/dashboard';
import type {
  Client,
  Comment,
  Phase,
  PhaseStatus,
  Project,
  Task,
  UUID,
} from '@/lib/domain/types';

/**
 * Property-based test for project status table aggregation (design Property 27).
 *
 * The project status table produced by `buildDashboard` must contain exactly the
 * active projects (projects with at least one phase whose status is not
 * Completed). For each row, the test verifies:
 *
 * - `latestComment` is the most recent comment by `createdAt` across the
 *   project's phases (or `null` when none exist).
 * - `nextAction` is the title of the earliest-due open task belonging to the
 *   project, or `"No next action"` when no open tasks exist.
 * - `clientName` matches the associated client's name.
 * - `currentPhaseTitle` is the title of the lowest-ordinal non-completed phase.
 * - `status` is the status of that current phase.
 * - `dueDate` is the due date of that current phase.
 *
 * **Validates: Requirements 11.2, 11.3**
 */

// Feature: client-sign-off-dashboard, Property 27: Project status table aggregation

// --- Arbitraries ---

const ALL_STATUSES: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
];

const NON_COMPLETED_STATUSES: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
];

let idCounter = 0;
function nextId(): UUID {
  return `uuid-${++idCounter}`;
}

function resetIds(): void {
  idCounter = 0;
}

const arbPhaseStatus: fc.Arbitrary<PhaseStatus> = fc.constantFrom(...ALL_STATUSES);

const arbNonCompletedStatus: fc.Arbitrary<PhaseStatus> = fc.constantFrom(
  ...NON_COMPLETED_STATUSES,
);

const arbISOTimestamp: fc.Arbitrary<string> = fc
  .integer({ min: 1577836800000, max: 1893456000000 }) // 2020-01-01 to 2030-01-01
  .map((ms) => new Date(ms).toISOString());

const arbISODate: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc
    .integer({ min: 18262, max: 21915 }) // days since epoch: ~2020 to ~2030
    .map((days) => {
      const d = new Date(days * 86400000);
      return d.toISOString().slice(0, 10);
    }),
);

const arbNonNullISODate: fc.Arbitrary<string> = fc
  .integer({ min: 18262, max: 21915 })
  .map((days) => {
    const d = new Date(days * 86400000);
    return d.toISOString().slice(0, 10);
  });

const arbName: fc.Arbitrary<string> = fc.string({ minLength: 1, maxLength: 50 });

/**
 * Generate a WorkspaceSnapshot with a controlled mix of active and inactive
 * projects, phases, comments, and tasks.
 */
const arbWorkspaceSnapshot: fc.Arbitrary<WorkspaceSnapshot> = fc
  .record({
    numClients: fc.integer({ min: 1, max: 4 }),
    numProjectsPerClient: fc.integer({ min: 1, max: 3 }),
    numPhasesPerProject: fc.integer({ min: 1, max: 5 }),
    numCommentsPerPhase: fc.integer({ min: 0, max: 3 }),
    numTasksPerProject: fc.integer({ min: 0, max: 4 }),
    // Whether some projects should be fully completed (inactive)
    inactiveProjectRatio: fc.double({ min: 0, max: 0.5 }),
    timestamps: fc.array(arbISOTimestamp, { minLength: 50, maxLength: 50 }),
    names: fc.array(arbName, { minLength: 20, maxLength: 20 }),
    dueDates: fc.array(arbISODate, { minLength: 20, maxLength: 20 }),
    taskDueDates: fc.array(arbISODate, { minLength: 20, maxLength: 20 }),
    taskStates: fc.array(fc.constantFrom('open' as const, 'complete' as const), {
      minLength: 20,
      maxLength: 20,
    }),
    phaseStatuses: fc.array(arbPhaseStatus, { minLength: 20, maxLength: 20 }),
  })
  .map((params) => {
    resetIds();
    const clients: Client[] = [];
    const projects: Project[] = [];
    const phases: Phase[] = [];
    const comments: Comment[] = [];
    const tasks: Task[] = [];

    const ownerId = nextId();
    let tsIdx = 0;
    let nameIdx = 0;
    let dueDateIdx = 0;
    let taskDueDateIdx = 0;
    let taskStateIdx = 0;
    let phaseStatusIdx = 0;

    const getTs = () => params.timestamps[tsIdx++ % params.timestamps.length];
    const getName = () => params.names[nameIdx++ % params.names.length];
    const getDueDate = () => params.dueDates[dueDateIdx++ % params.dueDates.length];
    const getTaskDueDate = () =>
      params.taskDueDates[taskDueDateIdx++ % params.taskDueDates.length];
    const getTaskState = () =>
      params.taskStates[taskStateIdx++ % params.taskStates.length];
    const getPhaseStatus = () =>
      params.phaseStatuses[phaseStatusIdx++ % params.phaseStatuses.length];

    for (let ci = 0; ci < params.numClients; ci++) {
      const clientId = nextId();
      clients.push({
        id: clientId,
        ownerId,
        name: `Client-${getName()}`,
        createdAt: getTs(),
      });

      for (let pi = 0; pi < params.numProjectsPerClient; pi++) {
        const projectId = nextId();
        const isInactive =
          Math.random() < params.inactiveProjectRatio;

        projects.push({
          id: projectId,
          clientId,
          ownerId,
          name: `Project-${getName()}`,
          createdAt: getTs(),
        });

        for (let phi = 0; phi < params.numPhasesPerProject; phi++) {
          const phaseId = nextId();
          // If project should be inactive, make all phases Completed
          const status: PhaseStatus = isInactive ? 'Completed' : getPhaseStatus();

          phases.push({
            id: phaseId,
            projectId,
            title: `Phase-${getName()}`,
            ordinal: phi + 1,
            description: '',
            internalNotes: '',
            status,
            dueDate: getDueDate(),
            approvedByName: null,
            approvedInitials: null,
            approvedAt: null,
            createdAt: getTs(),
          });

          // Add comments to this phase
          for (let cmi = 0; cmi < params.numCommentsPerPhase; cmi++) {
            comments.push({
              id: nextId(),
              phaseId,
              authorType: 'designer',
              authorUserId: ownerId,
              authorName: null,
              text: `Comment text ${cmi}`,
              createdAt: getTs(),
            });
          }
        }

        // Add tasks for this project
        for (let ti = 0; ti < params.numTasksPerProject; ti++) {
          const taskState = getTaskState();
          tasks.push({
            id: nextId(),
            ownerId,
            title: `Task-${getName()}`,
            state: taskState,
            projectId,
            phaseId: null,
            dueDate: getTaskDueDate(),
            createdAt: getTs(),
          });
        }
      }
    }

    return { clients, projects, phases, comments, tasks } as WorkspaceSnapshot;
  });

// --- Oracle helpers ---

function isProjectActive(phases: readonly Phase[]): boolean {
  return phases.some((p) => p.status !== 'Completed');
}

function getProjectPhases(
  snapshot: WorkspaceSnapshot,
  projectId: UUID,
): Phase[] {
  return snapshot.phases.filter((p) => p.projectId === projectId);
}

function getCurrentPhase(phases: readonly Phase[]): Phase | null {
  return phases
    .filter((p) => p.status !== 'Completed')
    .reduce<Phase | null>((best, p) => {
      if (best === null || p.ordinal < best.ordinal) return p;
      return best;
    }, null);
}

function getLatestComment(
  snapshot: WorkspaceSnapshot,
  projectId: UUID,
): Comment | null {
  const phaseIds = new Set(
    snapshot.phases
      .filter((p) => p.projectId === projectId)
      .map((p) => p.id),
  );
  const projectComments = snapshot.comments.filter((c) => phaseIds.has(c.phaseId));
  return projectComments.reduce<Comment | null>((latest, c) => {
    if (latest === null || c.createdAt > latest.createdAt) return c;
    return latest;
  }, null);
}

function getNextAction(
  snapshot: WorkspaceSnapshot,
  projectId: UUID,
  phaseIds: ReadonlySet<UUID>,
): string {
  const projectTasks = snapshot.tasks.filter(
    (t) =>
      t.state === 'open' &&
      (t.projectId === projectId ||
        (t.phaseId !== null && phaseIds.has(t.phaseId))),
  );

  // Sort: ascending due date, null-due last
  const sorted = [...projectTasks].sort((a, b) => {
    if (a.dueDate === null && b.dueDate === null) return 0;
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    if (a.dueDate < b.dueDate) return -1;
    if (a.dueDate > b.dueDate) return 1;
    return 0;
  });

  return sorted.length > 0 ? sorted[0].title : NO_NEXT_ACTION;
}

// --- Test ---

describe('buildDashboard – project status table (Property 27)', () => {
  // Feature: client-sign-off-dashboard, Property 27: Project status table aggregation
  it('contains exactly active projects with correct latest comment, next action, client, current phase, status, and due date', () => {
    fc.assert(
      fc.property(arbWorkspaceSnapshot, (snapshot) => {
        const now = new Date('2025-06-15T12:00:00Z');
        const result = buildDashboard(snapshot, now);

        // Determine expected active projects
        const expectedActiveProjectIds = snapshot.projects
          .filter((p) => isProjectActive(getProjectPhases(snapshot, p.id)))
          .map((p) => p.id);

        // The table should contain exactly the active projects
        const tableProjectIds = result.projectStatusTable.map((r) => r.projectId);
        expect(new Set(tableProjectIds)).toEqual(new Set(expectedActiveProjectIds));
        expect(tableProjectIds.length).toBe(expectedActiveProjectIds.length);

        // Verify each row
        for (const row of result.projectStatusTable) {
          const project = snapshot.projects.find((p) => p.id === row.projectId)!;
          const projectPhases = getProjectPhases(snapshot, project.id);
          const currentPhase = getCurrentPhase(projectPhases)!;
          const phaseIds = new Set(projectPhases.map((p) => p.id));

          // Client name
          const client = snapshot.clients.find((c) => c.id === project.clientId);
          expect(row.clientName).toBe(client ? client.name : '');

          // Current phase
          expect(row.currentPhaseId).toBe(currentPhase.id);
          expect(row.currentPhaseTitle).toBe(currentPhase.title);

          // Status
          expect(row.status).toBe(currentPhase.status);

          // Due date
          expect(row.dueDate).toBe(currentPhase.dueDate);

          // Latest comment
          const expectedLatestComment = getLatestComment(snapshot, project.id);
          if (expectedLatestComment === null) {
            expect(row.latestComment).toBeNull();
          } else {
            expect(row.latestComment).not.toBeNull();
            expect(row.latestComment!.id).toBe(expectedLatestComment.id);
            expect(row.latestComment!.createdAt).toBe(expectedLatestComment.createdAt);
          }

          // Next action
          const expectedNextAction = getNextAction(snapshot, project.id, phaseIds);
          expect(row.nextAction).toBe(expectedNextAction);
        }
      }),
      { numRuns: 100 },
    );
  });
});
