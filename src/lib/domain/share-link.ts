/**
 * Pure domain logic for share-link issuance and resolution.
 *
 * This module is part of the pure domain layer: it has **no** Supabase (or any
 * other infrastructure) imports and performs no I/O. The randomness needed to
 * mint tokens is injected as a {@link RandomSource} so token generation stays
 * deterministic under test, and link/phase lookups are passed in by callers.
 *
 * Responsibilities (Requirement 8 + reviewer view-only scope):
 * - Mint cryptographically-strong, URL-safe tokens of at least 32 characters
 *   that are unique across the existing set (R8.1).
 * - Decide whether a share link is accessible — accessible iff it exists and
 *   has not been revoked (R8.2, R8.5).
 * - Enforce phase-scoped isolation: a phase-scoped link exposes exactly its one
 *   in-scope phase and denies every other phase/project (R8.3).
 * - Produce a single, indistinguishable "invalid or no longer available"
 *   response for both nonexistent and revoked links, disclosing nothing about
 *   whether an underlying project/phase exists (R8.4).
 * - Authorize reviewer operations as view-only: only adding a comment or
 *   submitting an approval against the in-scope phase of a valid link is
 *   permitted; everything else is rejected with no state change
 *   (R7.5, R8.6, R9.9, R9.10).
 *
 * See design "Components and Interfaces → Domain Layer (Share-link issuance)",
 * "Architecture → Share-Link Access Flow", and Properties 15–19.
 */

import type { Phase, ShareLink, UUID } from '@/lib/domain/types';
import {
  type AppError,
  type Result,
  appError,
  err,
  ok,
} from '@/lib/domain/result';

// ---------------------------------------------------------------------------
// Token generation (R8.1)
// ---------------------------------------------------------------------------

/**
 * A source of cryptographically secure random bytes.
 *
 * Injected into token generation so production code can supply a real CSPRNG
 * (see {@link webCryptoRandomSource}) while tests supply a deterministic stub.
 */
export interface RandomSource {
  /**
   * Return exactly `size` cryptographically secure random bytes.
   *
   * @param size - The number of bytes to produce; must be a positive integer.
   */
  randomBytes(size: number): Uint8Array;
}

/** The minimum number of characters every issued token must contain (R8.1). */
export const MIN_TOKEN_LENGTH = 32;

/**
 * Number of random bytes drawn per token. 32 bytes (256 bits of entropy)
 * base64url-encode to 43 characters, comfortably above {@link MIN_TOKEN_LENGTH}
 * and large enough that collisions are cryptographically negligible.
 */
export const TOKEN_BYTE_LENGTH = 32;

/**
 * Maximum attempts {@link generateUniqueToken} will make before giving up.
 * With 256-bit tokens a single collision is astronomically unlikely, so
 * exhausting this bound indicates a degenerate {@link RandomSource}.
 */
const MAX_UNIQUE_TOKEN_ATTEMPTS = 1000;

/** Standard base64 alphabet; converted to the URL-safe variant on output. */
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode bytes as unpadded base64url, yielding only URL-safe characters
 * (`A–Z`, `a–z`, `0–9`, `-`, `_`).
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  let output = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const hasB1 = i + 1 < bytes.length;
    const hasB2 = i + 2 < bytes.length;
    const b1 = hasB1 ? (bytes[i + 1] ?? 0) : 0;
    const b2 = hasB2 ? (bytes[i + 2] ?? 0) : 0;
    const triple = (b0 << 16) | (b1 << 8) | b2;

    output += BASE64_ALPHABET[(triple >> 18) & 0x3f]!;
    output += BASE64_ALPHABET[(triple >> 12) & 0x3f]!;
    if (hasB1) output += BASE64_ALPHABET[(triple >> 6) & 0x3f]!;
    if (hasB2) output += BASE64_ALPHABET[triple & 0x3f]!;
  }
  return output.replace(/\+/g, '-').replace(/\//g, '_');
}

/**
 * Generate a single URL-safe share-link token of at least
 * {@link MIN_TOKEN_LENGTH} characters using the injected {@link RandomSource}.
 *
 * The token contains only URL-safe characters and carries 256 bits of entropy.
 * Uniqueness against existing links is the caller's concern; use
 * {@link generateUniqueToken} when an existing-token set is available.
 */
export function generateToken(rng: RandomSource): string {
  return bytesToBase64Url(rng.randomBytes(TOKEN_BYTE_LENGTH));
}

