/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for the EmailHistoryTable component.
 *
 * Tests:
 * 1. Empty state rendering when no email history records exist
 * 2. Row rendering when records are present
 * 3. Correct delivery status badge rendering (sent, failed, pending)
 * 4. Sort order (most recent first)
 * 5. Project name resolution from project list
 *
 * Requirements: 8.3, 12.2, 12.6
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EmailHistoryTable } from '../EmailHistoryTable';
import type { ClientEmailHistory, Project } from '@/lib/domain/types';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function makeEmailRecord(
  overrides: Partial<ClientEmailHistory> = {}
): ClientEmailHistory {
  return {
    id: `email-${Math.random().toString(36).slice(2)}`,
    clientId: 'client-001',
    projectId: 'project-001',
    phaseId: null,
    recipientEmail: 'client@example.com',
    subject: 'Review: Test Project',
    message: 'Your review is ready.',
    sentBy: 'admin-001',
    sentAt: '2024-06-15T10:00:00.000Z',
    deliveryStatus: 'sent',
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-001',
    clientId: 'client-001',
    ownerId: 'owner-001',
    name: 'Website Redesign',
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('EmailHistoryTable', () => {
  describe('empty state', () => {
    it('shows empty state when no email history records exist', () => {
      render(<EmailHistoryTable emailHistory={[]} />);

      expect(screen.getByText('No emails sent')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Review link emails sent to this client will appear here.'
        )
      ).toBeInTheDocument();
    });

    it('does not render table headers in empty state', () => {
      render(<EmailHistoryTable emailHistory={[]} />);

      expect(screen.queryByText('Date Sent')).not.toBeInTheDocument();
      expect(screen.queryByText('Subject')).not.toBeInTheDocument();
    });
  });

  describe('row rendering', () => {
    it('renders rows when email history records exist', () => {
      const records = [
        makeEmailRecord({
          id: 'email-1',
          subject: 'Review: Homepage Design',
          recipientEmail: 'alice@example.com',
          sentAt: '2024-06-15T10:00:00.000Z',
        }),
        makeEmailRecord({
          id: 'email-2',
          subject: 'Review: Mobile Layout',
          recipientEmail: 'bob@example.com',
          sentAt: '2024-06-10T08:00:00.000Z',
        }),
      ];

      render(<EmailHistoryTable emailHistory={records} />);

      // Each subject appears twice (table + stacked layout)
      const homepageElements = screen.getAllByText('Review: Homepage Design');
      const mobileElements = screen.getAllByText('Review: Mobile Layout');
      expect(homepageElements.length).toBeGreaterThanOrEqual(1);
      expect(mobileElements.length).toBeGreaterThanOrEqual(1);
    });

    it('displays recipient email for each record', () => {
      const records = [
        makeEmailRecord({
          id: 'email-1',
          recipientEmail: 'alice@example.com',
        }),
      ];

      render(<EmailHistoryTable emailHistory={records} />);

      // Recipient is shown in table layout (hidden on stacked via hideOnStacked)
      const elements = screen.getAllByText('alice@example.com');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('resolves project name from projects list', () => {
      const records = [
        makeEmailRecord({ id: 'email-1', projectId: 'proj-abc' }),
      ];
      const projects = [
        makeProject({ id: 'proj-abc', name: 'Brand Refresh' }),
      ];

      render(
        <EmailHistoryTable emailHistory={records} projects={projects} />
      );

      // IndexTable renders both table and stacked layout, so text may appear twice
      const elements = screen.getAllByText('Brand Refresh');
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('shows dash when project is not found in projects list', () => {
      const records = [
        makeEmailRecord({ id: 'email-1', projectId: 'unknown-proj' }),
      ];
      const projects = [makeProject({ id: 'different-proj' })];

      render(
        <EmailHistoryTable emailHistory={records} projects={projects} />
      );

      // Both table and stacked layouts render the dash
      const dashes = screen.getAllByText('—');
      expect(dashes.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('status badges', () => {
    it('renders "Sent" badge for sent status', () => {
      const records = [
        makeEmailRecord({ id: 'email-1', deliveryStatus: 'sent' }),
      ];

      render(<EmailHistoryTable emailHistory={records} />);

      // IndexTable renders both table and stacked layouts, so badge appears twice
      const badges = screen.getAllByText('Sent');
      expect(badges.length).toBe(2);
      expect(badges[0]).toBeInTheDocument();
    });

    it('renders "Failed" badge for failed status', () => {
      const records = [
        makeEmailRecord({ id: 'email-2', deliveryStatus: 'failed' }),
      ];

      render(<EmailHistoryTable emailHistory={records} />);

      const badges = screen.getAllByText('Failed');
      expect(badges.length).toBe(2);
      expect(badges[0]).toBeInTheDocument();
    });

    it('renders "Pending" badge for pending status', () => {
      const records = [
        makeEmailRecord({ id: 'email-3', deliveryStatus: 'pending' }),
      ];

      render(<EmailHistoryTable emailHistory={records} />);

      const badges = screen.getAllByText('Pending');
      expect(badges.length).toBe(2);
      expect(badges[0]).toBeInTheDocument();
    });
  });

  describe('sort order', () => {
    it('displays records in descending order by sentAt (most recent first)', () => {
      const records = [
        makeEmailRecord({
          id: 'email-old',
          subject: 'Old Email',
          sentAt: '2024-01-01T00:00:00.000Z',
        }),
        makeEmailRecord({
          id: 'email-new',
          subject: 'New Email',
          sentAt: '2024-12-31T23:59:59.000Z',
        }),
        makeEmailRecord({
          id: 'email-mid',
          subject: 'Middle Email',
          sentAt: '2024-06-15T12:00:00.000Z',
        }),
      ];

      render(<EmailHistoryTable emailHistory={records} />);

      // getAllByText returns elements from both table and stacked layouts.
      // The table renders first, so the first 3 results are from the table
      // in the correct sorted order.
      const allSubjects = screen.getAllByText(/Email$/);
      // Table (3 rows) + Stacked (3 items) = 6 total elements
      expect(allSubjects.length).toBe(6);
      // Table layout comes first in the DOM; verify sort order there
      expect(allSubjects[0].textContent).toBe('New Email');
      expect(allSubjects[1].textContent).toBe('Middle Email');
      expect(allSubjects[2].textContent).toBe('Old Email');
    });
  });
});
