/**
 * Banner — inline status / error / notice messaging
 * (Requirements 6.5, 8.4, 8.6, and supporting auth/persistence notices).
 *
 * A Banner communicates a page- or section-level condition inline, distinct
 * from transient Toast confirmations. It is the surface used for:
 *   - the invalid / no-longer-available Share_Link message (R8.4),
 *   - the view-only access message for reviewer write attempts (R8.6),
 *   - the storage-failure message when a file cannot be stored (R6.5),
 *   - and other notices/errors (auth, persistence) per the Error Handling map.
 *
 * Tone variants map to the design-token status palette so a Banner reads
 * consistently with StatusBadge colors:
 *   - info     → blue   (neutral notices)
 *   - success  → green  (positive confirmations that should persist inline)
 *   - warning  → amber  (cautions, e.g. view-only access)
 *   - critical → red    (errors, e.g. invalid link, storage failure)
 *
 * Presentation-only and props-driven: the component owns no data and performs
 * no side effects. Dismissal is optional and delegated to the consumer via
 * `onDismiss`; when provided, a close control is rendered. The root uses
 * `role="status"` for non-critical tones and `role="alert"` for `critical`
 * so assistive technology announces errors promptly.
 */

import React, { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BannerTone = "info" | "success" | "warning" | "critical";

export interface BannerProps {
  /** Visual + semantic tone. Defaults to `info`. */
  tone?: BannerTone;
  /** Optional bold title line summarizing the condition. */
  title?: string;
  /** Body content describing the notice or error. */
  children?: ReactNode;
  /**
   * When provided, renders a dismiss control that invokes this callback.
   * The consumer owns the dismissed/visible state.
   */
  onDismiss?: () => void;
  /** Optional additional class names applied to the root container. */
  className?: string;
}

interface ToneStyle {
  /** Container surface + border classes. */
  container: string;
  /** Icon color class. */
  icon: string;
  /** Accessible role for the region. */
  role: "status" | "alert";
  /** Glyph rendered in the leading icon slot. */
  glyph: ReactNode;
}

const TONE_STYLES: Record<BannerTone, ToneStyle> = {
  info: {
    container: "border-status-blue/30 bg-status-blue/10 text-text",
    icon: "text-status-blue",
    role: "status",
    glyph: <InfoGlyph />,
  },
  success: {
    container: "border-status-green/30 bg-status-green/10 text-text",
    icon: "text-status-green",
    role: "status",
    glyph: <SuccessGlyph />,
  },
  warning: {
    container: "border-status-amber/30 bg-status-amber/10 text-text",
    icon: "text-status-amber",
    role: "status",
    glyph: <WarningGlyph />,
  },
  critical: {
    container: "border-status-red/30 bg-status-red/10 text-text",
    icon: "text-status-red",
    role: "alert",
    glyph: <CriticalGlyph />,
  },
};

export function Banner({ tone = "info", title, children, onDismiss, className }: BannerProps) {
  const style = TONE_STYLES[tone];

  return (
    <div
      role={style.role}
      className={cn(
        "flex items-start gap-token-3 rounded-md border px-token-4 py-token-3 text-sm",
        style.container,
        className,
      )}
    >
      <span className={cn("mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center", style.icon)} aria-hidden="true">
        {style.glyph}
      </span>

      <div className="min-w-0 flex-1">
        {title != null && <p className="font-semibold text-text">{title}</p>}
        {children != null && (
          <div className={cn("text-text-subdued", title != null && "mt-token-1")}>{children}</div>
        )}
      </div>

      {onDismiss != null && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-token-1 -mt-token-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-subdued hover:bg-surface-hovered hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <DismissGlyph />
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Inline glyphs (no external icon dependency). Each inherits `currentColor`
 * so it follows the tone's icon color token.
 * ------------------------------------------------------------------------ */

function glyphProps() {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function InfoGlyph() {
  return (
    <svg {...glyphProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function SuccessGlyph() {
  return (
    <svg {...glyphProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </svg>
  );
}

function WarningGlyph() {
  return (
    <svg {...glyphProps()}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function CriticalGlyph() {
  return (
    <svg {...glyphProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-6 6" />
      <path d="M9 9l6 6" />
    </svg>
  );
}

function DismissGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
