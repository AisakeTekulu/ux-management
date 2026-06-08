"use client";

/**
 * Modal — Polaris-inspired confirm/cancel dialog (Requirements 14.7, 14.8, 15.5, 17.4).
 *
 * A single, reusable overlay dialog that backs both:
 *   - Delete confirmation (R14.7, R17.4): a confirm action and a cancel action,
 *     where the destructive action is performed ONLY after the Designer selects
 *     confirm. Selecting cancel, pressing Escape, or clicking the backdrop
 *     dismisses the dialog with no side effect (R14.8, R17.8).
 *   - The sign-off form (R15.5): the body slot hosts the name/initials inputs
 *     and the official-record statement; confirm submits, cancel dismisses.
 *
 * Action semantics (critical):
 *   - `onConfirm` is invoked EXCLUSIVELY when the confirm control is activated.
 *   - `onCancel` is invoked on the cancel control, the close (×) control, the
 *     Escape key, and a backdrop click. It never runs the confirmed action.
 *   - This component does NOT auto-close on confirm. The parent owns the `open`
 *     flag and decides whether to close based on the action's success/failure
 *     (e.g. keep open to surface validation errors on the sign-off form; close
 *     after a delete resolves). This keeps "perform only on confirm" explicit
 *     and lets failed deletions retain the record while closing (R17.8).
 *
 * Accessibility:
 *   - `role="dialog"` + `aria-modal="true"`, labelled by the title and optionally
 *     described by `description`.
 *   - Focus is moved into the dialog on open and trapped (Tab / Shift+Tab cycle
 *     within the dialog); focus is restored to the previously focused element on
 *     close.
 *   - Escape cancels (R14.8). Background page scroll is locked while open.
 *
 * This is a Client Component because it manages focus, keyboard interaction, and
 * a body-level portal. Presentation/interaction only — the concrete delete and
 * sign-off usages are wired by later view tasks.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** Visual tone of the confirm action. `critical` is used for destructive deletes. */
export type ModalTone = "default" | "critical";

/** Dialog width presets. */
export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  /** Whether the dialog is visible. The parent owns this flag. */
  open: boolean;
  /** Accessible dialog title, rendered in the header and used as the aria label. */
  title: string;
  /**
   * Dismiss handler. Called by the cancel control, the close (×) control, the
   * Escape key, and a backdrop click. Must NOT perform the confirmed action;
   * typically just sets `open` to false and leaves the target record unchanged.
   */
  onCancel: () => void;
  /**
   * Confirm handler. Invoked ONLY when the confirm control is activated. May be
   * async; while it is pending the actions are disabled to prevent double-submit.
   * Omit to render an acknowledgement-only dialog (cancel/close only).
   */
  onConfirm?: () => void | Promise<void>;
  /** Body content (confirmation copy, or a form for the sign-off usage). */
  children?: ReactNode;
  /** Confirm control label. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Cancel control label. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Confirm action tone; `critical` renders a red destructive button. */
  tone?: ModalTone;
  /** Disable the confirm control (e.g. invalid form). */
  confirmDisabled?: boolean;
  /** Externally-driven busy state (e.g. a parent-managed pending action). */
  busy?: boolean;
  /** Optional supporting text rendered under the title and used as the aria description. */
  description?: string;
  /**
   * Optional element to focus when the dialog opens (e.g. the first input of the
   * sign-off form). Defaults to the confirm control, falling back to the first
   * focusable element.
   */
  initialFocusRef?: RefObject<HTMLElement>;
  /** Dialog width preset. Defaults to "md". */
  size?: ModalSize;
  /**
   * Replace the default cancel/confirm footer entirely. When provided,
   * `onConfirm`/labels/tone are ignored for rendering (the parent supplies its
   * own controls). `onCancel` is still wired to Escape/backdrop/close.
   */
  footer?: ReactNode;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

/** Selector matching elements that can receive keyboard focus. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export function Modal({
  open,
  title,
  onCancel,
  onConfirm,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  confirmDisabled = false,
  busy = false,
  description,
  initialFocusRef,
  size = "md",
  footer,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  // Element focused before the dialog opened; restored on close.
  const previouslyFocused = useRef<HTMLElement | null>(null);
  // Internal pending state for async confirm handlers (prevents double-submit).
  const [confirming, setConfirming] = useState(false);
  // Avoid creating a portal during SSR / before hydration.
  const [mounted, setMounted] = useState(false);

  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isBusy = busy || confirming;

  const handleConfirm = useCallback(async () => {
    if (!onConfirm || confirmDisabled || isBusy) return;
    try {
      setConfirming(true);
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }, [onConfirm, confirmDisabled, isBusy]);

  // Manage focus capture/restore and body scroll lock around the open lifecycle.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Lock background scroll while the dialog is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog after it paints.
    const focusTimer = window.setTimeout(() => {
      const target =
        initialFocusRef?.current ??
        confirmRef.current ??
        (dialogRef.current ? getFocusable(dialogRef.current)[0] : null);
      target?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      // Restore focus to the trigger element.
      previouslyFocused.current?.focus?.();
    };
  }, [open, initialFocusRef]);

  // Keyboard handling: Escape cancels (R14.8); Tab is trapped within the dialog.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = getFocusable(dialogRef.current);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !dialogRef.current.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onCancel],
  );

  if (!mounted || !open) return null;

  const confirmToneClasses =
    tone === "critical"
      ? "bg-status-red text-text-on-primary hover:bg-status-red/90 focus-visible:ring-status-red"
      : "bg-primary text-text-on-primary hover:bg-primary-hovered focus-visible:ring-focus";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-token-4"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
      onKeyDown={onKeyDown}
    >
      {/* Backdrop — clicking dismisses without side effect (R14.8). */}
      <button
        type="button"
        aria-label={cancelLabel}
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-text/40"
      />

      {/* Dialog surface. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={cn(
          "relative z-10 w-full overflow-hidden rounded-lg bg-surface shadow-overlay",
          SIZE_CLASSES[size],
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-token-3 border-b border-border px-token-5 py-token-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-base font-semibold text-text">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-token-1 text-sm text-text-subdued">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="-mr-token-2 -mt-token-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-subdued hover:bg-surface-hovered hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        {children != null && (
          <div className="px-token-5 py-token-4 text-sm text-text">{children}</div>
        )}

        {/* Footer actions */}
        {footer ?? (
          <div className="flex justify-end gap-token-3 border-t border-border bg-surface-subdued px-token-5 py-token-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-token-4 py-token-2 text-sm font-medium text-text hover:bg-surface-hovered focus:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            {onConfirm && (
              <button
                ref={confirmRef}
                type="button"
                onClick={handleConfirm}
                disabled={confirmDisabled || isBusy}
                className={cn(
                  "inline-flex items-center justify-center rounded-md px-token-4 py-token-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
                  confirmToneClasses,
                )}
              >
                {isBusy ? "Working…" : confirmLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function CloseIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
