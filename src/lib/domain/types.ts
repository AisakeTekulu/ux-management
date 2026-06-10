/**
 * Shared domain types for the Client Sign-Off Dashboard.
 *
 * These are pure TypeScript types with no Supabase (or other infrastructure)
 * imports. They describe the application's core entities and are consumed by
 * the domain, application, and presentation layers.
 *
 * Mirrors the "Data Models → TypeScript Domain Types" section of the design.
 */

/** A UUID string (typically v4, e.g. from `gen_random_uuid()`). */
export type UUID = string;

/** A calendar date with no time component, formatted as `'YYYY-MM-DD'`. */
export type ISODate = string;

/** A UTC ISO-8601 timestamp, e.g. `'2024-01-31T12:34:56.000Z'`. */
export type ISOTimestamp = string;

/** The decision a reviewer can record when signing off on a phase. */
export type ApprovalDecision = 'Approved' | 'Changes Requested';

/**
 * The lifecycle status of a phase.
 *
 * Note: `'Overdue'` is intentionally absent — overdue is a derived state
 * computed from the due date and status, never persisted.
 */
export type PhaseStatus =
  | 'Draft'
  | 'Sent to Client'
  | 'Waiting for Feedback'
  | 'Changes Requested'
  | 'Approved'
  | 'Completed';

/** The lifecycle status of a client record. */
export type ClientStatus = 'active' | 'archived';

/** Preferred method of contact for a client. */
export type PreferredContactMethod = 'email' | 'phone' | 'other';

export interface Client {
  id: UUID;
  ownerId: UUID;
  name: string;
  status: ClientStatus;
  deletedAt: ISOTimestamp | null;
  createdAt: ISOTimestamp;
  // CRM extensions (all nullable for backward compatibility)
  fullName: string | null;
  businessName: string | null;
  primaryEmail: string | null;
  secondaryEmail: string | null;
  phone: string | null;
  website: string | null;
  location: string | null;
  preferredContactMethod: PreferredContactMethod;
  notes: string | null;
}

export interface Project {
  id: UUID;
  clientId: UUID;
  ownerId: UUID;
  name: string;
  createdAt: ISOTimestamp;
}

export interface Phase {
  id: UUID;
  projectId: UUID;
  title: string;
  ordinal: number;
  /** Free-text description; max 5000 characters. */
  description: string;
  /** Internal-only notes; max 5000 characters. */
  internalNotes: string;
  /** Current status; never `'Overdue'` (overdue is derived). */
  status: PhaseStatus;
  dueDate: ISODate | null;
  approvedByName: string | null;
  approvedInitials: string | null;
  approvedAt: ISOTimestamp | null;
  createdAt: ISOTimestamp;
}

export interface ChecklistItem {
  id: UUID;
  phaseId: UUID;
  text: string;
  complete: boolean;
  createdAt: ISOTimestamp;
}

export interface DesignLink {
  id: UUID;
  phaseId: UUID;
  kind: 'url' | 'file';
  /** Populated when `kind` is `'url'`. */
  url: string | null;
  /** Populated when `kind` is `'file'`. */
  storagePath: string | null;
  fileName: string | null;
  createdAt: ISOTimestamp;
}

/** The originator of a comment: an authenticated designer or an external reviewer. */
export type Author =
  | { type: 'designer'; userId: UUID }
  | { type: 'reviewer'; name: string };

export interface Comment {
  id: UUID;
  phaseId: UUID;
  authorType: 'designer' | 'reviewer';
  /** Populated when `authorType` is `'designer'`. */
  authorUserId: UUID | null;
  /** Populated when `authorType` is `'reviewer'`. */
  authorName: string | null;
  /** Comment body; 1..5000 characters. */
  text: string;
  /** UTC creation timestamp. */
  createdAt: ISOTimestamp;
}

export interface Approval {
  id: UUID;
  phaseId: UUID;
  decision: ApprovalDecision;
  /** Reviewer's full name; 1..100 characters. */
  reviewerName: string;
  /** Reviewer's initials; 1..10 characters. */
  reviewerInitials: string;
  /** Immutable snapshot of checklist completion at sign-off. */
  checklistSnapshot: Array<{ checklistItemId: UUID; text: string; complete: boolean }>;
  /** UTC approval timestamp. */
  createdAt: ISOTimestamp;
}

