/**
 * Unit tests for client-crm.ts validation functions, email template generation,
 * and email-differs logic.
 *
 * Validates Requirements: 1.3, 1.4, 1.5, 1.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 4.6, 10.1, 10.5, 13.5
 */

import { describe, it, expect } from 'vitest';
import {
  validateEmailFormat,
  validateClientFields,
  canSendReviewLink,
  generateEmailTemplate,
  generateEmailSubject,
  emailDiffers,
} from './client-crm';
import type { Client, EmailTemplateContext } from './types';

describe('generateEmailSubject', () => {
  it('includes project name when no phase title provided', () => {
    const subject = generateEmailSubject('Website Redesign');
    expect(subject).toBe('Review: Website Redesign');
    expect(subject).toContain('Website Redesign');
  });

  it('includes both project name and phase title when provided', () => {
    const subject = generateEmailSubject('Website Redesign', 'Wireframes');
    expect(subject).toBe('Review: Website Redesign - Wireframes');
    expect(subject).toContain('Website Redesign');
    expect(subject).toContain('Wireframes');
  });

  it('handles empty phase title as no phase', () => {
    const subject = generateEmailSubject('My Project', '');
    expect(subject).toBe('Review: My Project');
  });
});

describe('generateEmailTemplate', () => {
  const baseContext: EmailTemplateContext = {
    clientFullName: 'Jane Smith',
    projectName: 'Website Redesign',
    reviewUrl: 'https://app.example.com/review/abc123token',
    adminName: 'John Designer',
  };

  it('includes personalized greeting with client full name (Req 6.1)', () => {
    const result = generateEmailTemplate(baseContext);
    expect(result.body).toContain('Hi Jane Smith,');
  });

  it('includes project name in the body (Req 6.2)', () => {
    const result = generateEmailTemplate(baseContext);
    expect(result.body).toContain('Website Redesign');
  });

  it('includes phase name when provided (Req 6.2)', () => {
    const context: EmailTemplateContext = {
      ...baseContext,
      phaseName: 'Wireframes',
    };
    const result = generateEmailTemplate(context);
    expect(result.body).toContain('Wireframes');
    expect(result.body).toContain('Website Redesign');
  });

  it('includes review URL as a link (Req 6.3)', () => {
    const result = generateEmailTemplate(baseContext);
    expect(result.body).toContain('https://app.example.com/review/abc123token');
  });

  it('includes admin name in sign-off (Req 6.4)', () => {
    const result = generateEmailTemplate(baseContext);
    expect(result.body).toContain('Best regards,');
    expect(result.body).toContain('John Designer');
  });

  it('includes custom message when provided (Req 6.5)', () => {
    const context: EmailTemplateContext = {
      ...baseContext,
      customMessage: 'Please focus on the navigation section.',
    };
    const result = generateEmailTemplate(context);
    expect(result.body).toContain('Please focus on the navigation section.');
  });

  it('does not include custom message placeholder when not provided', () => {
    const result = generateEmailTemplate(baseContext);
    // Body should go straight from the review link section to sign-off
    const signOffIndex = result.body.indexOf('Best regards,');
    const urlIndex = result.body.indexOf(baseContext.reviewUrl);
    // There should be just whitespace between the URL line and sign-off
    const between = result.body.slice(
      urlIndex + baseContext.reviewUrl.length,
      signOffIndex,
    );
    expect(between.trim()).toBe('');
  });

  it('returns subject generated via generateEmailSubject', () => {
    const context: EmailTemplateContext = {
      ...baseContext,
      phaseName: 'Wireframes',
    };
    const result = generateEmailTemplate(context);
    expect(result.subject).toBe('Review: Website Redesign - Wireframes');
  });

  it('returns subject without phase when phaseName is not provided', () => {
    const result = generateEmailTemplate(baseContext);
    expect(result.subject).toBe('Review: Website Redesign');
  });

  it('custom message appears before sign-off', () => {
    const context: EmailTemplateContext = {
      ...baseContext,
      customMessage: 'Custom note here.',
    };
    const result = generateEmailTemplate(context);
    const customIndex = result.body.indexOf('Custom note here.');
    const signOffIndex = result.body.indexOf('Best regards,');
    expect(customIndex).toBeLessThan(signOffIndex);
    expect(customIndex).toBeGreaterThan(-1);
  });
});

describe('emailDiffers', () => {
  it('returns false when emails are identical', () => {
    expect(emailDiffers('test@example.com', 'test@example.com')).toBe(false);
  });

  it('returns false when emails differ only in case', () => {
    expect(emailDiffers('Test@Example.COM', 'test@example.com')).toBe(false);
  });

  it('returns true when emails are different', () => {
    expect(emailDiffers('alice@example.com', 'bob@example.com')).toBe(true);
  });

  it('returns true when local parts differ', () => {
    expect(emailDiffers('alice@example.com', 'ALICE2@example.com')).toBe(true);
  });

  it('returns true when domains differ', () => {
    expect(emailDiffers('user@gmail.com', 'user@yahoo.com')).toBe(true);
  });

  it('handles case-insensitive comparison for mixed case', () => {
    expect(emailDiffers('John.Doe@Company.ORG', 'john.doe@company.org')).toBe(
      false,
    );
  });
});


