"use client";

/**
 * EmailPreview — Collapsible panel showing the formatted email template as the
 * client will receive it (Requirements 5.8, 6.6).
 *
 * Renders the email body in a clean, readable card with proper whitespace
 * handling (preserves newlines from the template). The panel is collapsible
 * via a toggle header.
 */

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface EmailPreviewProps {
  /** The email subject line. */
  subject: string;
  /** The email body content (newlines are preserved). */
  body: string;
  /** Whether the panel starts collapsed. Defaults to true. */
  isCollapsed?: boolean;
}

export function EmailPreview({
  subject,
  body,
  isCollapsed = true,
}: EmailPreviewProps) {
  const [collapsed, setCollapsed] = useState(isCollapsed);

  return (
    <div className="overflow-hidden rounded-md border border-border">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between gap-token-3 bg-surface-subdued px-token-4 py-token-3 text-left text-sm font-semibold text-text hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      >
        <span>Email Preview</span>
        <ChevronIcon collapsed={collapsed} />
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="border-t border-border bg-surface px-token-5 py-token-4">
          {/* Subject line */}
          <div className="mb-token-3">
            <span className="text-xs font-medium uppercase tracking-wide text-text-subdued">
              Subject
            </span>
            <p className="mt-token-1 text-sm font-medium text-text">{subject}</p>
          </div>

          {/* Divider */}
          <hr className="mb-token-4 border-border" />

          {/* Email body — preserve newlines from the template */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-text">
            {body}
          </div>
        </div>
      )}
    </div>
  );
}

/** Small chevron icon that rotates based on collapsed state. */
function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn(
        "shrink-0 transition-transform duration-200",
        !collapsed && "rotate-180",
      )}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
