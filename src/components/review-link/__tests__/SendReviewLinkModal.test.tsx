/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for SendReviewLinkModal.
 *
 * Validates: Requirements 4.4, 4.5, 5.1, 9.1, 9.2, 13.5
 *
 * Tests cover:
 * 1. Auto-fill with known client data (name, email, subject)
 * 2. Field editability (email, subject, custom message)
 * 3. Disabled send button when no valid email
 * 4. Email-differs notice display
 * 5. Warning banner when client has no primaryEmail
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SendReviewLinkModal } from "../SendReviewLinkModal";
import type { ReviewLinkModalContext } from "@/lib/domain/types";

// ─── Test Helpers ───────────────────────────────────────────────────────────

function buildContext(
  overrides: Partial<ReviewLinkModalContext> = {}
): ReviewLinkModalContext {
  return {
    client: {
      id: "client-1",
      ownerId: "owner-1",
      name: "Test Client",
      status: "active",
      deletedAt: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      fullName: "Jane Doe",
      businessName: "Doe Studios",
      primaryEmail: "jane@doe.com",
      secondaryEmail: null,
      phone: null,
      website: null,
      location: null,
      preferredContactMethod: "email",
      notes: null,
    },
    project: {
      id: "project-1",
      clientId: "client-1",
      ownerId: "owner-1",
      name: "Website Redesign",
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    phase: {
      id: "phase-1",
      projectId: "project-1",
      title: "Wireframes",
      ordinal: 1,
      description: "",
      internalNotes: "",
      status: "Sent to Client",
      dueDate: null,
      approvedByName: null,
      approvedInitials: null,
      approvedAt: null,
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    lastSentDate: "2024-06-01T12:00:00.000Z",
    totalSentCount: 3,
    autoFilledEmail: "jane@doe.com",
    autoFilledName: "Jane Doe",
    ...overrides,
  };
}

const defaultOnSend = vi.fn().mockResolvedValue(undefined);
const defaultOnClose = vi.fn();

function renderModal(
  contextOverrides: Partial<ReviewLinkModalContext> = {},
  props: { onSend?: typeof defaultOnSend; onClose?: typeof defaultOnClose } = {}
) {
  const context = buildContext(contextOverrides);
  return render(
    <SendReviewLinkModal
      isOpen={true}
      onClose={props.onClose ?? defaultOnClose}
      context={context}
      onSend={props.onSend ?? defaultOnSend}
    />
  );
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("SendReviewLinkModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ─── 1. Auto-fill with known client data ────────────────────────────────

  describe("auto-fill with known client data", () => {
    it("shows client fullName in the Client Name field (Req 4.4)", () => {
      renderModal();
      const nameInput = screen.getByLabelText("Client Name") as HTMLInputElement;
      expect(nameInput.value).toBe("Jane Doe");
    });

    it("auto-fills recipient email from context.autoFilledEmail (Req 4.5)", () => {
      renderModal();
      const emailInput = screen.getByLabelText(
        "Recipient Email"
      ) as HTMLInputElement;
      expect(emailInput.value).toBe("jane@doe.com");
    });

    it("auto-fills email subject from project and phase names (Req 4.6)", () => {
      renderModal();
      const subjectInput = screen.getByLabelText(
        "Email Subject"
      ) as HTMLInputElement;
      expect(subjectInput.value).toBe("Review: Website Redesign - Wireframes");
    });

    it("generates subject without phase when phase is not provided", () => {
      renderModal({ phase: undefined });
      const subjectInput = screen.getByLabelText(
        "Email Subject"
      ) as HTMLInputElement;
      expect(subjectInput.value).toBe("Review: Website Redesign");
    });

    it("falls back to client.name when fullName is null", () => {
      renderModal({
        client: {
          id: "client-1",
          ownerId: "owner-1",
          name: "Fallback Name",
          status: "active",
          deletedAt: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          fullName: null,
          businessName: null,
          primaryEmail: "test@example.com",
          secondaryEmail: null,
          phone: null,
          website: null,
          location: null,
          preferredContactMethod: "email",
          notes: null,
        },
      });
      const nameInput = screen.getByLabelText("Client Name") as HTMLInputElement;
      expect(nameInput.value).toBe("Fallback Name");
    });
  });

  // ─── 2. Field editability ───────────────────────────────────────────────

  describe("field editability", () => {
    it("Client Name field is read-only", () => {
      renderModal();
      const nameInput = screen.getByLabelText("Client Name") as HTMLInputElement;
      expect(nameInput.readOnly).toBe(true);
    });

    it("allows editing of Recipient Email field (Req 5.1)", () => {
      renderModal();
      const emailInput = screen.getByLabelText(
        "Recipient Email"
      ) as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "new@email.com" } });
      expect(emailInput.value).toBe("new@email.com");
    });

    it("allows editing of Email Subject field (Req 5.2)", () => {
      renderModal();
      const subjectInput = screen.getByLabelText(
        "Email Subject"
      ) as HTMLInputElement;
      fireEvent.change(subjectInput, {
        target: { value: "Custom Subject" },
      });
      expect(subjectInput.value).toBe("Custom Subject");
    });

    it("allows editing of Custom Message field (Req 5.3)", () => {
      renderModal();
      const messageInput = screen.getByPlaceholderText(
        "Add a personal message to include in the email…"
      ) as HTMLTextAreaElement;
      fireEvent.change(messageInput, {
        target: { value: "Hello, please review." },
      });
      expect(messageInput.value).toBe("Hello, please review.");
    });
  });

  // ─── 3. Disabled send button when no valid email ────────────────────────

  describe("disabled send button when no valid email (Req 9.2, 9.3)", () => {
    it("disables Send Review Link button when email is empty", () => {
      renderModal({ autoFilledEmail: "" });
      const sendButton = screen.getByRole("button", {
        name: "Send Review Link",
      }) as HTMLButtonElement;
      expect(sendButton.disabled).toBe(true);
    });

    it("disables Send Review Link button when email is invalid", () => {
      renderModal({ autoFilledEmail: "not-an-email" });
      const sendButton = screen.getByRole("button", {
        name: "Send Review Link",
      }) as HTMLButtonElement;
      expect(sendButton.disabled).toBe(true);
    });

    it("enables Send Review Link button when email is valid", () => {
      renderModal({ autoFilledEmail: "valid@email.com" });
      const sendButton = screen.getByRole("button", {
        name: "Send Review Link",
      }) as HTMLButtonElement;
      expect(sendButton.disabled).toBe(false);
    });
  });

  // ─── 4. Email-differs notice display ───────────────────────────────────

  describe("email-differs notice display (Req 13.5)", () => {
    it("shows notice when entered email differs from client primaryEmail", () => {
      renderModal({ autoFilledEmail: "different@email.com" });
      expect(
        screen.getByText(
          /this email differs from the client/i
        )
      ).toBeDefined();
    });

    it("does not show notice when entered email matches client primaryEmail", () => {
      renderModal({ autoFilledEmail: "jane@doe.com" });
      expect(
        screen.queryByText(
          /this email differs from the client/i
        )
      ).toBeNull();
    });

    it("shows notice after user changes email to differ from client record", () => {
      renderModal();
      const emailInput = screen.getByLabelText(
        "Recipient Email"
      ) as HTMLInputElement;
      fireEvent.change(emailInput, {
        target: { value: "other@domain.com" },
      });
      expect(
        screen.getByText(
          /this email differs from the client/i
        )
      ).toBeDefined();
    });

    it("case-insensitive comparison: same email different case shows no notice", () => {
      renderModal({ autoFilledEmail: "JANE@DOE.COM" });
      expect(
        screen.queryByText(
          /this email differs from the client/i
        )
      ).toBeNull();
    });
  });

  // ─── 5. Warning banner when client has no primaryEmail ──────────────────

  describe("warning banner for missing primary email (Req 9.1)", () => {
    it("shows warning banner when client has no primaryEmail", () => {
      renderModal({
        client: {
          id: "client-1",
          ownerId: "owner-1",
          name: "No Email Client",
          status: "active",
          deletedAt: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          fullName: "No Email Client",
          businessName: null,
          primaryEmail: null,
          secondaryEmail: null,
          phone: null,
          website: null,
          location: null,
          preferredContactMethod: "email",
          notes: null,
        },
        autoFilledEmail: "",
      });
      expect(screen.getByText("No email on file")).toBeDefined();
    });

    it("shows warning banner when client primaryEmail is empty string", () => {
      renderModal({
        client: {
          id: "client-1",
          ownerId: "owner-1",
          name: "Empty Email Client",
          status: "active",
          deletedAt: null,
          createdAt: "2024-01-01T00:00:00.000Z",
          fullName: "Empty Email Client",
          businessName: null,
          primaryEmail: "",
          secondaryEmail: null,
          phone: null,
          website: null,
          location: null,
          preferredContactMethod: "email",
          notes: null,
        },
        autoFilledEmail: "",
      });
      expect(screen.getByText("No email on file")).toBeDefined();
    });

    it("does not show warning banner when client has a primaryEmail", () => {
      renderModal();
      expect(screen.queryByText("No email on file")).toBeNull();
    });
  });
});
