/**
 * ReviewLayout — Client_Portal shell (Requirements 15.1, 15.2).
 *
 * A centered, single-column review layout that excludes the admin sidebar.
 * Renders children in a max-width container with no horizontal overflow
 * across 320px–1920px (R16.6).
 *
 * This component is the Client_Portal equivalent of the admin AppShell,
 * but intentionally simpler: no sidebar, no navigation, just a clean
 * centered column for the review experience.
 */

import { type ReactNode } from "react";

export interface ReviewLayoutProps {
  /** Main review content. */
  children: ReactNode;
}

export function ReviewLayout({ children }: ReviewLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-2xl px-token-4 py-token-8">
        {children}
      </main>
    </div>
  );
}
