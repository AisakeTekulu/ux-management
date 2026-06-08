"use server";

/**
 * Checklist item Server Actions (Requirement 5).
 *
 * Implements add, update, delete, and toggle operations for checklist items
 * within a phase. Each action authenticates the session, validates input via
 * the domain validator, and delegates persistence to the Supabase repository.
 *
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 5.7_
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { validateChecklistText } from "@/lib/domain/validators";
import type { ChecklistItem } from "@/lib/domain/types";
import {
  type Result,
  type ValidationError,
  type AppError,
  appError,
  err,
  ok,
} from "@/lib/domain/result";

/**
 * Retrieve the authenticated user's ID from the current session.
 * Returns an AppError if no session is present.
 */
async function getSessionUserId(): Promise<Result<string, AppError>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  return ok(user.id);
}

/**
 * Add a new checklist item to a phase.
 *
 * Validates the text (trimmed, 1–500 characters) and creates the item with
 * a completion state of incomplete. (R5.1, R5.7)
 *
 * @param phaseId - The phase to add the item to.
 * @param text - The raw checklist item text.
 */
export async function addChecklistItem(
  phaseId: string,
  text: string,
): Promise<Result<ChecklistItem, ValidationError | AppError>> {
  const session = await getSessionUserId();
  if (!session.ok) return session;

  const validated = validateChecklistText(text);
  if (!validated.ok) return validated;

  const supabase = await createClient();
  const repos = createSupabaseRepositories(supabase);

  const item = await repos.checklistItems.create({
    phaseId,
    text: validated.value,
    complete: false,
  });

  return ok(item);
}

/**
 * Update an existing checklist item's text.
 *
 * Validates the new text if provided (trimmed, 1–500 characters). (R5.2)
 *
 * @param id - The checklist item ID.
 * @param patch - Fields to update. `text` is validated if provided.
 */
export async function updateChecklistItem(
  id: string,
  patch: { text?: string; complete?: boolean },
): Promise<Result<ChecklistItem, ValidationError | AppError>> {
  const session = await getSessionUserId();
  if (!session.ok) return session;

  // Validate text if it's being updated
  const updatePatch: { text?: string; complete?: boolean } = {};

  if (patch.text !== undefined) {
    const validated = validateChecklistText(patch.text);
    if (!validated.ok) return validated;
    updatePatch.text = validated.value;
  }

  if (patch.complete !== undefined) {
    updatePatch.complete = patch.complete;
  }

  const supabase = await createClient();
  const repos = createSupabaseRepositories(supabase);

  const updated = await repos.checklistItems.update(id, updatePatch);

  if (!updated) {
    return err(appError("not_found", "Checklist item not found."));
  }

  return ok(updated);
}

/**
 * Delete a checklist item from a phase. (R5.4)
 *
 * @param id - The checklist item ID to delete.
 */
export async function deleteChecklistItem(
  id: string,
): Promise<Result<void, AppError>> {
  const session = await getSessionUserId();
  if (!session.ok) return session;

  const supabase = await createClient();
  const repos = createSupabaseRepositories(supabase);

  const deleted = await repos.checklistItems.delete(id);

  if (!deleted) {
    return err(appError("not_found", "Checklist item not found."));
  }

  return ok(undefined);
}

/**
 * Toggle the completion state of a checklist item. (R5.3)
 *
 * Flips the `complete` boolean from its current value.
 *
 * @param id - The checklist item ID to toggle.
 */
export async function toggleChecklistItem(
  id: string,
): Promise<Result<ChecklistItem, AppError>> {
  const session = await getSessionUserId();
  if (!session.ok) return session;

  const supabase = await createClient();
  const repos = createSupabaseRepositories(supabase);

  // Fetch current state to flip the boolean
  const existing = await repos.checklistItems.findById(id);
  if (!existing) {
    return err(appError("not_found", "Checklist item not found."));
  }

  const updated = await repos.checklistItems.update(id, {
    complete: !existing.complete,
  });

  if (!updated) {
    return err(appError("not_found", "Checklist item not found."));
  }

  return ok(updated);
}
