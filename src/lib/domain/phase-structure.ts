/**
 * Pure structural operations for projects and phases.
 *
 * This module owns the project/phase *structure* concerns of the domain layer:
 * default phase initialization, appending phases, preserving phases across a
 * project edit, applying partial phase-field updates, and validating phase
 * fields (description / internal notes length and due-date validity).
 *
 * Everything here is pure: no Supabase imports, no clock or RNG access. Side
 * effects such as identifier generation and the current time are injected by
 * the caller so the functions stay deterministic and property-testable.
 *
 * Implements the structural behavior described in the design's
 * "Data Models → Default Phase Initialization" and "Components and Interfaces →
 * Domain Layer" sections, covering Requirements 3.6, 3.7, 4.4, 4.5, 4.6, 10.1.
 */

import type {
  ISODate,
  ISOTimestamp,
  Phase,
  PhaseStatus,
  Project,
  UUID,
} from '@/lib/domain/types';
import {
  err,
  ok,
  validationError,
  type FieldError,
  type Result,
  type ValidationError,
} from '@/lib/domain/result';

/**
 * The ten default phases created with every project, in workflow order.
 *
 * Mirrors the design's "Default Phase Initialization" section and the glossary
 * default Phase set (R3.7).
 */
export const DEFAULT_PHASE_TITLES: readonly string[] = [
  'Discovery',
  'Brief sign-off',
  'Sitemap',
  'Wireframes',
  'UI design',
  'Content',
  'Development',
  'Testing',
  'Launch',
  'Handover',
] as const;

/** The status assigned to every newly created phase (R10.1). */
export const INITIAL_PHASE_STATUS: PhaseStatus = 'Draft';

/** Maximum allowed length, in characters, of a phase description or notes (R4.5). */
export const MAX_PHASE_TEXT_LENGTH = 5000;

/**
 * A source of unique identifiers.
 *
 * Injected (rather than imported) so the structural functions remain pure and
 * deterministic under test. In production this is typically backed by
 * `crypto.randomUUID()` or the database's `gen_random_uuid()`.
 */
export type IdSource = () => UUID;

/**
 * Build a brand-new phase with empty content and no approval, used by both
 * default initialization and append.
 */
function createPhase(
  id: UUID,
  projectId: UUID,
  title: string,
  ordinal: number,
  now: ISOTimestamp,
): Phase {
  return {
    id,
    projectId,
    title,
    ordinal,
    description: '',
    internalNotes: '',
    status: INITIAL_PHASE_STATUS,
    dueDate: null,
    approvedByName: null,
    approvedInitials: null,
    approvedAt: null,
    createdAt: now,
  };
}

/**
 * Produce the default set of phases for a newly created project (R3.7, R10.1).
 *
 * Returns exactly the ten {@link DEFAULT_PHASE_TITLES} in order, assigned
 * ordinals 1..10, each with status `'Draft'`, empty description/notes, no due
 * date, and no approval data.
 *
 * @param projectId - The owning project's identifier.
 * @param newId - Identifier source; invoked once per phase, in order.
 * @param now - Creation timestamp applied to every phase.
 */
export function initializeDefaultPhases(
  projectId: UUID,
  newId: IdSource,
  now: ISOTimestamp,
): Phase[] {
  return DEFAULT_PHASE_TITLES.map((title, index) =>
    createPhase(newId(), projectId, title, index + 1, now),
  );
}

/**
 * Append a new phase to a project as the last ordinal position (R4.6, R10.1).
 *
 * The new phase's ordinal is one greater than the largest existing ordinal (or
 * 1 when the project has no phases), guaranteeing it exceeds every existing
 * phase. Its status is `'Draft'`.
 *
 * @param existingPhases - The project's current phases (any order).
 * @param projectId - The owning project's identifier.
 * @param title - The title for the new phase.
 * @param newId - Identifier source for the new phase.
 * @param now - Creation timestamp for the new phase.
 */
