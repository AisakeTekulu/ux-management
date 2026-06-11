/**
 * StatusBadge — renders a phase/project status as a colored badge with icon.
 * (Requirements 14.4, 11.7).
 *
 * This component is the single visual representation of status across the
 * entire application. Each badge MUST include an icon + text (not color alone).
 *
 * Status color mapping:
 * - Draft → gray (📝 pencil)
 * - Sent to Client / In Review → blue (mail/arrow)
 * - Waiting for Feedback → indigo (clock)
 * - Changes Requested → amber (⚠️ pencil)
 * - Approved → green (✓)
 * - Completed → emerald/teal (✓✓ check-circle)
 * - Overdue → red (⚠️ alert)
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
 */
const COLOR_CLASSES: Record<StatusColorToken, { bg: string; text: string }> = {
  grey: { bg: "bg-gray-100", text: "text-gray-700" },
  blue: { bg: "bg-blue-100", text: "text-blue-700" },
  indigo: { bg: "bg-indigo-100", text: "text-indigo-700" },
  amber: { bg: "bg-amber-100", text: "text-amber-800" },
  green: { bg: "bg-green-100", text: "text-green-800" },
  teal: { bg: "bg-emerald-100", text: "text-emerald-800" },
  red: { bg: "bg-red-100", text: "text-red-800" },
};

/**
 * Icons for each status — inline SVGs for consistent rendering.
 */
function StatusIcon({ status }: { status: StatusBadgeKey }) {
  const size = 12;
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (status) {
    case "Draft":
      // Pencil icon
      return (
        <svg {...props} aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    case "Sent to Client":
      // Mail/arrow icon
      return (
        <svg {...props} aria-hidden="true">
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </svg>
      );
    case "Waiting for Feedback":
      // Clock icon
      return (
        <svg {...props} aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      );
    case "Changes Requested":
      // Warning/pencil icon
      return (
        <svg {...props} aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "Approved":
      // Single check
      return (
        <svg {...props} aria-hidden="true">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "Completed":
      // Double check / check-circle
      return (
        <svg {...props} aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <path d="M22 4L12 14.01l-3-3" />
        </svg>
      );
    case "Overdue":
      // Alert triangle
      return (
        <svg {...props} aria-hidden="true">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return null;
  }
}

/**
 * A small pill badge that renders an icon + label for a given status.
 *
 * Uses the canonical STATUS_PRESENTATION map so presentation is consistent
 * across every view: dashboard table, phase detail, portal, etc. (R14.4, R11.7).
 */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label } = getStatusPresentation(status);
  const colorToken = getStatusPresentation(status).colorToken;
  const { bg, text } = COLOR_CLASSES[colorToken];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
        bg,
        text,
        className,
      )}
    >
      <StatusIcon status={status} />
      {label}
    </span>
  );
}
