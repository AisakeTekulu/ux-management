/**
 * Design-token reference (Requirements 14.3, 16.5).
 *
 * The canonical token values live as CSS variables in src/app/globals.css and
 * are exposed to Tailwind via tailwind.config.ts. This module documents the
 * Polaris-inspired status color tokens so the status presentation map
 * (design.md R14.4, implemented in task 17.4) can reference them by name.
 *
 * Each entry corresponds to a `status-*` Tailwind color backed by a
 * `--color-status-*` CSS variable.
 */
export const STATUS_COLOR_TOKENS = {
  grey: "status-grey",
  blue: "status-blue",
  indigo: "status-indigo",
  amber: "status-amber",
  green: "status-green",
  teal: "status-teal",
  red: "status-red",
} as const;

export type StatusColorToken = keyof typeof STATUS_COLOR_TOKENS;
