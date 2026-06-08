/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for the ContactInfoCard component.
 *
 * Tests:
 * 1. Empty state rendering when client has no contact data
 * 2. Full data rendering when all fields are present
 * 3. Validation errors for invalid email in edit mode
 * 4. Edit flow: clicking Edit, changing values, saving
 *
 * Requirements: 2.6, 1.6, 12.1
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ContactInfoCard } from '../ContactInfoCard';
import type { Client } from '@/lib/domain/types';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-001',
    ownerId: 'owner-001',
    name: 'Test Client',
    status: 'active',
    deletedAt: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    fullName: null,
    businessName: null,
    primaryEmail: null,
    secondaryEmail: null,
    phone: null,
    website: null,
    location: null,
    preferredContactMethod: 'email',
    notes: null,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ContactInfoCard', () => {
  describe('empty state', () => {
    it('shows empty state message when client has no contact data', () => {
      const client = makeClient();
      const onUpdate = vi.fn();

      render(<ContactInfoCard client={client} onUpdate={onUpdate} />);

      expect(
        screen.getByText('No contact information added yet.')
      ).toBeInTheDocument();
      expect(screen.getByText('Add contact details')).toBeInTheDocument();
    });

    it('does not show field values in empty state', () => {
      const client = makeClient();
      const onUpdate = vi.fn();

      render(<ContactInfoCard client={client} onUpdate={onUpdate} />);

      // Should not render any field labels in display mode
      expect(screen.queryByText('Primary Email')).not.toBeInTheDocument();
    });
  });

  describe('data rendering', () => {
    it('renders all contact fields when data is present', () => {
      const client = makeClient({
        primaryEmail: 'john@example.com',
        secondaryEmail: 'john.alt@example.com',
        phone: '+1 555-1234',
        website: 'https://example.com',
        location: 'New York, US',
        preferredContactMethod: 'phone',
      });
      const onUpdate = vi.fn();

      render(<ContactInfoCard client={client} onUpdate={onUpdate} />);

      expect(screen.getByText('john@example.com')).toBeInTheDocument();
      expect(screen.getByText('john.alt@example.com')).toBeInTheDocument();
      expect(screen.getByText('+1 555-1234')).toBeInTheDocument();
      expect(screen.getByText('https://example.com')).toBeInTheDocument();
      expect(screen.getByText('New York, US')).toBeInTheDocument();
      expect(screen.getByText('phone')).toBeInTheDocument();
    });

    it('renders Edit button in display mode', () => {
      const client = makeClient({ primaryEmail: 'a@b.com' });
      const onUpdate = vi.fn();

      render(<ContactInfoCard client={client} onUpdate={onUpdate} />);

      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });

  describe('edit flow', () => {
    it('enters edit mode when Edit button is clicked', () => {
      const client = makeClient({ primaryEmail: 'a@b.com' });
      const onUpdate = vi.fn();

      render(<ContactInfoCard client={client} onUpdate={onUpdate} />);

      fireEvent.click(screen.getByText('Edit'));

      // Edit mode should show Save and Cancel buttons
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('populates form fields with current client values in edit mode', () => {
      const client = makeClient({
        primaryEmail: 'john@example.com',
        phone: '+1 555-9999',
      });
      const onUpdate = vi.fn();

      render(<ContactInfoCard client={client} onUpdate={onUpdate} />);

      fireEvent.click(screen.getByText('Edit'));

      const emailInput = screen.getByLabelText(
        'Primary Email'
      ) as HTMLInputElement;
      expect(emailInput.value).toBe('john@example.com');

      const phoneInput = screen.getByLabelText('Phone') as HTMLInputElement;
      expect(phoneInput.value).toBe('+1 555-9999');
    });

    it('shows validation error for invalid email format', async () => {
      const client = makeClient({ primaryEmail: 'valid@email.com' });
      const onUpdate = vi.fn();

      render(<ContactInfoCard client={client} onUpdate={onUpdate} />);

      // Enter edit mode
      fireEvent.click(screen.getByText('Edit'));

      // Enter invalid email
      const emailInput = screen.getByLabelText('Primary Email');
      fireEvent.change(emailInput, { target: { value: 'not-an-email' } });

      // Try to save
      fireEvent.click(screen.getByText('Save'));

      // Should show validation error
      await waitFor(() => {
        expect(
          screen.getByText('Primary email must be a valid email address.')
        ).toBeInTheDocument();
      });

      // onUpdate should not be called
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('calls onUpdate with correct fields on successful save', async () => {
      const client = makeClient({ primaryEmail: 'old@example.com' });
      const onUpdate = vi.fn().mockResolvedValue(undefined);

      render(<ContactInfoCard client={client} onUpdate={onUpdate} />);

      // Enter edit mode
      fireEvent.click(screen.getByText('Edit'));

      // Change email
      const emailInput = screen.getByLabelText('Primary Email');
      fireEvent.change(emailInput, {
        target: { value: 'new@example.com' },
      });

      // Save
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(onUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            primaryEmail: 'new@example.com',
          })
        );
      });
    });

    it('cancels editing and resets form on Cancel click', () => {
      const client = makeClient({ primaryEmail: 'a@b.com' });
      const onUpdate = vi.fn();

      render(<ContactInfoCard client={client} onUpdate={onUpdate} />);

      // Enter edit mode
      fireEvent.click(screen.getByText('Edit'));

      // Change field
      const emailInput = screen.getByLabelText('Primary Email');
      fireEvent.change(emailInput, { target: { value: 'changed@x.com' } });

      // Cancel
      fireEvent.click(screen.getByText('Cancel'));

      // Should be back to display mode showing original value
      expect(screen.getByText('a@b.com')).toBeInTheDocument();
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });
  });
});
