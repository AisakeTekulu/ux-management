/**
 * Unit tests for archived client restrictions.
 *
 * Tests:
 * 1. Modal shows "Client is archived" banner for archived client (Req 10.1)
 * 2. Modal "Send Review Link" button is disabled for archived client (Req 10.4)
 * 3. `canSendReviewLink` returns error for archived clients (Req 10.1)
 * 4. `canSendReviewLink` returns ok for active clients (Req 10.5)
 * 5. Email history remains visible for archived clients (Req 10.4)
 *
 * _Requirements: 10.1, 10.4, 10.5_
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { canSendReviewLink } from '@/lib/domain/client-crm';
import { SendReviewLinkModal } from '@/components/review-link/SendReviewLinkModal';
import { EmailHistoryTable } from '@/components/email-history/EmailHistoryTable';
import type {
  Client,
  ClientEmailHistory,
  Project,
  ReviewLinkModalContext,
} from '@/lib/domain/types';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 'client-001',
    ownerId: 'owner-001',
    name: 'Test Client',
    status: 'active',
    deletedAt: null,
    createdAt: '2024-01-15T10:00:00.000Z',
    fullName: 'Jane Doe',
    businessName: 'Doe Design Co.',
    primaryEmail: 'jane@example.com',
    secondaryEmail: null,
    phone: null,
    website: null,
    location: null,
    preferredContactMethod: 'email',
    notes: null,
    ...overrides,
  };
}

function makeArchivedClient(overrides: Partial<Client> = {}): Client {
  return makeClient({ status: 'archived', ...overrides });
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-001',
    clientId: 'client-001',
    ownerId: 'owner-001',
    name: 'Website Redesign',
    createdAt: '2024-02-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeModalContext(
  clientOverrides: Partial<Client> = {},
): ReviewLinkModalContext {
  const client = makeClient(clientOverrides);
  return {
    client,
    project: makeProject(),
    lastSentDate: '2024-06-01T12:00:00.000Z',
    totalSentCount: 3,
    autoFilledEmail: client.primaryEmail ?? undefined,
    autoFilledName: client.fullName ?? undefined,
  };
}

function makeEmailHistory(overrides: Partial<ClientEmailHistory> = {}): ClientEmailHistory {
  return {
    id: 'email-001',
    clientId: 'client-001',
    projectId: 'project-001',
    phaseId: null,
    recipientEmail: 'jane@example.com',
    subject: 'Review: Website Redesign',
    message: 'Hi Jane, your review is ready.',
    sentBy: 'owner-001',
    sentAt: '2024-06-01T12:00:00.000Z',
    deliveryStatus: 'sent',
    ...overrides,
  };
}

// ─── Domain Function Tests ──────────────────────────────────────────────────

describe('canSendReviewLink - archived client restrictions', () => {
  it('returns error for archived clients (Req 10.1)', () => {
    const archivedClient = makeArchivedClient();
    const result = canSendReviewLink(archivedClient);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('app');
      expect(result.error.code).toBe('forbidden');
      expect(result.error.message).toContain('archived');
    }
  });

  it('returns ok for active clients (Req 10.5)', () => {
    const activeClient = makeClient({ status: 'active' });
    const result = canSendReviewLink(activeClient);

    expect(result.ok).toBe(true);
  });
});

// ─── SendReviewLinkModal Tests ──────────────────────────────────────────────

describe('SendReviewLinkModal - archived client restrictions', () => {
  it('shows "Client is archived" banner for archived client (Req 10.1)', () => {
    const context = makeModalContext({ status: 'archived' });

    render(
      <SendReviewLinkModal
        isOpen={true}
        onClose={vi.fn()}
        context={context}
        onSend={vi.fn()}
      />,
    );

    // The Banner with title "Client is archived" should be present
    expect(screen.getByText('Client is archived')).toBeInTheDocument();
    expect(
      screen.getByText(/Cannot send review links to archived clients/),
    ).toBeInTheDocument();
  });

  it('"Send Review Link" button is disabled for archived client (Req 10.4)', () => {
    const context = makeModalContext({ status: 'archived' });

    render(
      <SendReviewLinkModal
        isOpen={true}
        onClose={vi.fn()}
        context={context}
        onSend={vi.fn()}
      />,
    );

    const sendButton = screen.getByRole('button', { name: /Send Review Link/i });
    expect(sendButton).toBeDisabled();
  });

  it('does not show archived banner for active client', () => {
    const context = makeModalContext({ status: 'active' });

    render(
      <SendReviewLinkModal
        isOpen={true}
        onClose={vi.fn()}
        context={context}
        onSend={vi.fn()}
      />,
    );

    expect(screen.queryByText('Client is archived')).not.toBeInTheDocument();
  });
});

// ─── EmailHistoryTable Tests (historical data visible) ──────────────────────

describe('EmailHistoryTable - historical data for archived clients (Req 10.4)', () => {
  it('renders email history records for an archived client', () => {
    const archivedClient = makeArchivedClient();
    const projects: Project[] = [makeProject()];
    const emailHistory: ClientEmailHistory[] = [
      makeEmailHistory({
        id: 'email-001',
        clientId: archivedClient.id,
        subject: 'Review: Website Redesign',
        recipientEmail: 'jane@example.com',
        sentAt: '2024-06-01T12:00:00.000Z',
      }),
      makeEmailHistory({
        id: 'email-002',
        clientId: archivedClient.id,
        subject: 'Review: Brand Update - Logo Phase',
        recipientEmail: 'jane@example.com',
        sentAt: '2024-05-15T09:00:00.000Z',
      }),
    ];

    render(
      <EmailHistoryTable emailHistory={emailHistory} projects={projects} />,
    );

    // The IndexTable renders both desktop (table) and mobile (stacked) views.
    // Use getAllByText to account for both render targets.
    const redesignEntries = screen.getAllByText('Review: Website Redesign');
    expect(redesignEntries.length).toBeGreaterThanOrEqual(1);

    const brandEntries = screen.getAllByText('Review: Brand Update - Logo Phase');
    expect(brandEntries.length).toBeGreaterThanOrEqual(1);

    // Recipient emails are visible (may appear in multiple views)
    const recipientEntries = screen.getAllByText('jane@example.com');
    expect(recipientEntries.length).toBeGreaterThanOrEqual(1);

    // Project name is shown
    const projectEntries = screen.getAllByText('Website Redesign');
    expect(projectEntries.length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no history exists (but component still renders)', () => {
    render(<EmailHistoryTable emailHistory={[]} projects={[]} />);

    expect(screen.getByText('No emails sent')).toBeInTheDocument();
  });
});
