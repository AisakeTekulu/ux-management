"use client";

/**
 * PortalContent — Mobile-first client review portal.
 *
 * Features:
 * - Sticky status header with blur backdrop
 * - Progressive disclosure via accordions
 * - Fixed action footer with approve/request changes
 * - Identity locked per session
 * - Confirmation modal for approvals
 * - Toast notifications for comment success
 * - Accessible touch targets (44px+)
 * - Single authoritative status display
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Markdown } from "@/components/ui/Markdown";
import { FileViewer } from "@/components/ui/FileViewer";

import type {
  Phase,
  ChecklistItem,
  DesignLink,
  Comment,
  Approval,
} from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PhaseViewModel {
  phase: Phase;
  checklistItems: ChecklistItem[];
  designLinks: DesignLink[];
  comments: Comment[];
  approvals: Approval[];
}

interface ReviewViewModel {
  projectName: string;
  phases: PhaseViewModel[];
  token: string;
}

interface PortalContentProps {
  viewModel: ReviewViewModel;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format date as "Jun 11, 2026" */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Format timestamp as "Jun 11, 10:47 AM" */
function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Get file extension from filename */
function getFileExtension(fileName: string | null): string {
  if (!fileName) return "";
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1]!.toLowerCase() : "";
}

/** Middle-ellipsis for long file names */
function truncateFileName(name: string, maxLen = 28): string {
  if (name.length <= maxLen) return name;
  const ext = name.lastIndexOf(".");
  const extension = ext > -1 ? name.slice(ext) : "";
  const base = ext > -1 ? name.slice(0, ext) : name;
  const keep = maxLen - extension.length - 3;
  const front = Math.ceil(keep / 2);
  const back = Math.floor(keep / 2);
  return base.slice(0, front) + "…" + base.slice(-back) + extension;
}

// ---------------------------------------------------------------------------
// Sub-Components
// ---------------------------------------------------------------------------

/** Accordion panel for progressive disclosure */
function Accordion({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 min-h-[44px] text-left bg-surface hover:bg-surface-subdued transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      >
        <span className="text-sm font-medium text-text">{title}</span>
        <span className="flex items-center gap-2">
          {badge && (
            <span className="inline-flex items-center rounded-full bg-surface-subdued px-2 py-0.5 text-xs font-medium text-text-subdued">
              {badge}
            </span>
          )}
          <svg
            className={`h-4 w-4 text-text-subdued transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div
        ref={contentRef}
        role="region"
        className={`transition-all duration-200 ease-in-out ${open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}
      >
        <div className="px-4 py-3 border-t border-border">{children}</div>
      </div>
    </div>
  );
}

/** Status badge with icon */
function StatusBadge({ status }: { status: Phase["status"] }) {
  const config: Record<string, { icon: string; classes: string }> = {
    Draft: { icon: "📝", classes: "bg-gray-100 text-gray-700" },
    "Sent to Client": { icon: "📤", classes: "bg-blue-100 text-blue-700" },
    "Waiting for Feedback": { icon: "🕐", classes: "bg-blue-100 text-blue-700" },
    "Changes Requested": { icon: "⚠️", classes: "bg-amber-100 text-amber-800" },
    Approved: { icon: "✓", classes: "bg-green-100 text-green-800" },
    Completed: { icon: "✓✓", classes: "bg-green-100 text-green-800" },
  };

  const { icon, classes } = config[status] ?? { icon: "•", classes: "bg-gray-100 text-gray-700" };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
      role="status"
      aria-label={`Status: ${status}`}
    >
      <span aria-hidden="true">{icon}</span>
      {status}
    </span>
  );
}

