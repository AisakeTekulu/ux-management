/**
 * StatusBadge — renders a phase/project status as a colored badge
 * (Requirements 14.4, 11.7).
 *
 * This component is the single visual representation of status across the
 * entire application. It derives its label and color exclusively from the
 * status presentation map (`src/lib/domain/status-presentation.ts`), ensuring
 * that every status value — including the derived Overdue indicator — is
 * rendered with one fixed label and one fixed, visually distinct color
 * everywhere it appears.
 *
 * The color is applied via the `status-*` Tailwind color utilities backed by
 * CSS variables in `globals.css` and configured in `tailwind.config.ts`.
 */

import {
  getStatusPresentation,
  type StatusBadgeKey,
} from "@/lib/domain/status-presentation";
import type { StatusColorToken } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

export interface StatusBadgeProps {
  /** The status value to display (one of the 6 workflow statuses or "Overdue"). */
  status: StatusBadgeKey;
  /** Optional additional class names for the badge container. */
  className?: string;
}

/**
 * Static Tailwind class pairs for each color token.
 *
 * Tailwind's JIT compiler requires full class names to appear statically in
 * source so they are included in the generated CSS. We map each color token to
 * its background (with 10% opacity) and text color classes.
 */
const COLOR_CLASSES: Record<StatusColorToken, { bg: string; text: string }> = {
  grey: { bg: "bg-status-grey/10", text: "text-status-grey" },
  blue: { bg: "bg-status-blue/10", text: "text-status-blue" },
  indigo: { bg: "bg-status-indigo/10", text: "text-status-indigo" },
  amber: { bg: "bg-status-amber/10", text: "text-status-amber" },
  green: { bg: "bg-status-green/10", text: "text-status-green" },
  teal: { bg: "bg-status-teal/10", text: "text-status-teal" },
  red: { bg: "bg-status-red/10", text: "text-status-red" },
};

/**
 * A small pill badge that renders the label and color for a given status.
 *
 * Uses the canonical STATUS_PRESENTATION map so presentation is consistent
 * across every view: dashboard table, phase detail, portal, etc. (R14.4, R11.7).
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, colorToken } = getStatusPresentation(status);
  const { bg, text } = COLOR_CLASSES[colorToken];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-token-2 py-token-1 text-xs font-medium",
        bg,
        text,
        className,
      )}
    >
      {label}
    </span>
  );
}
