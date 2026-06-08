import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { buildDashboard } from '@/lib/domain/dashboard';
import type { WorkspaceSnapshot } from '@/lib/domain/dashboard';
import type {
  Client,
  Comment,
  Phase,
  PhaseStatus,
  Project,
  Task,
} from '@/lib/domain/types';

/**
 * Property-based test for the waiting-on-client filter (design Property 28).
 *
 * The `buildDashboard` function computes a `waitingOnClient` array that must
 * contain exactly the phases whose status is 'Sent to Client' or
 * 'Waiting for Feedback'. No other statuses should appear, and no qualifying
 * phase should be omitted.
 *
 * **Validates: Requirements 11.4**
 */

// Feature: client-sign-off-dashboard, Property 28: Waiting-on-client filter

const ALL_PHASE_STATUSES: PhaseStatus[] = [
  'Draft',
  'Sent to Client',
  'Waiting for Feedback',
  'Changes Requested',
  'Approved',
  'Completed',
];

const WAITING_STATUSES: PhaseStatus[] = ['Sent to Client', 'Waiting for Feedback'];

/** Generate a UUID-shaped string. */
const arbitraryUUID = fc.uuid().map((id) => id as string);

/** Generate an ISO timestamp string. */
const arbitraryTimestamp = fc
  .integer({
    min: new Date('2000-01-01T00:00:00Z').getTime(),
    max: new Date('2099-12-31T23:59:59Z').getTime(),
  })
  .map((ms) => new Date(ms).toISOString());

/** Generate an optional ISO date string (YYYY-MM-DD) or null. */
const arbitraryDueDate = fc.option(
  fc
    .integer({ min: 0, max: 36524 }) // days offset from 2000-01-01
    .map((days) => {
      const base = new Date('2000-01-01T00:00:00Z');
      base.setUTCDate(base.getUTCDate() + days);
      return base.toISOString().slice(0, 10);
    }),
  { nil: null },
);

/** Generate a phase status from all valid values. */
const arbitraryPhaseStatus: fc.Arbitrary<PhaseStatus> = fc.constantFrom(
  ...ALL_PHASE_STATUSES,
);

/** Generate a Phase with a given projectId and ordinal. */
function arbitraryPhase(projectId: string, ordinal: number): fc.Arbitrary<Phase> {
  return fc.record({
    id: arbitraryUUID,
    projectId: fc.constant(projectId),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    ordinal: fc.constant(ordinal),
    description: fc.constant(''),
    internalNotes: fc.constant(''),
    status: arbitraryPhaseStatus,
    dueDate: arbitraryDueDate,
    approvedByName: fc.constant(null),
    approvedInitials: fc.constant(null),
    approvedAt: fc.constant(null),
    createdAt: arbitraryTimestamp,
  });
}

/** Generate a WorkspaceSnapshot with phases in various statuses. */
const arbitrarySnapshot: fc.Arbitrary<WorkspaceSnapshot> = fc
  .record({
    ownerId: arbitraryUUID,
    clientId: arbitraryUUID,
    projectId: arbitraryUUID,
    clientName: fc.string({ minLength: 1, maxLength: 50 }),
    projectName: fc.string({ minLength: 1, maxLength: 50 }),
    phaseCount: fc.integer({ min: 0, max: 15 }),
    timestamp: arbitraryTimestamp,
  })
  .chain(({ ownerId, clientId, projectId, clientName, projectName, phaseCount, timestamp }) => {
    const client: Client = {
      id: clientId,
      ownerId,
      name: clientName,
      status: 'active',
      deletedAt: null,
      createdAt: timestamp,
      fullName: null,
      businessName: null,
      primaryEmail: null,
      secondaryEmail: null,
      phone: null,
      website: null,
      location: null,
      preferredContactMethod: 'email',
      notes: null,
    };

    const project: Project = {
      id: projectId,
      clientId,
      ownerId,
      name: projectName,
      createdAt: timestamp,
    };

    // Generate between 0 and phaseCount phases for this project
    const phasesArb =
      phaseCount === 0
        ? fc.constant([] as Phase[])
        : fc.tuple(
            ...Array.from({ length: phaseCount }, (_, i) =>
              arbitraryPhase(projectId, i + 1),
            ),
          );

    return phasesArb.map((phases) => {
      const snapshot: WorkspaceSnapshot = {
        clients: [client],
        projects: [project],
        phases,
        comments: [] as Comment[],
        tasks: [] as Task[],
      };
      return snapshot;
    });
  });

describe('buildDashboard waiting-on-client filter (Property 28)', () => {
  // Feature: client-sign-off-dashboard, Property 28: Waiting-on-client filter
  // Validates: Requirements 11.4
  it('waitingOnClient contains exactly phases with status Sent to Client or Waiting for Feedback', () => {
    fc.assert(
      fc.property(arbitrarySnapshot, (snapshot) => {
        const now = new Date();
        const result = buildDashboard(snapshot, now);

        // Compute expected: all phases whose status is one of the waiting statuses
        const expectedPhases = snapshot.phases.filter((phase) =>
          WAITING_STATUSES.includes(phase.status),
        );

        // The waitingOnClient array must contain exactly those phases
        expect(result.waitingOnClient).toHaveLength(expectedPhases.length);

        // Every phase in waitingOnClient must have a waiting status
        for (const phase of result.waitingOnClient) {
          expect(WAITING_STATUSES).toContain(phase.status);
        }

        // Every phase with a waiting status must appear in waitingOnClient
        const waitingIds = new Set(result.waitingOnClient.map((p) => p.id));
        for (const phase of expectedPhases) {
          expect(waitingIds.has(phase.id)).toBe(true);
        }

        // No phase with a non-waiting status should appear
        for (const phase of result.waitingOnClient) {
          expect(
            phase.status === 'Sent to Client' || phase.status === 'Waiting for Feedback',
          ).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
