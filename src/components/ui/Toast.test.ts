import { describe, expect, it } from "vitest";
import {
  DEFAULT_TOAST_DURATION_MS,
  MIN_TOAST_DURATION_MS,
  resolveToastDuration,
} from "./Toast";

/**
 * Unit tests for the toast auto-dismiss duration policy (Requirement 14.6):
 * confirmation toasts remain visible for at least 4 seconds or until dismissed.
 *
 * The presentation/DOM behavior (rendering, timer-driven dismissal, manual
 * dismiss) is covered by the component-test task (17.10); here we validate the
 * pure clamping rule that guarantees the 4-second floor.
 */
describe("resolveToastDuration", () => {
  it("uses the 4s default when no duration is requested", () => {
    expect(resolveToastDuration(undefined)).toBe(DEFAULT_TOAST_DURATION_MS);
    expect(DEFAULT_TOAST_DURATION_MS).toBe(MIN_TOAST_DURATION_MS);
  });

  it("returns null for a persistent (manual-dismiss-only) toast", () => {
    expect(resolveToastDuration(null)).toBeNull();
  });

  it("raises sub-4s requests up to the 4-second floor (R14.6)", () => {
    expect(resolveToastDuration(0)).toBe(MIN_TOAST_DURATION_MS);
    expect(resolveToastDuration(1_000)).toBe(MIN_TOAST_DURATION_MS);
    expect(resolveToastDuration(3_999)).toBe(MIN_TOAST_DURATION_MS);
    expect(resolveToastDuration(-5_000)).toBe(MIN_TOAST_DURATION_MS);
  });

  it("keeps durations at or above the floor unchanged", () => {
    expect(resolveToastDuration(MIN_TOAST_DURATION_MS)).toBe(MIN_TOAST_DURATION_MS);
    expect(resolveToastDuration(6_000)).toBe(6_000);
    expect(resolveToastDuration(60_000)).toBe(60_000);
  });

  it("falls back to the default for non-finite values", () => {
    expect(resolveToastDuration(Number.NaN)).toBe(DEFAULT_TOAST_DURATION_MS);
    expect(resolveToastDuration(Number.POSITIVE_INFINITY)).toBe(DEFAULT_TOAST_DURATION_MS);
  });
});
