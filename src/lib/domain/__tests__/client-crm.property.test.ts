/**
 * Property-based tests for client CRM domain logic.
 *
 * Contains:
 * - Property 1: Client profile data round-trip
 * - Property 2: Email validation correctness
 * - Property 3: Preferred contact method enum enforcement
 * - Property 4: Notes length boundary
 * - Property 10: Archived client lifecycle guard round-trip
 */

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canSendReviewLink, validateClientFields, validateEmailFormat, emailDiffers, MAX_NOTES_LENGTH, VALID_CONTACT_METHODS } from '@/lib/domain/client-crm';
import type { Client, PreferredContactMethod } from '@/lib/domain/types';

// ─── Shared Generators ──────────────────────────────────────────────────────

/** Generate a valid UUID v4 string. */
const arbUuid = fc.uuid();

/** Generate a valid ISO timestamp string. */
const arbISOTimestamp = fc
  .date({ min: new Date('2000-01-01T00:00:00.000Z'), max: new Date('2030-12-31T23:59:59.999Z'), noInvalidDate: true })
  .map((d) => d.toISOString());

/** Generate a valid preferred contact method. */
const arbPreferredContactMethod: fc.Arbitrary<PreferredContactMethod> = fc.constantFrom(
  'email',
  'phone',
  'other',
);

/** Generate nullable string fields (CRM extension fields). */
const arbNullableString = fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null });

/** Generate a nullable email-like string. */
const arbNullableEmail = fc.option(
  fc.tuple(
    fc.string({ minLength: 1, maxLength: 20, unit: 'grapheme-ascii' }),
    fc.string({ minLength: 1, maxLength: 10, unit: 'grapheme-ascii' }),
    fc.string({ minLength: 1, maxLength: 5, unit: 'grapheme-ascii' }),
  ).map(([local, domain, tld]) => `${local}@${domain}.${tld}`),
  { nil: null },
);

/**
 * Generate an arbitrary Client object with a specific status.
 */
function arbClientWithStatus(status: 'active' | 'archived'): fc.Arbitrary<Client> {
  return fc.record({
    id: arbUuid,
    ownerId: arbUuid,
    name: fc.string({ minLength: 1, maxLength: 100 }),
    status: fc.constant(status),
    deletedAt: fc.option(arbISOTimestamp, { nil: null }),
    createdAt: arbISOTimestamp,
    fullName: arbNullableString,
    businessName: arbNullableString,
    primaryEmail: arbNullableEmail,
    secondaryEmail: arbNullableEmail,
    phone: arbNullableString,
    website: arbNullableString,
    location: arbNullableString,
    preferredContactMethod: arbPreferredContactMethod,
    notes: fc.option(fc.string({ minLength: 0, maxLength: 500 }), { nil: null }),
  });
}

/** Generate a valid email string for round-trip testing. */
const arbValidEmailStr = fc
  .tuple(
    fc.stringMatching(/^[a-z][a-z0-9]{0,10}$/),
    fc.stringMatching(/^[a-z][a-z0-9]{0,8}$/),
    fc.stringMatching(/^[a-z]{2,4}$/),
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

/** Generate a nullable valid email for CRM fields. */
const arbNullableValidEmail = fc.oneof(fc.constant(null), arbValidEmailStr);

/** Generate a valid notes field (null or string up to 5000 chars). */
const arbValidNotes = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 0, maxLength: 200 }),
  fc.string({ minLength: 4990, maxLength: 5000 }),
);

/** Generate a complete valid Client object suitable for round-trip testing. */
const arbClientForRoundTrip: fc.Arbitrary<Client> = fc.record({
  id: fc.uuid(),
  ownerId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  status: fc.constantFrom('active' as const, 'archived' as const),
  deletedAt: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  createdAt: fc.date().map((d) => d.toISOString()),
  fullName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  businessName: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
  primaryEmail: arbNullableValidEmail,
  secondaryEmail: arbNullableValidEmail,
  phone: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
  website: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  location: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  preferredContactMethod: fc.constantFrom('email' as const, 'phone' as const, 'other' as const),
  notes: arbValidNotes,
});


// ─── Property 2: Email validation correctness ───────────────────────────────