export interface Task {
  id: UUID;
  ownerId: UUID;
  /** Task title; 1..200 characters. */
  title: string;
  state: 'open' | 'complete';
  projectId: UUID | null;
  phaseId: UUID | null;
  dueDate: ISODate | null;
  createdAt: ISOTimestamp;
}

/** The kind of event recorded in the append-only activity log. */
export type ActivityType =
  | 'comment_created'
  | 'approval_created'
  | 'phase_status_changed'
  | 'review_link_sent';

export interface ActivityLog {
  id: UUID;
  projectId: UUID;
  type: ActivityType;
  /** Designer email or reviewer name. */
  actor: string;
  /** Event-specific payload, e.g. `{ from, to }` or `{ decision, name }`. */
  detail: Record<string, unknown>;
  /** UTC timestamp, second-level precision. */
  createdAt: ISOTimestamp;
}

export interface ShareLink {
  id: UUID;
  ownerId: UUID;
  /** Opaque, URL-safe token; >= 32 characters, unique. */
  token: string;
  scopeType: 'project' | 'phase';
  /** Populated when `scopeType` is `'project'`. */
  projectId: UUID | null;
  /** Populated when `scopeType` is `'phase'`. */
  phaseId: UUID | null;
  revokedAt: ISOTimestamp | null;
  firstAccessedAt: ISOTimestamp | null;
  createdAt: ISOTimestamp;
}

// ─── CRM & Email History Types ──────────────────────────────────────────────

/** Delivery status for a sent review link email. */
export type EmailDeliveryStatus = 'sent' | 'failed' | 'pending';

/** An append-only email history record tracking review link sends. */
export interface ClientEmailHistory {
  id: UUID;
  clientId: UUID;
  projectId: UUID;
  phaseId: UUID | null;
  recipientEmail: string;
  subject: string;
  message: string;
  sentBy: UUID;
  sentAt: ISOTimestamp;
  deliveryStatus: EmailDeliveryStatus;
}

/** Input type for updating CRM fields on a client profile. */
export type ClientCRMInput = Partial<
  Pick<
    Client,
    | 'fullName'
    | 'businessName'
    | 'primaryEmail'
    | 'secondaryEmail'
    | 'phone'
    | 'website'
    | 'location'
    | 'preferredContactMethod'
    | 'notes'
  >
>;

/** Context for generating an email template. */
export interface EmailTemplateContext {
  clientFullName: string;
  projectName: string;
  phaseName?: string;
  reviewUrl: string;
  customMessage?: string;
  adminName: string;
}

/** Output of email template generation. */
export interface EmailTemplate {
  subject: string;
  body: string;
}

/** Input for the sendReviewLink server action. */
export interface SendReviewLinkInput {
  clientId: UUID;
  projectId: UUID;
  phaseId?: UUID;
  recipientEmail: string;
  ccEmail?: string;
  subject: string;
  customMessage?: string;
  saveEmailToProfile: boolean;
}

/** Result returned after a successful sendReviewLink action. */
export interface SendReviewLinkResult {
  reviewUrl: string;
  emailHistoryId: UUID;
  shareToken: string;
}

/** Context data provided to the Send Review Link modal. */
export interface ReviewLinkModalContext {
  client: Client;
  project: Project;
  phase?: Phase;
  lastSentDate?: ISOTimestamp;
  totalSentCount: number;
  autoFilledEmail?: string;
  autoFilledName?: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

/** The category of a notification event. */
export type NotificationType =
  | 'client_comment'
  | 'client_approval'
  | 'client_changes_requested'
  | 'phase_status_changed'
  | 'review_link_viewed';

/**
 * An in-app notification for the admin user.
 *
 * Notifications are created when clients interact with shared review links
 * (commenting, approving, requesting changes) or when a review link is viewed.
 */
export interface Notification {
  id: UUID;
  userId: UUID;
  projectId: UUID | null;
  phaseId: UUID | null;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: ISOTimestamp;
  metadata: Record<string, unknown>;
}
