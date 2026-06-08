/**
 * EmptyState — empty-state message with a relevant primary action
 * (Requirements 14.5, and supporting 2.6, 4.2, 5.6, 11.3, 13.5).
 *
 * Shown wherever a list view, sub-list, or section has no records. It states
 * what is empty and surfaces the relevant primary action so the Designer can
 * resolve the empty state directly (e.g. "Add client" on an empty Clients
 * list). The "empty-checklist indicator" (R5.6) and "no activity" message
 * (R13.5) reuse this same surface with a message and no action.
 *
 * Presentation-only and props-driven: it owns no state and performs no data
 * access. The consumer supplies the message text and, where relevant, the
 * primary action as a ReactNode (typically a Button or Link). Passing the
 * action as a node keeps this component renderable from either a Server or a
 * Client component — the interactive boundary is owned by the consumer.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Short heading naming what is empty (e.g. "No clients yet"). */
  title: string;
  /**
   * Optional supporting message giving context or the next step.
   * Accepts a node so callers can include emphasis or links inline.
   */
  description?: ReactNode;
  /**
   * Optional decorative icon/illustration rendered above the title.
   * Defaults to a neutral placeholder glyph.
   */
  icon?: ReactNode;
  /**
   * The relevant primary action (R14.5), typically a Button or Link.
   * Omit for purely informational empty states (e.g. empty checklist).
   */
  action?: ReactNode;
  /** Optional additional class names applied to the root container. */
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-subdued px-token-6 py-token-8 text-center",
        className,
      )}
    >
      <span
        className="mb-token-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-hovered text-text-subdued"
        aria-hidden="true"
      >
        {icon ?? <DefaultEmptyIcon />}
      </span>

      <h3 className="text-base font-semibold text-text">{title}</h3>

      {description != null && (
        <p className="mt-token-2 max-w-md text-sm text-text-subdued">{description}</p>
      )}

      {action != null && <div className="mt-token-5">{action}</div>}
    </div>
  );
}

/** Neutral placeholder glyph used when no custom icon is provided. */
function DefaultEmptyIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 11h18" />
    </svg>
  );
}