/**
 * Property-based test for email validation correctness (design Property 2).
 *
 * For any string, `validateEmailFormat` should accept iff it contains exactly
 * one `@`, non-empty local part, and domain with at least one dot.
 *
 * **Validates: Requirements 1.3, 1.4**
 */

/** Characters safe for email local parts. Excludes `@` and whitespace. */
const emailLocalPartChar = fc.constantFrom(
  'a', 'b', 'c', 'z', 'A', 'Z', '0', '9',
  '.', '_', '-', '+', '!', '#', '$', '%',
);

/** Characters safe for domain labels (alphanumeric + hyphen). */
const emailDomainLabelChar = fc.constantFrom(
  'a', 'b', 'c', 'x', 'y', 'z', '0', '1', '9', '-',
);

/** A non-empty local part string (1–30 chars, no @ or whitespace). */
const arbLocalPart = fc
  .array(emailLocalPartChar, { minLength: 1, maxLength: 30 })
  .map((chars) => chars.join(''));

/** A non-empty domain label (1–15 chars). */
const arbDomainLabel = fc
  .array(emailDomainLabelChar, { minLength: 1, maxLength: 15 })
  .map((chars) => chars.join(''));

/** A valid domain with at least one dot (2+ labels joined by dots). */
const arbValidDomain = fc
  .tuple(
    arbDomainLabel,
    fc.array(arbDomainLabel, { minLength: 1, maxLength: 3 }),
  )
  .map(([first, rest]) => [first, ...rest].join('.'));

/**
 * Generator for structurally valid emails:
 * exactly one @, non-empty local part, domain with at least one dot.
 */
const arbStructurallyValidEmail = fc
  .tuple(arbLocalPart, arbValidDomain)
  .map(([local, domain]) => `${local}@${domain}`);

/** Generator for strings with NO `@` symbol. */
const arbNoAtString = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => !s.includes('@') && s.trim().length > 0);

/** Generator for strings with MULTIPLE `@` symbols. */
const arbMultipleAtString = fc
  .tuple(
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.includes('@')),
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.includes('@')),
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.includes('@')),
  )
  .map(([a, b, c]) => `${a}@${b}@${c}`);

/** Generator for emails with empty local part (starts with @). */
const arbEmptyLocalPart = arbValidDomain.map((domain) => `@${domain}`);

/** Generator for emails with domain lacking a dot. */
const arbDomainWithoutDot = fc
  .tuple(arbLocalPart, arbDomainLabel) // single label = no dot
  .map(([local, domain]) => `${local}@${domain}`);

/**
 * Independent oracle: determines if a trimmed string is a valid email per
 * the spec (exactly one @, non-empty local, domain with at least one dot,
 * no empty domain parts).
 */
function oracleIsValidEmail(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return false;

  const atCount = (trimmed.match(/@/g) || []).length;
  if (atCount !== 1) return false;

  const atIndex = trimmed.indexOf('@');
  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (local.length === 0) return false;
  if (!domain.includes('.')) return false;

  const domainParts = domain.split('.');
  if (domainParts.some((part) => part.length === 0)) return false;

  return true;
}

