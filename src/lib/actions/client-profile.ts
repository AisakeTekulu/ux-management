"use server";

/**
 * Client CRM profile Server Actions.
 *
 * Implements `updateClientProfile` for patching CRM fields on a client record
 * and `getClientProfileDetail` for fetching extended client detail including
 * linked projects, email history, and activity logs.
 *
 * _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 3.4_
 */

import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { validateClientFields } from "@/lib/domain/client-crm";
import type {
  Client,
  ClientCRMInput,
  ClientEmailHistory,
  Project,
  ActivityLog,
} from "@/lib/domain/types";
import {
  ok,
  err,
  appError,
  type Result,
  type ValidationError,
  type AppError,
} from "@/lib/domain/result";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input accepted by the updateClientProfile action. */
export type ClientProfileInput = Partial<ClientCRMInput>;

/**
 * Composite data returned by `getClientProfileDetail`.
 *
 * Includes the full client record with CRM fields, all linked projects,
 * email history (most recent first), and activity logs across the client's
 * projects.
 *
 * _Requirements: 2.1, 2.2, 2.3, 2.4, 3.4_
 */
export interface ClientProfileDetailData {
  client: Client;
  projects: Project[];
  emailHistory: ClientEmailHistory[];
  activityLogs: ActivityLog[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve the authenticated user's ID from the current session.
 * Returns an AppError if no session is present (unauthenticated).
 */
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
 * Update client CRM profile fields.
 *
 * Validates all provided fields using the domain-layer `validateClientFields`
 * function, verifies the client exists and belongs to the authenticated user,
 * and persists the update via the client repository.
 *
 * Returns the full updated Client record on success, or a ValidationError /
 * AppError on failure.
 *
 * _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
 */
export async function updateClientProfile(
  clientId: string,
  fields: ClientProfileInput
): Promise<Result<Client, AppError | ValidationError>> {
  // 1. Authenticate
  const authResult = await getAuthenticatedUserId();
  if (!authResult.ok) return authResult;
  const userId = authResult.value;

  // 2. Validate input fields using domain-layer validation
  const validationResult = validateClientFields(fields);
  if (!validationResult.ok) return validationResult;

  // 3. Persist update via repository
  try {
    const supabase = await createSupabaseClient();
    const repos = createSupabaseRepositories(supabase);

    // Verify the client exists and belongs to the authenticated user
    const existing = await repos.clients.findById(clientId);
    if (!existing) {
      return err(appError("not_found", "Client not found."));
    }
    if (existing.ownerId !== userId) {
      return err(appError("forbidden", "You do not own this client."));
    }

    // Update the client with the provided CRM fields
    const updated = await repos.clients.update(clientId, fields);
    if (!updated) {
      return err(appError("not_found", "Client not found."));
    }

    return ok(updated);
  } catch (error) {
    return err(
      appError(
        "internal",
        "Failed to update client profile. Please try again.",
        { cause: error instanceof Error ? error.message : String(error) }
      )
    );
  }
}


/**
 * Get extended client detail with CRM fields, linked projects, email history,
 * and activity log.
 *
 * Fetches the client record by ID (including all CRM fields), linked projects,
 * email history ordered by most recent first, and activity logs across the
 * client's projects (aggregated and sorted chronologically, most recent first).
 *
 * Returns `null` if the client is not found or does not belong to the
 * authenticated user.
 *
 * _Requirements: 2.1, 2.2, 2.3, 2.4, 3.4_
 */
export async function getClientProfileDetail(
  clientId: string
): Promise<ClientProfileDetailData | null> {
  // 1. Get authenticated user session
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const repos = createSupabaseRepositories(supabase);

  // 2. Fetch the client record by ID (including all CRM fields)
  const client = await repos.clients.findById(clientId);
  if (!client || client.ownerId !== user.id) return null;

  // 3. Fetch linked projects for this client
  const projects = await repos.projects.listByClient(client.id);

  // 4. Fetch email history for this client
  const emailHistory = await repos.emailHistory.listByClient(client.id);

  // 5. Fetch activity logs related to this client's projects
  const activityLogPromises = projects.map((project) =>
    repos.activityLogs.listByProject(project.id)
  );
  const activityLogArrays = await Promise.all(activityLogPromises);
  const activityLogs = activityLogArrays
    .flat()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

  // 6. Return composite data object
  return {
    client,
    projects,
    emailHistory,
    activityLogs,
  };
}
