/**
 * Simple in-memory rate limiter.
 *
 * Uses a Map to track request counts per IP within a sliding time window.
 * Suitable for single-instance deployments. For multi-instance environments,
 * replace with a Redis-backed implementation.
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitEntry>();

/** Clean up expired entries every 60 seconds. */
const CLEANUP_INTERVAL_MS = 60_000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetTime) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow the timer to not prevent process exit
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

/**
 * Check if a request from the given IP is within the rate limit.
 *
 * @param ip - The client IP address
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns `{ success: true, remaining }` if allowed, `{ success: false, remaining: 0 }` if exceeded
 */
export function rateLimit(
  ip: string,
  limit: number = 10,
  windowMs: number = 60_000,
): { success: boolean; remaining: number } {
  startCleanup();

  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetTime) {
    // First request or window expired — reset
    store.set(ip, { count: 1, resetTime: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count += 1;
  return { success: true, remaining: limit - entry.count };
}

/**
 * Extract the client IP from request headers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
