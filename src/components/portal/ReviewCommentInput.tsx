"use client";

/**
 * ReviewCommentInput — Client Portal comment input (Requirements 7.2, 9.1).
 *
 * A text input with a submit button for the reviewer to leave a comment on
 * the shared phase. This is a presentation-only Client Component that manages
 * its own local form state and delegates submission to the parent via callback.
 */

import { useCallback, useState } from "react";

export interface ReviewCommentInputProps {
  /** Called with the trimmed comment text when the reviewer submits. */
  onSubmit: (text: string) => void | Promise<void>;
  /** Whether the input is disabled (e.g., while a submission is in flight). */
  disabled?: boolean;
  /** Placeholder text for the input. */
  placeholder?: string;
}

export function ReviewCommentInput({
  onSubmit,
  disabled = false,
  placeholder = "Leave a comment…",
}: ReviewCommentInputProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || busy || disabled) return;

      try {
        setBusy(true);
        await onSubmit(trimmed);
        setText("");
      } finally {
        setBusy(false);
      }
    },
    [text, busy, disabled, onSubmit],
  );

  const isSubmitDisabled = disabled || busy || text.trim().length === 0;

  return (
    <form onSubmit={handleSubmit} className="flex gap-token-2">
      <label htmlFor="review-comment-input" className="sr-only">
        Comment
      </label>
      <input
        id="review-comment-input"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || busy}
        maxLength={5000}
        aria-label="Comment"
        className="flex-1 rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isSubmitDisabled}
        className="rounded-md bg-action-primary px-token-4 py-token-2 text-sm font-medium text-on-primary transition-colors hover:bg-action-primary-hovered focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