/** File type icon */
function FileIcon({ fileName }: { fileName: string | null }) {
  const ext = getFileExtension(fileName);
  const isPdf = ext === "pdf";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);

  if (isPdf) {
    return (
      <svg className="h-5 w-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    );
  }

  if (isImage) {
    return (
      <svg className="h-5 w-5 flex-shrink-0 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5 flex-shrink-0 text-text-subdued" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

/** Confirmation Modal */
function ConfirmModal({
  open,
  phaseName,
  reviewerName,
  reviewerInitials,
  decision,
  onConfirm,
  onCancel,
  submitting,
}: {
  open: boolean;
  phaseName: string;
  reviewerName: string;
  reviewerInitials: string;
  decision: "Approved" | "Changes Requested";
  onConfirm: () => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-sm rounded-xl bg-surface p-6 shadow-xl">
        <h3 id="confirm-modal-title" className="text-lg font-bold text-text mb-2">
          {decision === "Approved" ? "Confirm Approval" : "Confirm Request"}
        </h3>
        <p className="text-sm text-text-subdued mb-6">
          {decision === "Approved"
            ? `Are you sure you want to approve "${phaseName}"? This will be recorded as ${reviewerName} (${reviewerInitials}).`
            : `Are you sure you want to request changes for "${phaseName}"? This will be recorded as ${reviewerName} (${reviewerInitials}).`}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 min-h-[44px] rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text hover:bg-surface-subdued focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={`flex-1 min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 disabled:opacity-60 ${
              decision === "Approved"
                ? "bg-green-600 hover:bg-green-700 focus-visible:ring-green-500"
                : "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500"
            }`}
          >
            {submitting ? "Submitting…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Toast notification */
function Toast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-green-700 px-4 py-3 text-sm font-medium text-white shadow-lg"
      role="alert"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function PortalContent({ viewModel }: PortalContentProps) {
  const { projectName, phases, token } = viewModel;

  // --- Identity state (locked per session) ---
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerInitials, setReviewerInitials] = useState("");
  const [identityLocked, setIdentityLocked] = useState(false);

  // --- Sign-off state ---
  const [signOffPhaseId, setSignOffPhaseId] = useState(
    phases.length === 1 ? phases[0]!.phase.id : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [signOffResult, setSignOffResult] = useState<{
    ok: boolean;
    message: string;
    decision?: string;
  } | null>(null);

  // --- Confirmation modal ---
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<"Approved" | "Changes Requested">("Approved");

  // --- Comment state ---
  const [commentText, setCommentText] = useState("");
  const [commentPhaseId, setCommentPhaseId] = useState(
    phases.length === 1 ? phases[0]!.phase.id : ""
  );
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // --- Toast state ---
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Comments expansion state ---
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});

  // --- File viewer state ---
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState<{ url: string; name: string } | null>(null);

  // --- Derived state ---
  const currentPhase = phases.find((p) => p.phase.id === signOffPhaseId) ?? phases[0];
  const currentStatus = currentPhase?.phase.status ?? "Waiting for Feedback";
  const sessionApproved = signOffResult?.ok === true;

  // --- Helpers ---
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000);
  }, []);

  const lockIdentity = useCallback(() => {
    if (reviewerName.trim() && reviewerInitials.trim()) {
      setIdentityLocked(true);
    }
  }, [reviewerName, reviewerInitials]);

  // --- Handlers ---
  const handleApproveClick = (decision: "Approved" | "Changes Requested") => {
    if (!reviewerName.trim() || !reviewerInitials.trim()) {
      setSignOffResult({ ok: false, message: "Please enter your name and initials." });
      return;
    }
    if (!signOffPhaseId) {
      setSignOffResult({ ok: false, message: "Please select a phase to sign off on." });
      return;
    }
    lockIdentity();
    setPendingDecision(decision);
    setConfirmOpen(true);
  };

  const handleSignOffConfirm = async () => {
    setSubmitting(true);
    setSignOffResult(null);

    try {
      const res = await fetch(`/review/${token}/signoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: reviewerName.trim(),
          initials: reviewerInitials.trim(),
          decision: pendingDecision,
          phaseId: signOffPhaseId,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSignOffResult({
          ok: true,
          message:
            pendingDecision === "Approved"
              ? "Thank you! Your approval has been recorded."
              : "Your feedback has been recorded. The designer will review your changes.",
          decision: pendingDecision,
        });
      } else {
        setSignOffResult({ ok: false, message: data.message || "Something went wrong." });
      }
    } catch {
      setSignOffResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !reviewerName.trim()) {
      showToast("Please enter your name and comment.");
      return;
    }

    lockIdentity();
    setCommentSubmitting(true);

    try {
      const res = await fetch(`/review/${token}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: commentText.trim(),
          reviewerName: reviewerName.trim(),
          phaseId: commentPhaseId || phases[0]?.phase.id,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        showToast("Comment added successfully.");
        setCommentText("");
      } else {
        showToast(data.message || "Failed to add comment.");
      }
    } catch {
      showToast("Network error. Please try again.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      {/* ─── STICKY STATUS HEADER ─── */}
      <header
        className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur-md"
      >
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary">
              <svg
                className="h-4 w-4 text-text-on-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h1 className="text-base font-bold text-text truncate">{projectName}</h1>
          </div>
          <StatusBadge status={currentStatus} />
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="mx-auto max-w-3xl px-4 py-6 pb-36 space-y-6">
        {/* Phase sections */}
        {phases.map(({ phase, checklistItems, designLinks, comments, approvals }) => {
          const completedCount = checklistItems.filter((i) => i.complete).length;
          const totalChecklist = checklistItems.length;
          const latestApproval = approvals.length > 0 ? approvals[0] : null;
          const olderApprovals = approvals.slice(1);
          const isExpanded = expandedComments[phase.id] ?? false;
          const visibleComments = isExpanded ? comments : comments.slice(-2);

          return (
            <section
              key={phase.id}
              className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden"
              aria-labelledby={`phase-title-${phase.id}`}
            >
              {/* Phase heading */}
              <div className="px-4 py-4 border-b border-border">
                <div className="flex items-center justify-between gap-2">
                  <h2
                    id={`phase-title-${phase.id}`}
                    className="text-base font-semibold text-text"
                  >
                    {phase.ordinal}. {phase.title}
                  </h2>
                  <StatusBadge status={phase.status} />
                </div>
                {phase.dueDate && (
                  <p className="mt-1 text-xs text-text-subdued">
                    Due: {formatDate(phase.dueDate)}
                  </p>
                )}
              </div>

              <div className="px-4 py-4 space-y-4">
                {/* Description — always visible */}
                {phase.description && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subdued mb-2">
                      Deliverable
                    </h3>
                    <div className="prose prose-sm max-w-none text-text">
                      <Markdown content={phase.description} />
                    </div>
                  </div>
                )}

                {/* Latest status (single authoritative) */}
                {latestApproval && (
                  <div className={`rounded-lg p-3 ${
                    latestApproval.decision === "Approved"
                      ? "bg-green-50 border border-green-200"
                      : "bg-amber-50 border border-amber-200"
                  }`}>
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-base">
                        {latestApproval.decision === "Approved" ? "✓" : "⚠️"}
                      </span>
                      <span className={`text-sm font-semibold ${
                        latestApproval.decision === "Approved" ? "text-green-800" : "text-amber-800"
                      }`}>
                        {latestApproval.decision}
                      </span>
                      <span className="text-xs text-text-subdued ml-auto">
                        by {latestApproval.reviewerName} · {formatDate(latestApproval.createdAt)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Checklist Accordion */}
                {checklistItems.length > 0 && (
                  <Accordion
                    title="Checklist"
                    badge={`${completedCount}/${totalChecklist} complete`}
                  >
                    <p className="text-xs text-text-subdued mb-3 italic">
                      Please review all items before signing off.
                    </p>
                    <ul className="space-y-2" role="list" aria-label="Checklist items">
                      {checklistItems.map((item) => (
                        <li key={item.id} className="flex items-start gap-2.5">
                          <span
                            className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                              item.complete
                                ? "bg-green-500 border-green-500 text-white"
                                : "border-border bg-surface"
                            }`}
                            role="img"
                            aria-label={item.complete ? "Complete" : "Incomplete"}
                          >
                            {item.complete && (
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className={`text-sm ${item.complete ? "text-text-subdued line-through" : "text-text"}`}>
                            {item.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Accordion>
                )}

                {/* Attachments Accordion */}
                {designLinks.length > 0 && (
                  <Accordion
                    title="Attachments"
                    badge={`${designLinks.length} file${designLinks.length !== 1 ? "s" : ""}`}
                  >
                    <ul className="space-y-2" role="list" aria-label="Attachments">
                      {designLinks.map((dl) => (
                        <li
                          key={dl.id}
                          className="flex items-center gap-3 rounded-lg border border-border p-3"
                        >
                          {dl.kind === "url" ? (
                            <>
                              <svg
                                className="h-5 w-5 flex-shrink-0 text-primary"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                aria-hidden="true"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.06a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374" />
                              </svg>
                              <a
                                href={dl.url ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 min-w-0 text-sm text-primary hover:text-primary-hovered hover:underline truncate min-h-[44px] flex items-center"
                                aria-label={`Open link: ${dl.url}`}
                              >
                                {dl.url ? truncateFileName(dl.url, 40) : "External link"}
                              </a>
                            </>
                          ) : (
                            <>
                              <FileIcon fileName={dl.fileName} />
                              <span className="flex-1 min-w-0 text-sm text-text truncate">
                                {truncateFileName(dl.fileName ?? "File")}
                              </span>
                              <div className="flex gap-1 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewerFile({
                                      url: `/review/${token}/files/${dl.id}`,
                                      name: dl.fileName ?? "File",
                                    });
                                    setViewerOpen(true);
                                  }}
                                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-xs font-medium text-primary hover:text-primary-hovered hover:bg-surface-subdued focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                  aria-label={`View ${dl.fileName ?? "file"}`}
                                >
                                  View
                                </button>
                                <a
                                  href={`/review/${token}/files/${dl.id}`}
                                  download
                                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md text-xs font-medium text-primary hover:text-primary-hovered hover:bg-surface-subdued focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                  aria-label={`Download ${dl.fileName ?? "file"}`}
                                >
                                  Download
                                </a>
                              </div>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Accordion>
                )}

                {/* Comments — latest 2, expandable */}
                {comments.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subdued mb-2">
                      Comments
                    </h3>
                    <div className="space-y-2">
                      {visibleComments.map((comment) => (
                        <div
                          key={comment.id}
                          className={`rounded-lg p-3 text-sm ${
                            comment.authorType === "designer"
                              ? "bg-blue-50 border border-blue-100"
                              : "bg-surface-subdued border border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-text text-xs">
                              {comment.authorType === "designer"
                                ? "Designer"
                                : comment.authorName ?? "Reviewer"}
                            </span>
                            <time className="text-xs text-text-subdued">
                              {formatTimestamp(comment.createdAt)}
                            </time>
                          </div>
                          <p className="text-text text-sm">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                    {comments.length > 2 && !isExpanded && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedComments((prev) => ({ ...prev, [phase.id]: true }))
                        }
                        className="mt-2 min-h-[44px] text-sm font-medium text-primary hover:text-primary-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1"
                        aria-label={`View all ${comments.length} comments`}
                      >
                        View all {comments.length} comments
                      </button>
                    )}
                    {isExpanded && comments.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedComments((prev) => ({ ...prev, [phase.id]: false }))
                        }
                        className="mt-2 min-h-[44px] text-sm font-medium text-primary hover:text-primary-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-2 py-1"
                      >
                        Show less
                      </button>
                    )}
                  </div>
                )}

                {/* Sign-off History Accordion */}
                {olderApprovals.length > 0 && (
                  <Accordion
                    title="Sign-off History"
                    badge={`${olderApprovals.length}`}
                  >
                    <div className="space-y-2">
                      {olderApprovals.map((approval) => (
                        <div
                          key={approval.id}
                          className="flex items-center justify-between rounded-lg border border-border p-3"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                                approval.decision === "Approved"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {approval.reviewerInitials}
                            </span>
                            <div>
                              <span className="text-sm text-text block">
                                {approval.reviewerName}
                              </span>
                              <span
                                className={`text-xs font-medium ${
                                  approval.decision === "Approved"
                                    ? "text-green-600"
                                    : "text-amber-600"
                                }`}
                              >
                                {approval.decision}
                              </span>
                            </div>
                          </div>
                          <time className="text-xs text-text-subdued">
                            {formatDate(approval.createdAt)}
                          </time>
                        </div>
                      ))}
                    </div>
                  </Accordion>
                )}
              </div>
            </section>
          );
        })}

        {/* ─── COMMENT INPUT AREA ─── */}
        <section className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-text mb-3">Leave a Comment</h2>
          <div className="space-y-3">
            {phases.length > 1 && (
              <select
                value={commentPhaseId}
                onChange={(e) => setCommentPhaseId(e.target.value)}
                aria-label="Select phase for comment"
                className="w-full min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select phase…</option>
                {phases.map(({ phase }) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.ordinal}. {phase.title}
                  </option>
                ))}
              </select>
            )}
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              placeholder="Share your feedback or questions…"
              aria-label="Comment text"
              className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-sm text-text placeholder:text-text-subdued focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="button"
              onClick={handleComment}
              disabled={commentSubmitting}
              className="w-full min-h-[44px] rounded-lg bg-primary px-4 py-3 text-sm font-medium text-text-on-primary hover:bg-primary-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 transition-colors"
              aria-label="Send comment"
            >
              {commentSubmitting ? "Sending…" : "Send Comment"}
            </button>
          </div>
        </section>
      </main>

      {/* ─── STICKY ACTION FOOTER ─── */}
      {!sessionApproved && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface/90 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-4 py-3 space-y-2">
            {/* Identity input row (compact) */}
            {!identityLocked ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={reviewerName}
                  onChange={(e) => setReviewerName(e.target.value)}
                  placeholder="Your name"
                  aria-label="Reviewer name"
                  className="flex-1 min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subdued focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  value={reviewerInitials}
                  onChange={(e) => setReviewerInitials(e.target.value)}
                  placeholder="Initials"
                  maxLength={4}
                  aria-label="Reviewer initials"
                  className="w-20 min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subdued focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-text-subdued">
                  Reviewing as <span className="font-medium text-text">{reviewerName}</span> ({reviewerInitials})
                </span>
                <button
                  type="button"
                  onClick={() => setIdentityLocked(false)}
                  className="text-xs text-primary hover:text-primary-hovered underline min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  aria-label="Change reviewer identity"
                >
                  Change
                </button>
              </div>
            )}

            {/* Phase selector for multi-phase */}
            {phases.length > 1 && (
              <select
                value={signOffPhaseId}
                onChange={(e) => setSignOffPhaseId(e.target.value)}
                aria-label="Select phase to sign off"
                className="w-full min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select phase…</option>
                {phases.map(({ phase }) => (
                  <option key={phase.id} value={phase.id}>
                    {phase.ordinal}. {phase.title}
                  </option>
                ))}
              </select>
            )}

            {/* Error from sign-off */}
            {signOffResult && !signOffResult.ok && (
              <p className="text-xs text-red-600" role="alert">{signOffResult.message}</p>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleApproveClick("Approved")}
                disabled={submitting}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-60 transition-colors"
                aria-label="Approve phase"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Approve
              </button>
              <button
                type="button"
                onClick={() => handleApproveClick("Changes Requested")}
                disabled={submitting}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-lg border-2 border-amber-500 bg-surface px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60 transition-colors"
                aria-label="Request changes"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                </svg>
                Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success state replaces footer */}
      {sessionApproved && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-green-200 bg-green-50/95 backdrop-blur-md">
          <div className="mx-auto max-w-3xl px-4 py-4 text-center">
            <p className="text-sm font-semibold text-green-800">
              {signOffResult?.decision === "Approved" ? "✓ Approved" : "⚠️ Feedback Submitted"}
            </p>
            <p className="text-xs text-green-700 mt-0.5">{signOffResult?.message}</p>
          </div>
        </div>
      )}

      {/* ─── SECURE LINK FOOTER ─── */}
      <footer className="mx-auto max-w-3xl px-4 pb-40 pt-4 text-center">
        <p className="text-xs text-text-subdued">
          🔒 This is a secure review link. Do not share it with unauthorized parties.
        </p>
      </footer>

      {/* ─── TOAST OVERLAY ─── */}
      <Toast message={toastMessage} visible={toastVisible} />

      {/* ─── CONFIRMATION MODAL ─── */}
      <ConfirmModal
        open={confirmOpen}
        phaseName={currentPhase?.phase.title ?? "this phase"}
        reviewerName={reviewerName}
        reviewerInitials={reviewerInitials}
        decision={pendingDecision}
        onConfirm={handleSignOffConfirm}
        onCancel={() => setConfirmOpen(false)}
        submitting={submitting}
      />

      {/* ─── FILE VIEWER ─── */}
      {viewerFile && (
        <FileViewer
          fileUrl={viewerFile.url}
          fileName={viewerFile.name}
          open={viewerOpen}
          onClose={() => {
            setViewerOpen(false);
            setViewerFile(null);
          }}
        />
      )}
    </div>
  );
}
