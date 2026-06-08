/**
 * Shared utility helpers used across the admin and portal surfaces.
 */

/**
 * Join conditional class names into a single space-separated string.
 * Falsy values (false, null, undefined, "") are ignored.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
