"use client";

/**
 * SignoffModal — Client Portal sign-off form modal (Requirements 9.2, 9.3, 15.5, 15.6).
 *
 * Wraps the shared Modal component with:
 *   - A name input (1–100 characters after trim)
 *   - An initials input (1–10 characters after trim)
 *   - An official-record statement ("This sign-off is an official record")
 *   - Per-field validation messaging that retains entered values on rejection
 *
 * The modal validates client-side before invoking the `onSubmit` callback.
 * On validation failure, the modal remains open with error messages displayed
 * next to the offending fields, and the user's entered values are preserved.
 *
 * This is a Client Component because it manages form state and user interaction.
 */

import { useCallback, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import type { ApprovalDecision } from "@/lib/domain/types";

/** Per-field validation errors surfaced in the modal. */
interface FieldErrors {
  name?: string;
  initials?: string;
}

export interface SignoffModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** The decision the reviewer selected (Approved or Changes Requested). */
  decision: ApprovalDecision;
  /** Called when the reviewer cancels or dismisses the modal. */
  onCancel: () => void;
  /**
   * Called with the validated decision, name, and initials when the form passes
   * client-side validation. May be async; the modal shows a busy state while pending.
   */
  onSubmit: (data: {
    decision: ApprovalDecision;
    name: string;
    initials: string;
  }) => void | Promise<void>;
}

/**
 * Validate name and initials client-side, returning per-field error messages.
 * Returns null if both fields are valid.
 * Exported as `validateSignoffFields` for testability.
 */
export function validateSignoffFields(name: string, initials: string): FieldErrors | null {
  const errors: FieldErrors = {};
  const trimmedName = name.trim();
  const trimmedInitials = initials.trim();

  if (trimmedName.length < 1) {
    errors.name = "Name is required.";
  } else if (trimmedName.length > 100) {
    errors.name = "Name must be at most 100 characters.";
  }

  if (trimmedInitials.length < 1) {
    errors.initials = "Initials are required.";
  } else if (trimmedInitials.length > 10) {
    errors.initials = "Initials must be at most 10 characters.";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

export function SignoffModal({
  open,
  decision,
  onCancel,
  onSubmit,
}: SignoffModalProps) {
  const [name, setName] = useState("");
  const [initials, setInitials] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const handleConfirm = useCallback(async () => {
    // Validate before submitting — retain entered values on rejection (R15.6)
    const validationErrors = validateSignoffFields(name, initials);
    if (validationErrors) {
      setErrors(validationErrors);
      return;
    }

    // Clear any previous errors
    setErrors({});

    try {
      setBusy(true);
      await onSubmit({
        decision,
        name: name.trim(),
        initials: initials.trim(),
      });
    } finally {
      setBusy(false);
    }
  }, [name, initials, decision, onSubmit]);

  const handleCancel = useCallback(() => {
    // Reset form state on cancel
    setName("");
    setInitials("");
    setErrors({});
    onCancel();
  }, [onCancel]);

  const title =
    decision === "Approved" ? "Approve Phase" : "Request Changes";

  const confirmLabel =
    decision === "Approved" ? "Approve" : "Request Changes";

  return (
    <Modal
      open={open}
      title={title}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      confirmLabel={confirmLabel}
      cancelLabel="Cancel"
      busy={busy}
      initialFocusRef={nameInputRef as React.RefObject<HTMLElement>}
      size="md"
    >
      <div className="space-y-token-4">
        {/* Official record statement (R15.5) */}
        <p className="text-sm font-medium text-text-subdued">
          This sign-off is an official record.
        </p>

        {/* Name input */}
        <div>
          <label
            htmlFor="signoff-name"
            className="mb-token-1 block text-sm font-medium text-text"
          >
            Full Name
          </label>
          <input
            ref={nameInputRef}
            id="signoff-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              // Clear field error on change
              if (errors.name) {
                setErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            placeholder="Enter your full name"
            maxLength={101}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "signoff-name-error" : undefined}
            className="w-full rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus aria-[invalid=true]:border-status-red"
          />
          {errors.name && (
            <p
              id="signoff-name-error"
              role="alert"
              className="mt-token-1 text-xs text-status-red"
            >
              {errors.name}
            </p>
          )}
        </div>

        {/* Initials input */}
        <div>
          <label
            htmlFor="signoff-initials"
            className="mb-token-1 block text-sm font-medium text-text"
          >
            Initials
          </label>
          <input
            id="signoff-initials"
            type="text"
            value={initials}
            onChange={(e) => {
              setInitials(e.target.value);
              // Clear field error on change
              if (errors.initials) {
                setErrors((prev) => ({ ...prev, initials: undefined }));
              }
            }}
            placeholder="Enter your initials"
            maxLength={11}
            aria-invalid={!!errors.initials}
            aria-describedby={
              errors.initials ? "signoff-initials-error" : undefined
            }
            className="w-full rounded-md border border-border bg-surface px-token-3 py-token-2 text-sm text-text placeholder:text-text-subdued focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus aria-[invalid=true]:border-status-red"
          />
          {errors.initials && (
            <p
              id="signoff-initials-error"
              role="alert"
              className="mt-token-1 text-xs text-status-red"
            >
              {errors.initials}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
