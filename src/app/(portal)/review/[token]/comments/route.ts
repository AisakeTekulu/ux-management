import "server-only";

/**
 * Portal comment POST handler.
 *
 * Implements `POST /review/[token]/comments` — allows a Client_Reviewer to add
 * a comment through a valid, non-revoked share link. The comment is attributed
 * to the reviewer (authorType 'reviewer') and a `comment_created` activity-log
 * entry is recorded.
 *
 * Uses the service-role Supabase client (bypasses RLS) because the reviewer is
 * unauthenticated. Scope enforcement and link validation are performed in code.
 *
 * _Requirements: 7.2, 7.5, 13.1_
 */

import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { validateCommentText } from "@/lib/domain/validators";
import {
  isShareLinkAccessible,
  isPhaseAccessibleThroughLink,
  INVALID_LINK_MESSAGE,
} from "@/lib/domain/share-link";
import { buildCommentCreatedLog } from "@/lib/domain/activity";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// ---------------------------------------------------------------------------
// POST /review/[token]/comments
// ---------------------------------------------------------------------------

/**
 * Add a reviewer comment on the phase accessible through the share link.
 *
 * Request body (JSON):
 * ```json
 * { "text": "string", "reviewerName": "string" }
 * ```
 *
 * Responses:
 * - 201: Comment created successfully.
 * - 400: Validation error (empty/too-long text, missing reviewerName).
 * - 403: Link invalid, revoked, or phase not in scope (generic message).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  // Rate limit: 10 requests per minute per IP
  const ip = getClientIp(request);
  const { success: withinLimit } = rateLimit(ip, 10, 60_000);
  if (!withinLimit) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    );
  }

  const { token } = await params;

  // 1. Resolve the share link using the service-role client
  const supabase = createServiceRoleClient();
  const repos = createSupabaseRepositories(supabase);

  const link = await repos.shareLinks.findByToken(token);

  // 2. Validate the link is accessible (exists and not revoked) — R7.5, R8.4
  if (!link || !isShareLinkAccessible(link)) {
    return NextResponse.json(
      { ok: false, message: INVALID_LINK_MESSAGE },
      { status: 403 },
    );
  }

  // 3. Parse the request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid request body." },
      { status: 400 },
    );
  }

  const { text, reviewerName } = (body ?? {}) as {
    text?: string;
    reviewerName?: string;
  };

  // 4. Validate reviewer name is present
  if (!reviewerName || typeof reviewerName !== "string" || reviewerName.trim() === "") {
    return NextResponse.json(
      { ok: false, message: "Reviewer name is required." },
      { status: 400 },
    );
  }

  // 5. Validate comment text — R7.2
  const validation = validateCommentText(text ?? "");
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, message: validation.error.message, fields: validation.error.fields },
      { status: 400 },
    );
  }
  const validatedText = validation.value;

  // 6. Determine the target phase from the link scope
  //    For phase-scoped links: the single phase in scope.
  //    For project-scoped links: we need a phaseId in the body to know which
  //    phase the comment targets.
  let targetPhaseId: string;

  if (link.scopeType === "phase") {
    if (!link.phaseId) {
      return NextResponse.json(
        { ok: false, message: INVALID_LINK_MESSAGE },
        { status: 403 },
      );
    }
    targetPhaseId = link.phaseId;
  } else {
    // Project-scoped link: require phaseId in body
    const { phaseId } = (body as { phaseId?: string }) ?? {};
    if (!phaseId || typeof phaseId !== "string") {
      return NextResponse.json(
        { ok: false, message: "Phase ID is required for project-scoped links." },
        { status: 400 },
      );
    }
    targetPhaseId = phaseId;
  }

  // 7. Load the target phase and verify it's accessible through the link — R7.5
  const phase = await repos.phases.findById(targetPhaseId);
  if (!phase || !isPhaseAccessibleThroughLink(link, phase)) {
    return NextResponse.json(
      { ok: false, message: INVALID_LINK_MESSAGE },
      { status: 403 },
    );
  }

  // 8. Create the comment attributed to the reviewer — R7.2
  const comment = await repos.comments.create({
    phaseId: phase.id,
    authorType: "reviewer",
    authorUserId: null,
    authorName: reviewerName.trim(),
    text: validatedText,
  });

  // 9. Record a comment_created activity-log entry — R13.1
  const activityEntry = buildCommentCreatedLog({
    id: crypto.randomUUID(),
    projectId: phase.projectId,
    actor: reviewerName.trim(),
    now: new Date(),
    commentId: comment.id,
    phaseId: phase.id,
  });

  await repos.activityLogs.create({
    projectId: activityEntry.projectId,
    type: activityEntry.type,
    actor: activityEntry.actor,
    detail: activityEntry.detail,
  });

  // 10. Return the created comment
  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
