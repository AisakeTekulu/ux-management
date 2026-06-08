/**
 * Pure boundary validators for the Client Sign-Off Dashboard domain layer.
 *
 * Every function here is pure: it has no Supabase (or other infrastructure)
 * imports, performs no I/O, and never mutates its inputs. Validators return a
 * {@link Result} so callers must explicitly handle both the accepted (trimmed)
 * value and the {@link ValidationError} produced on rejection. The predicate
 * helpers (`isProjectNameDuplicate`, `isWithinUploadLimit`) return booleans.
 *
 * Character lengths are measured in Unicode code points (via `Array.from`) so
 * they align with PostgreSQL `char_length` and behave correctly for inputs
 * outside the Basic Multilingual Plane (e.g. emoji).
 *
 * Mirrors the "Components and Interfaces → Domain Layer" section of the design.
 */

import type { Project } from '@/lib/domain/types';
import {
  ok,
  err,
  validationError,
  type Result,
  type ValidationError,
  type FieldError,
} from '@/lib/domain/result';

/** The validated, trimmed name and initials captured during a sign-off. */
export interface Signoff {
  /** Reviewer's full name; trimmed, 1..100 code points. */
  name: string;
  /** Reviewer's initials; trimmed, 1..10 code points. */
  initials: string;
}

/** Maximum allowed upload size in bytes (50 MiB). */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Maximum allowed length of a design-link URL, in code points. */
export const MAX_DESIGN_URL_LENGTH = 2048;

/**
 * Count the number of Unicode code points in a string.
 *
 * Unlike `String.prototype.length` (which counts UTF-16 code units), this
 * matches PostgreSQL `char_length` semantics for astral-plane characters.
 */
function codePointLength(value: string): number {
  return Array.from(value).length;
}

/**
 * Validate a trimmed, length-bounded text field.
 *
 * Trims leading/trailing whitespace, then accepts the value if and only if its
 * code-point length falls within `[min, max]`. On rejection, produces a
 * {@link ValidationError} carrying a single {@link FieldError} for `field` that
 * distinguishes an empty value from one that exceeds `max`. The original input
 * is never mutated.
 */
function validateBoundedText(
  raw: string,
  field: string,
  label: string,
  min: number,
  max: number,
): Result<string, ValidationError> {
  const trimmed = raw.trim();
  const length = codePointLength(trimmed);

  if (length < min) {
    const message = `${label} is required.`;
    return err(validationError(message, [{ field, message }]));
  }

  if (length > max) {
    const message = `${label} must be at most ${max} characters.`;
    return err(validationError(message, [{ field, message }]));
  }

  return ok(trimmed);
}

/**
 * Validate a client name.
 *
 * Accepts if and only if the trimmed length is 1..100; returns the trimmed
 * value. (R2.1, R2.2, R2.3, R2.4)
 */
export function validateClientName(raw: string): Result<string, ValidationError> {
  return validateBoundedText(raw, 'name', 'Client name', 1, 100);
}

/**
 * Validate a project name.
 *
 * Accepts if and only if the trimmed length is 1..120; returns the trimmed
 * value. (R3.1, R3.2, R3.4)
 */
export function validateProjectName(raw: string): Result<string, ValidationError> {
  return validateBoundedText(raw, 'name', 'Project name', 1, 120);
}

/**
 * Validate checklist-item text.
 *
 * Accepts if and only if the trimmed length is 1..500; returns the trimmed
 * value. (R5.1, R5.2, R5.7)
 */
export function validateChecklistText(raw: string): Result<string, ValidationError> {
  return validateBoundedText(raw, 'text', 'Checklist item text', 1, 500);
}

/**
 * Validate comment text.
 *
 * Accepts if and only if the trimmed length is 1..5000; returns the trimmed
 * value. (R7.1, R7.2, R7.3, R7.4)
 */
export function validateCommentText(raw: string): Result<string, ValidationError> {
  return validateBoundedText(raw, 'text', 'Comment text', 1, 5000);
}

/**
 * Validate a phase description.
 *
 * Accepts if and only if the (untrimmed) length is at most 5000 code points;
 * an empty description is valid. The value is returned unchanged because
 * descriptions are stored verbatim (no trimming). (R4.5)
 */
export function validateDescription(raw: string): Result<string, ValidationError> {
  if (codePointLength(raw) > 5000) {
    const message = 'Description must be at most 5000 characters.';
    return err(validationError(message, [{ field: 'description', message }]));
  }
  return ok(raw);
}