/**
 * Generate a token that does not collide with any token in `existingTokens`,
 * satisfying R8.1's "unique across all existing Share_Links" guarantee.
 *
 * Retries on the (cryptographically negligible) chance of a collision. Throws
 * if no unique token is found within {@link MAX_UNIQUE_TOKEN_ATTEMPTS}, which
 * can only happen with a broken {@link RandomSource} — a programming error
 * rather than an expected, user-facing failure mode.
 */
export function generateUniqueToken(
  rng: RandomSource,
  existingTokens: Iterable<string> = [],
): string {
  const taken = new Set(existingTokens);
  for (let attempt = 0; attempt < MAX_UNIQUE_TOKEN_ATTEMPTS; attempt += 1) {
    const token = generateToken(rng);
    if (!taken.has(token)) {
      return token;
    }
  }
  throw new Error(
    'generateUniqueToken: exhausted attempts to produce a unique token; ' +
      'the provided RandomSource is not producing distinct values',
  );
}

/**
 * A {@link RandomSource} backed by the platform Web Crypto API
 * (`globalThis.crypto.getRandomValues`), available in modern browsers and
 * Node.js 18+.
 *
 * Production callers can pass this to {@link generateToken} /
 * {@link generateUniqueToken}; tests should inject a deterministic stub
 * instead. It is provided here for convenience and uses only standard web
 * APIs (no Supabase or Node-specific imports).
 */
export const webCryptoRandomSource: RandomSource = {
  randomBytes(size: number): Uint8Array {
    const cryptoApi = (globalThis as { crypto?: Crypto }).crypto;
    if (!cryptoApi || typeof cryptoApi.getRandomValues !== 'function') {
      throw new Error(
        'webCryptoRandomSource: a Web Crypto implementation is not available ' +
          'in this environment',
      );
    }
    return cryptoApi.getRandomValues(new Uint8Array(size));
  },
};

// ---------------------------------------------------------------------------
// Access predicate & resolution (R8.2, R8.4, R8.5)
// ---------------------------------------------------------------------------

/**
 * The single, generic message shown for any invalid or revoked link. Shared by
 * read and write paths so neither discloses whether an underlying project or
 * phase exists (R8.4).
 */
export const INVALID_LINK_MESSAGE =
  'This link is invalid or no longer available.';

/** The message returned when a reviewer attempts a non-permitted write (R8.6). */
export const VIEW_ONLY_MESSAGE = 'This share link provides view-only access.';

/**
 * Whether a share link is accessible.
 *
 * A link is accessible if and only if it exists (is non-null) and has not been
 * revoked (`revokedAt` is null) — R8.2, R8.5.
 */
export function isShareLinkAccessible(
  link: ShareLink | null | undefined,
): boolean {
  return link != null && link.revokedAt === null;
}

/**
 * The indistinguishable response for a nonexistent or revoked link.
 *
 * Both cases must produce a value that is deeply equal so callers cannot
 * distinguish "never existed" from "revoked" (R8.4).
 */
export interface InvalidShareLinkResponse {
  readonly ok: false;
  readonly reason: 'invalid';
  readonly message: string;
}

/** Construct the generic invalid-link response (R8.4). */
export function invalidShareLinkResponse(): InvalidShareLinkResponse {
  return { ok: false, reason: 'invalid', message: INVALID_LINK_MESSAGE };
}

/**
 * The outcome of resolving a share link.
 *
 * A valid link resolves to a read-only view (`readOnly: true`); an invalid or
 * revoked link resolves to the generic {@link InvalidShareLinkResponse}.
 */
export type ShareLinkResolution =
  | { readonly ok: true; readonly readOnly: true; readonly link: ShareLink }
  | InvalidShareLinkResponse;

/**
 * Resolve a candidate link to either a read-only valid resolution or the
 * indistinguishable invalid response.
 *
 * Pass `null`/`undefined` for a token that matched no link; pass the link for a
 * matched-but-possibly-revoked link. Nonexistent and revoked inputs both yield
 * an identical invalid response (R8.4); an accessible link resolves to a
 * read-only view model (R8.2).
 */
export function resolveShareLink(
  link: ShareLink | null | undefined,
): ShareLinkResolution {
  if (!isShareLinkAccessible(link)) {
    return invalidShareLinkResponse();
  }
  return { ok: true, readOnly: true, link: link as ShareLink };
}

