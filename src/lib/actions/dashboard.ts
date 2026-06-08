"use server";

/**
 * Dashboard data Server Action (Requirement 11).
 *
 * Assembles the authenticated designer's workspace snapshot from the Supabase
 * repositories, delegates to the pure `buildDashboard` domain function, and
 * returns the resulting {@link DashboardViewModel} together with the 20 most
 * recent activity-log entries across all projects.
 *
 * Requirements covered:
 *  - 11.1 Summary counts (active projects, waiting-for-feedback, overdue, open tasks)
 *  - 11.2 Project status table
 *  - 11.3 "No next action" sentinel
 *  - 11.4 Waiting-on-client filter
 *  - 11.5 My next tasks (open tasks ordered by due date)
 *  - 11.6 Recent activity timeline (20 most recent entries)
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import {
  buildDashboard,
  type DashboardViewModel,
  type WorkspaceSnapshot,
} from "@/lib/domain/dashboard";
import { sortOpenTasks } from "@/lib/domain/ordering";
import type { ActivityLog, Task } from "@/lib/domain/types";

/** The maximum number of recent activity entries shown on the dashboard. */
const DASHBOARD_ACTIVITY_LIMIT = 20;

/**
 * The shape returned by {@link getDashboard}: the aggregated dashboard view
 * model plus the recent activity entries and the sorted open tasks list.
 */
export interface DashboardData {
  /** Aggregated dashboard view model (summary, project table, waiting-on-client). */
  dashboard: DashboardViewModel;
  /** The 20 most recent activity-log entries across all projects (reverse chronological). */
  recentActivity: ActivityLog[];
  /** Open tasks ordered by due date ascending, null-due last (Requirement 11.5). */
  openTasks: Task[];
}

/**
 * Load the authenticated designer's dashboard data.
 *
 * 1. Retrieves the current user session from Supabase Auth.
 * 2. Loads the workspace snapshot (clients, projects, phases, comments, tasks)
 *    via the owner-scoped repositories.
 * 3. Calls `buildDashboard(snapshot, now)` to compute summary counts, the
 *    project status table, and the waiting-on-client list.
 * 4. Loads the 20 most recent activity-log entries across all projects.
 * 5. Returns the combined result.
 *
 * Throws if the user is not authenticated (middleware should prevent this, but
 * defense-in-depth).
 */
export async function getDashboard(): Promise<DashboardData> {
  const supabase = await createClient();

  // 1. Get authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: no authenticated session");
  }

  const ownerId = user.id;
  const repos = createSupabaseRepositories(supabase);

  // 2. Load workspace snapshot in parallel
  const [clients, projects, tasks] = await Promise.all([
    repos.clients.listByOwner(ownerId),
    repos.projects.listByOwner(ownerId),
    repos.tasks.listByOwner(ownerId),
  ]);

  // Load phases and comments for all projects
  const phases = (
    await Promise.all(
      projects.map((project) => repos.phases.listByProject(project.id))
    )
  ).flat();

  const comments = (
    await Promise.all(
      phases.map((phase) => repos.comments.listByPhase(phase.id))
    )
  ).flat();

  // 3. Build the workspace snapshot and compute the dashboard view model
  const snapshot: WorkspaceSnapshot = {
    clients,
    projects,
    phases,
    comments,
    tasks,
  };

  const dashboard = buildDashboard(snapshot, new Date());

  // 4. Load the 20 most recent activity-log entries across all projects
  const activityByProject = await Promise.all(
    projects.map((project) =>
      repos.activityLogs.listByProject(project.id, DASHBOARD_ACTIVITY_LIMIT)
    )
  );

  // Merge all project activity entries, sort reverse-chronologically, take top 20
  const allActivity = activityByProject.flat();
  allActivity.sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0));
  const recentActivity = allActivity.slice(0, DASHBOARD_ACTIVITY_LIMIT);

  // 5. Compute sorted open tasks for the "My next tasks" section (R11.5)
  const openTasks = sortOpenTasks(tasks);

  return {
    dashboard,
    recentActivity,
    openTasks,
  };
}
