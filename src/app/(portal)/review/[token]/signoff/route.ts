/**
 * Portal sign-off POST Route Handler.
 *
 * Implements `POST /review/[token]/signoff` — the unauthenticated endpoint
 * through which a Client_Reviewer submits an approval (Approved or Changes
 * Requested) after entering their name and initials.
 *
 * Flow:
 * 1. Resolve the share link by token using the service-role client (bypasses
 *    RLS since the reviewer has no auth session).
 * 2. Validate the link is accessible (exists and not revoked); return the
 *    generic invalid-link response otherwise (R8.4, R9.9).
 * 3. Validate the sign-off inputs (name, initials, decision).
 * 4. Load the phase and its checklist items to build the approval snapshot.
 * 5. Build the approval + checklist snapshot via `buildApprovalOutcome`.
 * 6. Apply the phase status transition via `nextStatusOnApproval` (R10.4, R10.5).
 * 7. Create a change-request task when the decision is Changes Requested (R12.5).
 * 8. Record activity logs: approval_created (R13.2) and phase_status_changed (R13.3).
 * 9. Return the approval confirmation.
 *
 * _Requirements: 9.4, 9.5, 9.9, 10.4, 10.5, 12.5, 13.2, 13.3_
 */

import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import {
  isShareLinkAccessible,
  INVALID_LINK_MESSAGE,
  isPhaseAccessibleThroughLink,
} from "@/lib/domain/share-link";
import { buildApprovalOutcome } from "@/lib/domain/approval";
import { nextStatusOnApproval } from "@/lib/domain/phase-status";
import type { ApprovalDecision } from "@/lib/domain/types";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// POST /review/[token]/signoff
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  // Rate limit: 5 requests per minute per IP for sign-offs
  const ip = getClientIp(request);
  const { success: withinLimit } = rateLimit(ip, 5, 60_000);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const { token } = await params;

  // Generic invalid-link response (R8.4, R9.9) — indistinguishable for
  // nonexistent and revoked links.
  const invalidResponse = () =>
    NextResponse.json(
      { ok: false, message: INVALID_LINK_MESSAGE },
      { status: 403 }
    );

  try {
    // 1. Resolve the share link using the service-role client
    const supabase = createServiceRoleClient();
    const repos = createSupabaseRepositories(supabase);

    const link = await repos.shareLinks.findByToken(token);

    // 2. Validate the link is accessible
    if (!link || !isShareLinkAccessible(link)) {
      return invalidResponse();
    }

    // 3. Parse and validate the request body
    let body: { name?: string; initials?: string; decision?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const { name, initials, decision } = body;

    // Basic type checks before passing to domain validation
    if (typeof name !== "string" || typeof initials !== "string") {
      return NextResponse.json(
        { ok: false, message: "Name and initials are required." },
        { status: 400 }
      );
    }

    if (decision !== "Approved" && decision !== "Changes Requested") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Decision must be either 'Approved' or 'Changes Requested'.",
        },
        { status: 400 }
      );
    }

    const approvalDecision = decision as ApprovalDecision;

    // 4. Determine the target phase from the link scope
    let phaseId: string | null = null;

    if (link.scopeType === "phase") {
      phaseId = link.phaseId;
    } else {
      // For project-scoped links, the client must specify which phase
      // they are signing off on. For now, we use the first phase of the
      // project if not specified in the body.
      const bodyPhaseId = (body as Record<string, unknown>).phaseId;
      if (typeof bodyPhaseId === "string" && bodyPhaseId.trim().length > 0) {
        phaseId = bodyPhaseId.trim();
      } else {
        // Default to the first phase of the project
        const phases = await repos.phases.listByProject(link.projectId!);
        if (phases.length > 0) {
          // Sort by ordinal and pick the first
          const sorted = [...phases].sort((a, b) => a.ordinal - b.ordinal);
          phaseId = sorted[0]!.id;
        }
      }
    }

    if (!phaseId) {
      return invalidResponse();
    }

    // 5. Load the phase and verify it's accessible through this link
    const phase = await repos.phases.findById(phaseId);
    if (!phase) {
      return invalidResponse();
    }

    if (!isPhaseAccessibleThroughLink(link, phase)) {
      return invalidResponse();
    }

    // 6. Load checklist items for the snapshot
    const checklistItems = await repos.checklistItems.listByPhase(phaseId);

    // 7. Build the approval outcome (approval + optional change-request task)
    const now = new Date();
    const outcome = buildApprovalOutcome(
      {
        phaseId,
        decision: approvalDecision,
        name,
        initials,
      },
      checklistItems,
      {
        ownerId: link.ownerId,
        projectId: phase.projectId,
        phaseTitle: phase.title,
      },
      () => crypto.randomUUID(),
      now
    );

    if (!outcome.ok) {
      // Validation failed (name/initials invalid)
      return NextResponse.json(
        {
          ok: false,
          message: outcome.error.message,
          fields: outcome.error.fields,
        },
        { status: 422 }
      );
    }

    const { approval, tasks } = outcome.value;

    // 8. Persist the approval
    await repos.approvals.create({
      phaseId: approval.phaseId,
      decision: approval.decision,
      reviewerName: approval.reviewerName,
      reviewerInitials: approval.reviewerInitials,
      checklistSnapshot: approval.checklistSnapshot,
    });

    // 9. Apply the status transition (R10.4, R10.5)
    const previousStatus = phase.status;
    const newStatus = nextStatusOnApproval(approvalDecision);

    await repos.phases.update(phaseId, {
      status: newStatus,
      // If approved, record the approver details on the phase (R4.7)
      ...(approvalDecision === "Approved"
        ? {
            approvedByName: approval.reviewerName,
            approvedInitials: approval.reviewerInitials,
            approvedAt: approval.createdAt,
          }
        : {}),
    });

    // 10. Create change-request task if applicable (R12.5)
    for (const task of tasks) {
      await repos.tasks.create({
        ownerId: task.ownerId,
        title: task.title,
        state: task.state,
        projectId: task.projectId,
        phaseId: task.phaseId,
        dueDate: task.dueDate,
      });
    }

    // 11. Record activity logs (R13.2, R13.3)
    // Activity log: approval_created (R13.2)
    await repos.activityLogs.create({
      projectId: phase.projectId,
      type: "approval_created",
      actor: approval.reviewerName,
      detail: {
        approvalId: approval.id,
        phaseId: approval.phaseId,
        decision: approval.decision,
        reviewerName: approval.reviewerName,
      },
    });

    // Activity log: phase_status_changed (R13.3)
    if (previousStatus !== newStatus) {
      await repos.activityLogs.create({
        projectId: phase.projectId,
        type: "phase_status_changed",
        actor: approval.reviewerName,
        detail: {
          phaseId: phase.id,
          from: previousStatus,
          to: newStatus,
        },
      });
    }

    // 12. Return the approval confirmation (R9.6)
    return NextResponse.json(
      {
        ok: true,
        approval: {
          decision: approval.decision,
          reviewerName: approval.reviewerName,
          reviewerInitials: approval.reviewerInitials,
          timestamp: approval.createdAt,
          phaseId: approval.phaseId,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[POST /review/[token]/signoff] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
