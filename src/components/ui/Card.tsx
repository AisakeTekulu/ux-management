/**
 * Card — Admin_Dashboard content surface (Requirement 14.3).
 *
 * Per R14.3 the admin presents content "within card-based sections using white
 * and light-grey surfaces, subtle rounded corners, and soft borders". This
 * component is that surface primitive:
 *   - white surface (`bg-surface`) by default, with a subdued light-grey
 *     variant (`bg-surface-subdued`) available via the `tone` prop,
 *   - subtle rounded corners (`rounded-md` → --radius-md / 12px),
 *   - a soft border (`border-border`) and a low card elevation (`shadow-card`),
 *   - compact internal spacing driven by the token spacing scale.
 *
 * It is presentation-only and props-driven. Optional `title`/`actions` render a
 * compact card header separated from the body by a soft divider; when neither
 * is provided the card is a plain padded surface wrapping `children`.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Internal padding scale for the card body (and header). */
export type CardPadding = "none" | "tight" | "default";

export interface CardProps {
  /** Card body content. */
  children: ReactNode;
  /** Optional card title rendered in a compact header. */
  title?: ReactNode;
  /** Optional header actions, right-aligned beside the title. */
  actions?: ReactNode;
  /** Surface tone: white (default) or subdued light-grey. */
  tone?: "default" | "subdued";
  /** Body padding density; defaults to compact `default` spacing. */
  padding?: CardPadding;
  /** Optional additional class names for the card container. */
  className?: string;
}

const BODY_PADDING: Record<CardPadding, string> = {
  none: "",
  tight: "p-token-3",
  default: "p-token-4",
};

export function Card({
  children,
  title,
  actions,
  tone = "default",
  padding = "default",
  className,
}: CardProps) {
  const hasHeader = title != null || actions != null;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-border shadow-card",
        tone === "subdued" ? "bg-surface-subdued" : "bg-surface",
        className,
      )}
    >
      {hasHeader && (
        <div className="flex items-center justify-between gap-token-3 border-b border-border px-token-4 py-token-3">
          {title != null && (
            <h2 className="truncate text-sm font-semibold text-text">{title}</h2>
          )}
          {actions != null && (
            <div className="flex shrink-0 items-center gap-token-2">{actions}</div>
          )}
        </div>
      )}

      <div className={cn(BODY_PADDING[padding])}>{children}</div>
    </section>
  );
}
