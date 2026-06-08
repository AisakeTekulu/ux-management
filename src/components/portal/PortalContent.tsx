"use client";

/**
 * PortalContent — Client Component for the review portal.
 *
 * Renders a document-like layout with:
 * - Project header with branding
 * - Phase sections with markdown-rendered descriptions
 * - Checklist, design links, and comments
 * - Comment input for the reviewer
 * - Prominent sign-off area at the bottom
 */

import { useState } from "react";
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
// Component
// ---------------------------------------------------------------------------

export function PortalContent({ viewModel }: PortalContentProps) {
  const { projectName, phases, token } = viewModel;

  const [signOffName, setSignOffName] = useState("");
  const [signOffInitials, setSignOffInitials] = useState("");
  const [signOffPhaseId, setSignOffPhaseId] = useState(
    phases.length === 1 ? phases[0]!.phase.id : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [signOffResult, setSignOffResult] = useState<{
    ok: boolean;
    message: string;
    decision?: string;
  } | null>(null);

  // File viewer state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState<{ url: string; name: string } | null>(null);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [commentName, setCommentName] = useState("");
  const [commentPhaseId, setCommentPhaseId] = useState(
    phases.length === 1 ? phases[0]!.phase.id : ""
  );
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentResult, setCommentResult] = useState<string | null>(null);

  const handleSignOff = async (decision: "Approved" | "Changes Requested") => {
    if (!signOffName.trim() || !signOffInitials.trim()) {
      setSignOffResult({ ok: false, message: "Please enter your name and initials." });
      return;
    }
    if (!signOffPhaseId) {
      setSignOffResult({ ok: false, message: "Please select a phase to sign off on." });
      return;
    }

    setSubmitting(true);
    setSignOffResult(null);

    try {
      const res = await fetch(`/review/${token}/signoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: signOffName.trim(),
          initials: signOffInitials.trim(),
          decision,
          phaseId: signOffPhaseId,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setSignOffResult({
          ok: true,
          message: decision === "Approved"
            ? "Thank you! Your approval has been recorded."
            : "Your feedback has been recorded. The designer will review your changes.",
          decision,
        });
      } else {
        setSignOffResult({ ok: false, message: data.message || "Something went wrong." });
      }
    } catch {
      setSignOffResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleComment = async () => {
    if (!commentText.trim() || !commentName.trim()) {
      setCommentResult("Please enter your name and comment.");
      return;
    }

    setCommentSubmitting(true);
    setCommentResult(null);

    try {
      const res = await fetch(`/review/${token}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: commentText.trim(),
          reviewerName: commentName.trim(),
          phaseId: commentPhaseId || phases[0]?.phase.id,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setCommentResult("Comment added successfully.");
        setCommentText("");
      } else {
        setCommentResult(data.message || "Failed to add comment.");
      }
    } catch {
      setCommentResult("Network error. Please try again.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Document header */}
      <header className="mb-8 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <svg className="h-5 w-5 text-text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">{projectName}</h1>
            <p className="text-sm text-text-subdued">Project Review Document</p>
          </div>
        </div>
      </header>

      {/* Phase sections */}
      <div className="space-y-8">
        {phases.map(({ phase, checklistItems, designLinks, comments, approvals }, idx) => (
          <section
            key={phase.id}
            className="rounded-lg border border-border bg-surface shadow-card overflow-hidden"
          >
            {/* Phase header */}
            <div className="border-b border-border bg-surface-subdued px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text">
                  {phase.ordinal}. {phase.title}
                </h2>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  phase.status === "Approved"
                    ? "bg-green-100 text-green-800"
                    : phase.status === "Changes Requested"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-blue-100 text-blue-800"
                }`}>
                  {phase.status}
                </span>
              </div>
              {phase.dueDate && (
                <p className="mt-1 text-xs text-text-subdued">
                  Due: {new Date(phase.dueDate + "T00:00:00Z").toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric"
                  })}
                </p>
              )}
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Description rendered as markdown */}
              {phase.description && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subdued mb-2">
                    Deliverable
                  </h3>
                  <Markdown content={phase.description} />
                </div>
              )}

              {/* Checklist */}
              {checklistItems.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subdued mb-2">
                    Checklist
                  </h3>
                  <ul className="space-y-2">
                    {checklistItems.map((item) => (
                      <li key={item.id} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded ${
                          item.complete
                            ? "bg-green-500 text-white"
                            : "border-2 border-border bg-surface"
                        }`}>
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
                </div>
              )}

              {/* Design links / files */}
              {designLinks.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subdued mb-2">
                    Attachments & Links
                  </h3>
                  <ul className="space-y-1.5">
                    {designLinks.map((dl) => (
                      <li key={dl.id} className="flex items-center gap-2">
                        <svg className="h-4 w-4 flex-shrink-0 text-text-subdued" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          {dl.kind === "url" ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.06a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          )}
                        </svg>
                        {dl.kind === "url" && dl.url ? (
                          <a
                            href={dl.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:text-primary-hovered hover:underline truncate"
                          >
                            {dl.url}
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setViewerFile({
                                url: `/review/${token}/files/${dl.id}`,
                                name: dl.fileName ?? "File",
                              });
                              setViewerOpen(true);
                            }}
                            className="text-sm text-primary hover:text-primary-hovered hover:underline truncate"
                          >
                            {dl.fileName ?? "Attached file"} — View
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Comments */}
              {comments.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subdued mb-2">
                    Comments
                  </h3>
                  <div className="space-y-3">
                    {comments.map((comment) => (
                      <div
                        key={comment.id}
                        className={`rounded-lg p-3 text-sm ${
                          comment.authorType === "designer"
                            ? "bg-blue-50 border border-blue-100"
                            : "bg-surface-subdued border border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-text">
                            {comment.authorType === "designer" ? "Designer" : (comment.authorName ?? "Reviewer")}
                          </span>
                          <time className="text-xs text-text-subdued">
                            {new Date(comment.createdAt).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                            })}
                          </time>
                        </div>
                        <p className="text-text">{comment.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approval history */}
              {approvals.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-text-subdued mb-2">
                    Previous Sign-offs
                  </h3>
                  <div className="space-y-2">
                    {approvals.map((approval) => (
                      <div key={approval.id} className="flex items-center justify-between rounded border border-border p-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            approval.decision === "Approved"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            {approval.reviewerInitials}
                          </span>
                          <span className="text-sm text-text">{approval.reviewerName}</span>
                          <span className={`text-xs font-medium ${
                            approval.decision === "Approved" ? "text-green-600" : "text-amber-600"
                          }`}>
                            — {approval.decision}
                          </span>
                        </div>
                        <time className="text-xs text-text-subdued">
                          {new Date(approval.createdAt).toLocaleDateString()}
                        </time>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Add Comment Section */}
      <section className="mt-8 rounded-lg border border-border bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold text-text mb-4">Leave a Comment</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="comment-name" className="block text-sm font-medium text-text mb-1">
                Your Name
              </label>
              <input
                id="comment-name"
                type="text"
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>
            {phases.length > 1 && (
              <div>
                <label htmlFor="comment-phase" className="block text-sm font-medium text-text mb-1">
                  Phase
                </label>
                <select
                  id="comment-phase"
                  value={commentPhaseId}
                  onChange={(e) => setCommentPhaseId(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
                >
                  <option value="">Select phase...</option>
                  {phases.map(({ phase }) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.ordinal}. {phase.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            placeholder="Share your feedback or questions..."
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
          />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleComment}
              disabled={commentSubmitting}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-text-on-primary hover:bg-primary-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:opacity-60"
            >
              {commentSubmitting ? "Sending..." : "Send Comment"}
            </button>
            {commentResult && (
              <p className={`text-sm ${commentResult.includes("success") ? "text-green-600" : "text-status-red"}`}>
                {commentResult}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Sign-Off Section — prominent at the bottom */}
      {!signOffResult?.ok ? (
        <section className="mt-8 rounded-lg border-2 border-primary bg-surface p-6 shadow-card">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-text">Client Sign-Off</h2>
            <p className="mt-1 text-sm text-text-subdued">
              Please review the deliverables above, then approve or request changes below.
            </p>
          </div>

          <div className="space-y-4">
            {/* Name and initials */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="signoff-name" className="block text-sm font-medium text-text mb-1">
                  Full Name <span className="text-status-red">*</span>
                </label>
                <input
                  id="signoff-name"
                  type="text"
                  value={signOffName}
                  onChange={(e) => setSignOffName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
                />
              </div>
              <div>
                <label htmlFor="signoff-initials" className="block text-sm font-medium text-text mb-1">
                  Initials <span className="text-status-red">*</span>
                </label>
                <input
                  id="signoff-initials"
                  type="text"
                  value={signOffInitials}
                  onChange={(e) => setSignOffInitials(e.target.value)}
                  placeholder="JS"
                  maxLength={4}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
                />
              </div>
            </div>

            {/* Phase selector (for multi-phase links) */}
            {phases.length > 1 && (
              <div>
                <label htmlFor="signoff-phase" className="block text-sm font-medium text-text mb-1">
                  Phase to Sign Off <span className="text-status-red">*</span>
                </label>
                <select
                  id="signoff-phase"
                  value={signOffPhaseId}
                  onChange={(e) => setSignOffPhaseId(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
                >
                  <option value="">Select a phase...</option>
                  {phases.map(({ phase }) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.ordinal}. {phase.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Error message */}
            {signOffResult && !signOffResult.ok && (
              <p className="text-sm text-status-red">{signOffResult.message}</p>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => handleSignOff("Approved")}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 disabled:opacity-60"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {submitting ? "Submitting..." : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => handleSignOff("Changes Requested")}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-amber-500 bg-white px-6 py-3 text-sm font-semibold text-amber-700 shadow-sm hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                </svg>
                {submitting ? "Submitting..." : "Request Changes"}
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* Success confirmation */
        <section className="mt-8 rounded-lg border-2 border-green-200 bg-green-50 p-6 text-center shadow-card">
          <svg className="mx-auto h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="mt-3 text-xl font-bold text-green-800">
            {signOffResult.decision === "Approved" ? "Approved!" : "Feedback Submitted"}
          </h2>
          <p className="mt-2 text-sm text-green-700">{signOffResult.message}</p>
        </section>
      )}

      {/* Footer */}
      <footer className="mt-12 border-t border-border pt-6 text-center">
        <p className="text-xs text-text-subdued">
          This is a secure review link. Do not share it with unauthorized parties.
        </p>
      </footer>

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