/**
 * Validate a design-link URL.
 *
 * Trims the input, then accepts it if and only if it parses as an absolute URL
 * using the `http` or `https` scheme and its length does not exceed 2048
 * characters. Returns the trimmed URL. (R6.1, R6.2)
 */
export function validateDesignUrl(raw: string): Result<string, ValidationError> {
  const trimmed = raw.trim();
  const invalid = (): Result<string, ValidationError> => {
    const message =
      'Enter a valid URL that starts with http:// or https:// and is at most 2048 characters.';
    return err(validationError(message, [{ field: 'url', message }]));
  };

  if (codePointLength(trimmed) > MAX_DESIGN_URL_LENGTH) {
    return invalid();
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return invalid();
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return invalid();
  }

  return ok(trimmed);
}

/**
 * Validate a sign-off's name and initials together.
 *
 * Accepts if and only if the name's trimmed length is 1..100 and the initials'
 * trimmed length is 1..10. On rejection, every invalid field is identified in
 * the returned {@link ValidationError}; inputs are never mutated, so the caller
 * can retain the originally entered values. (R9.2, R9.3, R15.6)
 */
export function validateSignoff(
  name: string,
  initials: string,
): Result<Signoff, ValidationError> {
  const trimmedName = name.trim();
  const trimmedInitials = initials.trim();
  const fields: FieldError[] = [];

  const nameLength = codePointLength(trimmedName);
  if (nameLength < 1) {
    fields.push({ field: 'name', message: 'Name is required.' });
  } else if (nameLength > 100) {
    fields.push({ field: 'name', message: 'Name must be at most 100 characters.' });
  }

  const initialsLength = codePointLength(trimmedInitials);
  if (initialsLength < 1) {
    fields.push({ field: 'initials', message: 'Initials are required.' });
  } else if (initialsLength > 10) {
    fields.push({
      field: 'initials',
      message: 'Initials must be at most 10 characters.',
    });
  }

  if (fields.length > 0) {
    return err(validationError('Sign-off details are invalid.', fields));
  }

  return ok({ name: trimmedName, initials: trimmedInitials });
}

/**
 * Validate a task title.
 *
 * Accepts if and only if the trimmed length is 1..200; returns the trimmed
 * value. (R12.1, R12.2)
 */
export function validateTaskTitle(raw: string): Result<string, ValidationError> {
  return validateBoundedText(raw, 'title', 'Task title', 1, 200);
}

/**
 * Determine whether a project name duplicates an existing sibling's name.
 *
 * Comparison is case-insensitive after trimming leading/trailing whitespace,
 * matching the database's `lower(btrim(name))` uniqueness index. The caller is
 * responsible for excluding the project being edited from `siblings`. The
 * `siblings` array is read-only and never mutated. (R3.5)
 */
export function isProjectNameDuplicate(name: string, siblings: Project[]): boolean {
  const normalized = name.trim().toLowerCase();
  return siblings.some((sibling) => sibling.name.trim().toLowerCase() === normalized);
}

/**
 * Determine whether an upload's size is within the allowed limit.
 *
 * True if and only if `sizeInBytes` is at most {@link MAX_UPLOAD_BYTES}
 * (50 MiB). File sizes are expected to be non-negative; `NaN` yields `false`.
 * (R6.3, R6.4)
 */
export function isWithinUploadLimit(sizeInBytes: number): boolean {
  return sizeInBytes <= MAX_UPLOAD_BYTES;
}

// ---------------------------------------------------------------------------
// File type validation
// ---------------------------------------------------------------------------

/** Allowed file extensions for design file uploads. */
export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
  '.fig', '.sketch', '.psd', '.ai', '.xd', '.zip',
] as const;

/** Allowed MIME types for design file uploads. */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/zip', 'application/x-zip-compressed',
  'application/octet-stream', // For .fig, .sketch, .psd, .ai, .xd
] as const;

/**
 * Determine whether a file's name and MIME type are within the allowed set.
 *
 * Returns `true` if either the file extension OR the MIME type is in the
 * allowlist. This accommodates cases where the browser reports a generic MIME
 * type (e.g. `application/octet-stream`) for proprietary design formats.
 */
export function isAllowedFileType(fileName: string, mimeType: string): boolean {
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  const extAllowed = (ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(ext);
  const mimeAllowed = (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
  return extAllowed || mimeAllowed;
}
