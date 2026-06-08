/**
 * Dashboard aggregation for the Client Sign-Off Dashboard.
 *
 * `buildDashboard` reduces a {@link WorkspaceSnapshot} (a plain, in-memory
 * view of the designer's data) into a {@link DashboardViewModel} that backs the
 * admin dashboard's summary cards, project status table, and "Waiting on
 * client" section.
 *
 * Every function in this module is pure: it reads its inputs, computes a
 * result, and never mutates its arguments or any shared state. It has no
 * Supabase (or other infrastructure) dependencies, so the aggregation is
 * deterministic and directly property-testable. Persistence concerns (loading
 * the snapshot) live in the application layer's `getDashboard`.
 *
 * Requirements covered:
 *  - 11.1 summary counts (active projects, waiting-for-feedback phases, overdue
 *    phases, open tasks), each non-negative.
 *  - 11.2 project status table for each active project (client name, current
 *    phase, status, latest comment, next action, due date).
 *  - 11.3 "No next action" sentinel when an active project has no open tasks.
 *  - 11.4 "Waiting on client" filter (phases Sent to Client / Waiting for
 *    Feedback).
 *
 * Backs correctness properties 26 (summary counts), 27 (project status table
 * aggregation), and 28 (waiting-on-client filter).
 */

import type {
  Client,
  Comment,
  ISODate,
  Phase,
  PhaseStatus,
  Project,
  Task,
  UUID,
} from '@/lib/domain/types';
import { sortOpenTasks, sortProjectsByName } from '@/lib/domain/ordering';
import { isOverdue } from '@/lib/domain/phase-status';

/**
 * Sentinel shown in the project status table's "next action" column when an
 * active project has no open tasks (Requirement 11.3).
 */
export const NO_NEXT_ACTION = 'No next action' as const;

/**
 * The phase statuses that mean a phase is awaiting client action and therefore
 * appears in the "Waiting on client" section (Requirement 11.4).
 */
const WAITING_ON_CLIENT_STATUSES: readonly PhaseStatus[] = [
  'Sent to Client',
  'Waiting for Feedback',
];

/**
 * An in-memory snapshot of the designer's workspace, sufficient to compute the
 * dashboard view model. Arrays are read-only because aggregation never mutates
 * them. The application layer assembles this from the repositories before
 * delegating to {@link buildDashboard}.
 */
export interface WorkspaceSnapshot {
  /** All clients owned by the designer. */
  clients: readonly Client[];
  /** All projects owned by the designer. */
  projects: readonly Project[];
  /** All phases across every project. */
  phases: readonly Phase[];
  /** All comments across every phase. */
  comments: readonly Comment[];
  /** All tasks owned by the designer. */
  tasks: readonly Task[];
}

/** Non-negative summary counts shown on the dashboard cards (Requirement 11.1). */
export interface DashboardSummary {
  /** Projects with at least one phase whose status is not `'Completed'`. */
  activeProjects: number;
  /** Phases whose status is `'Waiting for Feedback'`. */
  phasesWaitingForFeedback: number;
  /** Phases that are currently overdue (derived from due date and status). */
  overduePhases: number;
  /** Tasks whose state is `'open'`. */
  openTasks: number;
}

/**
 * One row of the project status table, describing an active project
 * (Requirements 11.2, 11.3).
 */
export interface ProjectStatusRow {
  projectId: UUID;
  projectName: string;
  /** Name of the associated client; empty string if the client is missing. */
  clientName: string;
  /** Id of the current phase (the lowest-ordinal phase that is not completed). */
  currentPhaseId: UUID;
  /** Title of the current phase. */
  currentPhaseTitle: string;
  /** Status of the current phase. */
  status: PhaseStatus;
  /** Due date of the current phase, or `null` when none is set. */
  dueDate: ISODate | null;
  /**
   * The most recent comment across the project's phases by creation timestamp,
   * or `null` when the project has no comments.
   */
  latestComment: Comment | null;
  /**
   * The title of the project's open task with the earliest due date, or
   * {@link NO_NEXT_ACTION} when the project has no open tasks.
   */
  nextAction: string;
}

/** The aggregated dashboard view model returned by {@link buildDashboard}. */
export interface DashboardViewModel {
  /** Summary card counts (Requirement 11.1). */
  summary: DashboardSummary;
  /**
   * One row per active project, ordered case-insensitively by project name
   * (Requirements 11.2, 11.3).
   */
  projectStatusTable: ProjectStatusRow[];
  /**
   * Phases awaiting client action: status `'Sent to Client'` or
   * `'Waiting for Feedback'` (Requirement 11.4).
   */
  waitingOnClient: Phase[];
}

/**
 * Parse an `'YYYY-MM-DD'` calendar date into a UTC `Date` at midnight.
 *
 * Anchoring at UTC midnight matches {@link isOverdue}, which compares phases by
 * their UTC calendar day, so overdue computation is timezone-stable.
 */
function parseIsoDate(date: ISODate): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

