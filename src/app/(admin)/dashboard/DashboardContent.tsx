"use client";

/**
 * Dashboard — Salesforce-inspired 3-column layout with organized panels.
 *
 * Layout:
 * - Left sidebar: Quick stats + Waiting on Client
 * - Center: Project status table + Recent Activity feed
 * - Right sidebar: My Tasks + Quick Actions
 */

import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Timeline, type TimelineEntry } from "@/components/ui/Timeline";
import { isOverdue } from "@/lib/domain/phase-status";
import { formatDate } from "@/lib/format-date";
import type { DashboardViewModel, ProjectStatusRow } from "@/lib/domain/dashboard";
import type { Phase, PhaseStatus, Task, ActivityLog } from "@/lib/domain/types";

interface DashboardContentProps {
  dashboard: DashboardViewModel;
  recentActivity: ActivityLog[];
  openTasks: Task[];
  /** All phases grouped by project — used for the phase pipeline display. */
  phasesByProject: Record<string, Phase[]>;
}

export default function DashboardContent({
  dashboard,
  recentActivity,
  openTasks,
  phasesByProject,
}: DashboardContentProps) {
  const { summary, projectStatusTable, waitingOnClient } = dashboard;
  const router = useRouter();
  const now = new Date();

  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-token-5">
      {/* Top bar: greeting + quick actions */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">{greeting} 👋</h1>
          <p className="mt-0.5 text-sm text-text-subdued">
            Here&apos;s what&apos;s happening with your projects.
          </p>
        </div>
        <div className="flex items-center gap-token-2">
          <button
            type="button"
            onClick={() => router.push("/clients")}
            className="inline-flex items-center gap-token-2 rounded-lg border border-border bg-surface px-token-3 py-[9px] text-sm font-medium text-text hover:bg-surface-hovered transition-all"
          >
            <PlusIcon />
            New Client
          </button>
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="inline-flex items-center gap-token-2 rounded-lg bg-primary px-token-4 py-[9px] text-sm font-semibold text-text-on-primary shadow-sm hover:bg-primary-hovered transition-all"
          >
            <PlusIcon />
            New Project
          </button>
        </div>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 gap-token-5 xl:grid-cols-12">
        {/* ─── Left Panel (3 cols) ─── */}
        <aside className="xl:col-span-3 space-y-token-4">
          {/* Summary Panel */}
          <Panel title="Overview">
            <div className="space-y-token-3">
              <StatRow
                label="Active Projects"
                value={summary.activeProjects}
                icon={<FolderIcon />}
                color="blue"
              />
              <StatRow
                label="Waiting on Client"
                value={summary.phasesWaitingForFeedback}
                icon={<ClockIcon />}
                color="amber"
              />
              <StatRow
                label="Overdue Phases"
                value={summary.overduePhases}
                icon={<AlertIcon />}
                color="red"
              />
              <StatRow
                label="Open Tasks"
                value={summary.openTasks}
                icon={<CheckIcon />}
                color="green"
              />
            </div>
          </Panel>

          {/* Waiting on Client — overdue items appear first */}
          <Panel
            title="Waiting on Client"
            count={waitingOnClient.length}
            accentColor="amber"
          >
            {waitingOnClient.length === 0 ? (
              <p className="text-sm text-text-subdued text-center py-token-3">
                No phases awaiting client feedback
              </p>
            ) : (
              <ul className="space-y-token-1">
                {[...waitingOnClient]
                  .sort((a, b) => {
                    const aOverdue = isOverdue(
                      a.dueDate ? new Date(`${a.dueDate}T00:00:00.000Z`) : null,
                      a.status,
                      now
                    );
                    const bOverdue = isOverdue(
                      b.dueDate ? new Date(`${b.dueDate}T00:00:00.000Z`) : null,
                      b.status,
                      now
                    );
                    if (aOverdue && !bOverdue) return -1;
                    if (!aOverdue && bOverdue) return 1;
                    if (aOverdue && bOverdue && a.dueDate && b.dueDate) {
                      return a.dueDate.localeCompare(b.dueDate);
                    }
                    return 0;
                  })
                  .slice(0, 5)
                  .map((phase) => {
                    const overdue = isOverdue(
                      phase.dueDate
                        ? new Date(`${phase.dueDate}T00:00:00.000Z`)
                        : null,
                      phase.status,
                      now
                    );
                    // Look up the project/client info for this phase
                    const projectRow = projectStatusTable.find(
                      (r) => r.projectId === phase.projectId
                    );
                    const projectLabel = projectRow
                      ? `${projectRow.clientName} · ${projectRow.projectName}`
                      : "";
                    return (
                      <li
                        key={phase.id}
                        className={`rounded-md px-token-3 py-token-2 cursor-pointer hover:opacity-80 transition-opacity ${
                          overdue ? "bg-red-50 border border-red-200" : "bg-surface-subdued"
                        }`}
                        onClick={() => router.push(`/projects/${phase.projectId}`)}
                      >
                        <p className={`text-sm font-medium truncate ${overdue ? "text-red-800" : "text-text"}`}>
                          {phase.title}
                        </p>
                        {projectLabel && (
                          <p className="text-[11px] text-text-subdued truncate">
                            {projectLabel}
                          </p>
                        )}
                        <p className={`text-xs mt-0.5 ${overdue ? "text-red-600" : "text-text-subdued"}`}>
                          {overdue && "⚠️ Overdue · "}
                          {phase.dueDate ? `Due ${formatDate(phase.dueDate)}` : phase.status}
                        </p>
                      </li>
                    );
                  })}
                {waitingOnClient.length > 5 && (
                  <li className="text-center pt-token-1">
                    <button
                      type="button"
                      onClick={() => router.push("/sign-offs")}
                      className="text-xs font-medium text-primary hover:text-primary-hovered"
                    >
                      +{waitingOnClient.length - 5} more →
                    </button>
                  </li>
                )}
              </ul>
            )}
          </Panel>
        </aside>

        {/* ─── Center Panel (6 cols) ─── */}
        <main className="xl:col-span-6 space-y-token-4">
          {/* Project Status Table */}
          <Panel
            title="Active Projects"
            action={
              <button
                type="button"
                onClick={() => router.push("/projects")}
                className="text-xs font-medium text-primary hover:text-primary-hovered transition-colors"
              >
                View all →
              </button>
            }
          >
            {projectStatusTable.length === 0 ? (
              <EmptyState
                title="No active projects"
                description="Create a project to get started tracking client work."
                action={
                  <button
                    type="button"
                    onClick={() => router.push("/projects")}
                    className="rounded-lg bg-primary px-token-4 py-[9px] text-sm font-semibold text-text-on-primary shadow-sm hover:bg-primary-hovered"
                  >
                    Create Project
                  </button>
                }
              />
            ) : (
              <div className="space-y-token-3">
                {[...projectStatusTable]
                  .sort((a, b) => {
                    const aOverdue = a.dueDate
                      ? isOverdue(new Date(`${a.dueDate}T00:00:00.000Z`), a.status, now)
                      : false;
                    const bOverdue = b.dueDate
                      ? isOverdue(new Date(`${b.dueDate}T00:00:00.000Z`), b.status, now)
                      : false;
                    if (aOverdue && !bOverdue) return -1;
                    if (!aOverdue && bOverdue) return 1;
                    // Among overdue items, most overdue first (earliest due date)
                    if (aOverdue && bOverdue && a.dueDate && b.dueDate) {
                      return a.dueDate.localeCompare(b.dueDate);
                    }
                    return 0;
                  })
                  .slice(0, 6)
                  .map((row) => {
                  const phases = phasesByProject[row.projectId] ?? [];
                  const completedCount = phases.filter(
                    (p) => p.status === "Completed" || p.status === "Approved"
                  ).length;
                  const totalCount = phases.length;
                  const progressPct =
                    totalCount > 0
                      ? Math.round((completedCount / totalCount) * 100)
                      : 0;
                  const rowOverdue = row.dueDate
                    ? isOverdue(new Date(`${row.dueDate}T00:00:00.000Z`), row.status, now)
                    : false;

                  return (
                    <button
                      key={row.projectId}
                      type="button"
                      onClick={() =>
                        router.push(`/projects/${row.projectId}`)
                      }
                      className="w-full rounded-lg border border-border bg-surface p-token-4 text-left hover:shadow-card-hovered hover:border-primary/20 transition-all"
                    >
                      {/* Header: project name + status */}
                      <div className="flex items-center justify-between mb-token-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text truncate">
                            {row.projectName}
                          </p>
                          <p className="text-xs text-text-subdued">
                            {row.clientName}
                          </p>
                        </div>
                        <div className="flex items-center gap-token-2 shrink-0">
                          <span className="text-xs text-text-subdued">
                            {completedCount}/{totalCount} phases
                          </span>
                          {rowOverdue && <StatusBadge status="Overdue" />}
                          <StatusBadge status={row.status} />
                        </div>
                      </div>

                      {/* Phase Pipeline — visual progress dots */}
                      {totalCount > 0 && (
                        <div className="mb-token-3">
                          <div className="flex items-center gap-1">
                            {phases
                              .sort((a, b) => a.ordinal - b.ordinal)
                              .map((phase) => (
                                <PhaseDot
                                  key={phase.id}
                                  status={phase.status}
                                  title={phase.title}
                                  isCurrent={phase.id === row.currentPhaseId}
                                />
                              ))}
                          </div>
                          {/* Progress bar */}
                          <div className="mt-token-2 h-1 w-full rounded-full bg-surface-subdued overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-500"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Footer: current phase + due date */}
                      <div className="flex items-center justify-between text-xs text-text-subdued">
                        <span>
                          Current:{" "}
                          <span className="font-medium text-text">
                            {row.currentPhaseTitle}
                          </span>
                        </span>
                        {row.dueDate && (
                          <span
                            className={
                              rowOverdue
                                ? "text-red-600 font-medium flex items-center gap-1"
                                : ""
                            }
                          >
                            {rowOverdue && <span>⚠️</span>}
                            Due{" "}
                            {formatDate(row.dueDate)}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Panel>

          {/* Recent Activity Feed */}
          <Panel
            title="Recent Activity"
            action={
              <button
                type="button"
                onClick={() => router.push("/activity")}
                className="text-xs font-medium text-primary hover:text-primary-hovered transition-colors"
              >
                View all →
              </button>
            }
          >
            {recentActivity.length === 0 ? (
              <p className="text-sm text-text-subdued text-center py-token-6">
                No recent activity
              </p>
            ) : (
              <Timeline
                entries={recentActivity.slice(0, 8).map((entry) => ({
                  id: entry.id,
                  actor: entry.actor,
                  type: entry.type,
                  description: buildActivityDescription(entry),
                  timestamp: entry.createdAt,
                }))}
                aria-label="Recent activity"
              />
            )}
          </Panel>
        </main>

        {/* ─── Right Panel (3 cols) ─── */}
        <aside className="xl:col-span-3 space-y-token-4">
          {/* My Tasks */}
          <Panel
            title="My Tasks"
            count={openTasks.length}
            action={
              <button
                type="button"
                onClick={() => router.push("/tasks")}
                className="text-xs font-medium text-primary hover:text-primary-hovered transition-colors"
              >
                View all →
              </button>
            }
          >
            {openTasks.length === 0 ? (
              <div className="flex flex-col items-center py-token-4">
                <span className="text-2xl mb-token-2">✓</span>
                <p className="text-sm text-text-subdued">All caught up</p>
              </div>
            ) : (
              <ul className="space-y-token-1">
                {openTasks.slice(0, 7).map((task) => (
                  <li
                    key={task.id}
                    className="flex items-start gap-token-2 rounded-md px-token-3 py-token-2 hover:bg-surface-hovered transition-colors"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border">
                      &nbsp;
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text truncate">
                        {task.title}
                      </p>
                      {task.dueDate && (
                        <p className="text-xs text-text-subdued mt-0.5">
                          Due{" "}
                          {formatDate(task.dueDate)}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}

// ─── Reusable Panel Component ─────────────────────────────────────────────────

interface PanelProps {
  title: string;
  count?: number;
  action?: React.ReactNode;
  accentColor?: "amber" | "blue" | "red";
  children: React.ReactNode;
}

function Panel({ title, count, action, accentColor, children }: PanelProps) {
  const accentBorder = accentColor
    ? `border-l-4 border-l-status-${accentColor}`
    : "";

  return (
    <div
      className={`rounded-lg border border-border bg-surface overflow-hidden ${accentBorder}`}
    >
      <div className="flex items-center justify-between border-b border-border px-token-4 py-token-3">
        <div className="flex items-center gap-token-2">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {count !== undefined && count > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-surface-subdued px-token-2 py-0.5 text-xs font-medium text-text-subdued">
              {count}
            </span>
          )}
        </div>
        {action}
      </div>
      <div className="p-token-4">{children}</div>
    </div>
  );
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

interface StatRowProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "amber" | "red" | "green";
}

function StatRow({ label, value, icon, color }: StatRowProps) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-600",
  };
  const valueColorMap = {
    blue: "text-blue-600",
    amber: "text-amber-600",
    red: "text-red-600",
    green: "text-green-600",
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-token-3">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${colorMap[color]}`}
        >
          {icon}
        </span>
        <span className="text-sm text-text">{label}</span>
      </div>
      <span className={`text-lg font-bold ${valueColorMap[color]}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Activity Description ─────────────────────────────────────────────────────

function buildActivityDescription(entry: ActivityLog): string {
  switch (entry.type) {
    case "comment_created":
      return "added a comment";
    case "approval_created": {
      const decision = (entry.detail as { decision?: string }).decision;
      return decision ? `recorded: ${decision}` : "recorded a sign-off";
    }
    case "phase_status_changed": {
      const detail = entry.detail as { from?: string; to?: string };
      if (detail.from && detail.to) return `${detail.from} → ${detail.to}`;
      return "changed phase status";
    }
    case "review_link_sent": {
      const email = (entry.detail as { recipientEmail?: string })
        .recipientEmail;
      return email ? `sent review link to ${email}` : "sent a review link";
    }
    default:
      return "performed an action";
  }
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

// ─── Phase Pipeline Dot ───────────────────────────────────────────────────────

const PHASE_DOT_COLORS: Record<PhaseStatus, string> = {
  Draft: "bg-gray-300",
  "Sent to Client": "bg-blue-400",
  "Waiting for Feedback": "bg-amber-400",
  "Changes Requested": "bg-orange-400",
  Approved: "bg-green-500",
  Completed: "bg-green-600",
};

function PhaseDot({
  status,
  title,
  isCurrent,
}: {
  status: PhaseStatus;
  title: string;
  isCurrent: boolean;
}) {
  const color = PHASE_DOT_COLORS[status] ?? "bg-gray-300";

  return (
    <span
      title={`${title} — ${status}`}
      className={`flex-1 h-2 rounded-full ${color} ${
        isCurrent ? "ring-2 ring-primary ring-offset-1" : ""
      }`}
    />
  );
}
