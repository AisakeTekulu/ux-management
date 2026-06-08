"use server";

/**
 * Comment Server Action for the admin (designer) surface.
 *
 * Implements `addComment` — validates the comment text, creates the comment
 * attributed to the authenticated designer, and records a `comment_created`
 * activity-log entry.
 *
 * _Requirements: 7.1, 7.3, 7.4, 13.1_
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import { validateCommentText } from "@/lib/domain/validators";
import { buildCommentCreatedLog } from "@/lib/domain/activity";
import type { Comment, UUID } from "@/lib/domain/types";
import type { Result, ValidationError, AppError } from "@/lib/domain/result";
import { err, appError } from "@/lib/domain/result";

/**
 * Add a comment to a phase as the authenticated designer.
 *
 * 1. Validates the comment text using `validateCommentText` (trim, 1–5000).
 * 2. Retrieves the current session to identify the designer (authorType
 *    `'designer'`, authorUserId from session).
 * 3. Looks up the phase to determine the parent project (needed for the
 *    activity-log entry).
 * 4. Persists the comment.
 * 5. Records a `comment_created` activity-log entry via
 *    `buildCommentCreatedLog`.
 *
 * Returns a `Result<Comment, ValidationError | AppError>`.
 *
 * @param phaseId - The phase to attach the comment to.
 * @param text - The raw comment text submitted by the designer.
 */
export async function addComment(
  phaseId: UUID,
  text: string,
): Promise<Result<Comment, ValidationError | AppError>> {
  // 1. Validate comment text
  const validation = validateCommentText(text);
  if (!validation.ok) {
    return validation;
  }
  const validatedText = validation.value;

  // 2. Get authenticated session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(appError("unauthorized", "Authentication required."));
  }

  const repos = createSupabaseRepositories(supabase);

  // 3. Look up the phase to get the projectId for the activity log
  const phase = await repos.phases.findById(phaseId);
  if (!phase) {
    return err(appError("not_found", "Phase not found."));
  }

  // 4. Create the comment attributed to the designer
  const comment = await repos.comments.create({
    phaseId,
    authorType: "designer",
    authorUserId: user.id,
    authorName: null,
    text: validatedText,
  });

  // 5. Record a comment_created activity-log entry (R13.1)
  const activityEntry = buildCommentCreatedLog({
    id: crypto.randomUUID(),
    projectId: phase.projectId,
    actor: user.email ?? user.id,
    now: new Date(),
    commentId: comment.id,
    phaseId,
  });

  await repos.activityLogs.create({
    projectId: activityEntry.projectId,
    type: activityEntry.type,
    actor: activityEntry.actor,
    detail: activityEntry.detail,
  });

  return { ok: true, value: comment };
}
