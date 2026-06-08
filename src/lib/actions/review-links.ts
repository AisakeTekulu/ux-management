"use server";

/**
 * Review Link Server Actions.
 *
 * Implements the `getReviewLinkModalContext` and `sendReviewLink` server
 * actions for the Send Review Link modal workflow.
 *
 * `getReviewLinkModalContext` fetches all context data needed to populate
 * the Send Review Link modal: client info, project, phase, email history
 * stats, and auto-filled fields.
 *
 * `sendReviewLink` validates input, generates a share link, creates the
 * email template, logs the email history record and activity log entry,
 * and optionally updates the client's primaryEmail.
 *
 * _Requirements: 3.3, 4.1, 4.4, 4.5, 4.6, 5.5, 7.1, 7.2, 7.3, 9.4, 10.1, 13.1, 13.2, 13.3, 13.4_
 */

import { createClient } from "@/lib/supabase/server";
import { createSupabaseRepositories } from "@/lib/repositories/supabase";
import type {
  ReviewLinkModalContext,
  SendReviewLinkInput,
  SendReviewLinkResult,
} from "@/lib/domain/types";
import {
  ok,
  err,
  appError,
  type Result,
  type AppError,
} from "@/lib/domain/result";
import {
  validateEmailFormat,
  canSendReviewLink,
  generateEmailTemplate,
} from "@/lib/domain/client-crm";
import {
  generateUniqueToken,
  webCryptoRandomSource,
} from "@/lib/domain/share-link";
import { sendEmail } from "@/lib/email/resend";
import { syncActivityToNotion } from "@/lib/integrations/notion";

/**
 * Get context for the Send Review Link modal.
 *
 * Fetches all data needed to render and auto-fill the modal:
 * - Client record (for auto-filling email and name)
 * - Project record (for context display)
 * - Phase record (when phaseId provided, for context display)
 * - Email history stats: total sent count and last sent date
 *
 * Auto-fills:
 * - recipientEmail from client.primaryEmail (Req 4.5)
 * - clientName from client.fullName (Req 4.4)
 * - Email subject from project/phase names (Req 4.6)
 *
 * Contextual info:
 * - Project name (Req 13.1)
 * - Phase name when applicable (Req 13.2)
 * - Last sent date for this client+project (Req 13.3)
 * - Total sent count for this client (Req 13.4)
 *
 * _Requirements: 3.3, 4.4, 4.5, 4.6, 13.1, 13.2, 13.3, 13.4_
 */
export async function getReviewLinkModalContext(
  projectId: string,
  phaseId?: string
): Promise<Result<ReviewLinkModalContext, AppError>> {
  // 1. Authenticate the user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(
      appError("unauthorized", "You must be signed in to perform this action.")
    );
  }

  try {
    const repos = createSupabaseRepositories(supabase);

    // 2. Fetch the project by ID
    const project = await repos.projects.findById(projectId);
    if (!project) {
      return err(appError("not_found", "Project not found."));
    }

    // 3. Fetch the client linked to this project
    const client = await repos.clients.findById(project.clientId);
    if (!client) {
      return err(appError("not_found", "Client not found."));
    }

    // 4. If phaseId provided, fetch the phase
    let phase = undefined;
    if (phaseId) {
      const fetchedPhase = await repos.phases.findById(phaseId);
      if (fetchedPhase) {
        phase = fetchedPhase;
      }
    }

    // 5. Get email history stats
    const [totalSentCount, lastSentRecord] = await Promise.all([
      repos.emailHistory.countByClient(client.id),
      repos.emailHistory.lastSentForClientProject(client.id, projectId),
    ]);

    const lastSentDate = lastSentRecord?.sentAt ?? undefined;

    // 6. Auto-fill from client record
    const autoFilledEmail = client.primaryEmail ?? undefined;
    const autoFilledName = client.fullName ?? undefined;

    // 7. Build and return the modal context
    const context: ReviewLinkModalContext = {
      client,
      project,
      phase,
      lastSentDate,
      totalSentCount,
      autoFilledEmail,
      autoFilledName,
    };

    return ok(context);
  } catch (error) {
    return err(
      appError(
        "internal",
        "Failed to load review link context. Please try again.",
        {
          cause: error instanceof Error ? error.message : String(error),
        }
      )
    );
  }
}

/**
 * Send a review link to a client.
 *
 * This action orchestrates the full "send review link" flow:
 * 1. Validates the recipient email format
 * 2. Checks the `canSendReviewLink` guard (rejects archived clients)
 * 3. Generates a share link (token) using existing infrastructure
 * 4. Generates the email template
 * 5. Creates an email history record
 * 6. Creates an activity log entry with type 'review_link_sent'
 * 7. Optionally updates the client's primaryEmail if saveEmailToProfile is true
 *
 * Returns the review URL, email history ID, and share token on success.
 *
 * _Requirements: 4.1, 5.5, 7.1, 7.2, 7.3, 9.4, 10.1_
 */
