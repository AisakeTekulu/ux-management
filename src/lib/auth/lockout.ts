/**
 * Account lockout module (Requirement 1.6).
 *
 * Tracks consecutive sign-in failures per email in a rolling 15-minute window.
 * After 5 consecutive failures the account is locked for 15 minutes. During
 * lockout all sign-in attempts are rejected with a generic "temporarily locked"
 * message BEFORE credentials are checked against Supabase.
 *
 * Implementation notes:
 * - In-memory Map is acceptable for the MVP. A production deployment would use
 *   a persistent store (e.g., Redis or a database table) so lockout state
 *   survives server restarts and works across multiple instances.
 * - The module exports pure helper functions and a singleton store so it can be
 *   tested deterministically by injecting a custom `now` timestamp.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of consecutive failures that triggers a lockout. */
export const MAX_ATTEMPTS = 5;

/** Duration of the rolling failure window AND the lockout period (ms). */
export const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Generic message returned when an account is locked. Intentionally does not
 * disclose which field was wrong or how many attempts remain.
 */
export const LOCKOUT_MESSAGE =
  "This account is temporarily locked. Please try again later.";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttemptRecord {
  /** Timestamps (epoch ms) of consecutive failures within the rolling window. */
  failures: number[];
  /** Epoch ms when the lockout was triggered, or null if not locked. */
  lockedAt: number | null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * In-memory store keyed by normalised email (lowercased, trimmed).
 * Exported for testing purposes only — production code should use the
 * helper functions below.
 */
export const attemptStore: Map<string, AttemptRecord> = new Map();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise an email for consistent map lookups. */
function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Prune failures that fall outside the rolling 15-minute window relative to
 * `now`. Mutates the record in place for efficiency.
 */
function pruneExpiredFailures(record: AttemptRecord, now: number): void {
  const cutoff = now - WINDOW_MS;
  record.failures = record.failures.filter((ts) => ts > cutoff);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check whether the account identified by `email` is currently locked.
 *
 * @param email - The email to check.
 * @param now   - Current epoch ms (injectable for testing; defaults to Date.now()).
 * @returns `true` if the account is locked and attempts should be rejected.
 */
export function isLocked(email: string, now: number = Date.now()): boolean {
  const key = normaliseEmail(email);
  const record = attemptStore.get(key);
  if (!record || record.lockedAt === null) {
    return false;
  }

  // Check if the lockout period has expired.
  if (now - record.lockedAt >= WINDOW_MS) {
    // Lockout expired — reset the record.
    record.lockedAt = null;
    record.failures = [];
    return false;
  }

  return true;
}

/**
 * Record a failed sign-in attempt for the given email. If this failure pushes
 * the account past the threshold, the account is locked.
 *
 * @param email - The email that failed authentication.
 * @param now   - Current epoch ms (injectable for testing; defaults to Date.now()).
 */
export function recordFailure(email: string, now: number = Date.now()): void {
  const key = normaliseEmail(email);
  let record = attemptStore.get(key);

  if (!record) {
    record = { failures: [], lockedAt: null };
    attemptStore.set(key, record);
  }

  // If already locked, nothing more to do.
  if (record.lockedAt !== null) {
    return;
  }

  // Prune stale failures outside the window, then add the new one.
  pruneExpiredFailures(record, now);
  record.failures.push(now);

  // Lock if threshold reached.
  if (record.failures.length >= MAX_ATTEMPTS) {
    record.lockedAt = now;
  }
}

/**
 * Record a successful sign-in, clearing any accumulated failure state for the
 * account. Called after Supabase confirms valid credentials.
 *
 * @param email - The email that authenticated successfully.
 */
export function recordSuccess(email: string): void {
  const key = normaliseEmail(email);
  attemptStore.delete(key);
}

/**
 * Reset the entire store. Intended for testing only.
 */
export function resetStore(): void {
  attemptStore.clear();
}