/** Phases belonging to a given project. */
function phasesOfProject(snapshot: WorkspaceSnapshot, projectId: UUID): Phase[] {
  return snapshot.phases.filter((phase) => phase.projectId === projectId);
}

/**
 * A project is active when it has at least one phase whose status is not
 * `'Completed'` (Requirement 11.1/11.2). A project with no phases, or whose
 * every phase is completed, is not active.
 */
function isProjectActive(phases: readonly Phase[]): boolean {
  return phases.some((phase) => phase.status !== 'Completed');
}

/**
 * The current phase of a project: the lowest-ordinal phase that is not
 * completed. Returns `null` only when no such phase exists (i.e. the project is
 * not active). The input is not mutated.
 */
function currentPhaseOf(phases: readonly Phase[]): Phase | null {
  return phases
    .filter((phase) => phase.status !== 'Completed')
    .reduce<Phase | null>((current, phase) => {
      if (current === null || phase.ordinal < current.ordinal) return phase;
      return current;
    }, null);
}

/**
 * The most recent comment among the given comments by creation timestamp, or
 * `null` when there are none. Ties resolve to the first comment encountered
 * that attains the maximum timestamp.
 */
function latestCommentOf(comments: readonly Comment[]): Comment | null {
  return comments.reduce<Comment | null>((latest, comment) => {
    if (latest === null || comment.createdAt > latest.createdAt) return comment;
    return latest;
  }, null);
}

/**
 * Whether a task belongs to a project, either by direct project reference or by
 * referencing one of the project's phases.
 */
function taskBelongsToProject(
  task: Task,
  projectId: UUID,
  phaseIds: ReadonlySet<UUID>,
): boolean {
  if (task.projectId === projectId) return true;
  return task.phaseId !== null && phaseIds.has(task.phaseId);
}

/**
 * Build the dashboard view model from a workspace snapshot.
 *
 * Pure and deterministic: the snapshot and `now` are read, never mutated, and
 * the returned arrays are freshly constructed.
 *
 * @param snapshot - The designer's workspace data.
 * @param now - The current instant, used to derive overdue phases.
 * @returns The aggregated {@link DashboardViewModel}.
 * @see Requirements 11.1, 11.2, 11.3, 11.4
 */
export function buildDashboard(
  snapshot: WorkspaceSnapshot,
  now: Date,
): DashboardViewModel {
  // Summary counts (Requirement 11.1). Each is a length/count, so non-negative
  // by construction.
  const activeProjects = snapshot.projects.filter((project) =>
    isProjectActive(phasesOfProject(snapshot, project.id)),
  );

  const phasesWaitingForFeedback = snapshot.phases.filter(
    (phase) => phase.status === 'Waiting for Feedback',
  ).length;

  const overduePhases = snapshot.phases.filter((phase) =>
    isOverdue(
      phase.dueDate === null ? null : parseIsoDate(phase.dueDate),
      phase.status,
      now,
    ),
  ).length;

  const openTasks = snapshot.tasks.filter((task) => task.state === 'open').length;

  const summary: DashboardSummary = {
    activeProjects: activeProjects.length,
    phasesWaitingForFeedback,
    overduePhases,
    openTasks,
  };

  // Project status table (Requirements 11.2, 11.3): exactly the active
  // projects, ordered case-insensitively by name for stable presentation.
  const clientNameById = new Map(
    snapshot.clients.map((client) => [client.id, client.name] as const),
  );

  const projectStatusTable: ProjectStatusRow[] = sortProjectsByName(activeProjects)
    .map((project) => {
      const projectPhases = phasesOfProject(snapshot, project.id);
      const currentPhase = currentPhaseOf(projectPhases);
      // Active projects always have a current phase; skip defensively if not.
      if (currentPhase === null) return null;

      const phaseIds = new Set(projectPhases.map((phase) => phase.id));

      const latestComment = latestCommentOf(
        snapshot.comments.filter((comment) => phaseIds.has(comment.phaseId)),
      );

      const projectOpenTasks = sortOpenTasks(
        snapshot.tasks.filter((task) =>
          taskBelongsToProject(task, project.id, phaseIds),
        ),
      );
      const earliestOpenTask = projectOpenTasks[0];
      const nextAction =
        earliestOpenTask !== undefined ? earliestOpenTask.title : NO_NEXT_ACTION;

      const row: ProjectStatusRow = {
        projectId: project.id,
        projectName: project.name,
        clientName: clientNameById.get(project.clientId) ?? '',
        currentPhaseId: currentPhase.id,
        currentPhaseTitle: currentPhase.title,
        status: currentPhase.status,
        dueDate: currentPhase.dueDate,
        latestComment,
        nextAction,
      };
      return row;
    })
    .filter((row): row is ProjectStatusRow => row !== null);

  // Waiting-on-client filter (Requirement 11.4): exactly the phases whose
  // status is Sent to Client or Waiting for Feedback.
  const waitingOnClient = snapshot.phases.filter((phase) =>
    WAITING_ON_CLIENT_STATUSES.includes(phase.status),
  );

  return { summary, projectStatusTable, waitingOnClient };
}