/**
 * Resolve a share link by token using an injected lookup.
 *
 * The lookup performs the (impure) token→link fetch at the application layer;
 * this function stays pure and applies the access predicate and
 * indistinguishability rules uniformly.
 */
export function resolveShareLinkByToken(
  token: string,
  lookup: (token: string) => ShareLink | null | undefined,
): ShareLinkResolution {
  return resolveShareLink(lookup(token));
}

// ---------------------------------------------------------------------------
// Phase-scoped isolation (R8.3)
// ---------------------------------------------------------------------------

/**
 * Whether the given phase is reachable through `link`.
 *
 * - Phase-scoped link: only the single phase whose id equals `link.phaseId`.
 * - Project-scoped link: any phase belonging to `link.projectId`.
 */
export function isPhaseAccessibleThroughLink(
  link: ShareLink,
  phase: Pick<Phase, 'id' | 'projectId'>,
): boolean {
  if (link.scopeType === 'phase') {
    return link.phaseId === phase.id;
  }
  return link.projectId === phase.projectId;
}

/**
 * Whether the given project is reachable through `link`.
 *
 * A phase-scoped link denies all project-level access (R8.3); a project-scoped
 * link permits exactly its own project.
 */
export function isProjectAccessibleThroughLink(
  link: ShareLink,
  projectId: UUID,
): boolean {
  if (link.scopeType === 'phase') {
    return false;
  }
  return link.projectId === projectId;
}

/**
 * The exact set of phase ids in scope for `link`.
 *
 * For a phase-scoped link this is exactly the one in-scope phase; for a
 * project-scoped link it is every phase of the project, supplied via
 * `projectPhaseIds`. Used to expose only in-scope content (R8.3).
 */
export function scopedPhaseIds(
  link: ShareLink,
  projectPhaseIds: readonly UUID[] = [],
): UUID[] {
  if (link.scopeType === 'phase') {
    return link.phaseId != null ? [link.phaseId] : [];
  }
  return [...projectPhaseIds];
}

// ---------------------------------------------------------------------------
// Reviewer view-only authorization (R7.5, R8.6, R9.9, R9.10)
// ---------------------------------------------------------------------------

/**
 * Write actions a reviewer might attempt through a share link. Only
 * `add_comment` and `submit_approval` are ever permitted; the remaining
 * variants enumerate the modify/delete attempts that must be rejected.
 */
export type ReviewerWriteAction =
  | 'add_comment'
  | 'submit_approval'
  | 'edit_comment'
  | 'delete_comment'
  | 'edit_approval'
  | 'delete_approval'
  | 'edit_phase'
  | 'delete_phase'
  | 'edit_checklist_item'
  | 'delete_checklist_item';

/** The only two actions a reviewer is ever authorized to perform. */
const ALLOWED_REVIEWER_ACTIONS: ReadonlySet<string> = new Set<string>([
  'add_comment',
  'submit_approval',
]);

/** Whether `action` is one of the two permitted reviewer write actions. */
export function isAllowedReviewerAction(action: string): boolean {
  return ALLOWED_REVIEWER_ACTIONS.has(action);
}

/**
 * Authorize a reviewer write attempted through a share link.
 *
 * Succeeds **only** when all of the following hold:
 * 1. the link is valid (exists and not revoked),
 * 2. the action is `add_comment` or `submit_approval`, and
 * 3. the target phase is in scope for the link.
 *
 * Every other case — a modify/delete action, an out-of-scope target, a missing
 * target, or any write through an invalid/revoked link — is rejected as
 * view-only with no state change (R7.5, R8.6, R9.9, R9.10). Being a pure
 * predicate, this function never mutates anything; it only returns the verdict.
 */
export function authorizeReviewerWrite(
  link: ShareLink | null | undefined,
  action: string,
  targetPhase: Pick<Phase, 'id' | 'projectId'> | null | undefined,
): Result<void, AppError> {
  if (link == null || !isShareLinkAccessible(link)) {
    return err(appError('forbidden', VIEW_ONLY_MESSAGE));
  }
  if (!isAllowedReviewerAction(action)) {
    return err(appError('forbidden', VIEW_ONLY_MESSAGE));
  }
  if (targetPhase == null || !isPhaseAccessibleThroughLink(link, targetPhase)) {
    return err(appError('forbidden', VIEW_ONLY_MESSAGE));
  }
  return ok(undefined);
}
