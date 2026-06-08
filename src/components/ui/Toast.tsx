"use client";

/**
 * Toast / ToastProvider — confirmation toasts for the Admin_Dashboard
 * (Requirement 14.6).
 *
 * Behavior mandated by R14.6:
 *   - When a Designer completes a create, edit, or delete action, a toast is
 *     shown that *identifies the completed action* (the caller supplies the
 *     message, e.g. "Client created", "Project deleted").
 *   - Each toast remains visible for **at least 4 seconds** or until the
 *     Designer dismisses it. The auto-dismiss duration is therefore clamped to
 *     a 4s floor; callers may request a longer duration, or pass `null` to keep
 *     the toast on screen until it is manually dismissed.
 *
 * Usage:
 *   // Wrap the admin surface once (e.g. in the admin layout):
 *   <ToastProvider>{children}</ToastProvider>
 *
 *   // Anywhere beneath the provider, trigger a confirmation:
 *   const { showToast } = useToast();
 *   showToast("Client created");                 // success, 4s minimum
 *   showToast("Could not save", { tone: "error", durationMs: null });
 *
 * This is a Client Component because it owns interactive, timer-driven state.
 * Styling draws exclusively from the Polaris-inspired design tokens in
 * src/app/globals.css (via Tailwind utility mappings).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Minimum on-screen lifetime for an auto-dismissing toast (R14.6: "at least 4
 * seconds"). Requested durations below this floor are raised to it.
 */
export const MIN_TOAST_DURATION_MS = 4_000;

/** Default auto-dismiss duration when a caller does not specify one. */
export const DEFAULT_TOAST_DURATION_MS = MIN_TOAST_DURATION_MS;

/** Visual tone of a toast. Confirmations are `success` by default. */
export type ToastTone = "success" | "info" | "error";

export interface ToastOptions {
  /** Visual tone; defaults to `"success"` for action confirmations. */
  tone?: ToastTone;
  /**
   * Auto-dismiss duration in milliseconds. Values are clamped to a 4s floor
   * (R14.6). Pass `null` to keep the toast visible until manually dismissed.
   * Defaults to {@link DEFAULT_TOAST_DURATION_MS}.
   */
  durationMs?: number | null;
}

export interface Toast {
  /** Stable unique identifier for this toast instance. */
  id: string;
  /** Message identifying the completed action (R14.6). */
  message: string;
  /** Visual tone. */
  tone: ToastTone;
  /**
   * Resolved auto-dismiss duration in ms, or `null` for a persistent toast.
   * Never less than {@link MIN_TOAST_DURATION_MS} when non-null.
   */
  durationMs: number | null;
}

export interface ToastContextValue {
  /** Currently visible toasts, oldest first. */
  toasts: readonly Toast[];
  /**
   * Show a confirmation toast identifying a completed action. Returns the id
   * of the created toast so callers can dismiss it programmatically.
   */
  showToast: (message: string, options?: ToastOptions) => string;
  /** Dismiss a toast by id (no-op if it is already gone). */
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Resolve a requested duration into the value actually used, enforcing the
 * R14.6 4-second floor. `null`/`undefined` semantics:
 *   - `undefined` → {@link DEFAULT_TOAST_DURATION_MS}
 *   - `null`      → persistent (returned as `null`)
 *   - number      → `max(value, MIN_TOAST_DURATION_MS)`
 */
export function resolveToastDuration(durationMs: number | null | undefined): number | null {
  if (durationMs === undefined) return DEFAULT_TOAST_DURATION_MS;
  if (durationMs === null) return null;
  if (!Number.isFinite(durationMs)) return DEFAULT_TOAST_DURATION_MS;
  return Math.max(durationMs, MIN_TOAST_DURATION_MS);
}

export interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Provides toast state to descendants and renders the toast viewport. Wrap the
 * admin surface once so any view can call {@link useToast} to confirm actions.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // Monotonic counter guarantees unique ids without relying on crypto APIs.
  const counterRef = useRef(0);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message: string, options?: ToastOptions): string => {
    counterRef.current += 1;
    const id = `toast-${counterRef.current}`;
    const toast: Toast = {
      id,
      message,
      tone: options?.tone ?? "success",
      durationMs: resolveToastDuration(options?.durationMs),
    };
    setToasts((current) => [...current, toast]);
    return id;
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, showToast, dismissToast }),
    [toasts, showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

/**
 * Access the toast API. Must be called from within a {@link ToastProvider}.
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (ctx === null) {
    throw new Error("useToast must be used within a <ToastProvider>.");
  }
  return ctx;
}

/* --------------------------------------------------------------------------
 * Presentation
 * ------------------------------------------------------------------------ */

interface ToastViewportProps {
  toasts: readonly Toast[];
  onDismiss: (id: string) => void;
}

/**
 * Fixed, bottom-centered region that stacks active toasts. Announced politely
 * to assistive technology so confirmations are conveyed without stealing focus.
 */
function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-token-2 p-token-4"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const TONE_STYLES: Record<ToastTone, string> = {
  success: "border-status-green/30 bg-surface text-text",
  info: "border-status-blue/30 bg-surface text-text",
  error: "border-status-red/30 bg-surface text-text",
};

const TONE_ACCENT: Record<ToastTone, string> = {
  success: "bg-status-green",
  info: "bg-status-blue",
  error: "bg-status-red",
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

/**
 * A single toast. Owns its own auto-dismiss timer so that the visible lifetime
 * is independent per toast; the timer is cleared on manual dismiss/unmount.
 * Persistent toasts (`durationMs === null`) never auto-dismiss.
 */
function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { id, message, tone, durationMs } = toast;

  useEffect(() => {
    if (durationMs === null) return;
    const timer = setTimeout(() => onDismiss(id), durationMs);
    return () => clearTimeout(timer);
  }, [id, durationMs, onDismiss]);

  return (
    <div
      // Errors are assertive; confirmations are polite.
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-token-3 overflow-hidden rounded-md border p-token-3 shadow-overlay",
        TONE_STYLES[tone],
      )}
    >
      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", TONE_ACCENT[tone])} aria-hidden="true" />
      <p className="min-w-0 flex-1 break-words text-sm font-medium">{message}</p>
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className="-m-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-text-subdued transition-colors hover:bg-surface-hovered hover:text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <CloseIcon />
      </button>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      width={16}
      height={16}
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
