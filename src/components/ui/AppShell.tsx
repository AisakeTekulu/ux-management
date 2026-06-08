"use client";

/**
 * AppShell — Admin_Dashboard frame (Requirements 14.1, 16.1, 16.2).
 *
 * Layout:
 *   ┌─────────────┬───────────────────────────────┐
 *   │             │  top header region            │
 *   │   Sidebar   ├───────────────────────────────┤
 *   │   (rail)    │  main content area            │
 *   └─────────────┴───────────────────────────────┘
 *
 * Responsive behavior:
 *   - Desktop (viewport ≥ 1024px, Tailwind `lg`): the persistent left sidebar
 *     is shown and expanded by default (R16.1). The Designer can manually
 *     collapse/expand it; the choice is persisted to `localStorage` and
 *     restored on load, so the preference survives reloads and viewport-width
 *     changes back to ≥ 1024px (R16.2).
 *   - Mobile/tablet (< 1024px): the rail is hidden and replaced by a
 *     toggleable navigation control that is hidden by default (R16.3); a
 *     header toggle opens an overlay drawer revealing the nav entries (R16.4,
 *     handled in task 20.1 — the toggle wiring lives here).
 *
 * This is a Client Component because it manages interactive collapse/drawer
 * state. Page content is passed via `children`; an optional `header` slot
 * renders inside the top header region (the PageHeader component lands in
 * task 17.2).
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";

/** localStorage key for the desktop collapsed/expanded preference. */
export const SIDEBAR_COLLAPSED_STORAGE_KEY = "csod.sidebar.collapsed";

export interface AppShellProps {
  /** Main content area. */
  children: ReactNode;
  /** Optional content rendered in the top header region (e.g. PageHeader). */
  header?: ReactNode;
}

/** Read the persisted desktop collapse preference; defaults to expanded. */
function readPersistedCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function AppShell({ children, header }: AppShellProps) {
  // Desktop rail collapse state (R16.1 default expanded → false).
  const [collapsed, setCollapsed] = useState(false);
  // Mobile drawer visibility (R16.3 hidden by default → false).
  const [mobileOpen, setMobileOpen] = useState(false);
  // Track whether we have hydrated the persisted value to avoid SSR mismatch.
  const [hydrated, setHydrated] = useState(false);

  // Restore the persisted desktop preference after mount (R16.2).
  useEffect(() => {
    setCollapsed(readPersistedCollapsed());
    setHydrated(true);
  }, []);

  // Persist the desktop preference whenever it changes (post-hydration only).
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      /* storage unavailable (private mode / quota) — ignore */
    }
  }, [collapsed, hydrated]);

  const toggleCollapsed = useCallback(() => setCollapsed((c) => !c), []);
  const openMobileNav = useCallback(() => setMobileOpen(true), []);
  const closeMobileNav = useCallback(() => setMobileOpen(false), []);

  // Close the mobile drawer with the Escape key.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileNav();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, closeMobileNav]);

  // Close the mobile drawer when the viewport crosses ≥1024px (R16.2).
  // This ensures the mobile overlay doesn't linger when resizing to desktop,
  // and the persisted desktop preference takes over cleanly.
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop persistent rail (≥1024px). Hidden below lg (R16.3). */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-surface lg:flex lg:flex-col",
          "transition-[width] duration-200 ease-out",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <Sidebar collapsed={collapsed} />
      </aside>

      {/* Mobile navigation drawer (<1024px), hidden by default (R16.3, R16.4). */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={closeMobileNav}
            className="absolute inset-0 bg-text/30"
          />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[80vw] border-r border-border bg-surface shadow-overlay">
            <Sidebar onNavigate={closeMobileNav} />
          </div>
        </div>
      )}

      {/* Content column, offset by the rail width on desktop. */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-16" : "lg:pl-64",
        )}
      >
        {/* Top header region (R14.2 host; PageHeader lands in 17.2). */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-token-3 border-b border-border bg-surface px-token-4">
          {/* Mobile nav toggle — visible only below 1024px (R16.4). */}
          <button
            type="button"
            onClick={openMobileNav}
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-subdued hover:bg-surface-hovered hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:hidden"
          >
            <MenuIcon />
          </button>

          {/* Desktop collapse/expand toggle — visible only at ≥1024px (R16.2). */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
            className="hidden h-9 w-9 items-center justify-center rounded-md text-text-subdued hover:bg-surface-hovered hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:inline-flex"
          >
            <CollapseIcon collapsed={collapsed} />
          </button>

          <div className="min-w-0 flex-1">{header}</div>
        </header>

        {/* Main content area. */}
        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1920px] px-token-4 py-token-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
      {collapsed ? <path d="M14 9l3 3-3 3" /> : <path d="M17 9l-3 3 3 3" />}
    </svg>
  );
}
