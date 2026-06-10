"use client";

/**
 * Sidebar — refined admin navigation with better visual hierarchy.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: <DashboardIcon /> },
  { label: "Notifications", href: "/notifications", icon: <NotificationsIcon /> },
  { label: "Projects", href: "/projects", icon: <ProjectsIcon /> },
  { label: "Clients", href: "/clients", icon: <ClientsIcon /> },
  { label: "Tasks", href: "/tasks", icon: <TasksIcon /> },
  { label: "Sign-offs", href: "/sign-offs", icon: <SignoffsIcon /> },
  { label: "Activity", href: "/activity", icon: <ActivityIcon /> },
];

const BOTTOM_ITEMS: readonly NavItem[] = [
  { label: "Settings", href: "/settings", icon: <SettingsIcon /> },
];

export interface SidebarProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

function isActiveRoute(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ collapsed = false, onNavigate }: SidebarProps) {
  const pathname = usePathname() ?? "";

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-border/50 px-token-4",
          collapsed && "justify-center px-token-2",
        )}
      >
        <div className="flex items-center gap-token-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-emerald-600 text-text-on-primary shadow-sm">
            <LogoMark />
          </span>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-bold text-text tracking-tight">UX Flow</span>
              <span className="text-[10px] text-text-subdued font-medium">Project Manager</span>
            </div>
          )}
        </div>
      </div>

      {/* Main navigation */}
      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-token-3 py-token-4">
        {!collapsed && (
          <p className="mb-token-2 px-token-3 text-[10px] font-semibold uppercase tracking-widest text-text-subdued">
            Menu
          </p>
        )}
        <ul className="flex flex-col gap-token-1">
          {NAV_ITEMS.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center rounded-lg text-[13px] font-medium transition-all duration-150",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                    collapsed ? "justify-center p-token-2" : "gap-token-3 px-token-3 py-[10px]",
                    active
                      ? "bg-primary/8 text-primary shadow-sm"
                      : "text-text-subdued hover:bg-surface-hovered hover:text-text",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 shrink-0 items-center justify-center transition-colors",
                      active ? "text-primary" : "text-text-subdued group-hover:text-text",
                    )}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border/50 px-token-3 py-token-3">
        <ul className="flex flex-col gap-token-1">
          {BOTTOM_ITEMS.map((item) => {
            const active = isActiveRoute(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group flex items-center rounded-lg text-[13px] font-medium transition-all duration-150",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                    collapsed ? "justify-center p-token-2" : "gap-token-3 px-token-3 py-[10px]",
                    active
                      ? "bg-primary/8 text-primary"
                      : "text-text-subdued hover:bg-surface-hovered hover:text-text",
                  )}
                >
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className={cn("truncate", collapsed && "sr-only")}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* Icons — refined with consistent 20x20 stroked glyphs */

function iconProps() {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function LogoMark() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function ClientsIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function SignoffsIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function NotificationsIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
