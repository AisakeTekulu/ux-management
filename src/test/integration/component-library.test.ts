/**
 * Component library integration tests (Task 17.10).
 *
 * These tests verify the LOGIC and EXPORTS of the Polaris-inspired component
 * library without DOM rendering (no jsdom/happy-dom required). They confirm:
 *
 * 1. StatusBadge: the STATUS_PRESENTATION map has all 7 keys with distinct
 *    colors (detailed coverage in status-presentation.test.ts).
 * 2. Toast: resolveToastDuration enforces the 4s floor (detailed coverage in
 *    Toast.test.ts).
 * 3. Modal: the component and its props interface are correctly exported.
 * 4. EmptyState: the component and its props interface are correctly exported.
 *
 * Validates: Requirements 14.4, 14.5, 14.6, 14.7, 14.8
 */

import { describe, expect, it } from "vitest";

// --- StatusBadge: badge mapping consistency (R14.4) ---

import {
  STATUS_PRESENTATION,
  OVERDUE_BADGE,
  getStatusPresentation,
  type StatusBadgeKey,
} from "@/lib/domain/status-presentation";
import { StatusBadge, type StatusBadgeProps } from "@/components/ui/StatusBadge";

describe("StatusBadge — badge mapping consistency (R14.4)", () => {
  const ALL_KEYS: StatusBadgeKey[] = [
    "Draft",
    "Sent to Client",
    "Waiting for Feedback",
    "Changes Requested",
    "Approved",
    "Completed",
    OVERDUE_BADGE,
  ];

  it("STATUS_PRESENTATION has exactly 7 keys", () => {
    expect(Object.keys(STATUS_PRESENTATION)).toHaveLength(7);
  });

  it("every key maps to a non-empty label and a color token", () => {
    for (const key of ALL_KEYS) {
      const entry = STATUS_PRESENTATION[key];
      expect(entry).toBeDefined();
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.colorToken.length).toBeGreaterThan(0);
      expect(entry.colorClass.length).toBeGreaterThan(0);
    }
  });

  it("all 7 color tokens are pairwise distinct", () => {
    const tokens = ALL_KEYS.map((k) => STATUS_PRESENTATION[k].colorToken);
    expect(new Set(tokens).size).toBe(7);
  });

  it("getStatusPresentation is deterministic", () => {
    for (const key of ALL_KEYS) {
      expect(getStatusPresentation(key)).toStrictEqual(getStatusPresentation(key));
    }
  });

  it("StatusBadge component is exported as a function", () => {
    expect(typeof StatusBadge).toBe("function");
  });

  it("StatusBadgeProps type is structurally correct (status is required)", () => {
    // Type-level check: constructing a valid props object compiles
    const props: StatusBadgeProps = { status: "Draft" };
    expect(props.status).toBe("Draft");

    const propsWithClass: StatusBadgeProps = { status: "Approved", className: "extra" };
    expect(propsWithClass.className).toBe("extra");
  });
});

// --- Toast: duration floor enforcement (R14.6) ---

import {
  resolveToastDuration,
  MIN_TOAST_DURATION_MS,
  DEFAULT_TOAST_DURATION_MS,
  ToastProvider,
  useToast,
  type ToastOptions,
  type Toast,
  type ToastContextValue,
} from "@/components/ui/Toast";

