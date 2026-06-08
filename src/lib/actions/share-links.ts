"use server";

/**
 * Share-link management Server Actions (Requirements 8.1, 8.5, 10.2, 13.3).
 *
 * Implements `generateShareLink` and `revokeShareLink` as authenticated Server
 * Actions. Each action:
 * 1. Obtains the authenticated user session from the Supabase SSR client.
 * 2. Delegates token generation to the domain layer (`generateUniqueToken`
 *    with `webCryptoRandomSource`).
 * 3. Uses the Supabase repositories for persistence.
 * 4. Returns a `Result<ShareLink | void, AppError>` so the UI can surface
 *    errors appropriately.
 *
 * `generateShareLink` additionally:
 * - Updates the phase status to 'Sent to Client' via `nextStatusOnShare` (R10.2).
 * - Records a `phase_status_changed` activity-log entry (R13.3).
 *
 * `revokeShareLink` sets `revokedAt` to the current timestamp, denying all
 * subsequent access through that link within 5 seconds (R8.5).
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import {
  generateUniqueToken,
  webCryptoRandomSource,
} from "@/lib/domain/share-link";
import { nextStatusOnShare } from "@/lib/domain/phase-status";
import { canCreateShareLink } from "@/lib/domain/client-lifecycle";
import type { ShareLink, PhaseStatus } from "@/lib/domain/types";
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

/**
 * Retrieve the authenticated user's ID from the current session.
 * Returns an AppError if no session is present (unauthenticated).
 */
async function getAuthenticatedUserId(): Promise<Result<string, AppError>> {
  const supabase = await createClient();
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
 * Generate a new share link for a project or phase.
 *
 * Creates a unique, cryptographically-strong token (≥ 32 URL-safe characters),
 * persists the share_links record, updates the phase status to 'Sent to Client'
 * (R10.2), and records a phase_status_changed activity-log entry (R13.3).
 *
 * For project-scoped links, all phases of the project are transitioned.
 * For phase-scoped links, only the targeted phase is transitioned.
 *
 * _Requirements: 8.1, 8.5, 10.2, 13.3_
 */
export async function generateShareLink(scope: {
  type: "project" | "phase";
  id: string;
}): Promise<Result<ShareLink, AppError>> {
  // 1. Authenticate
  const authResult = await getAuthenticatedUserId();
  if (!authResult.ok) return authResult;
  const userId = authResult.value;

  try {
    const supabase = await createClient();
    const repos = createSupabaseRepositories(supabase);

    // 2. Resolve the scope and validate the target exists
    let projectId: string | null = null;
    let phaseId: string | null = null;
    let resolvedClientId: string | null = null;
    let phasesToTransition: Array<{ id: string; projectId: string; status: PhaseStatus }> = [];

    if (scope.type === "phase") {
      const phase = await repos.phases.findById(scope.id);
      if (!phase) {
        return err(appError("not_found", "Phase not found."));
      }
      phaseId = phase.id;
      // For a phase-scoped link, we need the projectId for the activity log
      projectId = null; // phase-scoped links don't set projectId on the share_links record
      phasesToTransition = [{ id: phase.id, projectId: phase.projectId, status: phase.status }];
      // Resolve clientId from the parent project
      const parentProject = await repos.projects.findById(phase.projectId);
      if (parentProject) resolvedClientId = parentProject.clientId;
    } else {
      const project = await repos.projects.findById(scope.id);
      if (!project) {
        return err(appError("not_found", "Project not found."));
      }
      projectId = project.id;
      phaseId = null;
      resolvedClientId = project.clientId;
      const phases = await repos.phases.listByProject(project.id);
      phasesToTransition = phases.map((p) => ({
        id: p.id,
        projectId: p.projectId,
        status: p.status,
      }));
    }

    // 3. Check client lifecycle guard — block archived/deleted clients
    if (resolvedClientId) {
      const client = await repos.clients.findById(resolvedClientId);
      if (client) {
        const linkGuard = canCreateShareLink(client);
        if (!linkGuard.ok) return linkGuard;
      }
    }

    // 4. Generate a unique token
    const existingLinks = await repos.shareLinks.listByOwner(userId);
    const existingTokens = existingLinks.map((link) => link.token);
    const token = generateUniqueToken(webCryptoRandomSource, existingTokens);

    // 5. Create the share_links record
    const shareLink = await repos.shareLinks.create({
      ownerId: userId,
      token,
      scopeType: scope.type,
      projectId,
      phaseId,
      revokedAt: null,
      firstAccessedAt: null,
    });

    // 6. Update phase status to 'Sent to Client' and record activity logs (R10.2, R13.3)
    for (const phase of phasesToTransition) {
      const previousStatus = phase.status;
      const newStatus = nextStatusOnShare(previousStatus);

      // Only update and log if the status actually changes
      if (previousStatus !== newStatus) {
        await repos.phases.update(phase.id, { status: newStatus });

        // Record phase_status_changed activity log (R13.3)
        await repos.activityLogs.create({
          projectId: phase.projectId,
          type: "phase_status_changed",
          actor: userId,
          detail: {
            phaseId: phase.id,
            from: previousStatus,
            to: newStatus,
          },
        });
      }
    }

    return ok(shareLink);
  } catch (error) {
    return err(
      appError("internal", "Failed to generate share link. Please try again.", {
        cause: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/**
 * Revoke an existing share link by setting its `revokedAt` timestamp to now.
 *
 * After revocation, all subsequent access through the link is denied (R8.5).
 * The link record is preserved for audit purposes; only the `revokedAt` field
 * is updated.
 *
 * _Requirements: 8.5_
 */
export async function revokeShareLink(
  id: string
): Promise<Result<void, AppError>> {
  // 1. Authenticate
  const authResult = await getAuthenticatedUserId();
  if (!authResult.ok) return authResult;

  try {
    const supabase = await createClient();
    const repos = createSupabaseRepositories(supabase);

    // 2. Verify the share link exists
    const existing = await repos.shareLinks.findById(id);
    if (!existing) {
      return err(appError("not_found", "Share link not found."));
    }

    // 3. Check if already revoked
    if (existing.revokedAt !== null) {
      return err(
        appError("invalid_state", "Share link has already been revoked.")
      );
    }

    // 4. Set revokedAt to now
    const revokedAt = new Date().toISOString();
    const updated = await repos.shareLinks.update(id, { revokedAt });

    if (!updated) {
      return err(appError("not_found", "Share link not found."));
    }

    return ok(undefined);
  } catch (error) {
    return err(
      appError("internal", "Failed to revoke share link. Please try again.", {
        cause: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
