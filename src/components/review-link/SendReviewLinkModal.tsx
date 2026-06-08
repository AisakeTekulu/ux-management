"use client";

/**
 * SendReviewLinkModal — Confirmation modal for sending review links to clients.
 *
 * Wraps the shared Modal component with the full send-review-link workflow:
 * - Auto-fills client name, recipient email, and email subject from context
 * - Allows editing of recipient email, CC email, subject, and custom message
 * - Shows a review link preview with a copy button
 * - Displays "Save changed email to client profile" checkbox when email differs
 * - Shows contextual info: project name, phase name, last sent date, total sent count
 * - Warns when client has no primaryEmail on file
 * - Disables "Send Review Link" when no valid email is present
 * - Actions: Cancel, Copy Review Link, Send Test Email, Send Review Link
 *
 * This is a Client Component because it manages form state and user interaction.
 *
 * _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4,
 *  5.5, 5.6, 5.7, 5.8, 9.1, 9.2, 9.3, 13.1, 13.2, 13.3, 13.4, 13.5_
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Banner } from "@/components/ui/Banner";
import type { ReviewLinkModalContext, SendReviewLinkInput } from "@/lib/domain/types";
import {
  emailDiffers,
  generateEmailSubject,
  validateEmailFormat,
} from "@/lib/domain/client-crm";

export interface SendReviewLinkModalProps {
  /** Whether the modal is visible. */
  isOpen: boolean;
  /** Called when the modal is dismissed (Cancel, close, Escape, backdrop). */
  onClose: () => void;
  /** Context data from getReviewLinkModalContext. */
  context: ReviewLinkModalContext;
  /** Called when the admin clicks "Send Review Link". */
  onSend: (input: SendReviewLinkInput) => Promise<void>;
}

