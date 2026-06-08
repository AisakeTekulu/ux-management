"use client";

/**
 * Tabs — segmented control for list views (Requirement 14.1, supporting).
 *
 * A Polaris-inspired tab/segment row used to switch between segments of a list
 * view (for example "All / Active / Waiting on client" on the Projects view, or
 * "Open / Completed" on the Tasks view). The component is presentation-only and
 * fully controlled: it renders the provided `tabs`, marks the `selectedId` tab
 * as active, and reports selection through `onSelect`. It holds no internal
 * selection state, so the parent owns the filtering/segmenting logic.
 *
 * Accessibility: renders an ARIA tab list (`role="tablist"`) of buttons with
 * `role="tab"` and `aria-selected`, following the WAI-ARIA tabs pattern. The
 * caller is responsible for associating panels via `aria-controls`/`id` when a
 * panel relationship is needed; for pure list segmenting the buttons act as a
 * single-select segmented control.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  /** Stable identifier reported through `onSelect`. */
  id: string;
  /** Visible label and accessible name. */
  label: string;
  /** Optional count/indicator rendered alongside the label (e.g. a result count). */
  badge?: ReactNode;
  /** When true, the tab is rendered but cannot be selected. */
  disabled?: boolean;
}

export interface TabsProps {
  /** Tabs to render, in display order. */
  tabs: readonly TabItem[];
  /** Identifier of the currently selected tab. */
  selectedId: string;
  /** Called with the tab id when a (non-disabled) tab is activated. */
  onSelect: (id: string) => void;
  /**
   * When true, tabs share the available width equally (full-width segmented
   * control). When false (default), tabs size to their content.
   */
  fitted?: boolean;
  /** Accessible label for the tab list. */
  "aria-label"?: string;
  /** Optional additional classes for the tab list container. */
  className?: string;
}

export function Tabs({
  tabs,
  selectedId,
  onSelect,
  fitted = false,
  "aria-label": ariaLabel = "Views",
  className,
}: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={cn(
        "flex items-stretch gap-token-1 border-b border-border",
        fitted && "w-full",
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === selectedId;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onSelect(tab.id)}
            className={cn(
              "relative -mb-px inline-flex items-center justify-center gap-token-2 whitespace-nowrap px-token-3 py-token-2 text-sm font-medium",
              "border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              fitted && "flex-1",
              tab.disabled && "cursor-not-allowed opacity-50",
              selected
                ? "border-primary text-text"
                : "border-transparent text-text-subdued hover:border-border hover:text-text",
            )}
          >
            <span className="truncate">{tab.label}</span>
            {tab.badge !== undefined && tab.badge !== null && (
              <span
                className={cn(
                  "inline-flex min-w-5 items-center justify-center rounded-full px-token-1 text-xs font-semibold",
                  selected
                    ? "bg-primary text-text-on-primary"
                    : "bg-surface-hovered text-text-subdued",
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