// ─── Validation Function Tests (Task 2.2) ──────────────────────────────────

describe('validateEmailFormat', () => {
  it('accepts a standard email', () => {
    const result = validateEmailFormat('user@example.com');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain('@');
  });

  it('accepts email with subdomain', () => {
    const result = validateEmailFormat('admin@mail.example.co.uk');
    expect(result.ok).toBe(true);
  });

  it('rejects string with no @ symbol', () => {
    const result = validateEmailFormat('userexample.com');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_state');
  });

  it('rejects string with multiple @ symbols', () => {
    const result = validateEmailFormat('user@@example.com');
    expect(result.ok).toBe(false);
  });

  it('rejects email with empty local part', () => {
    const result = validateEmailFormat('@example.com');
    expect(result.ok).toBe(false);
  });

  it('rejects email with domain missing a dot', () => {
    const result = validateEmailFormat('user@localhost');
    expect(result.ok).toBe(false);
  });

  it('accepts email with numeric local part', () => {
    const result = validateEmailFormat('123@domain.org');
    expect(result.ok).toBe(true);
  });

  it('rejects empty string', () => {
    const result = validateEmailFormat('');
    expect(result.ok).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    const result = validateEmailFormat('   ');
    expect(result.ok).toBe(false);
  });
});

describe('validateClientFields', () => {
  it('returns ok for empty fields (all optional)', () => {
    const result = validateClientFields({});
    expect(result.ok).toBe(true);
  });

  it('returns ok for valid primaryEmail', () => {
    const result = validateClientFields({ primaryEmail: 'test@example.com' });
    expect(result.ok).toBe(true);
  });

  it('returns field error for invalid primaryEmail', () => {
    const result = validateClientFields({ primaryEmail: 'not-an-email' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fields).toContainEqual(
        expect.objectContaining({ field: 'primaryEmail' }),
      );
    }
  });

  it('returns field error for invalid secondaryEmail', () => {
    const result = validateClientFields({ secondaryEmail: 'bad-email' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fields).toContainEqual(
        expect.objectContaining({ field: 'secondaryEmail' }),
      );
    }
  });

  it('returns ok for valid preferredContactMethod values', () => {
    expect(validateClientFields({ preferredContactMethod: 'email' }).ok).toBe(true);
    expect(validateClientFields({ preferredContactMethod: 'phone' }).ok).toBe(true);
    expect(validateClientFields({ preferredContactMethod: 'other' }).ok).toBe(true);
  });

  it('returns field error for invalid preferredContactMethod', () => {
    const result = validateClientFields({
      preferredContactMethod: 'fax' as any,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fields).toContainEqual(
        expect.objectContaining({ field: 'preferredContactMethod' }),
      );
    }
  });

  it('returns ok for notes within limit', () => {
    const result = validateClientFields({ notes: 'Some notes.' });
    expect(result.ok).toBe(true);
  });

  it('returns ok for notes at exactly 5000 characters', () => {
    const result = validateClientFields({ notes: 'a'.repeat(5000) });
    expect(result.ok).toBe(true);
  });

  it('returns field error for notes exceeding 5000 characters', () => {
    const result = validateClientFields({ notes: 'a'.repeat(5001) });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fields).toContainEqual(
        expect.objectContaining({ field: 'notes' }),
      );
    }
  });

  it('returns multiple field errors when multiple fields invalid', () => {
    const result = validateClientFields({
      primaryEmail: 'bad',
      preferredContactMethod: 'invalid' as any,
      notes: 'x'.repeat(5001),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.fields.length).toBe(3);
    }
  });

  it('skips validation for null primaryEmail', () => {
    const result = validateClientFields({ primaryEmail: null as any });
    expect(result.ok).toBe(true);
  });

  it('skips validation for empty string primaryEmail', () => {
    const result = validateClientFields({ primaryEmail: '' });
    expect(result.ok).toBe(true);
  });
});

describe('canSendReviewLink', () => {
  const baseClient: Client = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    ownerId: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Test Client',
    status: 'active',
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    fullName: 'Test Client Full',
    businessName: null,
    primaryEmail: 'test@example.com',
    secondaryEmail: null,
    phone: null,
    website: null,
    location: null,
    preferredContactMethod: 'email',
    notes: null,
  };

  it('returns ok for an active client', () => {
    const result = canSendReviewLink(baseClient);
    expect(result.ok).toBe(true);
  });

  it('returns error with forbidden code for an archived client', () => {
    const archivedClient: Client = { ...baseClient, status: 'archived' };
    const result = canSendReviewLink(archivedClient);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('forbidden');
      expect(result.error.message).toContain('archived');
    }
  });
});
