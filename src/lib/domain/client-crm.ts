/**
 * Client CRM domain logic.
 *
 * Pure functions for client CRM validation, email template generation,
 * and send-flow guards. None of these functions perform side effects —
 * they return `Result<T, E>` so callers handle both outcomes explicitly.
 *
 * Mirrors the "Components and Interfaces → Domain Pure Functions" section
 * of the Client CRM & Review Links design document.
 */

import type {
  Client,
  ClientCRMInput,
  EmailTemplateContext,
  EmailTemplate,
  PreferredContactMethod,
} from './types';
import {
  ok,
  err,
  appError,
  validationError,
  type Result,
  type AppError,
  type ValidationError,
  type FieldError,
} from './result';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum allowed length of the notes field, in characters. */
export const MAX_NOTES_LENGTH = 5000;

/** Valid values for the preferredContactMethod field. */
export const VALID_CONTACT_METHODS: readonly PreferredContactMethod[] = [
  'email',
  'phone',
  'other',
];

// ─── Email Validation ───────────────────────────────────────────────────────

/**
 * Validate email format (RFC 5322 simplified).
 *
 * Accepts strings containing exactly one `@`, a non-empty local part,
 * and a domain with at least one dot. Returns the trimmed, lowercased email
 * on success. (Requirements 1.3, 1.4)
 */
export function validateEmailFormat(email: string): Result<string, AppError> {
  const trimmed = email.trim();

  if (trimmed.length === 0) {
    return err(appError('invalid_state', 'Email address is required.'));
  }

  const atIndex = trimmed.indexOf('@');
  const lastAtIndex = trimmed.lastIndexOf('@');

  // Must have exactly one @
  if (atIndex === -1 || atIndex !== lastAtIndex) {
    return err(appError('invalid_state', 'Email must contain exactly one @ symbol.'));
  }

  const localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  // Non-empty local part
  if (localPart.length === 0) {
    return err(appError('invalid_state', 'Email local part (before @) cannot be empty.'));
  }

  // Domain must have at least one dot
  if (!domain.includes('.')) {
    return err(appError('invalid_state', 'Email domain must contain at least one dot.'));
  }

  // Domain parts around the dot must be non-empty
  const domainParts = domain.split('.');
  if (domainParts.some((part) => part.length === 0)) {
    return err(appError('invalid_state', 'Email domain parts cannot be empty.'));
  }

  return ok(trimmed);
}

// ─── Client CRM Field Validation ────────────────────────────────────────────

/**
 * Validate all client CRM fields. Returns field-level errors.
 *
 * Validates email formats for primaryEmail and secondaryEmail when provided,
 * enforces preferredContactMethod enum, and enforces notes length limit.
 * (Requirements 1.3, 1.4, 1.5, 1.6)
 */
export function validateClientFields(
  fields: Partial<ClientCRMInput>,
): Result<void, ValidationError> {
  const fieldErrors: FieldError[] = [];

  // Validate primaryEmail format if provided and non-empty
  if (fields.primaryEmail != null && fields.primaryEmail !== '') {
    const result = validateEmailFormat(fields.primaryEmail);
    if (!result.ok) {
      fieldErrors.push({
        field: 'primaryEmail',
        message: 'Primary email must be a valid email address.',
      });
    }
  }

  // Validate secondaryEmail format if provided and non-empty
  if (fields.secondaryEmail != null && fields.secondaryEmail !== '') {
    const result = validateEmailFormat(fields.secondaryEmail);
    if (!result.ok) {
      fieldErrors.push({
        field: 'secondaryEmail',
        message: 'Secondary email must be a valid email address.',
      });
    }
  }

  // Validate preferredContactMethod enum
  if (fields.preferredContactMethod !== undefined) {
    if (
      !VALID_CONTACT_METHODS.includes(
        fields.preferredContactMethod as PreferredContactMethod,
      )
    ) {
      fieldErrors.push({
        field: 'preferredContactMethod',
        message:
          'Preferred contact method must be one of: email, phone, or other.',
      });
    }
  }

  // Validate notes length
  if (fields.notes !== undefined && fields.notes !== null) {
    if (fields.notes.length > MAX_NOTES_LENGTH) {
      fieldErrors.push({
        field: 'notes',
        message: `Notes must not exceed ${MAX_NOTES_LENGTH} characters.`,
      });
    }
  }

  if (fieldErrors.length > 0) {
    return err(
      validationError('Client profile fields are invalid.', fieldErrors),
    );
  }

  return ok(undefined);
}

// ─── Send Review Link Guard ─────────────────────────────────────────────────

/**
 * Guard: ensure a client can receive review link emails.
 *
 * Rejects archived clients. Active clients pass the guard.
 * (Requirements 10.1, 10.5)
 */
export function canSendReviewLink(client: Client): Result<void, AppError> {
  if (client.status === 'archived') {
    return err(
      appError(
        'forbidden',
        'Cannot send review links to archived clients.',
      ),
    );
  }
  return ok(undefined);
}

// ─── Email Template Generation ──────────────────────────────────────────────

/**
 * Generate the auto-filled email subject.
 *
 * Always includes projectName. When phaseTitle is provided, includes it too.
 * (Requirements 4.6)
 *
 * @example
 * generateEmailSubject("Website Redesign")
 * // => "Review: Website Redesign"
 *
 * generateEmailSubject("Website Redesign", "Wireframes")
 * // => "Review: Website Redesign - Wireframes"
 */
export function generateEmailSubject(
  projectName: string,
  phaseTitle?: string,
): string {
  if (phaseTitle) {
    return `Review: ${projectName} - ${phaseTitle}`;
  }
  return `Review: ${projectName}`;
}

/**
 * Generate the email template body from context.
 *
 * Produces an email with:
 * - Personalized greeting using clientFullName
 * - Project name context
 * - Phase name when provided
 * - Review URL as a link
 * - Custom message when provided (inserted before sign-off)
 * - Admin name in sign-off
 *
 * Returns an EmailTemplate with both subject (via generateEmailSubject) and body.
 * (Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6)
 */
export function generateEmailTemplate(
  context: EmailTemplateContext,
): EmailTemplate {
  const {
    clientFullName,
    projectName,
    phaseName,
    reviewUrl,
    customMessage,
    adminName,
  } = context;

  const subject = generateEmailSubject(projectName, phaseName);

  const lines: string[] = [];

  // Personalized greeting (Req 6.1)
  lines.push(`Hi ${clientFullName},`);
  lines.push('');

  // Project context (Req 6.2)
  if (phaseName) {
    lines.push(
      `Your review is ready for the "${phaseName}" phase of ${projectName}.`,
    );
  } else {
    lines.push(`Your review is ready for ${projectName}.`);
  }
  lines.push('');

  // Review link (Req 6.3)
  lines.push('You can access the review at the following link:');
  lines.push(reviewUrl);
  lines.push('');

  // Custom message when provided (Req 6.5)
  if (customMessage) {
    lines.push(customMessage);
    lines.push('');
  }

  // Sign-off with admin name (Req 6.4)
  lines.push(`Best regards,`);
  lines.push(adminName);

  const body = lines.join('\n');

  return { subject, body };
}

// ─── Email-Differs Detection ────────────────────────────────────────────────

/**
 * Detect whether the entered email differs from the client's primary email.
 *
 * Performs a case-insensitive comparison. Returns true if the emails differ
 * (after lowercasing both). (Requirements 13.5)
 */
export function emailDiffers(
  enteredEmail: string,
  clientPrimaryEmail: string,
): boolean {
  return enteredEmail.toLowerCase() !== clientPrimaryEmail.toLowerCase();
}
