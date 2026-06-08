'use client';

/**
 * EmailHistoryTable — displays a table of email history records for a client
 * or project. Uses IndexTable for consistent list rendering and shows delivery
 * status via colored badges.
 *
 * Requirements: 7.4, 7.5, 8.3, 8.4, 12.2, 12.6
 */

import { IndexTable, type IndexTableColumn } from '@/components/ui/IndexTable';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ClientEmailHistory, EmailDeliveryStatus, Project } from '@/lib/domain/types';
import { cn } from '@/lib/utils';

export interface EmailHistoryTableProps {
  /** Email history records to display. */
  emailHistory: ClientEmailHistory[];
  /** Optional project list for mapping projectId to project name. */
  projects?: Project[];
}

/** Badge color map for delivery status values. */
const STATUS_BADGE_STYLES: Record<EmailDeliveryStatus, { bg: string; text: string }> = {
  sent: { bg: 'bg-status-green/10', text: 'text-status-green' },
  failed: { bg: 'bg-status-red/10', text: 'text-status-red' },
  pending: { bg: 'bg-status-amber/10', text: 'text-status-amber' },
};

/** Format an ISO timestamp to a readable date string. */
function formatDate(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Render a delivery status badge. */
function DeliveryStatusBadge({ status }: { status: EmailDeliveryStatus }) {
  const { bg, text } = STATUS_BADGE_STYLES[status];
  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-token-2 py-token-1 text-xs font-medium',
        bg,
        text,
      )}
    >
      {label}
    </span>
  );
}

export function EmailHistoryTable({ emailHistory, projects }: EmailHistoryTableProps) {
  // Build a lookup map for project names
  const projectNameMap = new Map<string, string>();
  if (projects) {
    for (const project of projects) {
      projectNameMap.set(project.id, project.name);
    }
  }

  // Sort by sent_at descending (most recent first)
  const sortedHistory = [...emailHistory].sort(
    (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
  );

  const columns: IndexTableColumn<ClientEmailHistory>[] = [
    {
      key: 'sentAt',
      header: 'Date Sent',
      render: (row) => <span className="whitespace-nowrap">{formatDate(row.sentAt)}</span>,
    },
    {
      key: 'project',
      header: 'Project',
      render: (row) => projectNameMap.get(row.projectId) ?? '—',
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (row) => row.subject,
    },
    {
      key: 'recipientEmail',
      header: 'Recipient',
      render: (row) => row.recipientEmail,
      hideOnStacked: true,
    },
    {
      key: 'deliveryStatus',
      header: 'Status',
      render: (row) => <DeliveryStatusBadge status={row.deliveryStatus} />,
      align: 'center',
    },
  ];

  return (
    <IndexTable<ClientEmailHistory>
      columns={columns}
      rows={sortedHistory}
      rowKey={(row) => row.id}
      caption="Email history"
      emptyState={
        <EmptyState
          title="No emails sent"
          description="Review link emails sent to this client will appear here."
          icon={<EmailIcon />}
        />
      }
    />
  );
}

/** Email icon for the empty state. */
function EmailIcon() {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
