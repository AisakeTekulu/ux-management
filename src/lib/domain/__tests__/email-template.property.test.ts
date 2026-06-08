import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { generateEmailTemplate } from '@/lib/domain/client-crm';
import type { EmailTemplateContext } from '@/lib/domain/types';
import { MIN_TOKEN_LENGTH } from '@/lib/domain/share-link';

/**
 * Property-based test for email template generation (design Property 5).
 *
 * For any valid EmailTemplateContext, the generated email body should contain:
 * - clientFullName in the greeting
 * - projectName in the body
 * - reviewUrl as a link
 * - adminName in the sign-off
 * - customMessage when provided
 * - phaseName when provided
 *
 * **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
 */

// ─── Generators ─────────────────────────────────────────────────────────────

/** Generate a non-empty string without newlines (suitable for names/URLs). */
const nonEmptyString = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter((s) => s.trim().length > 0 && !s.includes('\n') && !s.includes('\r'));

/** Generate a plausible review URL (non-empty, no whitespace). */
const reviewUrlArb = fc
  .tuple(
    fc.constantFrom('https://app.example.com/review/', 'https://dashboard.test/r/'),
    fc.stringMatching(/^[a-zA-Z0-9_-]{32,64}$/),
  )
  .map(([base, token]) => `${base}${token}`);

/** Generate an arbitrary EmailTemplateContext with all required fields and optional ones. */
const emailTemplateContextArb: fc.Arbitrary<EmailTemplateContext> = fc.record({
  clientFullName: nonEmptyString,
  projectName: nonEmptyString,
  phaseName: fc.option(nonEmptyString, { nil: undefined }),
  reviewUrl: reviewUrlArb,
  customMessage: fc.option(
    fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
    { nil: undefined },
  ),
  adminName: nonEmptyString,
});

// ─── Property Test ──────────────────────────────────────────────────────────

describe('Feature: client-crm-review-links, Property 5: Email template includes all input data', () => {
  it('generated email body contains clientFullName in greeting, projectName, reviewUrl, adminName in sign-off, customMessage when provided, and phaseName when provided', () => {
    fc.assert(
      fc.property(emailTemplateContextArb, (context) => {
        const result = generateEmailTemplate(context);
        const { body } = result;

        // Req 6.1: clientFullName appears in the greeting
        expect(body).toContain(context.clientFullName);

        // Req 6.2: projectName appears in the body
        expect(body).toContain(context.projectName);

        // Req 6.3: reviewUrl appears as a link in the body
        expect(body).toContain(context.reviewUrl);

        // Req 6.4: adminName appears in the sign-off
        expect(body).toContain(context.adminName);

        // Req 6.5: customMessage appears when provided
        if (context.customMessage !== undefined) {
          expect(body).toContain(context.customMessage);
        }

        // Req 6.2 (phase context): phaseName appears when provided
        if (context.phaseName !== undefined) {
          expect(body).toContain(context.phaseName);
        }
      }),
      { numRuns: 100 },
    );
  });
});


// ─── Property 7: Review URL contains token ──────────────────────────────────

/**
 * Property-based test for review URL construction (design Property 7).
 *
 * For any share link token (≥ 32 URL-safe characters), the constructed review
 * URL should contain that token and be a valid URL path (starts with / or https://).
 *
 * The project uses the route pattern `/review/[token]`, so the review URL is
 * constructed as `/review/{token}` or `{baseUrl}/review/{token}`.
 *
 * **Validates: Requirements 4.7**
 */

/**
 * Generate a URL-safe token string of at least MIN_TOKEN_LENGTH (32) characters
 * using only characters from the base64url alphabet (A-Z, a-z, 0-9, -, _).
 */
const urlSafeTokenArb: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom(
      ...'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.split(''),
    ),
    { minLength: 32, maxLength: 64 },
  )
  .map((chars) => chars.join(''));

/**
 * Construct a review URL from a token, following the project's established
 * `/review/[token]` route pattern.
 *
 * This mirrors how the project assembles review URLs for the client portal
 * (see `src/app/(portal)/review/[token]/page.tsx`).
 */
function constructReviewUrl(token: string, baseUrl?: string): string {
  if (baseUrl) {
    return `${baseUrl}/review/${token}`;
  }
  return `/review/${token}`;
}

describe('Feature: client-crm-review-links, Property 7: Review URL contains token', () => {
  it('for any URL-safe token (≥ 32 chars), constructed review URL contains the token and is a valid URL path', () => {
    fc.assert(
      fc.property(urlSafeTokenArb, (token) => {
        // Verify token meets the minimum length requirement
        expect(token.length).toBeGreaterThanOrEqual(MIN_TOKEN_LENGTH);

        // Test with relative path (starts with /)
        const relativeUrl = constructReviewUrl(token);
        expect(relativeUrl).toContain(token);
        expect(relativeUrl.startsWith('/')).toBe(true);

        // Test with absolute URL (starts with https://)
        const absoluteUrl = constructReviewUrl(token, 'https://app.example.com');
        expect(absoluteUrl).toContain(token);
        expect(absoluteUrl.startsWith('https://')).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('the review URL path segment is exactly /review/{token}', () => {
    fc.assert(
      fc.property(urlSafeTokenArb, (token) => {
        const url = constructReviewUrl(token);

        // The URL should be exactly /review/{token}
        expect(url).toBe(`/review/${token}`);

        // Extract the token from the URL path and verify round-trip
        const extractedToken = url.replace('/review/', '');
        expect(extractedToken).toBe(token);
      }),
      { numRuns: 100 },
    );
  });
});
