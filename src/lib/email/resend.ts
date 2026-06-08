/**
 * Email delivery via Resend.
 *
 * Sends transactional emails (review link delivery) using the Resend API.
 * Requires the RESEND_API_KEY environment variable to be set.
 *
 * If RESEND_API_KEY is not configured, emails are logged to console instead
 * of being sent (useful for development).
 */

import { Resend } from 'resend';

interface SendEmailInput {
  /** Recipient email address. */
  to: string;
  /** CC email address (optional). */
  cc?: string;
  /** Email subject line. */
  subject: string;
  /** Plain text email body. */
  text: string;
  /** "From" display name and address. Uses Resend's default if not set. */
  from?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send an email via Resend.
 *
 * Falls back to console logging when RESEND_API_KEY is not set (dev mode).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // Dev fallback: log to console when no API key is configured
  if (!apiKey) {
    console.log('[Email] No RESEND_API_KEY set — logging email instead of sending:');
    console.log(`  To: ${input.to}`);
    if (input.cc) console.log(`  CC: ${input.cc}`);
    console.log(`  Subject: ${input.subject}`);
    console.log(`  Body:\n${input.text}`);
    console.log('[Email] End of email log');
    return { success: true, messageId: 'dev-mode-no-send' };
  }

  const resend = new Resend(apiKey);

  // Use the configured FROM address, or Resend's onboarding address
  const from = input.from ?? process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';

  try {
    const response = await resend.emails.send({
      from,
      to: input.to,
      cc: input.cc ? input.cc : undefined,
      subject: input.subject,
      text: input.text,
    });

    if (response.error) {
      console.error('[Email] Resend API error:', response.error);
      return { success: false, error: response.error.message };
    }

    return { success: true, messageId: response.data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Email] Failed to send:', message);
    return { success: false, error: message };
  }
}