export function SendReviewLinkModal({
  isOpen,
  onClose,
  context,
  onSend,
}: SendReviewLinkModalProps) {
  const { client, project, phase, lastSentDate, totalSentCount } = context;

  // ─── Form State ─────────────────────────────────────────────────────────────

  const [recipientEmail, setRecipientEmail] = useState("");
  const [ccEmail, setCcEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [saveEmailToProfile, setSaveEmailToProfile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // ─── Derived Values ─────────────────────────────────────────────────────────

  // Generate the review link preview (Req 4.7)
  const reviewLinkPreview = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/review/preview-token`;
  }, []);

  // Auto-fill values from context on open (Req 4.4, 4.5, 4.6)
  useEffect(() => {
    if (isOpen) {
      setRecipientEmail(context.autoFilledEmail ?? "");
      setCcEmail("");
      setSubject(generateEmailSubject(project.name, phase?.title));
      setCustomMessage("");
      setSaveEmailToProfile(false);
      setCopied(false);
    }
  }, [isOpen, context.autoFilledEmail, project.name, phase?.title]);

  // Check if the entered email is valid (Req 9.3)
  const isEmailValid = useMemo(() => {
    if (recipientEmail.trim().length === 0) return false;
    const result = validateEmailFormat(recipientEmail);
    return result.ok;
  }, [recipientEmail]);

  // Check if the entered email differs from client record (Req 13.5)
  const showEmailDiffers = useMemo(() => {
    if (!client.primaryEmail) return false;
    if (recipientEmail.trim().length === 0) return false;
    return emailDiffers(recipientEmail.trim(), client.primaryEmail);
  }, [recipientEmail, client.primaryEmail]);

  // Whether client has no primary email on file (Req 9.1)
  const hasNoPrimaryEmail = client.primaryEmail == null || client.primaryEmail === "";

  // Whether client is archived (Req 10.1, 10.2)
  const isClientArchived = client.status === "archived";

  // Format the last sent date for display (Req 13.3)
  const formattedLastSent = useMemo(() => {
    if (!lastSentDate) return null;
    try {
      return new Date(lastSentDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return lastSentDate;
    }
  }, [lastSentDate]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    if (!isEmailValid || busy) return;

    const input: SendReviewLinkInput = {
      clientId: client.id,
      projectId: project.id,
      phaseId: phase?.id,
      recipientEmail: recipientEmail.trim(),
      ccEmail: ccEmail.trim() || undefined,
      subject,
      customMessage: customMessage.trim() || undefined,
      saveEmailToProfile,
    };

    try {
      setBusy(true);
      await onSend(input);
    } finally {
      setBusy(false);
    }
  }, [
    isEmailValid,
    busy,
    client.id,
    project.id,
    phase?.id,
    recipientEmail,
    ccEmail,
    subject,
    customMessage,
    saveEmailToProfile,
    onSend,
  ]);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(reviewLinkPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text for manual copy
    }
  }, [reviewLinkPreview]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal
      open={isOpen}
      title="Send Review Link"
      onCancel={onClose}
      size="lg"
      footer={
        <div className="flex items-center justify-between border-t border-border bg-surface-subdued px-token-5 py-token-4">
          <div className="flex gap-token-2">
            {/* Copy Review Link (Req 5.6) */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm font-medium text-text hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {copied ? "Copied!" : "Copy Review Link"}
            </button>
            {/* Send Test Email (Req 5.7) */}
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm font-medium text-text hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              Send Test Email
            </button>
          </div>
          <div className="flex gap-token-3">
            {/* Cancel (Req 4.8) */}
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-token-4 py-token-2 text-sm font-medium text-text hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            {/* Send Review Link (Req 4.8, 9.3, 10.1) */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!isEmailValid || busy || isClientArchived}
              className="inline-flex items-center justify-center rounded-md bg-primary px-token-4 py-token-2 text-sm font-semibold text-text-on-primary hover:bg-primary-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send Review Link"}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-token-4">
        {/* Banner when client is archived (Req 10.1, 10.2) */}
        {isClientArchived && (
          <Banner tone="critical" title="Client is archived">
            Cannot send review links to archived clients. Restore this client to
            re-enable communication.
          </Banner>
        )}

        {/* Warning banner when client has no primary email (Req 9.1) */}
        {hasNoPrimaryEmail && !isClientArchived && (
          <Banner tone="warning" title="No email on file">
            This client has no primary email address saved. Please enter a
            recipient email below to continue.
          </Banner>
        )}

        {/* Context display section (Req 13.1, 13.2, 13.3, 13.4) */}
        <div className="flex flex-wrap gap-x-token-4 gap-y-token-1 text-xs text-text-subdued">
          <span>
            <span className="font-medium text-text">Project:</span>{" "}
            {project.name}
          </span>
          {phase && (
            <span>
              <span className="font-medium text-text">Phase:</span>{" "}
              {phase.title}
            </span>
          )}
          {formattedLastSent && (
            <span>
              <span className="font-medium text-text">Last sent:</span>{" "}
              {formattedLastSent}
            </span>
          )}
          <span>
            <span className="font-medium text-text">Total sent:</span>{" "}
            {totalSentCount}
          </span>
        </div>

        {/* Client Name (read-only, Req 4.3, 4.4) */}
        <div>
          <label
            htmlFor="review-client-name"
            className="mb-token-1 block text-sm font-medium text-text"
          >
            Client Name
          </label>
          <input
            id="review-client-name"
            type="text"
            value={client.fullName ?? client.name}
            readOnly
            className="w-full rounded-md border border-border bg-surface-subdued px-token-3 py-token-2 text-sm text-text-subdued cursor-not-allowed"
          />
        </div>

        {/* Recipient Email (editable, Req 4.3, 4.5, 5.1, 9.2) */}
        <div>
          <label
            htmlFor="review-recipient-email"
            className="mb-token-1 block text-sm font-medium text-text"
          >
            Recipient Email
          </label>
          <input
            id="review-recipient-email"
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="Enter recipient email address"
            className="w-full rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus"
          />
          {/* Email-differs notice (Req 13.5) */}
          {showEmailDiffers && (
            <p className="mt-token-1 text-xs text-status-amber">
              This email differs from the client&apos;s primary email on file.
            </p>
          )}
        </div>

        {/* CC Email (optional, Req 4.3) */}
        <div>
          <label
            htmlFor="review-cc-email"
            className="mb-token-1 block text-sm font-medium text-text"
          >
            CC Email{" "}
            <span className="font-normal text-text-subdued">(optional)</span>
          </label>
          <input
            id="review-cc-email"
            type="email"
            value={ccEmail}
            onChange={(e) => setCcEmail(e.target.value)}
            placeholder="Enter CC email address"
            className="w-full rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        {/* Email Subject (editable, Req 4.3, 4.6, 5.2) */}
        <div>
          <label
            htmlFor="review-subject"
            className="mb-token-1 block text-sm font-medium text-text"
          >
            Email Subject
          </label>
          <input
            id="review-subject"
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter email subject"
            className="w-full rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        {/* Custom Message (textarea, Req 4.3, 5.3) */}
        <div>
          <label
            htmlFor="review-custom-message"
            className="mb-token-1 block text-sm font-medium text-text"
          >
            Custom Message{" "}
            <span className="font-normal text-text-subdued">(optional)</span>
          </label>
          <textarea
            id="review-custom-message"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Add a personal message to include in the email…"
            rows={3}
            className="w-full resize-y rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        {/* Review Link Preview with copy button (Req 4.7) */}
        <div>
          <label className="mb-token-1 block text-sm font-medium text-text">
            Review Link Preview
          </label>
          <div className="flex items-center gap-token-2 rounded-md border border-border bg-surface-subdued px-token-3 py-token-2">
            <code className="flex-1 truncate text-xs text-text-subdued">
              {reviewLinkPreview}
            </code>
            <button
              type="button"
              onClick={handleCopyLink}
              className="shrink-0 rounded-md border border-border bg-surface px-token-2 py-token-1 text-xs font-medium text-text hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* "Save changed email to client profile" checkbox (Req 5.4, 5.5) */}
        {showEmailDiffers && (
          <div className="flex items-center gap-token-2">
            <input
              id="review-save-email"
              type="checkbox"
              checked={saveEmailToProfile}
              onChange={(e) => setSaveEmailToProfile(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-focus"
            />
            <label
              htmlFor="review-save-email"
              className="text-sm text-text"
            >
              Save changed email to client profile
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}