describe('Feature: client-crm-review-links, Property 2: Email validation correctness', () => {
  it('accepts valid emails: strings with exactly one @, non-empty local part, domain with at least one dot', () => {
    fc.assert(
      fc.property(arbStructurallyValidEmail, (email) => {
        const result = validateEmailFormat(email);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value).toBe(email.trim());
        }
      }),
      { numRuns: 100 },
    );
  });

  it('rejects strings with no @ symbol', () => {
    fc.assert(
      fc.property(arbNoAtString, (input) => {
        const result = validateEmailFormat(input);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.kind).toBe('app');
          expect(result.error.code).toBe('invalid_state');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('rejects strings with multiple @ symbols', () => {
    fc.assert(
      fc.property(arbMultipleAtString, (input) => {
        const result = validateEmailFormat(input);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.kind).toBe('app');
          expect(result.error.code).toBe('invalid_state');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('rejects emails with empty local part', () => {
    fc.assert(
      fc.property(arbEmptyLocalPart, (input) => {
        const result = validateEmailFormat(input);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.kind).toBe('app');
          expect(result.error.code).toBe('invalid_state');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('rejects emails with domain lacking a dot', () => {
    fc.assert(
      fc.property(arbDomainWithoutDot, (input) => {
        const result = validateEmailFormat(input);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.kind).toBe('app');
          expect(result.error.code).toBe('invalid_state');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('oracle agreement: validateEmailFormat accepts iff oracle deems valid (broad arbitrary strings)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 80 }), (raw) => {
        const expected = oracleIsValidEmail(raw);
        const result = validateEmailFormat(raw);
        expect(result.ok).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });
});


// ─── Property 10: Archived client lifecycle guard round-trip ─────────────────

describe('Feature: client-crm-review-links, Property 10: Archived client lifecycle guard round-trip', () => {
  it('archived clients cannot send review links (result.ok === false)', () => {
    fc.assert(
      fc.property(arbClientWithStatus('archived'), (client) => {
        const result = canSendReviewLink(client);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('forbidden');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('active clients can send review links (result.ok === true)', () => {
    fc.assert(
      fc.property(arbClientWithStatus('active'), (client) => {
        const result = canSendReviewLink(client);
        expect(result.ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('restoring an archived client to active re-enables sending', () => {
    fc.assert(
      fc.property(arbClientWithStatus('archived'), (archivedClient) => {
        const archivedResult = canSendReviewLink(archivedClient);
        expect(archivedResult.ok).toBe(false);

        const restoredClient: Client = { ...archivedClient, status: 'active' };
        const activeResult = canSendReviewLink(restoredClient);
        expect(activeResult.ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});


// ─── Property 4: Notes length boundary ─────────────────────────────────────

/**
 * Property-based test for notes length boundary (design Property 4).
 *
 * For any string as notes, `validateClientFields` should reject if
 * char_length > 5000, accept otherwise (including null/undefined).
 *
 * **Validates: Requirements 1.6**
 */
describe('Feature: client-crm-review-links, Property 4: Notes length boundary', () => {
  it('accepts notes with length <= 5000', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: MAX_NOTES_LENGTH }),
        (notes) => {
          const result = validateClientFields({ notes });
          expect(result.ok).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects notes with length > 5000 with a field error on notes', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: MAX_NOTES_LENGTH + 1, maxLength: MAX_NOTES_LENGTH + 500 }),
        (notes) => {
          const result = validateClientFields({ notes });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.kind).toBe('validation');
            expect(
              result.error.fields.some((f) => f.field === 'notes'),
            ).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('accepts null notes', () => {
    fc.assert(
      fc.property(fc.constant(null), (notes) => {
        const result = validateClientFields({ notes: notes as any });
        expect(result.ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('accepts undefined notes (field not provided)', () => {
    fc.assert(
      fc.property(fc.constant(undefined), () => {
        const result = validateClientFields({});
        expect(result.ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});


// ─── Property 1: Client profile data round-trip ─────────────────────────────

/**
 * Feature: client-crm-review-links, Property 1: Client profile data round-trip
 *
 * For any valid client profile data, serializing to JSON and parsing back
 * should produce an identical record with all fields preserved.
 *
 * **Validates: Requirements 1.1**
 */
describe('Feature: client-crm-review-links, Property 1: Client profile data round-trip', () => {
  it('for any valid client profile data, JSON serialize/parse round-trip preserves all fields', () => {
    fc.assert(
      fc.property(arbClientForRoundTrip, (client) => {
        const serialized = JSON.stringify(client);
        const deserialized: Client = JSON.parse(serialized);

        expect(deserialized.id).toBe(client.id);
        expect(deserialized.ownerId).toBe(client.ownerId);
        expect(deserialized.name).toBe(client.name);
        expect(deserialized.status).toBe(client.status);
        expect(deserialized.deletedAt).toBe(client.deletedAt);
        expect(deserialized.createdAt).toBe(client.createdAt);
        expect(deserialized.fullName).toBe(client.fullName);
        expect(deserialized.businessName).toBe(client.businessName);
        expect(deserialized.primaryEmail).toBe(client.primaryEmail);
        expect(deserialized.secondaryEmail).toBe(client.secondaryEmail);
        expect(deserialized.phone).toBe(client.phone);
        expect(deserialized.website).toBe(client.website);
        expect(deserialized.location).toBe(client.location);
        expect(deserialized.preferredContactMethod).toBe(client.preferredContactMethod);
        expect(deserialized.notes).toBe(client.notes);
        expect(deserialized).toEqual(client);
      }),
      { numRuns: 100 },
    );
  });
});


// ─── Property 3: Preferred contact method enum enforcement ──────────────────

/**
 * Property-based test for preferred contact method enum enforcement (design Property 3).
 *
 * For any string, `validateClientFields` should accept as preferredContactMethod
 * iff it is 'email', 'phone', or 'other'.
 *
 * **Validates: Requirements 1.5**
 */
describe('Feature: client-crm-review-links, Property 3: Preferred contact method enum enforcement', () => {
  it('accepts any valid preferred contact method value (email, phone, or other)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_CONTACT_METHODS),
        (method) => {
          const result = validateClientFields({ preferredContactMethod: method });
          expect(result.ok).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rejects any string that is not a valid preferred contact method', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter(
          (s) => !(VALID_CONTACT_METHODS as readonly string[]).includes(s),
        ),
        (invalidMethod) => {
          const result = validateClientFields({
            preferredContactMethod: invalidMethod as any,
          });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.kind).toBe('validation');
            const fieldError = result.error.fields.find(
              (f) => f.field === 'preferredContactMethod',
            );
            expect(fieldError).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 13: Email-differs notice detection ────────────────────────────

/**
 * Property-based test for email-differs notice detection (Property 13).
 *
 * Feature: client-crm-review-links, Property 13: Email-differs notice detection
 *
 * For any pair of email strings (enteredEmail, clientPrimaryEmail), the
 * emailDiffers function should return true if and only if the entered email
 * is not equal (case-insensitive) to the client's primary email.
 *
 * **Validates: Requirements 13.5**
 */

// Generator for realistic email-like strings used in Property 13
const arbEmailLocalPart = fc
  .array(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      '.', '_', '-', '+',
    ),
    { minLength: 1, maxLength: 20 },
  )
  .map((chars) => chars.join(''));

const arbEmailDomainPart = fc
  .array(
    fc.constantFrom(
      'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
      'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
      'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
      'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
      '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
      '-',
    ),
    { minLength: 1, maxLength: 10 },
  )
  .map((chars) => chars.join(''));

const arbEmailTld = fc.constantFrom('com', 'org', 'net', 'io', 'co.uk', 'dev', 'app');

const arbEmailString = fc.tuple(arbEmailLocalPart, arbEmailDomainPart, arbEmailTld).map(
  ([local, domain, tld]) => `${local}@${domain}.${tld}`,
);

// Generator that produces a case-varied version of a string
const caseVariant = (str: string): fc.Arbitrary<string> =>
  fc.array(fc.boolean(), { minLength: str.length, maxLength: str.length }).map(
    (flags) =>
      str
        .split('')
        .map((ch, i) => (flags[i] ? ch.toUpperCase() : ch.toLowerCase()))
        .join(''),
  );

describe('Feature: client-crm-review-links, Property 13: Email-differs notice detection', () => {
  it('returns false for pairs of identical emails with possibly different case', () => {
    fc.assert(
      fc.property(
        arbEmailString.chain((email) =>
          caseVariant(email).map((variant) => ({ base: email, variant })),
        ),
        ({ base, variant }) => {
          // A case-varied version of the same email should not trigger differs notice
          expect(emailDiffers(variant, base)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns true for pairs of different emails', () => {
    fc.assert(
      fc.property(
        arbEmailString,
        arbEmailString,
        (emailA, emailB) => {
          // Only assert when the emails are genuinely different (case-insensitive)
          fc.pre(emailA.toLowerCase() !== emailB.toLowerCase());
          expect(emailDiffers(emailA, emailB)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('general property: emailDiffers(a, b) === (a.toLowerCase() !== b.toLowerCase())', () => {
    fc.assert(
      fc.property(
        fc.oneof(arbEmailString, fc.string({ minLength: 1, maxLength: 50 })),
        fc.oneof(arbEmailString, fc.string({ minLength: 1, maxLength: 50 })),
        (a, b) => {
          const expected = a.toLowerCase() !== b.toLowerCase();
          expect(emailDiffers(a, b)).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});
