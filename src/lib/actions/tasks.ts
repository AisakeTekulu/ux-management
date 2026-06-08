"use server";

/**
 * Task management Server Actions (Requirements 12.1, 12.2, 12.3).
 *
 * Implements `createTask` and `completeTask` for the authenticated Designer.
 * Each action retrieves the current session, validates input through the domain
 * layer, delegates persistence to the Supabase task repository, and returns a
 * typed `Result`.
 *
 * Ordering (R12.3, R12.4) is preserved by the domain layer's `sortOpenTasks`
 * helper at query time — the actions here handle creation and state transitions
 * only.
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { validateTaskTitle } from "@/lib/domain/validators";
import {
  type Result,
  type ValidationError,
  type AppError,
  ok,
  err,
  appError,
} from "@/lib/domain/result";
import type { Task } from "@/lib/domain/types";
import { syncTaskToNotion, markTaskCompleteInNotion } from "@/lib/integrations/notion";

/**
 * Create a new task with an open state for the authenticated Designer.
 *
 * Validates the title via `validateTaskTitle` (trimmed 1..200 characters).
 * Optionally associates the task with a project and/or phase, and an optional
 * due date. The task is always created with state `'open'`.
 *
 * @param input - The task creation payload.
 * @returns The persisted task on success, or a validation/app error on failure.
 *
 * _Requirements: 12.1, 12.2_
 */
export async function createTask(input: {
  title: string;
  projectId?: string;
  phaseId?: string;
  dueDate?: string;
}): Promise<Result<Task, ValidationError | AppError>> {
  // Authenticate: retrieve the current session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  // Validate the task title through the domain validator.
  const titleResult = validateTaskTitle(input.title);
  if (!titleResult.ok) {
    return titleResult;
  }

  const repos = createSupabaseRepositories(supabase);

  // Persist the new task with state 'open'.
  const task = await repos.tasks.create({
    ownerId: user.id,
    title: titleResult.value,
    state: "open",
    projectId: input.projectId ?? null,
    phaseId: input.phaseId ?? null,
    dueDate: input.dueDate ?? null,
  });

  // Sync to Notion (fire-and-forget — non-blocking, best-effort)
  const project = input.projectId ? await repos.projects.findById(input.projectId) : null;
  const client = project ? await repos.clients.findById(project.clientId) : null;
  syncTaskToNotion({
    title: task.title,
    status: "Open",
    clientName: client?.name ?? "—",
    projectName: project?.name ?? "—",
    dueDate: task.dueDate,
  }).catch(() => {}); // Swallow — never fail the main action for Notion

  return ok(task);
}

/**
 * Mark an existing task as complete for the authenticated Designer.
 *
 * Sets the task's state to `'complete'`, which excludes it from the open tasks
 * list. The domain layer's ordering (`sortOpenTasks`) naturally filters
 * completed tasks out of the active view.
 *
 * @param id - The UUID of the task to complete.
 * @returns The updated task on success, or an app error on failure.
 *
 * _Requirements: 12.3_
 */
export async function completeTask(
  id: string,
): Promise<Result<Task, AppError>> {
  // Authenticate: retrieve the current session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  const repos = createSupabaseRepositories(supabase);

  // Verify the task exists before updating.
  const existing = await repos.tasks.findById(id);
  if (!existing) {
    return err(appError("not_found", "Task not found."));
  }

  // Update the task state to 'complete'.
  const updated = await repos.tasks.update(id, { state: "complete" });
  if (!updated) {
    return err(appError("not_found", "Task not found."));
  }

  // Sync completion to Notion (fire-and-forget)
  markTaskCompleteInNotion(updated.title).catch(() => {});

  return ok(updated);
}
