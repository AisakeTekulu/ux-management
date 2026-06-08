/**
 * Status presentation map for the Client Sign-Off Dashboard (Requirement 14.4).
 *
 * This module is the single source of truth for how a phase/project status is
 * presented to the user: each status value — plus the derived `Overdue`
 * indicator — maps to exactly one fixed label and one fixed, visually distinct
 * color token. Every view (the dashboard status table, badges, the portal,
 * etc.) renders status through this map so presentation is consistent
 * everywhere (R11.7, R14.4).
 *
 * It is pure and presentation-only: no Supabase (or any other infrastructure)
 * imports and no I/O. The color tokens reference the Polaris-inspired status
 * palette declared as CSS variables in `src/app/globals.css` and surfaced as
 * Tailwind utilities via `src/lib/design-tokens.ts`.
 *
 * `Overdue` is a derived flag rendered as an additional badge; it is never a
 * persisted {@link PhaseStatus} (R10.6). See design "Data Models → Status
 * Presentation Map" and Property 36.
 */

import {
  STATUS_COLOR_TOKENS,
  type StatusColorToken,
} from '@/lib/design-tokens';
import type { PhaseStatus } from '@/lib/domain/types';

/** The label/badge text used for the derived overdue indicator. */
export const OVERDUE_BADGE = 'Overdue' as const;

/**
 * The full set of presentable status values: the six workflow
 * {@link PhaseStatus} values plus the derived `Overdue` indicator.
 */
export type StatusBadgeKey = PhaseStatus | typeof OVERDUE_BADGE;

/**
 * The presentation of a single status: a fixed, human-readable label and a
 * fixed color token. `colorToken` is the palette name (e.g. `'green'`);
 * `colorClass` is the corresponding Tailwind class (e.g. `'status-green'`)
 * resolved from {@link STATUS_COLOR_TOKENS}.
 */
export interface StatusPresentation {
  /** Fixed, human-readable label shown on the badge. */
  readonly label: string;
  /** Fixed palette token name backing the badge color. */
  readonly colorToken: StatusColorToken;
  /** Tailwind color class derived from {@link STATUS_COLOR_TOKENS}. */
  readonly colorClass: (typeof STATUS_COLOR_TOKENS)[StatusColorToken];
}

/** Build a {@link StatusPresentation}, resolving the Tailwind class from the token. */
function presentation(
  label: string,
  colorToken: StatusColorToken,
): StatusPresentation {
  return { label, colorToken, colorClass: STATUS_COLOR_TOKENS[colorToken] };
}

/**
 * The canonical status → presentation map (R14.4).
 *
 * Exactly one entry per presentable status, with pairwise-distinct color
 * tokens (and therefore pairwise-distinct color classes). The mapping matches
 * the design's Status Presentation Map table:
 *
 * | Status               | Label                | Color  |
 * |----------------------|----------------------|--------|
 * | Draft                | Draft                | grey   |
 * | Sent to Client       | Sent to Client       | blue   |
 * | Waiting for Feedback | Waiting for Feedback | indigo |
 * | Changes Requested    | Changes Requested    | amber  |
 * | Approved             | Approved             | green  |
 * | Completed            | Completed            | teal   |
 * | Overdue (derived)    | Overdue              | red    |
 */
export const STATUS_PRESENTATION: Readonly<
  Record<StatusBadgeKey, StatusPresentation>
> = {
  Draft: presentation('Draft', 'grey'),
  'Sent to Client': presentation('Sent to Client', 'blue'),
  'Waiting for Feedback': presentation('Waiting for Feedback', 'indigo'),
  'Changes Requested': presentation('Changes Requested', 'amber'),
  Approved: presentation('Approved', 'green'),
  Completed: presentation('Completed', 'teal'),
  [OVERDUE_BADGE]: presentation('Overdue', 'red'),
};

/**
 * Resolve the presentation for a status value.
 *
 * Total and deterministic over every {@link StatusBadgeKey}: it always returns
 * the same single label/color for a given key (R14.4).
 *
 * @param status - A workflow status or the derived `Overdue` indicator.
 * @returns The fixed label and color token/class for that status.
 */
export function getStatusPresentation(
  status: StatusBadgeKey,
): StatusPresentation {
  return STATUS_PRESENTATION[status];
}