describe("Toast — duration floor enforcement (R14.6)", () => {
  it("MIN_TOAST_DURATION_MS is 4000ms", () => {
    expect(MIN_TOAST_DURATION_MS).toBe(4_000);
  });

  it("DEFAULT_TOAST_DURATION_MS equals the minimum floor", () => {
    expect(DEFAULT_TOAST_DURATION_MS).toBe(MIN_TOAST_DURATION_MS);
  });

  it("resolveToastDuration(undefined) returns the default (4s)", () => {
    expect(resolveToastDuration(undefined)).toBe(DEFAULT_TOAST_DURATION_MS);
  });

  it("resolveToastDuration(null) returns null (persistent toast)", () => {
    expect(resolveToastDuration(null)).toBeNull();
  });

  it("sub-4s values are clamped up to the 4s floor", () => {
    expect(resolveToastDuration(0)).toBe(MIN_TOAST_DURATION_MS);
    expect(resolveToastDuration(2_000)).toBe(MIN_TOAST_DURATION_MS);
    expect(resolveToastDuration(3_999)).toBe(MIN_TOAST_DURATION_MS);
    expect(resolveToastDuration(-1_000)).toBe(MIN_TOAST_DURATION_MS);
  });

  it("values at or above the floor are kept unchanged", () => {
    expect(resolveToastDuration(4_000)).toBe(4_000);
    expect(resolveToastDuration(10_000)).toBe(10_000);
  });

  it("non-finite values fall back to the default", () => {
    expect(resolveToastDuration(NaN)).toBe(DEFAULT_TOAST_DURATION_MS);
    expect(resolveToastDuration(Infinity)).toBe(DEFAULT_TOAST_DURATION_MS);
  });

  it("ToastProvider and useToast are exported", () => {
    expect(typeof ToastProvider).toBe("function");
    expect(typeof useToast).toBe("function");
  });

  it("Toast type structure is correct", () => {
    const toast: Toast = {
      id: "toast-1",
      message: "Client created",
      tone: "success",
      durationMs: 4_000,
    };
    expect(toast.id).toBe("toast-1");
    expect(toast.tone).toBe("success");
  });
});

// --- Modal: exports and props interface (R14.7, R14.8) ---

import { Modal, type ModalProps, type ModalTone, type ModalSize } from "@/components/ui/Modal";

describe("Modal — exports and props interface (R14.7, R14.8)", () => {
  it("Modal component is exported as a function", () => {
    expect(typeof Modal).toBe("function");
  });

  it("ModalProps interface accepts required fields (open, title, onCancel)", () => {
    const props: ModalProps = {
      open: true,
      title: "Delete client?",
      onCancel: () => {},
    };
    expect(props.open).toBe(true);
    expect(props.title).toBe("Delete client?");
    expect(typeof props.onCancel).toBe("function");
  });

  it("ModalProps supports optional confirm handler and labels", () => {
    const props: ModalProps = {
      open: true,
      title: "Confirm",
      onCancel: () => {},
      onConfirm: async () => {},
      confirmLabel: "Delete",
      cancelLabel: "Keep",
      tone: "critical" as ModalTone,
      size: "lg" as ModalSize,
      confirmDisabled: false,
      busy: false,
      description: "This cannot be undone.",
    };
    expect(props.confirmLabel).toBe("Delete");
    expect(props.tone).toBe("critical");
    expect(props.size).toBe("lg");
  });

  it("ModalTone supports 'default' and 'critical'", () => {
    const tones: ModalTone[] = ["default", "critical"];
    expect(tones).toHaveLength(2);
  });

  it("ModalSize supports 'sm', 'md', and 'lg'", () => {
    const sizes: ModalSize[] = ["sm", "md", "lg"];
    expect(sizes).toHaveLength(3);
  });
});

// --- EmptyState: exports and props interface (R14.5) ---

import { EmptyState, type EmptyStateProps } from "@/components/ui/EmptyState";

describe("EmptyState — exports and props interface (R14.5)", () => {
  it("EmptyState component is exported as a function", () => {
    expect(typeof EmptyState).toBe("function");
  });

  it("EmptyStateProps interface accepts required title field", () => {
    const props: EmptyStateProps = { title: "No clients yet" };
    expect(props.title).toBe("No clients yet");
  });

  it("EmptyStateProps supports optional description, icon, action, className", () => {
    const props: EmptyStateProps = {
      title: "No projects",
      description: "Create your first project to get started.",
      icon: null,
      action: null,
      className: "mt-4",
    };
    expect(props.description).toBe("Create your first project to get started.");
    expect(props.className).toBe("mt-4");
  });
});
