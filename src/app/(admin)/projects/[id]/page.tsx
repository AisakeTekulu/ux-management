"use client";

/**
 * Project Detail Hub — the central workspace for managing a project.
 *
 * Clean, intuitive layout with:
 * - Project header with actions
 * - Progress overview
 * - Phase list (clickable to enter phase workspace)
 * - Quick add phase
 * - Share link management
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Banner } from "@/components/ui/Banner";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { SendReviewLinkModal } from "@/components/review-link/SendReviewLinkModal";

import { addPhase } from "@/lib/actions/phases";
import { getReviewLinkModalContext, sendReviewLink } from "@/lib/actions/review-links";
import { getProjectDetail, type ProjectDetailData } from "./actions";

import type { StatusBadgeKey } from "@/lib/domain/status-presentation";
import type { ReviewLinkModalContext, SendReviewLinkInput } from "@/lib/domain/types";

function isPhaseOverdue(phase: { dueDate: string | null; status: string }): boolean {
  if (!phase.dueDate) return false;
  if (phase.status === "Approved" || phase.status === "Completed") return false;
  const now = new Date();
  const due = new Date(phase.dueDate + "T00:00:00Z");
  return Math.floor(now.getTime() / 86_400_000) > Math.floor(due.getTime() / 86_400_000);
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [data, setData] = useState<ProjectDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add phase
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhaseTitle, setNewPhaseTitle] = useState("");
  const [addingPhase, setAddingPhase] = useState(false);

  // Share link (kept for the banner display of previously generated links)
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  // Review link modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewModalContext, setReviewModalContext] = useState<ReviewLinkModalContext | null>(null);
  const [loadingModalContext, setLoadingModalContext] = useState(false);

  const loadData = useCallback(async () => {
    if (!data) setLoading(true);
    setError(null);
    const result = await getProjectDetail(params.id);
    if (!result) {
      setError("Project not found.");
      setLoading(false);
      return;
    }
    setData(result);
    setLoading(false);
  }, [params.id, data]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.id]);

  const handleAddPhase = async () => {
    if (!newPhaseTitle.trim()) return;
    setAddingPhase(true);
    const result = await addPhase(params.id, newPhaseTitle.trim());
    setAddingPhase(false);
    if (result.ok) {
      setShowAddPhase(false);
      setNewPhaseTitle("");
      showToast("Phase added");
      loadData();
    } else {
      showToast(result.error.message);
    }
  };

  const handleSendToClient = async () => {
    setLoadingModalContext(true);
    const result = await getReviewLinkModalContext(params.id);
    setLoadingModalContext(false);
    if (result.ok) {
      setReviewModalContext(result.value);
      setReviewModalOpen(true);
    } else {
      showToast(result.error.message);
    }
  };

  const handleSendReviewLink = async (input: SendReviewLinkInput) => {
    const result = await sendReviewLink(input);
    if (result.ok) {
      const url = `${window.location.origin}${result.value.reviewUrl}`;
      setShareUrl(url);
      setReviewModalOpen(false);
      setReviewModalContext(null);
      showToast("Review link sent successfully");
      await loadData();
    } else {
      showToast(result.error.message);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-token-4">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-subdued" />
        <div className="grid grid-cols-3 gap-token-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-surface" />)}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Banner tone="critical" title="Error">{error ?? "Unable to load project."}</Banner>
    );
  }

  const { project, clientName, phases, shareLinks } = data;
  const completedCount = phases.filter((p) => p.status === "Completed" || p.status === "Approved").length;
  const totalCount = phases.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-token-6">
      {/* Header */}
      <div className="flex flex-col gap-token-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="mb-token-2 inline-flex items-center gap-1 text-xs font-medium text-text-subdued hover:text-text transition-colors"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Projects
          </button>
          <h1 className="text-xl font-bold text-text">{project.name}</h1>
          <p className="mt-token-1 text-sm text-text-subdued">{clientName}</p>
        </div>
        <div className="flex items-center gap-token-2">
          <button
            type="button"
            onClick={() => setShowAddPhase(true)}
            className="inline-flex items-center gap-token-2 rounded-lg border border-border bg-surface px-token-3 py-[9px] text-sm font-medium text-text hover:bg-surface-hovered hover:border-border transition-all"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Phase
          </button>
          <button
            type="button"
            onClick={handleSendToClient}
            disabled={loadingModalContext || phases.length === 0}
            className="inline-flex items-center gap-token-2 rounded-lg bg-primary px-token-4 py-[9px] text-sm font-semibold text-text-on-primary shadow-sm hover:bg-primary-hovered disabled:opacity-50 transition-all"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            {loadingModalContext ? "Loading…" : "Send to Client"}
          </button>
        </div>
      </div>

      {/* Share link banner */}
      {shareUrl && (
        <div className="flex items-center gap-token-3 rounded-lg border border-primary/20 bg-primary/5 px-token-4 py-token-3">
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-primary shrink-0" strokeLinecap="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <code className="flex-1 truncate text-xs text-text">{shareUrl}</code>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(shareUrl); showToast("Copied!"); }}
            className="shrink-0 rounded-md bg-primary/10 px-token-3 py-token-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            Copy Link
          </button>
        </div>
      )}

      {/* Progress stats */}
      <div className="grid grid-cols-1 gap-token-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-token-4">
          <p className="text-xs font-medium text-text-subdued uppercase tracking-wide">Progress</p>
          <div className="mt-token-2 flex items-end gap-token-2">
            <span className="text-2xl font-bold text-text">{progressPct}%</span>
            <span className="text-xs text-text-subdued mb-0.5">{completedCount}/{totalCount} phases</span>
          </div>
          <div className="mt-token-2 h-1.5 w-full rounded-full bg-surface-subdued overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-token-4">
          <p className="text-xs font-medium text-text-subdued uppercase tracking-wide">Total Phases</p>
          <p className="mt-token-2 text-2xl font-bold text-text">{totalCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-token-4">
          <p className="text-xs font-medium text-text-subdued uppercase tracking-wide">Completed</p>
          <p className="mt-token-2 text-2xl font-bold text-status-green">{completedCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-token-4">
          <p className="text-xs font-medium text-text-subdued uppercase tracking-wide">In Progress</p>
          <p className="mt-token-2 text-2xl font-bold text-status-blue">{totalCount - completedCount}</p>
        </div>
      </div>

      {/* Phases */}
      <div>
        <div className="flex items-center justify-between mb-token-3">
          <h2 className="text-sm font-semibold text-text">Phases</h2>
          <button
            type="button"
            onClick={() => setShowAddPhase(true)}
            className="text-xs font-medium text-primary hover:text-primary-hovered transition-colors"
          >
            + Add phase
          </button>
        </div>

        {phases.length === 0 ? (
          <Card>
            <div className="p-token-6">
              <EmptyState
                title="No phases yet"
                description="Phases are the building blocks of your project. Add your first phase to start creating deliverables."
                action={
                  <button type="button" onClick={() => setShowAddPhase(true)} className="rounded-lg bg-primary px-token-4 py-[10px] text-sm font-semibold text-text-on-primary shadow-sm hover:bg-primary-hovered">
                    Add your first phase
                  </button>
                }
              />
            </div>
          </Card>
        ) : (
          <div className="space-y-token-2">
            {phases.map((phase) => {
              const overdue = isPhaseOverdue(phase);
              const badgeStatus: StatusBadgeKey = overdue ? "Overdue" : (phase.status as StatusBadgeKey);

              return (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => router.push(`/projects/${params.id}/phases/${phase.id}`)}
                  className="group flex w-full items-center gap-token-4 rounded-lg border border-border bg-surface p-token-4 text-left transition-all hover:shadow-card-hovered hover:border-primary/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {/* Phase number */}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-subdued text-xs font-bold text-text-subdued group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    {phase.ordinal}
                  </span>

                  {/* Phase info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text group-hover:text-primary transition-colors truncate">
                      {phase.title}
                    </p>
                    {phase.description && (
                      <p className="mt-0.5 text-xs text-text-subdued truncate">
                        {phase.description.slice(0, 100)}{phase.description.length > 100 ? "…" : ""}
                      </p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-token-3 shrink-0">
                    {phase.dueDate && (
                      <span className={`text-xs ${overdue ? "text-status-red font-medium" : "text-text-subdued"}`}>
                        {new Date(phase.dueDate + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    )}
                    <StatusBadge status={badgeStatus} />
                    <svg className="h-4 w-4 text-text-subdued group-hover:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Share links */}
      {shareLinks.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text mb-token-3">Review Links</h2>
          <div className="space-y-token-2">
            {shareLinks.map((link) => (
              <div key={link.id} className="flex items-center justify-between rounded-lg border border-border bg-surface px-token-4 py-token-3">
                <div className="min-w-0 flex-1">
                  <code className="text-xs text-text-subdued truncate block">
                    /review/{link.token.slice(0, 12)}…
                  </code>
                  <p className="text-[11px] text-text-subdued mt-0.5">
                    {new Date(link.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {link.firstAccessedAt && " · Viewed by client"}
                  </p>
                </div>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  link.revokedAt
                    ? "bg-red-50 text-red-600"
                    : link.firstAccessedAt
                    ? "bg-green-50 text-green-600"
                    : "bg-blue-50 text-blue-600"
                }`}>
                  {link.revokedAt ? "Revoked" : link.firstAccessedAt ? "Viewed" : "Active"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Phase Modal */}
      <Modal
        open={showAddPhase}
        title="Add a new phase"
        description="Phases organize your deliverables. Each phase can have its own content, checklists, files, and sign-off."
        onCancel={() => { setShowAddPhase(false); setNewPhaseTitle(""); }}
        onConfirm={handleAddPhase}
        confirmLabel="Add Phase"
        confirmDisabled={addingPhase || !newPhaseTitle.trim()}
        busy={addingPhase}
      >
        <div>
          <label htmlFor="phase-title" className="block text-sm font-medium text-text">Phase Title</label>
          <input
            id="phase-title"
            type="text"
            value={newPhaseTitle}
            onChange={(e) => setNewPhaseTitle(e.target.value)}
            placeholder="e.g. Discovery, Wireframes, Final Design, Handoff"
            maxLength={120}
            className="mt-token-1 w-full rounded-lg border border-border bg-surface px-token-3 py-[10px] text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
            onKeyDown={(e) => { if (e.key === "Enter" && newPhaseTitle.trim()) handleAddPhase(); }}
            autoFocus
          />
        </div>
      </Modal>

      {/* Send Review Link Modal (Req 4.1, 7.3, 12.4, 12.5) */}
      {reviewModalContext && (
        <SendReviewLinkModal
          isOpen={reviewModalOpen}
          onClose={() => { setReviewModalOpen(false); setReviewModalContext(null); }}
          context={reviewModalContext}
          onSend={handleSendReviewLink}
        />
      )}
    </div>
  );
}
