import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { MAX_DESIGN_URL_LENGTH, validateDesignUrl } from '@/lib/domain/validators';

/**
 * Property-based test for design-link URL validation (design Property 11).
 *
 * `validateDesignUrl` is a pure function over a raw string. The spec rule is:
 * accept *if and only if* the trimmed input parses as a URL using the `http` or
 * `https` scheme and its (code-point) length does not exceed
 * {@link MAX_DESIGN_URL_LENGTH} (2048); otherwise no design link is created —
 * which, at this pure layer, means the function returns a validation error
 * carrying a `url` field rather than an accepted value.
 *
 * The oracle below recomputes the acceptance condition independently using the
 * same WHATWG `URL` parser the spec references, then the test asserts the
 * round-trip invariants (accepted -> trimmed value; rejected -> `url` error)
 * and that the input is never mutated. Generators deliberately exercise:
 * http/https vs. other schemes (ftp, mailto, javascript, relative), lengths on
 * both sides of 2048, Unicode, and malformed strings.
 */

// --- Independent oracle (the spec definition, recomputed) -------------------

function parsesAsHttpOrHttps(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function expectedAccept(raw: string): boolean {
  const trimmed = raw.trim();
  const length = Array.from(trimmed).length;
  return length <= MAX_DESIGN_URL_LENGTH && parsesAsHttpOrHttps(trimmed);
}

// --- Generators -------------------------------------------------------------

const whitespaceChar = fc.constantFrom(' ', '\t', '\n', '\r', '\f', '\u000b');
const whitespaceRun = fc
  .array(whitespaceChar, { minLength: 0, maxLength: 4 })
  .map((chars) => chars.join(''));

// Valid host labels: lowercase alphanumeric, joined with dots.
const hostLabel = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), {
    minLength: 1,
    maxLength: 8,
  })
  .map((chars) => chars.join(''));

const host = fc
  .array(hostLabel, { minLength: 1, maxLength: 3 })
  .map((labels) => labels.join('.'));

const pathSegment = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789-_'.split('')), {
    minLength: 0,
    maxLength: 8,
  })
  .map((chars) => chars.join(''));

const path = fc
  .array(pathSegment, { minLength: 0, maxLength: 3 })
  .map((segments) => (segments.length === 0 ? '' : `/${segments.join('/')}`));

// Well-formed http/https URLs that should be accepted (well under 2048 chars).
const goodHttpUrl = fc
  .tuple(fc.constantFrom('http', 'https'), host, path)
  .map(([scheme, h, p]) => `${scheme}://${h}${p}`);

// URLs with non-http(s) schemes — must be rejected.
const otherSchemeUrl = fc.constantFrom(
  'ftp://example.com/file.zip',
  'mailto:designer@example.com',
  'javascript:alert(1)',
  'file:///etc/passwd',
  'data:text/plain,hello',
  'tel:+15555550123',
  'ws://example.com/socket',
  'about:blank',
  'chrome://settings',
);

// Relative / malformed strings that do not parse as absolute URLs — rejected.
const malformedUrl = fc.constantFrom(
  '/relative/path',
  'example.com/no-scheme',
  '://missing-scheme.com',
  'http//missing-colon.com',
  'ht!tp://bad-scheme.com',
  'http://',
  'https://',
  'just some text',
  '',
  '   ',
);

// URLs tuned to straddle the 2048 code-point boundary (ASCII, so 1 char == 1
// code point). The base is 14 chars, so the fill produces the exact total.
const BASE = 'https://e.com/';
const urlOfTotalLength = (total: number) =>
  BASE + 'a'.repeat(Math.max(0, total - BASE.length));

const boundaryUrl = fc
  .constantFrom(
    MAX_DESIGN_URL_LENGTH - 2,
    MAX_DESIGN_URL_LENGTH - 1,
    MAX_DESIGN_URL_LENGTH,
    MAX_DESIGN_URL_LENGTH + 1,
    MAX_DESIGN_URL_LENGTH + 2,
    MAX_DESIGN_URL_LENGTH + 200,
  )
  .map((total) => urlOfTotalLength(total));

// Unicode / IDN hosts and paths — `new URL` accepts these (punycode/encoding),
// so they should be accepted when within the length bound.
const unicodeUrl = fc.constantFrom(
  'https://例え.テスト/パス',
  'https://münchen.de/straße',
  'http://example.com/path?q=café&x=🎨',
  'https://пример.рф/документ',
);

// Wrap an arbitrary string in random leading/trailing whitespace to exercise
// the trim-before-validate behaviour (including whitespace that pushes a
// boundary-length raw input back under 2048 once trimmed).
const withWhitespace = (inner: fc.Arbitrary<string>) =>
  fc.tuple(whitespaceRun, inner, whitespaceRun).map(([lead, core, trail]) => lead + core + trail);

const designUrlInput = fc.oneof(
  goodHttpUrl,
  withWhitespace(goodHttpUrl),
  otherSchemeUrl,
  malformedUrl,
  boundaryUrl,
  withWhitespace(boundaryUrl),
  unicodeUrl,
  fc.webUrl(),
  fc.string(),
  fc.string({ unit: 'grapheme', maxLength: 60 }),
);

describe('validateDesignUrl (Property 11)', () => {
  // Feature: client-sign-off-dashboard, Property 11: Design URL validation
  // Validates: Requirements 6.1, 6.2
  it('accepts iff the trimmed input is an http/https URL of length <= 2048, returns the trimmed value, and creates no link (errors on `url`) otherwise', () => {
    fc.assert(
      fc.property(designUrlInput, (raw) => {
        const original = raw;
        const trimmed = raw.trim();
        const shouldAccept = expectedAccept(raw);

        const result = validateDesignUrl(raw);

        // Acceptance holds if and only if the spec condition holds.
        expect(result.ok).toBe(shouldAccept);

        if (result.ok) {
          // Accepted inputs return exactly the trimmed URL.
          expect(result.value).toBe(trimmed);
          // The accepted value satisfies both halves of the rule.
          expect(Array.from(result.value).length).toBeLessThanOrEqual(MAX_DESIGN_URL_LENGTH);
          expect(parsesAsHttpOrHttps(result.value)).toBe(true);
        } else {
          // Rejected inputs produce a validation error identifying `url` and
          // yield no accepted value -> no design link is created.
          expect(result.error.kind).toBe('validation');
          expect(result.error.fields.some((field) => field.field === 'url')).toBe(true);
        }

        // The input string is left unchanged on every path.
        expect(raw).toBe(original);
      }),
      { numRuns: 200 },
    );
  });
});
