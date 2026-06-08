"use client";

/**
 * Phase workspace — where you create and manage deliverable content.
 *
 * Clean editor-style layout with:
 * - Back navigation to project
 * - Description editor with markdown preview
 * - Checklist builder
 * - File uploads and design links
 * - Comments thread
 * - Phase status and approval info
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { Banner } from "@/components/ui/Banner";
import { Markdown } from "@/components/ui/Markdown";
import { FileUpload } from "@/components/ui/FileUpload";
import { FileViewer } from "@/components/ui/FileViewer";

import { updatePhase, completePhase } from "@/lib/actions/phases";
import {
  addChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem,
} from "@/lib/actions/checklist";
import { addDesignLinkUrl, deleteDesignLink } from "@/lib/actions/design-links";
import { addComment } from "@/lib/actions/comments";

import type {
  Phase,
  ChecklistItem,
  DesignLink,
  Comment,
  Approval,
} from "@/lib/domain/types";
import type { StatusBadgeKey } from "@/lib/domain/status-presentation";

interface PhaseDetailData {
  phase: Phase;
  phases: Phase[];
  checklistItems: ChecklistItem[];
  designLinks: DesignLink[];
  comments: Comment[];
  approvals: Approval[];
  projectName: string;
}

async function fetchPhaseDetail(projectId: string, phaseId: string): Promise<PhaseDetailData | null> {
  const res = await fetch(`/api/projects/${projectId}/phases/${phaseId}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

function isPhaseOverdue(phase: Phase): boolean {
  if (!phase.dueDate) return false;
  if (phase.status === "Approved" || phase.status === "Completed") return false;
  const now = new Date();
  const due = new Date(phase.dueDate + "T00:00:00Z");
  return Math.floor(now.getTime() / 86_400_000) > Math.floor(due.getTime() / 86_400_000);
}

export default function PhaseDetailPage() {
  const params = useParams<{ id: string; phaseId: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const [data, setData] = useState<PhaseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [description, setDescription] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  // Checklist
  const [newChecklistText, setNewChecklistText] = useState("");

  // Design links
  const [newLinkUrl, setNewLinkUrl] = useState("");

  // File viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState<{ url: string; name: string } | null>(null);

  // Comments
  const [commentText, setCommentText] = useState("");

  // Complete modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  // Background refresh — doesn't show loading spinner, just silently updates
  const refreshData = useCallback(async () => {
    const result = await fetchPhaseDetail(params.id, params.phaseId);
    if (result) {
      setData(result);
      // Only update editor fields if they haven't been modified by the user
      // (avoid clobbering unsaved edits)
    }
  }, [params.id, params.phaseId]);

  const loadData = useCallback(async () => {
    // Only show loading on first load
    if (!data) setLoading(true);
    setError(null);
    const result = await fetchPhaseDetail(params.id, params.phaseId);
    if (!result) { setError("Phase not found."); setLoading(false); return; }
    setData(result);
    setDescription(result.phase.description);
    setInternalNotes(result.phase.internalNotes);
    setDueDate(result.phase.dueDate ?? "");
    setLoading(false);
  }, [params.id, params.phaseId, data]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.id, params.phaseId]);

  const handleSave = async () => {
    setSaving(true);
    const result = await updatePhase(params.phaseId, { description, internalNotes, dueDate: dueDate || null });
    setSaving(false);
    if (!result.ok) { showToast(result.error.message); return; }
    showToast("Saved");
    // Background refresh to pick up any server-side changes
    refreshData();
  };

  // Optimistic checklist toggle — update UI instantly, sync in background
  const handleToggleChecklist = async (id: string) => {
    if (!data) return;
    // Optimistic: flip the checkbox in local state immediately
    setData({
      ...data,
      checklistItems: data.checklistItems.map((item) =>
        item.id === id ? { ...item, complete: !item.complete } : item
      ),
    });
    // Fire and forget — sync in background
    toggleChecklistItem(id).then(() => {
      // silent background refresh to stay in sync
      refreshData();
    });
  };

  // Optimistic checklist add
  const handleAddChecklist = async () => {
    if (!newChecklistText.trim()) return;
    const text = newChecklistText.trim();
    setNewChecklistText("");

    // Optimistic: add a temporary item to the list
    if (data) {
      const tempItem: ChecklistItem = {
        id: `temp-${Date.now()}`,
        phaseId: params.phaseId,
        text,
        complete: false,
        createdAt: new Date().toISOString(),
      };
      setData({ ...data, checklistItems: [...data.checklistItems, tempItem] });
    }

    const result = await addChecklistItem(params.phaseId, text);
    if (!result.ok) { showToast(result.error.message); }
    // Refresh to get the real ID from the server
    refreshData();
  };

  // Optimistic checklist delete
  const handleDeleteChecklist = async (id: string) => {
    if (!data) return;
    // Optimistic: remove from local state immediately
    setData({
      ...data,
      checklistItems: data.checklistItems.filter((item) => item.id !== id),
    });
    deleteChecklistItem(id).then(() => refreshData());
  };

  const handleAddLink = async () => {
    if (!newLinkUrl.trim()) return;
    const url = newLinkUrl.trim();
    setNewLinkUrl("");
    const result = await addDesignLinkUrl(params.phaseId, url);
    if (result.ok) { showToast("Link added"); refreshData(); }
    else { showToast(result.error.message); setNewLinkUrl(url); }
  };

  const handleDeleteLink = async (id: string) => {
    if (!data) return;
    // Optimistic remove
    setData({ ...data, designLinks: data.designLinks.filter((l) => l.id !== id) });
    deleteDesignLink(id).then(() => refreshData());
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    const text = commentText.trim();
    setCommentText("");

    // Optimistic: add comment to local state immediately
    if (data) {
      const tempComment: Comment = {
        id: `temp-${Date.now()}`,
        phaseId: params.phaseId,
        authorType: "designer",
        authorUserId: null,
        authorName: null,
        text,
        createdAt: new Date().toISOString(),
      };
      setData({ ...data, comments: [...data.comments, tempComment] });
    }

    const result = await addComment(params.phaseId, text);
    if (!result.ok) { showToast(result.error.message); }
    refreshData();
  };

  const handleComplete = async () => {
    const result = await completePhase(params.phaseId);
    setShowCompleteModal(false);
    if (result.ok) { showToast("Phase completed"); refreshData(); }
    else showToast(result.error.message);
  };

  // Loading state — only on first load
  if (loading && !data) {
    return (
      <div className="space-y-token-4">
        <div className="h-8 w-48 animate-pulse rounded bg-surface-subdued" />
        <div className="h-64 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  if (error || !data) {
    return <Banner tone="critical" title="Error">{error ?? "Unable to load phase."}</Banner>;
  }

  const { phase, phases, checklistItems, designLinks, comments, approvals, projectName } = data;
  const overdue = isPhaseOverdue(phase);
  const badgeStatus: StatusBadgeKey = overdue ? "Overdue" : phase.status;

  return (
    <div className="space-y-token-6">
      {/* Navigation & header */}
      <div>
        <button
          type="button"
          onClick={() => router.push(`/projects/${params.id}`)}
          className="mb-token-3 inline-flex items-center gap-1 text-xs font-medium text-text-subdued hover:text-text transition-colors"
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          {projectName}
        </button>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-token-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {phase.ordinal}
              </span>
              <h1 className="text-xl font-bold text-text">{phase.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-token-3">
            <StatusBadge status={badgeStatus} />
            {phase.status === "Approved" && (
              <button
                type="button"
                onClick={() => setShowCompleteModal(true)}
                className="rounded-lg bg-status-green px-token-3 py-[7px] text-xs font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Mark Complete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Phase navigation — quick switcher */}
      {phases.length > 1 && (
        <div className="flex gap-token-1 overflow-x-auto pb-token-1">
          {phases.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => router.push(`/projects/${params.id}/phases/${p.id}`)}
              className={`shrink-0 rounded-full px-token-3 py-token-1 text-xs font-medium transition-all ${
                p.id === phase.id
                  ? "bg-primary text-text-on-primary shadow-sm"
                  : "bg-surface-subdued text-text-subdued hover:bg-surface-hovered hover:text-text"
              }`}
            >
              {p.ordinal}. {p.title}
            </button>
          ))}
        </div>
      )}

      {/* Main content area — 2 column layout on desktop */}
      <div className="grid grid-cols-1 gap-token-5 lg:grid-cols-3">
        {/* Left column — main content (2/3) */}
        <div className="lg:col-span-2 space-y-token-5">
          {/* Description editor */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-token-4 py-token-3">
              <h2 className="text-sm font-semibold text-text">Content</h2>
              <div className="flex items-center gap-token-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className={`rounded-md px-token-2 py-token-1 text-xs font-medium transition-colors ${
                    previewMode ? "bg-primary/10 text-primary" : "text-text-subdued hover:text-text"
                  }`}
                >
                  {previewMode ? "Preview" : "Edit"}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode(!previewMode)}
                  className={`rounded-md px-token-2 py-token-1 text-xs font-medium transition-colors ${
                    !previewMode ? "bg-primary/10 text-primary" : "text-text-subdued hover:text-text"
                  }`}
                >
                  {!previewMode ? "Preview" : "Edit"}
                </button>
              </div>
            </div>
            <div className="p-token-4">
              {previewMode ? (
                <div className="min-h-[200px]">
                  {description.trim() ? (
                    <Markdown content={description} />
                  ) : (
                    <p className="text-sm text-text-subdued italic">No content yet. Switch to Edit mode to start writing.</p>
                  )}
                </div>
              ) : (
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={10}
                  maxLength={5000}
                  className="w-full resize-y rounded-lg border border-border bg-surface-subdued px-token-3 py-token-3 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:bg-surface focus:outline-none focus:ring-1 focus:ring-focus font-mono"
                  placeholder="Write your phase content here...&#10;&#10;Supports Markdown:&#10;# Heading&#10;- Bullet points&#10;**Bold text**&#10;| Tables |"
                />
              )}
            </div>
          </div>

          {/* Internal notes */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="border-b border-border px-token-4 py-token-3">
              <h2 className="text-sm font-semibold text-text">Internal Notes</h2>
              <p className="text-[11px] text-text-subdued">Only visible to you — not shared with clients</p>
            </div>
            <div className="p-token-4">
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={4}
                maxLength={5000}
                className="w-full resize-y rounded-lg border border-border bg-surface-subdued px-token-3 py-token-3 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:bg-surface focus:outline-none focus:ring-1 focus:ring-focus"
                placeholder="Add private notes, reminders, or context..."
              />
            </div>
          </div>

          {/* Checklist */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="border-b border-border px-token-4 py-token-3">
              <h2 className="text-sm font-semibold text-text">Checklist</h2>
              <p className="text-[11px] text-text-subdued">Items for the client to review and confirm</p>
            </div>
            <div className="p-token-4">
              {checklistItems.length > 0 && (
                <ul className="space-y-token-2 mb-token-4">
                  {checklistItems.map((item) => (
                    <li key={item.id} className="group flex items-center gap-token-3 rounded-md px-token-2 py-token-2 hover:bg-surface-subdued transition-colors">
                      <button
                        type="button"
                        onClick={() => handleToggleChecklist(item.id)}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-all ${
                          item.complete
                            ? "border-primary bg-primary text-white"
                            : "border-border hover:border-primary/50"
                        }`}
                        aria-label={`Toggle "${item.text}"`}
                      >
                        {item.complete && (
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 text-sm ${item.complete ? "text-text-subdued line-through" : "text-text"}`}>
                        {item.text}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteChecklist(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-text-subdued hover:text-status-red transition-all"
                        aria-label="Delete"
                      >
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-token-2">
                <input
                  type="text"
                  value={newChecklistText}
                  onChange={(e) => setNewChecklistText(e.target.value)}
                  placeholder="Add a checklist item..."
                  maxLength={500}
                  className="flex-1 rounded-lg border border-border bg-surface-subdued px-token-3 py-[9px] text-sm text-text placeholder:text-text-subdued focus:border-focus focus:bg-surface focus:outline-none focus:ring-1 focus:ring-focus"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddChecklist(); }}
                />
                <button
                  type="button"
                  onClick={handleAddChecklist}
                  disabled={!newChecklistText.trim()}
                  className="rounded-lg bg-primary px-token-3 py-[9px] text-sm font-medium text-text-on-primary hover:bg-primary-hovered disabled:opacity-40 transition-all"
                >
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="border-b border-border px-token-4 py-token-3">
              <h2 className="text-sm font-semibold text-text">Comments</h2>
            </div>
            <div className="p-token-4">
              {comments.length > 0 && (
                <div className="space-y-token-3 mb-token-4">
                  {comments.map((c) => (
                    <div key={c.id} className={`rounded-lg p-token-3 text-sm ${
                      c.authorType === "designer"
                        ? "bg-primary/5 border border-primary/10"
                        : "bg-surface-subdued border border-border"
                    }`}>
                      <div className="flex items-center justify-between mb-token-1">
                        <span className="text-xs font-semibold text-text">
                          {c.authorType === "designer" ? "You" : (c.authorName ?? "Client")}
                        </span>
                        <time className="text-[11px] text-text-subdued">
                          {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </time>
                      </div>
                      <p className="text-text">{c.text}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-token-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  rows={2}
                  placeholder="Add a comment..."
                  className="flex-1 resize-none rounded-lg border border-border bg-surface-subdued px-token-3 py-[9px] text-sm text-text placeholder:text-text-subdued focus:border-focus focus:bg-surface focus:outline-none focus:ring-1 focus:ring-focus"
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={!commentText.trim()}
                  className="self-end rounded-lg bg-primary px-token-3 py-[9px] text-sm font-medium text-text-on-primary hover:bg-primary-hovered disabled:opacity-40 transition-all"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right column — sidebar (1/3) */}
        <div className="space-y-token-4">
          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-primary px-token-4 py-[11px] text-sm font-semibold text-text-on-primary shadow-sm hover:bg-primary-hovered disabled:opacity-60 transition-all"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>

          {/* Due date */}
          <div className="rounded-lg border border-border bg-surface p-token-4">
            <label className="block text-xs font-semibold text-text-subdued uppercase tracking-wide mb-token-2">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface-subdued px-token-3 py-[9px] text-sm text-text focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </div>

          {/* Files & Links */}
          <div className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="border-b border-border px-token-4 py-token-3">
              <h3 className="text-xs font-semibold text-text-subdued uppercase tracking-wide">Files & Links</h3>
            </div>
            <div className="p-token-4">
              {designLinks.length > 0 && (
                <ul className="space-y-token-2 mb-token-3">
                  {designLinks.map((link) => (
                    <li key={link.id} className="group flex items-center justify-between">
                      {link.kind === "url" ? (
                        <a
                          href={link.url ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-token-2 text-xs text-primary hover:underline truncate"
                        >
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="shrink-0">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                          </svg>
                          <span className="truncate">{link.url}</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setViewerFile({
                              url: `/api/phases/${params.phaseId}/files/${link.id}`,
                              name: link.fileName ?? "File",
                            });
                            setViewerOpen(true);
                          }}
                          className="flex items-center gap-token-2 text-xs text-primary hover:underline truncate"
                        >
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="shrink-0">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />
                          </svg>
                          <span className="truncate">{link.fileName ?? "File"}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteLink(link.id)}
                        className="opacity-0 group-hover:opacity-100 text-text-subdued hover:text-status-red transition-all"
                      >
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Add URL */}
              <div className="flex gap-token-1 mb-token-3">
                <input
                  type="url"
                  value={newLinkUrl}
                  onChange={(e) => setNewLinkUrl(e.target.value)}
                  placeholder="Paste a URL..."
                  className="flex-1 rounded-md border border-border bg-surface-subdued px-token-2 py-[7px] text-xs text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddLink(); }}
                />
                <button type="button" onClick={handleAddLink} className="rounded-md bg-surface-hovered px-token-2 py-[7px] text-xs font-medium text-text hover:bg-primary/10 hover:text-primary transition-colors">
                  Add
                </button>
              </div>

              {/* File upload */}
              <FileUpload phaseId={params.phaseId} onUploadComplete={loadData} />
            </div>
          </div>

          {/* Approvals */}
          {approvals.length > 0 && (
            <div className="rounded-lg border border-border bg-surface overflow-hidden">
              <div className="border-b border-border px-token-4 py-token-3">
                <h3 className="text-xs font-semibold text-text-subdued uppercase tracking-wide">Sign-offs</h3>
              </div>
              <div className="p-token-4 space-y-token-2">
                {approvals.map((a) => (
                  <div key={a.id} className="flex items-center gap-token-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                      a.decision === "Approved" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {a.reviewerInitials}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text truncate">{a.reviewerName}</p>
                      <p className="text-[10px] text-text-subdued">{a.decision}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Complete Phase Modal */}
      <Modal
        open={showCompleteModal}
        title="Complete Phase"
        description="Mark this phase as completed and finalized."
        onCancel={() => setShowCompleteModal(false)}
        onConfirm={handleComplete}
        confirmLabel="Mark Complete"
      >
        <p className="text-sm text-text">
          Are you sure you want to mark <strong>{phase.title}</strong> as completed?
        </p>
      </Modal>

      {/* File Viewer */}
      {viewerFile && (
        <FileViewer
          fileUrl={viewerFile.url}
          fileName={viewerFile.name}
          open={viewerOpen}
          onClose={() => { setViewerOpen(false); setViewerFile(null); }}
        />
      )}
    </div>
  );
}
