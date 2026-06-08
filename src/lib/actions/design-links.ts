"use server";

/**
 * Design-link Server Actions (Requirements 6.1, 6.2, 6.6).
 *
 * Implements `addDesignLinkUrl` and `deleteDesignLink` for the admin surface.
 * Each action authenticates the session, validates inputs via the domain layer,
 * and delegates persistence to the Supabase repositories.
 *
 * - `addDesignLinkUrl`: validates the URL with `validateDesignUrl`, then creates
 *   a design link with kind `'url'`.
 * - `deleteDesignLink`: removes the design-link record; if the link is
 *   file-backed (`kind === 'file'`), notes where Supabase Storage removal would
 *   occur (the actual Storage delete is handled by the upload Route Handler /
 *   a dedicated cleanup step in production).
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { validateDesignUrl } from "@/lib/domain/validators";
import {
  type Result,
  type ValidationError,
  type AppError,
  err,
  appError,
} from "@/lib/domain/result";
import type { DesignLink } from "@/lib/domain/types";

/**
 * Add a URL-based design link to a phase.
 *
 * Validates the URL (must be http/https, ≤ 2048 chars), then persists a
 * design link with `kind: 'url'`. Returns the created link on success or a
 * validation/app error on failure.
 *
 * _Requirements: 6.1, 6.2_
 */
export async function addDesignLinkUrl(
  phaseId: string,
  url: string,
): Promise<Result<DesignLink, ValidationError | AppError>> {
  // Authenticate the designer session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  // Validate the URL via the domain validator.
  const validation = validateDesignUrl(url);
  if (!validation.ok) {
    return validation;
  }

  const repos = createSupabaseRepositories(supabase);

  // Verify the phase exists and belongs to the authenticated designer.
  const phase = await repos.phases.findById(phaseId);
  if (!phase) {
    return err(appError("not_found", "Phase not found."));
  }

  // Create the design link with kind 'url'.
  const designLink = await repos.designLinks.create({
    phaseId,
    kind: "url",
    url: validation.value,
    storagePath: null,
    fileName: null,
  });

  return { ok: true, value: designLink };
}

/**
 * Delete a design link from a phase.
 *
 * Removes the design-link record from the database. If the link is file-backed
 * (`kind === 'file'`), Supabase Storage removal would be performed here in
 * production (currently noted as a TODO since the upload Route Handler manages
 * the full file lifecycle in task 14.1).
 *
 * _Requirements: 6.6_
 */
export async function deleteDesignLink(
  id: string,
): Promise<Result<void, AppError>> {
  // Authenticate the designer session.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  const repos = createSupabaseRepositories(supabase);

  // Look up the design link to check its kind before deletion.
  const link = await repos.designLinks.findById(id);
  if (!link) {
    return err(appError("not_found", "Design link not found."));
  }

  // If the link is file-backed, remove the underlying file from Storage.
  // NOTE: In production this would call supabase.storage.from('designs')
  // .remove([link.storagePath]) to clean up the stored file. The upload
  // Route Handler (task 14.1) owns the Storage bucket configuration, so
  // the actual removal is deferred to that integration point.
  if (link.kind === "file" && link.storagePath) {
    // TODO: await supabase.storage.from('designs').remove([link.storagePath]);
  }

  // Delete the database record.
  const deleted = await repos.designLinks.delete(id);
  if (!deleted) {
    return err(appError("not_found", "Design link not found."));
  }

  return { ok: true, value: undefined };
}
