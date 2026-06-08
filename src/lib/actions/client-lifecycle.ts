"use server";

/**
 * Client lifecycle Server Actions for archive, restore, delete profile,
 * and permanent delete operations.
 *
 * Each action authenticates, loads the client, validates ownership,
 * runs domain-layer guards, and delegates to the repository layer.
 *
 * _Requirements: 3.1, 4.1, 5.1–5.5, 6.1–6.5_
 */

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import {
  validateStatusTransition,
  canDeleteProfile,
  validateDeleteConfirmation,
} from "@/lib/domain/client-lifecycle";
import type { Client } from "@/lib/domain/types";
import {
  ok,
  err,
  appError,
  type Result,
  type AppError,
} from "@/lib/domain/result";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthenticatedUserId(): Promise<Result<string, AppError>> {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(
      appError("unauthorized", "You must be signed in to perform this action.")
    );
  }

  return ok(user.id);
}

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

/**
 * Archive an active client.
 *
 * Sets status from 'active' to 'archived'. All project history is preserved.
 * New share links are blocked while archived.
 *
 * _Requirements: 3.1, 3.4, 3.5_
 */
export async function archiveClient(
  id: string
): Promise<Result<Client, AppError>> {
  const authResult = await getAuthenticatedUserId();
  if (!authResult.ok) return authResult;
  const userId = authResult.value;

  try {
    const supabase = await createSupabaseClient();
    const repos = createSupabaseRepositories(supabase);

    const client = await repos.clients.findById(id);
    if (!client) {
      return err(appError("not_found", "Client not found."));
    }
    if (client.ownerId !== userId) {
      return err(appError("forbidden", "You do not own this client."));
    }

    const transition = validateStatusTransition(client.status, "archived");
    if (!transition.ok) return transition;

    const updated = await repos.clients.update(id, { status: "archived" });
    if (!updated) {
      return err(appError("not_found", "Client not found."));
    }

    return ok(updated);
  } catch (error) {
    return err(
      appError("internal", "Failed to archive client. Please try again.", {
        cause: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/**
 * Restore an archived client back to active.
 *
 * Sets status from 'archived' to 'active'. All project history and approvals
 * remain intact.
 *
 * _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
 */
export async function restoreClient(
  id: string
): Promise<Result<Client, AppError>> {
  const authResult = await getAuthenticatedUserId();
  if (!authResult.ok) return authResult;
  const userId = authResult.value;

  try {
    const supabase = await createSupabaseClient();
    const repos = createSupabaseRepositories(supabase);

    const client = await repos.clients.findById(id);
    if (!client) {
      return err(appError("not_found", "Client not found."));
    }
    if (client.ownerId !== userId) {
      return err(appError("forbidden", "You do not own this client."));
    }

    const transition = validateStatusTransition(client.status, "active");
    if (!transition.ok) return transition;

    const updated = await repos.clients.update(id, { status: "active" });
    if (!updated) {
      return err(appError("not_found", "Client not found."));
    }

    return ok(updated);
  } catch (error) {
    return err(
      appError("internal", "Failed to restore client. Please try again.", {
        cause: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/**
 * Delete a client's profile data while preserving project history.
 *
 * Sets the client name to 'Deleted Client', stamps deletedAt, and revokes
 * all active share links for the client's projects.
 *
 * _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
 */
export async function deleteClientProfile(
  id: string
): Promise<Result<void, AppError>> {
  const authResult = await getAuthenticatedUserId();
  if (!authResult.ok) return authResult;
  const userId = authResult.value;

  try {
    const supabase = await createSupabaseClient();
    const repos = createSupabaseRepositories(supabase);

    const client = await repos.clients.findById(id);
    if (!client) {
      return err(appError("not_found", "Client not found."));
    }
    if (client.ownerId !== userId) {
      return err(appError("forbidden", "You do not own this client."));
    }

    const guard = canDeleteProfile(client);
    if (!guard.ok) return guard;

    await repos.clients.deleteProfile(id);
    await repos.shareLinks.revokeByClient(id);

    return ok(undefined);
  } catch (error) {
    return err(
      appError(
        "internal",
        "Failed to delete client profile. Please try again.",
        { cause: error instanceof Error ? error.message : String(error) }
      )
    );
  }
}

/**
 * Permanently delete a client and all associated data (cascading).
 *
 * Requires the admin to type the exact client name as confirmation.
 * This is irreversible — all projects, phases, approvals, comments, tasks,
 * share links, and activity logs are removed.
 *
 * _Requirements: 6.1, 6.3, 6.5_
 */
export async function permanentDeleteClient(
  id: string,
  confirmation: string
): Promise<Result<void, AppError>> {
  const authResult = await getAuthenticatedUserId();
  if (!authResult.ok) return authResult;
  const userId = authResult.value;

  try {
    const supabase = await createSupabaseClient();
    const repos = createSupabaseRepositories(supabase);

    const client = await repos.clients.findById(id);
    if (!client) {
      return err(appError("not_found", "Client not found."));
    }
    if (client.ownerId !== userId) {
      return err(appError("forbidden", "You do not own this client."));
    }

    const confirmResult = validateDeleteConfirmation(client.name, confirmation);
    if (!confirmResult.ok) return confirmResult;

    const deleted = await repos.clients.delete(id);
    if (!deleted) {
      return err(appError("not_found", "Client not found."));
    }

    return ok(undefined);
  } catch (error) {
    return err(
      appError(
        "internal",
        "Failed to permanently delete client. Please try again.",
        { cause: error instanceof Error ? error.message : String(error) }
      )
    );
  }
}
