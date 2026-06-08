import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { buildDashboard, type WorkspaceSnapshot } from '@/lib/domain/dashboard';
import type {
  Client,
  Comment,
  Phase,
  PhaseStatus,
  Project,
  Task,
  UUID,
  ISODate,
  ISOTimestamp,
} from '@/lib/domain/types';
import { isOverdue } from '@/lib/domain/phase-status';

/**
 * Property-based test for dashboard summary counts (design Property 26).
 *
 * The `buildDashboard` function computes summary counts from a
 * {@link WorkspaceSnapshot}. This property verifies that:
 *
 * 1. All summary counts are non-negative.
 * 2. Each count equals the independently recomputed value from the snapshot:
 *    - activeProjects = projects with at least one non-Completed phase
 *    - phasesWaitingForFeedback = phases with status 'Waiting for Feedback'
 *    - overduePhases = phases past due and not Approved/Completed
 *    - openTasks = tasks with state 'open'
 *
 * **Validates: Requirements 11.1**
 */

// Feature: client-sign-off-dashboard, Property 26: Dashboard summary counts

// --- Arbitraries ---

const ALL_STATUSES: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
];

const arbUUID: fc.Arbitrary<UUID> = fc.uuid();

const arbISOTimestamp: fc.Arbitrary<ISOTimestamp> = fc
  .integer({
    min: new Date('2020-01-01T00:00:00Z').getTime(),
    max: new Date('2030-12-31T23:59:59Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

const arbISODate: fc.Arbitrary<ISODate> = fc
  .integer({
    min: new Date('2020-01-01T00:00:00Z').getTime(),
    max: new Date('2030-12-31T23:59:59Z').getTime(),
  })
  .map((ms) => {
    const d = new Date(ms);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

const arbPhaseStatus: fc.Arbitrary<PhaseStatus> = fc.constantFrom(...ALL_STATUSES);

const arbNow: fc.Arbitrary<Date> = fc
  .integer({
    min: new Date('2020-01-01T00:00:00Z').getTime(),
    max: new Date('2030-12-31T23:59:59Z').getTime(),
  })
  .map((ms) => new Date(ms));

function arbClient(ownerId: UUID): fc.Arbitrary<Client> {
  return fc.record({
    id: arbUUID,
    ownerId: fc.constant(ownerId),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    status: fc.constant('active' as const),
    deletedAt: fc.constant(null),
    createdAt: arbISOTimestamp,
    fullName: fc.constant(null),
    businessName: fc.constant(null),
    primaryEmail: fc.constant(null),
    secondaryEmail: fc.constant(null),
    phone: fc.constant(null),
    website: fc.constant(null),
    location: fc.constant(null),
    preferredContactMethod: fc.constant('email' as const),
    notes: fc.constant(null),
  });
}

function arbProject(clientId: UUID, ownerId: UUID): fc.Arbitrary<Project> {
  return fc.record({
    id: arbUUID,
    clientId: fc.constant(clientId),
    ownerId: fc.constant(ownerId),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    createdAt: arbISOTimestamp,
  });
}

function arbPhase(projectId: UUID, ordinal: number): fc.Arbitrary<Phase> {
  return fc.record({
    id: arbUUID,
    projectId: fc.constant(projectId),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    ordinal: fc.constant(ordinal),
    description: fc.constant(''),
    internalNotes: fc.constant(''),
    status: arbPhaseStatus,
    dueDate: fc.oneof(fc.constant(null), arbISODate),
    approvedByName: fc.constant(null),
    approvedInitials: fc.constant(null),
    approvedAt: fc.constant(null),
    createdAt: arbISOTimestamp,
  });
}

function arbTask(ownerId: UUID, projectId: UUID | null, phaseId: UUID | null): fc.Arbitrary<Task> {
  return fc.record({
    id: arbUUID,
    ownerId: fc.constant(ownerId),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    state: fc.constantFrom('open' as const, 'complete' as const),
    projectId: fc.constant(projectId),
    phaseId: fc.constant(phaseId),
    dueDate: fc.oneof(fc.constant(null), arbISODate),
    createdAt: arbISOTimestamp,
  });
}

/**
 * Generate a complete WorkspaceSnapshot with projects that have phases in
 * various statuses and tasks in open/complete states.
 */
const arbWorkspaceSnapshot: fc.Arbitrary<WorkspaceSnapshot> = fc
  .record({
    ownerId: arbUUID,
    numProjects: fc.integer({ min: 0, max: 5 }),
  })
  .chain(({ ownerId, numProjects }) =>
    fc
      .tuple(
        // Generate clients (1 per project for simplicity, or at least 1)
        fc.array(arbClient(ownerId), { minLength: Math.max(1, numProjects), maxLength: Math.max(1, numProjects) }),
        fc.constant(numProjects),
        fc.constant(ownerId),
      )
      .chain(([clients, nProjects, owner]) => {
        // Generate projects, each linked to a client
        const projectArbs = Array.from({ length: nProjects }, (_, i) =>
          arbProject(clients[i % clients.length].id, owner),
        );
        return fc
          .tuple(
            fc.constant(clients),
            projectArbs.length > 0 ? fc.tuple(...projectArbs) : fc.constant([] as Project[]),
            fc.constant(owner),
          );
      })
      .chain(([clients, projects, ownerId]) => {
        // Generate 1-4 phases per project
        const phaseArbs = projects.flatMap((project, _pi) =>
          Array.from({ length: 0 }, () => null) // placeholder
        );
        // Use a more direct approach: generate phases per project
        return fc
          .tuple(
            fc.constant(clients),
            fc.constant(projects),
            // For each project, generate 1-4 phases
            ...projects.map((project) =>
              fc.integer({ min: 1, max: 4 }).chain((numPhases) =>
                fc.tuple(
                  ...Array.from({ length: numPhases }, (_, i) =>
                    arbPhase(project.id, i + 1),
                  ),
                ),
              ),
            ),
          )
          .chain((tuple) => {
            const [cls, projs, ...phaseArrays] = tuple as [Client[], Project[], ...Phase[][]];
            const allPhases = phaseArrays.flat();

            // Generate tasks: some linked to projects, some to phases
            const taskCount = fc.integer({ min: 0, max: 8 });
            return taskCount.chain((nTasks) => {
              const taskArbs = Array.from({ length: nTasks }, () => {
                // Randomly link to a project or phase
                if (projs.length === 0) {
                  return arbTask(ownerId, null, null);
                }
                const projIdx = Math.floor(Math.random() * projs.length);
                const projectPhases = allPhases.filter((p) => p.projectId === projs[projIdx].id);
                const phaseId = projectPhases.length > 0 ? projectPhases[0].id : null;
                return arbTask(ownerId, projs[projIdx].id, phaseId);
              });

              return fc.tuple(
                fc.constant(cls),
                fc.constant(projs),
                fc.constant(allPhases),
                fc.constant([] as Comment[]),
                taskArbs.length > 0 ? fc.tuple(...taskArbs) : fc.constant([] as Task[]),
              );
            });
          });
      })
      .map(([clients, projects, phases, comments, tasks]) => ({
        clients: clients as Client[],
        projects: projects as Project[],
        phases: phases as Phase[],
        comments: comments as Comment[],
        tasks: Array.isArray(tasks) ? (tasks as Task[]) : [],
      })),
  );

// --- Helpers for independent recomputation ---

function parseIsoDate(date: ISODate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function recomputeActiveProjects(snapshot: WorkspaceSnapshot): number {
  return snapshot.projects.filter((project) => {
    const projectPhases = snapshot.phases.filter((p) => p.projectId === project.id);
    return projectPhases.some((phase) => phase.status !== 'Completed');
  }).length;
}

function recomputeWaitingForFeedback(snapshot: WorkspaceSnapshot): number {
  return snapshot.phases.filter((phase) => phase.status === 'Waiting for Feedback').length;
}

function recomputeOverduePhases(snapshot: WorkspaceSnapshot, now: Date): number {
  return snapshot.phases.filter((phase) =>
    isOverdue(
      phase.dueDate === null ? null : parseIsoDate(phase.dueDate),
      phase.status,
      now,
    ),
  ).length;
}

function recomputeOpenTasks(snapshot: WorkspaceSnapshot): number {
  return snapshot.tasks.filter((task) => task.state === 'open').length;
}

// --- Property Test ---

describe('buildDashboard summary counts (Property 26)', () => {
  // Feature: client-sign-off-dashboard, Property 26: Dashboard summary counts
  it('counts equal recomputed values from snapshot and are non-negative', () => {
    fc.assert(
      fc.property(arbWorkspaceSnapshot, arbNow, (snapshot, now) => {
        const dashboard = buildDashboard(snapshot, now);
        const { summary } = dashboard;

        // All counts are non-negative
        expect(summary.activeProjects).toBeGreaterThanOrEqual(0);
        expect(summary.phasesWaitingForFeedback).toBeGreaterThanOrEqual(0);
        expect(summary.overduePhases).toBeGreaterThanOrEqual(0);
        expect(summary.openTasks).toBeGreaterThanOrEqual(0);

        // Each count equals the independently recomputed value
        expect(summary.activeProjects).toBe(recomputeActiveProjects(snapshot));
        expect(summary.phasesWaitingForFeedback).toBe(recomputeWaitingForFeedback(snapshot));
        expect(summary.overduePhases).toBe(recomputeOverduePhases(snapshot, now));
        expect(summary.openTasks).toBe(recomputeOpenTasks(snapshot));
      }),
      { numRuns: 100 },
    );
  });
});
