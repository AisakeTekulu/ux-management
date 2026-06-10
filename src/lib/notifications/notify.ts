import 'server-only';

/**
 * Notification service — creates in-app notifications and sends email
 * notifications for key events in the portal review flow.
 *
 * All functions are fire-and-forget safe: callers should `.catch(() => {})`
 * so notification failures never break the main operation.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { createSupabaseRepositories } from '@/lib/repositories/supabase';
import { sendEmail } from '@/lib/email/resend';

/**
 * Notify the admin when a client leaves a comment.
 */
export async function notifyAdminOfComment(params: {
  adminUserId: string;
  projectId: string;
  phaseId: string;
  projectName: string;
  phaseName: string;
  reviewerName: string;
  commentText: string;
}): Promise<void> {
  const serviceClient = createServiceRoleClient();
  const repos = createSupabaseRepositories(serviceClient);

  await repos.notifications.create({
    userId: params.adminUserId,
    projectId: params.projectId,
    phaseId: params.phaseId,
    type: 'client_comment',
    title: `New comment from ${params.reviewerName}`,
    message: `${params.reviewerName} commented on "${params.phaseName}" in ${params.projectName}: "${params.commentText.slice(0, 100)}${params.commentText.length > 100 ? '...' : ''}"`,
    metadata: { reviewerName: params.reviewerName },
  });
}

/**
 * Notify the admin when a client approves a phase or requests changes.
 */
export async function notifyAdminOfApproval(params: {
  adminUserId: string;
  projectId: string;
  phaseId: string;
  projectName: string;
  phaseName: string;
  reviewerName: string;
  decision: string;
}): Promise<void> {
  const serviceClient = createServiceRoleClient();
  const repos = createSupabaseRepositories(serviceClient);

  const type = params.decision === 'Changes Requested' ? 'client_changes_requested' : 'client_approval';
  const title = params.decision === 'Changes Requested'
    ? `${params.reviewerName} requested changes`
    : `${params.reviewerName} approved "${params.phaseName}"`;

  await repos.notifications.create({
    userId: params.adminUserId,
    projectId: params.projectId,
    phaseId: params.phaseId,
    type,
    title,
    message: `${params.reviewerName} ${params.decision === 'Changes Requested' ? 'requested changes on' : 'approved'} "${params.phaseName}" in ${params.projectName}.`,
    metadata: { reviewerName: params.reviewerName, decision: params.decision },
  });
}

/**
 * Notify the client (via email) when admin sends feedback or changes phase status.
 */
export async function notifyClientOfFeedback(params: {
  clientEmail: string;
  clientName: string;
  projectName: string;
  phaseName: string;
  feedbackType: 'comment' | 'status_change';
  detail: string;
  reviewUrl?: string;
}): Promise<void> {
  const subject = params.feedbackType === 'comment'
    ? `New feedback on ${params.projectName} - ${params.phaseName}`
    : `Status update: ${params.projectName} - ${params.phaseName}`;

  const body = [
    `Hi ${params.clientName},`,
    '',
    params.feedbackType === 'comment'
      ? `You have new feedback on the "${params.phaseName}" phase of ${params.projectName}:`
      : `The status of "${params.phaseName}" in ${params.projectName} has been updated:`,
    '',
    params.detail,
    '',
    params.reviewUrl ? `View it here: ${params.reviewUrl}` : '',
    '',
    'Best regards,',
    'Your Design Team',
  ].filter(Boolean).join('\n');

  await sendEmail({ to: params.clientEmail, subject, text: body });
}