export function appendPhase(
  existingPhases: readonly Phase[],
  projectId: UUID,
  title: string,
  newId: IdSource,
  now: ISOTimestamp,
): Phase {
  const maxOrdinal = existingPhases.reduce(
    (max, phase) => (phase.ordinal > max ? phase.ordinal : max),
    0,
  );
  return createPhase(newId(), projectId, title, maxOrdinal + 1, now);
}

/** A project together with its phases, used by structural project edits. */
export interface ProjectWithPhases {
  project: Project;
  phases: Phase[];
}

/**
 * Apply a project-name edit while preserving the project's phases (R3.6).
 *
 * Returns a new {@link ProjectWithPhases} whose project carries the supplied
 * name and whose phases are the same phase records (identities, ordinals, and
 * contents unchanged). The input is never mutated.
 *
 * The new name is expected to be already validated by the project-name
 * validator; this function is concerned solely with the structural invariant
 * that editing a project does not disturb its phases.
 *
 * @param current - The project and its existing phases.
 * @param newName - The validated replacement name.
 */
export function applyProjectNameEdit(
  current: ProjectWithPhases,
  newName: string,
): ProjectWithPhases {
  return {
    project: { ...current.project, name: newName },
    phases: current.phases.map((phase) => phase),
  };
}

/**
 * A partial update to a phase's editable fields.
 *
 * A field is considered "patched" only when its key is present with a defined
 * value; `dueDate` may be set to `null` to clear the due date. Fields left
 * `undefined` are not touched.
 */
export interface PhaseFieldPatch {
  description?: string;
  internalNotes?: string;
  dueDate?: ISODate | null;
}

/** True when `value` is within the phase text-length limit (R4.5). */
export function isWithinPhaseTextLimit(value: string): boolean {
  return value.length <= MAX_PHASE_TEXT_LENGTH;
}

/**
 * True when `value` is a valid `YYYY-MM-DD` calendar date (R4.5).
 *
 * Rejects malformed strings and impossible dates such as `'2024-02-30'` or
 * `'2023-13-01'` by round-tripping the parsed components through a UTC `Date`.
 */
export function isValidCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Apply a partial update to a phase's description, internal notes, and/or due
 * date (R4.4, R4.5).
 *
 * Validation rules:
 * - `description` and `internalNotes`, when provided, must be at most
 *   {@link MAX_PHASE_TEXT_LENGTH} characters.
 * - `dueDate`, when provided and non-null, must be a valid calendar date.
 *
 * On success, returns a new phase in which exactly the patched fields are
 * changed and every other field (including identity, ordinal, status, and
 * approval data) is left intact. On failure, returns a {@link ValidationError}
 * identifying each invalid field and leaves the input phase unchanged (the
 * caller retains the stored values).
 *
 * @param phase - The currently stored phase.
 * @param patch - The fields to update.
 */
export function updatePhaseFields(
  phase: Phase,
  patch: PhaseFieldPatch,
): Result<Phase, ValidationError> {
  const { description, internalNotes, dueDate } = patch;
  const fields: FieldError[] = [];

  if (description !== undefined && !isWithinPhaseTextLimit(description)) {
    fields.push({
      field: 'description',
      message: `Description must be at most ${MAX_PHASE_TEXT_LENGTH} characters.`,
    });
  }

  if (internalNotes !== undefined && !isWithinPhaseTextLimit(internalNotes)) {
    fields.push({
      field: 'internalNotes',
      message: `Internal notes must be at most ${MAX_PHASE_TEXT_LENGTH} characters.`,
    });
  }

  if (
    dueDate !== undefined &&
    dueDate !== null &&
    !isValidCalendarDate(dueDate)
  ) {
    fields.push({
      field: 'dueDate',
      message: 'Due date must be a valid calendar date in YYYY-MM-DD format.',
    });
  }

  if (fields.length > 0) {
    return err(
      validationError('The phase update contains one or more invalid fields.', fields),
    );
  }

  const updated: Phase = {
    ...phase,
    ...(description !== undefined ? { description } : {}),
    ...(internalNotes !== undefined ? { internalNotes } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
  };

  return ok(updated);
}
