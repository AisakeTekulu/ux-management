/**
 * Pure ordering helpers for the Client Sign-Off Dashboard domain layer.
 *
 * Every function here is pure: it never mutates its inputs and always returns a
 * new array. Sorting is performed on a defensive copy so callers can rely on
 * their original arrays being untouched. These helpers implement the ordering
 * rules described in the design's "Components and Interfaces → Domain Layer
 * (Ordering & aggregation)" section and back the following correctness
 * properties: 10 (checklist), 14 (comments), 22 (approval history), 29 (open
 * tasks), and 30 (activity timeline ordering/limit).
 *
 * Timestamp ordering relies on the fact that the `ISOTimestamp`/`ISODate`
 * string formats are lexicographically ordered the same as chronologically
 * (UTC ISO-8601 and `YYYY-MM-DD`), so plain string comparison is both correct
 * and deterministic across environments.
 *
 * This module has no Supabase (or other infrastructure) imports.
 */

import type {
  ActivityLog,
  Approval,
  ChecklistItem,
  Client,
  Comment,
  Project,
  Task,
} from '@/lib/domain/types';

/**
 * Number of most-recent activity-log entries shown in the dashboard's recent
 * activity timeline (Requirement 11.6).
 */
export const DASHBOARD_ACTIVITY_LIMIT = 20;

/**
 * Maximum number of activity-log entries shown in a project's activity timeline
 * (Requirement 13.4).
 */
export const PROJECT_ACTIVITY_LIMIT = 50;

/**
 * Compare two strings case-insensitively for ascending order.
 *
 * Lower-cases both operands and compares by code point, which is fully
 * deterministic (unlike locale-sensitive collation). Returns a negative number
 * when `a` sorts before `b`, positive when after, and `0` when equal.
 */
function compareNamesCaseInsensitive(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la < lb) return -1;
  if (la > lb) return 1;
  return 0;
}

/**
 * Compare two ISO timestamp/date strings for ascending (chronological) order.
 *
 * Plain lexicographic comparison is correct because the string formats are
 * monotonic with time.
 */
function compareTimestampAsc(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Sort clients in ascending order by name using case-insensitive comparison
 * (Requirement 2.5). Returns a new array; the input is not mutated. The sort is
 * stable, so clients whose names compare equal retain their relative order.
 */
export function sortClientsByName(clients: readonly Client[]): Client[] {
  return [...clients].sort((a, b) => compareNamesCaseInsensitive(a.name, b.name));
}

/**
 * Sort projects in ascending order by name using case-insensitive comparison
 * (Requirement 3.8). Returns a new array; the input is not mutated. The sort is
 * stable, so projects whose names compare equal retain their relative order.
 */
export function sortProjectsByName(projects: readonly Project[]): Project[] {
  return [...projects].sort((a, b) => compareNamesCaseInsensitive(a.name, b.name));
}

/**
 * Build the open-task list (Requirements 11.5, 12.3, 12.4).
 *
 * Includes only tasks in the `open` state, ordered by ascending due date, with
 * tasks that have no due date listed after all tasks that have one. Returns a
 * new array; the input is not mutated. The sort is stable, so tasks with equal
 * (or both-absent) due dates retain their relative order.
 */
export function sortOpenTasks(tasks: readonly Task[]): Task[] {
  return tasks
    .filter((task) => task.state === 'open')
    .sort((a, b) => {
      if (a.dueDate === null && b.dueDate === null) return 0;
      if (a.dueDate === null) return 1; // a (null) goes after b
      if (b.dueDate === null) return -1; // b (null) goes after a
      return compareTimestampAsc(a.dueDate, b.dueDate);
    });
}

/**
 * Order checklist items for display: ascending (non-decreasing) by creation
 * timestamp (Requirement 5.5, Property 10). Returns a new array; the input is
 * not mutated.
 */
export function orderChecklistItems(items: readonly ChecklistItem[]): ChecklistItem[] {
  return [...items].sort((a, b) => compareTimestampAsc(a.createdAt, b.createdAt));
}

/**
 * Order comments for display: ascending (non-decreasing) by creation timestamp,
 * i.e. oldest to newest (Requirement 7.6, Property 14). Returns a new array; the
 * input is not mutated.
 */
export function orderComments(comments: readonly Comment[]): Comment[] {
  return [...comments].sort((a, b) => compareTimestampAsc(a.createdAt, b.createdAt));
}

/**
 * Order approvals for the approval history: reverse chronological
 * (non-increasing) by approval timestamp (Requirement 9.8, Property 22). Returns
 * a new array; the input is not mutated.
 */
export function orderApprovalHistory(approvals: readonly Approval[]): Approval[] {
  return [...approvals].sort((a, b) => compareTimestampAsc(b.createdAt, a.createdAt));
}

/**
 * Order an activity timeline: the `limit` most recent entries, ordered reverse
 * chronological (non-increasing) by creation timestamp (Requirements 11.6, 13.4,
 * Property 30). Returns a new array; the input is not mutated.
 *
 * A non-positive `limit` yields an empty array; a `limit` at or beyond the
 * number of entries yields all entries (still ordered).
 */
export function orderActivityTimeline(
  entries: readonly ActivityLog[],
  limit: number,
): ActivityLog[] {
  const sorted = [...entries].sort((a, b) =>
    compareTimestampAsc(b.createdAt, a.createdAt),
  );
  if (limit <= 0) return [];
  return sorted.slice(0, limit);
}

/**
 * The 20 most recent activity-log entries for the dashboard's recent activity
 * timeline, reverse chronological (Requirement 11.6).
 */
export function dashboardActivityTimeline(
  entries: readonly ActivityLog[],
): ActivityLog[] {
  return orderActivityTimeline(entries, DASHBOARD_ACTIVITY_LIMIT);
}

/**
 * The 50 most recent activity-log entries for a project's activity timeline,
 * reverse chronological (Requirement 13.4).
 */
export function projectActivityTimeline(
  entries: readonly ActivityLog[],
): ActivityLog[] {
  return orderActivityTimeline(entries, PROJECT_ACTIVITY_LIMIT);
}
