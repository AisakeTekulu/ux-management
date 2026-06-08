import { afterEach, describe, expect, it } from "vitest";

import {
  isLocked,
  LOCKOUT_MESSAGE,
  MAX_ATTEMPTS,
  recordFailure,
  recordSuccess,
  resetStore,
  WINDOW_MS,
} from "@/lib/auth/lockout";

/**
 * Unit tests for the account lockout module (Requirement 1.6).
 *
 * All tests inject explicit `now` timestamps so they are deterministic and
 * independent of wall-clock time.
 */

afterEach(() => {
  resetStore();
});

describe("isLocked", () => {
  it("returns false for an unknown email", () => {
    expect(isLocked("new@example.com", 1000)).toBe(false);
  });

  it("returns false when fewer than MAX_ATTEMPTS failures recorded", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      recordFailure("user@example.com", now + i * 1000);
    }
    expect(isLocked("user@example.com", now + 10_000)).toBe(false);
  });

  it("returns true after MAX_ATTEMPTS consecutive failures within the window", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure("user@example.com", now + i * 1000);
    }
    expect(isLocked("user@example.com", now + 10_000)).toBe(true);
  });

  it("lockout expires after WINDOW_MS from the moment it was triggered", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure("user@example.com", now + i * 1000);
    }
    // lockedAt = now + (MAX_ATTEMPTS - 1) * 1000 = now + 4000
    const lockedAt = now + (MAX_ATTEMPTS - 1) * 1000;
    // Just before expiry — still locked.
    expect(isLocked("user@example.com", lockedAt + WINDOW_MS - 1)).toBe(true);
    // At expiry — unlocked.
    expect(isLocked("user@example.com", lockedAt + WINDOW_MS)).toBe(false);
  });

  it("is case-insensitive on email", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure("User@Example.COM", now + i * 1000);
    }
    expect(isLocked("user@example.com", now + 5000)).toBe(true);
  });
});

describe("recordFailure", () => {
  it("prunes failures outside the rolling window", () => {
    const start = 1_000_000;
    // Record 4 failures at the start.
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      recordFailure("user@example.com", start + i * 1000);
    }
    // 5th failure arrives after the window has expired for the first ones.
    const lateNow = start + WINDOW_MS + 1000;
    recordFailure("user@example.com", lateNow);
    // Should NOT be locked because only 1 failure is within the window.
    expect(isLocked("user@example.com", lateNow)).toBe(false);
  });

  it("does not add more failures once already locked", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      recordFailure("user@example.com", now + i * 1000);
    }
    const lockedAt = now + (MAX_ATTEMPTS - 1) * 1000;
    // Additional failure while locked — should not extend the lockout.
    recordFailure("user@example.com", now + 5000);
    // Lockout still expires based on the original lock time (lockedAt).
    expect(isLocked("user@example.com", lockedAt + WINDOW_MS)).toBe(false);
  });
});

describe("recordSuccess", () => {
  it("clears accumulated failures so the account is not locked", () => {
    const now = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS - 1; i++) {
      recordFailure("user@example.com", now + i * 1000);
    }
    recordSuccess("user@example.com");
    // One more failure should not trigger lockout since counter was reset.
    recordFailure("user@example.com", now + 100_000);
    expect(isLocked("user@example.com", now + 100_000)).toBe(false);
  });
});

describe("LOCKOUT_MESSAGE", () => {
  it("is generic and does not disclose which field was wrong", () => {
    const msg = LOCKOUT_MESSAGE.toLowerCase();
    expect(msg).not.toContain("email");
    expect(msg).not.toContain("password");
    expect(msg).toContain("temporarily locked");
  });
});
