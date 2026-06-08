/**
 * Client lifecycle domain logic.
 *
 * Pure functions that enforce status transition rules, guard invariants,
 * and validate confirmation inputs for client data retention operations.
 *
 * None of these functions perform side effects — they return `Result<T, AppError>`
 * so callers handle both outcomes explicitly.
 */

import type { Client, ClientStatus } from './types';
import { ok, err, appError, type Result, type AppError } from './result';

/** Valid state transitions for ClientStatus. */
const VALID_TRANSITIONS: Record<ClientStatus, ClientStatus[]> = {
  active: ['archived'],
  archived: ['active'],
};

/**
 * Validate that a status transition is allowed.
 *
 * Valid transitions: active → archived, archived → active.
 * Self-transitions and all other combinations are rejected.
 *
 * @returns ok(targetStatus) if valid, err(AppError) if not.
 */
export function validateStatusTransition(
  current: ClientStatus,
  target: ClientStatus,
): Result<ClientStatus, AppError> {
  if (current === target) {
    return err(appError('invalid_state', `Client is already ${target}.`));
  }
  if (!VALID_TRANSITIONS[current]?.includes(target)) {
    return err(
      appError('invalid_state', `Cannot transition from ${current} to ${target}.`),
    );
  }
  return ok(target);
}

/**
 * Guard: ensure a client is eligible for profile deletion.
 *
 * Rejects if the client's profile has already been deleted (deletedAt is non-null).
 */
export function canDeleteProfile(client: Client): Result<void, AppError> {
  if (client.deletedAt !== null) {
    return err(appError('invalid_state', 'Client profile has already been deleted.'));
  }
  return ok(undefined);
}

/**
 * Guard: ensure share link creation is allowed for a client.
 *
 * Rejects archived clients and clients whose profile has been deleted.
 */
export function canCreateShareLink(client: Client): Result<void, AppError> {
  if (client.status === 'archived') {
    return err(appError('forbidden', 'Cannot create share links for archived clients.'));
  }
  if (client.deletedAt !== null) {
    return err(appError('forbidden', 'Cannot create share links for deleted client profiles.'));
  }
  return ok(undefined);
}

/**
 * Guard: reject any mutation attempt on an approval record.
 *
 * Approval records are immutable audit artefacts. This guard always returns
 * an error — there is no valid case where mutation is permitted.
 */
export function rejectApprovalMutation(): Result<never, AppError> {
  return err(
    appError('immutable', 'Approval records are immutable and cannot be modified or deleted.'),
  );
}

/**
 * Validate permanent delete name confirmation.
 *
 * The typed name must be an exact case-sensitive match of the client name.
 */
export function validateDeleteConfirmation(
  clientName: string,
  typedName: string,
): Result<void, AppError> {
  if (typedName !== clientName) {
    return err(
      appError('invalid_state', 'Typed name does not match client name. Permanent delete cancelled.'),
    );
  }
  return ok(undefined);
}
