import { describe, expect, it } from "vitest";

/**
 * Unit tests for Server Actions — domain-layer validation functions (Task 13.10).
 *
 * Server Actions delegate to pure domain functions for validation, duplicate
 * detection, and activity logging. Since the actions themselves require
 * Supabase Auth (which cannot be easily mocked in unit tests), these tests
 * verify the pure functions that the actions wire together:
 *
 * 1. validateClientName rejects empty names (surfacing validation errors) — R2.2
 * 2. isProjectNameDuplicate detects duplicates — R3.5
 * 3. validateChecklistText rejects invalid text — R5.3, R5.4
 * 4. buildCommentCreatedLog produces the correct activity entry — R13.1
 * 5. buildPhaseStatusChangedLog produces the correct activity entry — R13.3
 *
 * Validates: Requirements 2.2, 3.3, 3.5, 5.3, 5.4, 13.1, 13.3
 */

import {
  validateClientName,
  validateChecklistText,
  isProjectNameDuplicate,
} from "@/lib/domain/validators";
import {
  buildCommentCreatedLog,
  buildPhaseStatusChangedLog,
} from "@/lib/domain/activity";
import type { Project } from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// 1. validateClientName rejects empty names (R2.2)
// ---------------------------------------------------------------------------

describe("validateClientName — validation error surfacing with retained values", () => {
  it("rejects an empty string and surfaces a validation error", () => {
    const result = validateClientName("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
      expect(result.error.fields).toHaveLength(1);
      expect(result.error.fields[0].field).toBe("name");
      expect(result.error.fields[0].message).toContain("required");
    }
  });

  it("rejects a whitespace-only string", () => {
    const result = validateClientName("   \t\n  ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
      expect(result.error.fields[0].field).toBe("name");
    }
  });

  it("rejects a name exceeding 100 characters", () => {
    const longName = "A".repeat(101);
    const result = validateClientName(longName);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
      expect(result.error.fields[0].field).toBe("name");
      expect(result.error.fields[0].message).toContain("100");
    }
  });

  it("accepts a valid name and returns the trimmed value", () => {
    const result = validateClientName("  Acme Corp  ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("Acme Corp");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. isProjectNameDuplicate detects duplicates (R3.5)
// ---------------------------------------------------------------------------

describe("isProjectNameDuplicate — case-insensitive duplicate detection", () => {
  const siblings: Project[] = [
    {
      id: "proj-1",
      clientId: "client-1",
      ownerId: "owner-1",
      name: "Website Redesign",
      createdAt: "2024-01-01T00:00:00.000Z",
    },
    {
      id: "proj-2",
      clientId: "client-1",
      ownerId: "owner-1",
      name: "Mobile App",
      createdAt: "2024-02-01T00:00:00.000Z",
    },
  ];

  it("returns true for an exact match", () => {
    expect(isProjectNameDuplicate("Website Redesign", siblings)).toBe(true);
  });

  it("returns true for a case-insensitive match", () => {
    expect(isProjectNameDuplicate("website redesign", siblings)).toBe(true);
    expect(isProjectNameDuplicate("MOBILE APP", siblings)).toBe(true);
  });

  it("returns true when leading/trailing whitespace differs", () => {
    expect(isProjectNameDuplicate("  Website Redesign  ", siblings)).toBe(true);
  });

  it("returns false for a unique name", () => {
    expect(isProjectNameDuplicate("Brand Identity", siblings)).toBe(false);
  });

  it("returns false for an empty siblings list", () => {
    expect(isProjectNameDuplicate("Anything", [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. validateChecklistText rejects invalid text (R5.3, R5.4)
// ---------------------------------------------------------------------------

describe("validateChecklistText — rejects invalid text", () => {
  it("rejects empty text", () => {
    const result = validateChecklistText("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
      expect(result.error.fields[0].field).toBe("text");
      expect(result.error.fields[0].message).toContain("required");
    }
  });

  it("rejects whitespace-only text", () => {
    const result = validateChecklistText("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fields[0].field).toBe("text");
    }
  });

  it("rejects text exceeding 500 characters", () => {
    const longText = "x".repeat(501);
    const result = validateChecklistText(longText);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
      expect(result.error.fields[0].field).toBe("text");
      expect(result.error.fields[0].message).toContain("500");
    }
  });

  it("accepts valid text and returns the trimmed value", () => {
    const result = validateChecklistText("  Review homepage mockup  ");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("Review homepage mockup");
    }
  });

  it("accepts text at exactly 500 characters", () => {
    const exactText = "a".repeat(500);
    const result = validateChecklistText(exactText);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(exactText);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. buildCommentCreatedLog produces the correct activity entry (R13.1)
// ---------------------------------------------------------------------------

describe("buildCommentCreatedLog — activity entry construction", () => {
  it("produces a comment_created entry with correct fields", () => {
    const now = new Date("2024-06-15T10:30:45.123Z");
    const entry = buildCommentCreatedLog({
      id: "log-1",
      projectId: "proj-1",
      actor: "designer@example.com",
      now,
      commentId: "comment-1",
      phaseId: "phase-1",
    });

    expect(entry.id).toBe("log-1");
    expect(entry.projectId).toBe("proj-1");
    expect(entry.type).toBe("comment_created");
    expect(entry.actor).toBe("designer@example.com");
    // Timestamp should be truncated to second precision
    expect(entry.createdAt).toBe("2024-06-15T10:30:45.000Z");
    // Detail should carry commentId and phaseId
    expect(entry.detail).toEqual({
      commentId: "comment-1",
      phaseId: "phase-1",
    });
  });

  it("truncates sub-second precision from the timestamp", () => {
    const now = new Date("2024-01-01T23:59:59.999Z");
    const entry = buildCommentCreatedLog({
      id: "log-2",
      projectId: "proj-2",
      actor: "reviewer@client.com",
      now,
      commentId: "comment-2",
      phaseId: "phase-2",
    });

    expect(entry.createdAt).toBe("2024-01-01T23:59:59.000Z");
  });
});

// ---------------------------------------------------------------------------
// 5. buildPhaseStatusChangedLog produces the correct activity entry (R13.3)
// ---------------------------------------------------------------------------

describe("buildPhaseStatusChangedLog — activity entry construction", () => {
  it("produces a phase_status_changed entry with from/to statuses", () => {
    const now = new Date("2024-07-20T14:00:00.500Z");
    const entry = buildPhaseStatusChangedLog({
      id: "log-3",
      projectId: "proj-3",
      actor: "designer@example.com",
      now,
      phaseId: "phase-3",
      from: "Draft",
      to: "Sent to Client",
    });

    expect(entry.id).toBe("log-3");
    expect(entry.projectId).toBe("proj-3");
    expect(entry.type).toBe("phase_status_changed");
    expect(entry.actor).toBe("designer@example.com");
    expect(entry.createdAt).toBe("2024-07-20T14:00:00.000Z");
    expect(entry.detail).toEqual({
      phaseId: "phase-3",
      from: "Draft",
      to: "Sent to Client",
    });
  });

  it("records all valid status transitions correctly", () => {
    const now = new Date("2024-08-01T00:00:00.000Z");

    const entry = buildPhaseStatusChangedLog({
      id: "log-4",
      projectId: "proj-4",
      actor: "system",
      now,
      phaseId: "phase-4",
      from: "Waiting for Feedback",
      to: "Approved",
    });

    expect(entry.detail).toEqual({
      phaseId: "phase-4",
      from: "Waiting for Feedback",
      to: "Approved",
    });
  });

  it("truncates sub-second precision from the timestamp", () => {
    const now = new Date("2024-12-31T23:59:59.789Z");
    const entry = buildPhaseStatusChangedLog({
      id: "log-5",
      projectId: "proj-5",
      actor: "designer@test.com",
      now,
      phaseId: "phase-5",
      from: "Approved",
      to: "Completed",
    });

    expect(entry.createdAt).toBe("2024-12-31T23:59:59.000Z");
  });
});
