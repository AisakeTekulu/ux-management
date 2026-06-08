/**
 * Timeline — vertical chronological activity feed (Requirements 11.6, 13.4).
 *
 * Renders an ordered list of activity entries as a vertical timeline: a
 * connecting rail runs top-to-bottom, each entry is marked by a node, and the
 * actor, description, and timestamp are shown beside it. The dashboard's
 * "recent activity" view (R11.6, max 20) and the per-project Activity view
 * (R13.4, max 50) both compose this component.
 *
 * This component is presentation-only:
 *   - It does NOT sort or limit entries. Ordering (reverse-chronological) and
 *     the 20/50 limits are applied by the domain layer (see Property 30) before
 *     the data reaches this component. Entries are rendered in the exact order
 *     they are received.
 *   - It does NOT fetch data. All content arrives via props.
 *
 * Colors, spacing, radii, and borders draw from the Polaris-inspired design
 * tokens defined in `src/app/globals.css` (R14.3, R16.5).
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { ActivityType, ISOTimestamp } from "@/lib/domain/types";

/** A single entry rendered in the timeline. */
export interface TimelineEntry {
  /** Stable identifier used as the React key. */
  id: string;
  /** Who performed the action (designer email or reviewer name). */
  actor: string;
  /**
   * Human-readable description of what happened. May be a plain string or
   * richer nodes (e.g. emphasized status names). Optional when `type` alone
   * is sufficient context.
   */
  description?: ReactNode;
  /**
   * The kind of event. When provided, it selects the node's accent color and
   * supplies a fallback label if `description` is omitted.
   */
  type?: ActivityType;
  /** UTC ISO-8601 timestamp of the event. */
  timestamp: ISOTimestamp;
}

export interface TimelineProps {
  /**
   * The entries to render, already ordered (reverse-chronological) and limited
   * by the caller. Rendered in the order received.
   */
  entries: readonly TimelineEntry[];
  /**
   * Optional content shown when `entries` is empty. Views typically pass an
   * `EmptyState` here (R13.5). When omitted, nothing is rendered for an empty
   * timeline.
   */
  emptyFallback?: ReactNode;
  /**
   * Optional timestamp formatter. Defaults to a deterministic UTC format that
   * is stable across server and client renders (avoids hydration mismatch).
   */
  formatTimestamp?: (timestamp: ISOTimestamp) => string;
  /** Optional accessible label for the surrounding list region. */
  "aria-label"?: string;
  /** Optional additional class names for the root element. */
  className?: string;
}

/** Default, human-readable fallback labels for each activity type. */
const TYPE_LABELS: Record<ActivityType, string> = {
  comment_created: "Comment added",
  approval_created: "Sign-off recorded",
  phase_status_changed: "Status changed",
  review_link_sent: "Review link sent",
};

/** Accent color token applied to a node, keyed by activity type. */
const TYPE_NODE_COLOR: Record<ActivityType, string> = {
  comment_created: "bg-status-blue",
  approval_created: "bg-status-green",
  phase_status_changed: "bg-status-indigo",
  review_link_sent: "bg-status-blue",
};

/**
 * Deterministic default timestamp formatter. Renders the instant in UTC so the
 * server and client produce identical markup regardless of the viewer's locale
 * or timezone. Falls back to the raw value if it cannot be parsed.
 */
function defaultFormatTimestamp(timestamp: ISOTimestamp): string {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return timestamp;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(parsed);
}

export function Timeline({
  entries,
  emptyFallback,
  formatTimestamp = defaultFormatTimestamp,
  "aria-label": ariaLabel = "Activity timeline",
  className,
}: TimelineProps) {
  if (entries.length === 0) {
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  return (
    <ol aria-label={ariaLabel} className={cn("relative flex flex-col", className)}>
      {entries.map((entry, index) => {
        const isLast = index === entries.length - 1;
        const nodeColor = entry.type ? TYPE_NODE_COLOR[entry.type] : "bg-text-subdued";
        const description =
          entry.description ?? (entry.type ? TYPE_LABELS[entry.type] : null);

        return (
          <li key={entry.id} className="relative flex gap-token-3 pb-token-5 last:pb-0">
            {/* Rail + node column. The connecting line is hidden on the last row. */}
            <div className="relative flex w-5 shrink-0 justify-center">
              {!isLast && (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-4 h-full w-px -translate-x-1/2 bg-border"
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 mt-1 h-2.5 w-2.5 rounded-full ring-4 ring-surface",
                  nodeColor,
                )}
              />
            </div>

            {/* Entry content. */}
            <div className="min-w-0 flex-1 pt-px">
              <p className="text-sm text-text">
                <span className="font-medium">{entry.actor}</span>
                {description != null && (
                  <>
                    {" "}
                    <span className="text-text-subdued">{description}</span>
                  </>
                )}
              </p>
              <time
                dateTime={entry.timestamp}
                className="mt-token-1 block text-xs text-text-subdued"
              >
                {formatTimestamp(entry.timestamp)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
