"use server";

/**
 * Project management Server Actions (Requirements 3.1–3.7).
 *
 * Implements `createProject` and `updateProject` as authenticated Server
 * Actions. Each action:
 * 1. Obtains the authenticated user session (rejects if unauthenticated).
 * 2. Validates the project name via the domain validator.
 * 3. Checks for duplicate names among sibling projects under the same client.
 * 4. Persists the change through the repository layer.
 *
 * `createProject` additionally initializes the 10 default phases (R3.7) by
 * calling `initializeDefaultPhases` from the domain layer and persisting them
 * via `phases.createMany`.
 *
 * `updateProject` preserves existing phases — only the project name is updated
 * (R3.6).
 *
 * Both actions return `Result<Project, ValidationError | AppError>`.
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { validateProjectName, isProjectNameDuplicate } from "@/lib/domain/validators";
import { initializeDefaultPhases } from "@/lib/domain/phase-structure";
import {
  ok,
  err,
  appError,
  validationError,
  type Result,
  type ValidationError,
  type AppError,
} from "@/lib/domain/result";
import type { Project, UUID } from "@/lib/domain/types";
import type { NewPhase } from "@/lib/repositories/interfaces";

/**
 * Create a new project under a client, with duplicate-name guard and default
 * phase initialization (R3.1, R3.2, R3.3, R3.4, R3.5, R3.7).
 *
 * @param input - The project name and the owning client's id.
 * @returns The created project on success, or a validation/app error on failure.
 */
export async function createProject(input: {
  name: string;
  clientId: string;
}): Promise<Result<Project, ValidationError | AppError>> {
  // 1. Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  // 2. Validate client association (R3.3)
  if (!input.clientId || input.clientId.trim().length === 0) {
    return err(
      validationError("Client is required.", [
        { field: "clientId", message: "Client is required." },
      ])
    );
  }

  // 3. Validate project name (R3.1, R3.2, R3.4)
  const nameResult = validateProjectName(input.name);
  if (!nameResult.ok) {
    return nameResult;
  }
  const validatedName = nameResult.value;

  // 4. Check for duplicate name among siblings (R3.5)
  const repos = createSupabaseRepositories(supabase);
  const siblings = await repos.projects.listByClient(input.clientId);
  if (isProjectNameDuplicate(validatedName, siblings)) {
    return err(
      validationError(
        "A project with this name already exists for this client.",
        [
          {
            field: "name",
            message:
              "A project with this name already exists for this client.",
          },
        ]
      )
    );
  }

  // 5. Create the project
  const project = await repos.projects.create({
    clientId: input.clientId,
    ownerId: user.id,
    name: validatedName,
  });

  // 6. Initialize default phases (R3.7)
  const now = new Date().toISOString();
  const defaultPhases = initializeDefaultPhases(
    project.id,
    () => crypto.randomUUID(),
    now
  );

  // Convert domain Phase objects to NewPhase (omit id and createdAt for the
  // repository, which assigns them server-side).
  const newPhases: NewPhase[] = defaultPhases.map((phase) => ({
    projectId: phase.projectId,
    title: phase.title,
    ordinal: phase.ordinal,
    description: phase.description,
    internalNotes: phase.internalNotes,
    status: phase.status,
    dueDate: phase.dueDate,
    approvedByName: phase.approvedByName,
    approvedInitials: phase.approvedInitials,
    approvedAt: phase.approvedAt,
  }));

  await repos.phases.createMany(newPhases);

  return ok(project);
}

/**
 * Update an existing project's name, preserving its phases (R3.6).
 *
 * Validates the new name and checks for duplicates among sibling projects
 * under the same client (excluding the project being edited).
 *
 * @param id - The project id to update.
 * @param input - The new project name.
 * @returns The updated project on success, or a validation/app error on failure.
 */
export async function updateProject(
  id: UUID,
  input: { name: string }
): Promise<Result<Project, ValidationError | AppError>> {
  // 1. Authenticate
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  // 2. Validate project name (R3.4)
  const nameResult = validateProjectName(input.name);
  if (!nameResult.ok) {
    return nameResult;
  }
  const validatedName = nameResult.value;

  // 3. Fetch the existing project to verify ownership and get clientId
  const repos = createSupabaseRepositories(supabase);
  const existing = await repos.projects.findById(id);

  if (!existing) {
    return err(appError("not_found", "Project not found."));
  }

  if (existing.ownerId !== user.id) {
    return err(appError("forbidden", "You do not own this project."));
  }

  // 4. Check for duplicate name among siblings, excluding this project (R3.5)
  const siblings = await repos.projects.listByClient(existing.clientId);
  const siblingsExcludingSelf = siblings.filter((p) => p.id !== id);
  if (isProjectNameDuplicate(validatedName, siblingsExcludingSelf)) {
    return err(
      validationError(
        "A project with this name already exists for this client.",
        [
          {
            field: "name",
            message:
              "A project with this name already exists for this client.",
          },
        ]
      )
    );
  }

  // 5. Persist the name update (phases are untouched — R3.6)
  const updated = await repos.projects.update(id, { name: validatedName });

  if (!updated) {
    return err(appError("internal", "Failed to update project."));
  }

  return ok(updated);
}
