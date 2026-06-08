/**
 * The `Result` type and shared error shapes used across the domain and
 * application layers.
 *
 * The domain layer never throws for expected failure modes (validation,
 * guard violations, missing resources). Instead, functions return a
 * `Result<T, E>` so callers must explicitly handle both outcomes. This keeps
 * control flow explicit and the domain layer pure and easy to test.
 */

/**
 * The outcome of an operation that can fail.
 *
 * - `{ ok: true; value }` on success.
 * - `{ ok: false; error }` on failure.
 */
export type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** A single field-level validation problem. */
export interface FieldError {
  /** The name of the offending field, e.g. `'name'` or `'initials'`. */
  field: string;
  /** A human-readable explanation of why the field is invalid. */
  message: string;
}

/**
 * An error produced when user-supplied input fails boundary validation.
 *
 * Identifies each invalid field so the UI can surface targeted messages while
 * retaining the values the user entered. `fields` is empty for errors that are
 * not tied to a specific field.
 */
export interface ValidationError {
  kind: 'validation';
  /** An overall, human-readable summary of the validation failure. */
  message: string;
  /** Zero or more field-specific errors. */
  fields: FieldError[];
}

/** The categories of non-validation failures the application can surface. */
export type AppErrorCode =
  | 'not_found'
  | 'unauthorized'
  | 'forbidden'
  | 'conflict'
  | 'invalid_state'
  | 'immutable'
  | 'storage'
  | 'internal';

/**
 * A general application/domain error for non-validation failure modes such as
 * authorization, missing resources, illegal state transitions, immutability
 * violations, and infrastructure problems.
 */
export interface AppError {
  kind: 'app';
  code: AppErrorCode;
  /** A human-readable explanation of the failure. */
  message: string;
  /** Optional structured context for logging or display. */
  detail?: Record<string, unknown>;
}

/** Construct a successful `Result`. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Construct a failed `Result`. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Narrowing helper: returns `true` when the result is successful. */
export function isOk<T, E>(
  result: Result<T, E>,
): result is { ok: true; value: T } {
  return result.ok;
}

/** Narrowing helper: returns `true` when the result is a failure. */
export function isErr<T, E>(
  result: Result<T, E>,
): result is { ok: false; error: E } {
  return !result.ok;
}

/**
 * Build a {@link ValidationError}.
 *
 * @param message - Overall summary of the failure.
 * @param fields - Optional field-specific errors.
 */
export function validationError(
  message: string,
  fields: FieldError[] = [],
): ValidationError {
  return { kind: 'validation', message, fields };
}

/**
 * Build an {@link AppError}.
 *
 * @param code - The error category.
 * @param message - Human-readable explanation.
 * @param detail - Optional structured context.
 */
export function appError(
  code: AppErrorCode,
  message: string,
  detail?: Record<string, unknown>,
): AppError {
  return detail === undefined
    ? { kind: 'app', code, message }
    : { kind: 'app', code, message, detail };
}