export async function sendReviewLink(
  input: SendReviewLinkInput
): Promise<Result<SendReviewLinkResult, AppError>> {
  // 1. Authenticate the user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return err(
      appError("unauthorized", "You must be signed in to perform this action.")
    );
  }

  try {
    const repos = createSupabaseRepositories(supabase);

    // 2. Fetch the client by input.clientId
    const client = await repos.clients.findById(input.clientId);
    if (!client) {
      return err(appError("not_found", "Client not found."));
    }

    // 3. Validate recipient email format (Req 9.4)
    const emailResult = validateEmailFormat(input.recipientEmail);
    if (!emailResult.ok) {
      return err(
        appError("invalid_state", "A valid recipient email is required.")
      );
    }

    // 4. Check canSendReviewLink guard — reject archived clients (Req 10.1)
    const guardResult = canSendReviewLink(client);
    if (!guardResult.ok) {
      return guardResult;
    }

    // 5. Fetch the project
    const project = await repos.projects.findById(input.projectId);
    if (!project) {
      return err(appError("not_found", "Project not found."));
    }

    // 6. Fetch phase if provided (for email template context)
    let phaseName: string | undefined;
    if (input.phaseId) {
      const phase = await repos.phases.findById(input.phaseId);
      if (phase) {
        phaseName = phase.title;
      }
    }

    // 7. Generate a unique share link token
    const existingLinks = await repos.shareLinks.listByOwner(user.id);
    const existingTokens = existingLinks.map((link) => link.token);
    const token = generateUniqueToken(webCryptoRandomSource, existingTokens);

    // 8. Create the share link record
    const shareLink = await repos.shareLinks.create({
      ownerId: user.id,
      token,
      scopeType: input.phaseId ? "phase" : "project",
      projectId: input.phaseId ? null : input.projectId,
      phaseId: input.phaseId ?? null,
      revokedAt: null,
      firstAccessedAt: null,
    });

    // 9. Construct the review URL (use full absolute URL for email delivery)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const reviewUrl = `${baseUrl}/review/${shareLink.token}`;

    // 10. Generate email template (Req 6.1–6.5)
    const emailTemplate = generateEmailTemplate({
      clientFullName: client.fullName ?? client.name,
      projectName: project.name,
      phaseName,
      reviewUrl,
      customMessage: input.customMessage,
      adminName: user.email ?? "Your Designer",
    });

    // Use the input subject if provided, otherwise fall back to generated subject
    const emailSubject = input.subject || emailTemplate.subject;

    // 10b. Actually send the email via Resend
    const emailDelivery = await sendEmail({
      to: input.recipientEmail,
      cc: input.ccEmail,
      subject: emailSubject,
      text: emailTemplate.body,
    });

    // Determine delivery status based on send result
    const deliveryStatus = emailDelivery.success ? "sent" : "failed";

    // 11. Create email history record (Req 7.2)
    const emailHistoryRecord = await repos.emailHistory.create({
      clientId: input.clientId,
      projectId: input.projectId,
      phaseId: input.phaseId ?? null,
      recipientEmail: input.recipientEmail,
      subject: emailSubject,
      message: emailTemplate.body,
      sentBy: user.id,
      sentAt: new Date().toISOString(),
      deliveryStatus,
    });

    // 12. Create activity log entry with type 'review_link_sent' (Req 7.1)
    await repos.activityLogs.create({
      projectId: input.projectId,
      type: "review_link_sent",
      actor: user.email ?? user.id,
      detail: {
        recipientEmail: input.recipientEmail,
        emailHistoryId: emailHistoryRecord.id,
        shareToken: shareLink.token,
      },
    });

    // 13. Conditionally update client primaryEmail (Req 5.5, 9.4)
    if (
      input.saveEmailToProfile &&
      input.recipientEmail.toLowerCase() !== (client.primaryEmail ?? "").toLowerCase()
    ) {
      await repos.clients.update(client.id, {
        primaryEmail: input.recipientEmail,
      });
    }

    // 14. Return the success result (Req 7.3)
    const result: SendReviewLinkResult = {
      reviewUrl,
      emailHistoryId: emailHistoryRecord.id,
      shareToken: shareLink.token,
    };

    // Sync to Notion (fire-and-forget)
    syncActivityToNotion({
      title: `Review link sent to ${input.recipientEmail}`,
      type: "Review Link Sent",
      projectName: project.name,
      clientName: client.fullName ?? client.name,
      detail: phaseName,
    }).catch(() => {});

    return ok(result);
  } catch (error) {
    return err(
      appError(
        "internal",
        "Failed to send review link. Please try again.",
        {
          cause: error instanceof Error ? error.message : String(error),
        }
      )
    );
  }
}
