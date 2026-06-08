"use server";

/**
 * Phase management Server Actions (Requirements 4.4, 4.5, 4.6, 10.8, 10.9, 13.3).
 *
 * Implements `updatePhase`, `addPhase`, and `completePhase` as authenticated
 * Server Actions. Each action:
 * 1. Obtains the authenticated user session from the Supabase SSR client.
 * 2. Loads the target phase (or project) and validates ownership.
 * 3. Delegates to the appropriate domain function for validation/logic.
 * 4. Persists the change through the repository layer.
 * 5. Records activity-log entries where a status change occurs (R13.3).
 *
 * `updatePhase` — applies a partial field update (description, internalNotes,
 * dueDate) using `updatePhaseFields` from the domain layer (R4.4, R4.5).
 *
 * `addPhase` — appends a new phase to a project using `appendPhase` from the
 * domain layer, assigning it the next ordinal and Draft status (R4.6).
 *
 * `completePhase` — transitions an Approved phase to Completed using
 * `completePhase` from the phase-status domain module (R10.8, R10.9), and
 * records a `phase_status_changed` activity-log entry (R13.3).
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import {
  updatePhaseFields,
  appendPhase as domainAppendPhase,
  type PhaseFieldPatch,
} from "@/lib/domain/phase-structure";
import { completePhase as domainCompletePhase } from "@/lib/domain/phase-status";
import { buildPhaseStatusChangedLog } from "@/lib/domain/activity";
import type { Phase, UUID } from "@/lib/domain/types";
import {
  ok,
  err,
  appError,
  type Result,
  type ValidationError,
  type AppError,
} from "@/lib/domain/result";

// ---------------------------------------------------------------------------
// updatePhase (R4.4, R4.5)
// ---------------------------------------------------------------------------

/**
 * Update a phase's editable fields (description, internalNotes, dueDate).
 *
 * Validates the patch via the domain layer's `updatePhaseFields`, which rejects
 * text exceeding 5,000 characters or an invalid calendar date. On success,
 * persists the updated fields and returns the updated phase. On failure,
 * returns a ValidationError identifying each invalid field while retaining the
 * previously stored values.
 *
 * @param id - The phase id to update.
 * @param patch - The fields to update.
 * @returns The updated phase on success, or a validation/app error on failure.
 */
export async function updatePhase(
  id: UUID,
  patch: PhaseFieldPatch
): Promise<Result<Phase, ValidationError | AppError>> {
  // 1. Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  const repos = createSupabaseRepositories(supabase);

  // 2. Load the phase
  const phase = await repos.phases.findById(id);
  if (!phase) {
    return err(appError("not_found", "Phase not found."));
  }

  // 3. Verify ownership via the parent project
  const project = await repos.projects.findById(phase.projectId);
  if (!project || project.ownerId !== user.id) {
    return err(appError("forbidden", "You do not own this phase."));
  }

  // 4. Validate and apply the patch via the domain layer (R4.4, R4.5)
  const result = updatePhaseFields(phase, patch);
  if (!result.ok) {
    return result;
  }

  const updatedPhase = result.value;

  // 5. Persist only the changed fields
  const persistPatch: Record<string, unknown> = {};
  if (patch.description !== undefined) {
    persistPatch.description = updatedPhase.description;
  }
  if (patch.internalNotes !== undefined) {
    persistPatch.internalNotes = updatedPhase.internalNotes;
  }
  if (patch.dueDate !== undefined) {
    persistPatch.dueDate = updatedPhase.dueDate;
  }

  const persisted = await repos.phases.update(id, persistPatch);
  if (!persisted) {
    return err(appError("internal", "Failed to update phase."));
  }

  return ok(persisted);
}

// ---------------------------------------------------------------------------
// addPhase (R4.6)
// ---------------------------------------------------------------------------

/**
 * Append a new phase to a project as the last ordinal position with Draft
 * status (R4.6, R10.1).
 *
 * @param projectId - The project to add the phase to.
 * @param title - The title for the new phase.
 * @returns The created phase on success, or an app error on failure.
 */
export async function addPhase(
  projectId: UUID,
  title: string
): Promise<Result<Phase, AppError>> {
  // 1. Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  const repos = createSupabaseRepositories(supabase);

  // 2. Verify the project exists and is owned by the user
  const project = await repos.projects.findById(projectId);
  if (!project) {
    return err(appError("not_found", "Project not found."));
  }
  if (project.ownerId !== user.id) {
    return err(appError("forbidden", "You do not own this project."));
  }

  // 3. Load existing phases to determine the next ordinal
  const existingPhases = await repos.phases.listByProject(projectId);

  // 4. Build the new phase via the domain layer (R4.6, R10.1)
  const now = new Date().toISOString();
  const newPhase = domainAppendPhase(
    existingPhases,
    projectId,
    title,
    () => crypto.randomUUID(),
    now
  );

  // 5. Persist the new phase
  const created = await repos.phases.create({
    projectId: newPhase.projectId,
    title: newPhase.title,
    ordinal: newPhase.ordinal,
    description: newPhase.description,
    internalNotes: newPhase.internalNotes,
    status: newPhase.status,
    dueDate: newPhase.dueDate,
    approvedByName: newPhase.approvedByName,
    approvedInitials: newPhase.approvedInitials,
    approvedAt: newPhase.approvedAt,
  });

  return ok(created);
}

// ---------------------------------------------------------------------------
// completePhase (R10.8, R10.9, R13.3)
// ---------------------------------------------------------------------------

/**
 * Mark a phase as Completed. Only phases with status 'Approved' can be
 * completed (R10.8, R10.9). Records a `phase_status_changed` activity-log
 * entry on success (R13.3).
 *
 * @param id - The phase id to complete.
 * @returns The updated phase on success, or an app error on failure.
 */
export async function completePhase(
  id: UUID
): Promise<Result<Phase, AppError>> {
  // 1. Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  const repos = createSupabaseRepositories(supabase);

  // 2. Load the phase
  const phase = await repos.phases.findById(id);
  if (!phase) {
    return err(appError("not_found", "Phase not found."));
  }

  // 3. Verify ownership via the parent project
  const project = await repos.projects.findById(phase.projectId);
  if (!project || project.ownerId !== user.id) {
    return err(appError("forbidden", "You do not own this phase."));
  }

  // 4. Apply the Approved-only guard via the domain layer (R10.8, R10.9)
  const statusResult = domainCompletePhase(phase.status);
  if (!statusResult.ok) {
    return statusResult;
  }

  const newStatus = statusResult.value;
  const previousStatus = phase.status;

  // 5. Persist the status change
  const updated = await repos.phases.update(id, { status: newStatus });
  if (!updated) {
    return err(appError("internal", "Failed to complete phase."));
  }

  // 6. Record a phase_status_changed activity-log entry (R13.3)
  const activityLog = buildPhaseStatusChangedLog({
    id: crypto.randomUUID(),
    projectId: phase.projectId,
    actor: user.id,
    now: new Date(),
    phaseId: phase.id,
    from: previousStatus,
    to: newStatus,
  });

  await repos.activityLogs.create({
    projectId: activityLog.projectId,
    type: activityLog.type,
    actor: activityLog.actor,
    detail: activityLog.detail,
  });

  return ok(updated);
}
