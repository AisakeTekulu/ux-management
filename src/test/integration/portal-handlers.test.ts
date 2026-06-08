import { describe, expect, it } from "vitest";

/**
 * Integration tests for upload and portal handlers — domain-layer logic (Task 14.5).
 *
 * Since no live Supabase instance is available, these tests verify the pure
 * domain-layer functions that the upload and portal route handlers delegate to:
 *
 * 1. isWithinUploadLimit rejects files > 50 MB (R6.4)
 * 2. resolveShareLink returns invalid for revoked links (R8.4)
 * 3. authorizeReviewerWrite rejects writes on revoked links (R8.6, R9.9)
 * 4. isShareLinkAccessible returns false for revoked links
 *
 * Validates: Requirements 6.4, 6.5, 8.4, 8.6, 9.9
 */

import {
  isWithinUploadLimit,
  MAX_UPLOAD_BYTES,
} from "@/lib/domain/validators";
import {
  resolveShareLink,
  authorizeReviewerWrite,
  isShareLinkAccessible,
  INVALID_LINK_MESSAGE,
  VIEW_ONLY_MESSAGE,
} from "@/lib/domain/share-link";
import type { ShareLink } from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShareLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return {
    id: "link-1",
    ownerId: "owner-1",
    token: "a".repeat(32),
    scopeType: "phase",
    projectId: "proj-1",
    phaseId: "phase-1",
    revokedAt: null,
    firstAccessedAt: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeRevokedLink(overrides: Partial<ShareLink> = {}): ShareLink {
  return makeShareLink({
    revokedAt: "2024-06-01T12:00:00.000Z",
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 1. isWithinUploadLimit rejects files > 50 MB (R6.4)
// ---------------------------------------------------------------------------

describe("isWithinUploadLimit — size-cap rejection (R6.4)", () => {
  it("rejects a file that is 1 byte over the 50 MB limit", () => {
    expect(isWithinUploadLimit(MAX_UPLOAD_BYTES + 1)).toBe(false);
  });

  it("rejects a file that is significantly over the limit (100 MB)", () => {
    expect(isWithinUploadLimit(100 * 1024 * 1024)).toBe(false);
  });

  it("accepts a file at exactly 50 MB", () => {
    expect(isWithinUploadLimit(MAX_UPLOAD_BYTES)).toBe(true);
  });

  it("accepts a file well under the limit (1 MB)", () => {
    expect(isWithinUploadLimit(1 * 1024 * 1024)).toBe(true);
  });

  it("accepts a zero-byte file", () => {
    expect(isWithinUploadLimit(0)).toBe(true);
  });

  it("rejects NaN as not within limit", () => {
    expect(isWithinUploadLimit(NaN)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. resolveShareLink returns invalid for revoked links (R8.4)
// ---------------------------------------------------------------------------

describe("resolveShareLink — scoped read-only access and revoked link handling (R8.4)", () => {
  it("returns invalid response for a revoked link", () => {
    const revoked = makeRevokedLink();
    const result = resolveShareLink(revoked);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid");
      expect(result.message).toBe(INVALID_LINK_MESSAGE);
    }
  });

  it("returns invalid response for null (nonexistent link)", () => {
    const result = resolveShareLink(null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid");
      expect(result.message).toBe(INVALID_LINK_MESSAGE);
    }
  });

  it("returns invalid response for undefined (nonexistent link)", () => {
    const result = resolveShareLink(undefined);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid");
      expect(result.message).toBe(INVALID_LINK_MESSAGE);
    }
  });

  it("produces indistinguishable responses for revoked and nonexistent links", () => {
    const revokedResult = resolveShareLink(makeRevokedLink());
    const nonexistentResult = resolveShareLink(null);

    // Both must be deeply equal so callers cannot distinguish the two cases
    expect(revokedResult).toEqual(nonexistentResult);
  });

  it("returns a valid read-only resolution for an accessible link", () => {
    const validLink = makeShareLink();
    const result = resolveShareLink(validLink);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.readOnly).toBe(true);
      expect(result.link).toBe(validLink);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. authorizeReviewerWrite rejects writes on revoked links (R8.6, R9.9)
// ---------------------------------------------------------------------------

describe("authorizeReviewerWrite — reviewer write rejection on revoked links (R8.6, R9.9)", () => {
  const targetPhase = { id: "phase-1", projectId: "proj-1" };

  it("rejects add_comment on a revoked link", () => {
    const revoked = makeRevokedLink();
    const result = authorizeReviewerWrite(revoked, "add_comment", targetPhase);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("app");
      expect(result.error.code).toBe("forbidden");
      expect(result.error.message).toBe(VIEW_ONLY_MESSAGE);
    }
  });

  it("rejects submit_approval on a revoked link", () => {
    const revoked = makeRevokedLink();
    const result = authorizeReviewerWrite(
      revoked,
      "submit_approval",
      targetPhase
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("rejects any write on a null (nonexistent) link", () => {
    const result = authorizeReviewerWrite(null, "add_comment", targetPhase);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
      expect(result.error.message).toBe(VIEW_ONLY_MESSAGE);
    }
  });

  it("rejects disallowed actions even on a valid link", () => {
    const validLink = makeShareLink();
    const disallowedActions = [
      "edit_comment",
      "delete_comment",
      "edit_approval",
      "delete_approval",
      "edit_phase",
      "delete_phase",
      "edit_checklist_item",
      "delete_checklist_item",
    ];

    for (const action of disallowedActions) {
      const result = authorizeReviewerWrite(validLink, action, targetPhase);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("forbidden");
        expect(result.error.message).toBe(VIEW_ONLY_MESSAGE);
      }
    }
  });

  it("rejects writes targeting an out-of-scope phase", () => {
    const validLink = makeShareLink({ phaseId: "phase-1", scopeType: "phase" });
    const outOfScopePhase = { id: "phase-99", projectId: "proj-1" };

    const result = authorizeReviewerWrite(
      validLink,
      "add_comment",
      outOfScopePhase
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("forbidden");
    }
  });

  it("permits add_comment on a valid, in-scope link", () => {
    const validLink = makeShareLink();
    const result = authorizeReviewerWrite(validLink, "add_comment", targetPhase);

    expect(result.ok).toBe(true);
  });

  it("permits submit_approval on a valid, in-scope link", () => {
    const validLink = makeShareLink();
    const result = authorizeReviewerWrite(
      validLink,
      "submit_approval",
      targetPhase
    );

    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. isShareLinkAccessible returns false for revoked links
// ---------------------------------------------------------------------------

describe("isShareLinkAccessible — revoked link detection", () => {
  it("returns false for a revoked link", () => {
    const revoked = makeRevokedLink();
    expect(isShareLinkAccessible(revoked)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isShareLinkAccessible(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isShareLinkAccessible(undefined)).toBe(false);
  });

  it("returns true for a valid, non-revoked link", () => {
    const valid = makeShareLink();
    expect(isShareLinkAccessible(valid)).toBe(true);
  });

  it("returns false when revokedAt is set to any timestamp", () => {
    const revoked = makeShareLink({
      revokedAt: "2020-01-01T00:00:00.000Z",
    });
    expect(isShareLinkAccessible(revoked)).toBe(false);
  });
});
