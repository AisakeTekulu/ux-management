/**
 * PageHeader — Admin_Dashboard top header bar (Requirement 14.2).
 *
 * Renders the page title and the page's primary action for the current view.
 * Per R14.2 the admin frame presents "a top header bar containing the page
 * title and the primary action for the current page". This component is the
 * content that lives inside the AppShell's top header region (AppShell passes
 * it via its `header` slot).
 *
 * It is presentation-only and entirely props-driven:
 *   - `title` is required and rendered as the page heading.
 *   - `subtitle` is optional supporting text shown beneath the title.
 *   - `primaryAction` is an optional slot for the page's primary action
 *     (typically a button); it is right-aligned and never wraps under the
 *     title on wider viewports.
 *
 * The component owns no state and performs no data access, so it is safe to
 * render from either Server or Client Components.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  /** Page title shown as the header's heading. */
  title: string;
  /** Optional supporting text rendered beneath the title. */
  subtitle?: ReactNode;
  /** Optional primary-action slot (e.g. a button), right-aligned. */
  primaryAction?: ReactNode;
  /** Optional additional class names for the header container. */
  className?: string;
  /** Heading level for the title; defaults to an <h1>. */
  as?: "h1" | "h2";
}

export function PageHeader({
  title,
  subtitle,
  primaryAction,
  className,
  as: Heading = "h1",
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-token-3",
        className,
      )}
    >
      <div className="min-w-0">
        <Heading className="truncate text-base font-semibold leading-tight text-text">
          {title}
        </Heading>
        {subtitle != null && (
          <p className="mt-token-1 truncate text-sm text-text-subdued">
            {subtitle}
          </p>
        )}
      </div>

      {primaryAction != null && (
        <div className="flex shrink-0 items-center gap-token-2">
          {primaryAction}
        </div>
      )}
    </div>
  );
}
