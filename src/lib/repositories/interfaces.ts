/**
 * Typed repository interfaces for the Client Sign-Off Dashboard.
 *
 * These interfaces form the persistence boundary the Domain and Application
 * layers depend on (per the design's layered architecture: the Domain layer has
 * no Supabase imports and is injected with repository interfaces). They are
 * pure TypeScript contracts — no implementation. A Supabase-backed
 * implementation (task 12.2) and in-memory fakes for tests (task 12.3) both
 * satisfy these same interfaces, which keeps the domain logic testable in
 * isolation and the persistence technology swappable.
 *
 * Conventions:
 * - Every method is asynchronous and returns a `Promise`.
 * - Server-generated fields (`id`, `createdAt`) are excluded from create inputs
 *   via the `New<T>` helper, since persistence assigns them.
 * - `findById` (and `findByToken`) resolve to `null` when no record matches,
 *   rather than rejecting, so callers can branch on absence explicitly.
 * - `update` accepts a partial patch of mutable fields and resolves to the
 *   updated record, or `null` when the id does not exist.
 * - `activity_logs` is append-only by design (audit immutability), so its
 *   repository deliberately exposes no update or delete methods.
 *
 * _Requirements: 17.1_
 */

import type {
  Approval,
  ActivityLog,
  ChecklistItem,
  Client,
  ClientEmailHistory,
  ClientStatus,
  Comment,
  DesignLink,
  Notification,
  Phase,
  Project,
  ShareLink,
  Task,
  UUID,
} from '@/lib/domain/types';

/**
 * The shape accepted when creating a record: the full entity minus the
 * server-assigned identity (`id`) and creation timestamp (`createdAt`).
 */
export type New<T extends { id: UUID; createdAt: string }> = Omit<
  T,
  'id' | 'createdAt'
>;

/** Create input for a {@link Client}. CRM fields are optional at creation time. */
export type NewClient = Omit<
  New<Client>,
  | 'status'
  | 'deletedAt'
  | 'fullName'
  | 'businessName'
  | 'primaryEmail'
  | 'secondaryEmail'
  | 'phone'
  | 'website'
  | 'location'
  | 'preferredContactMethod'
  | 'notes'
> &
  Partial<
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
/** Mutable fields of a {@link Client} that an update may patch, including CRM fields. */
export type ClientPatch = Partial<Pick<Client,
  | 'name' | 'status' | 'deletedAt'
  | 'fullName' | 'businessName' | 'primaryEmail' | 'secondaryEmail'
  | 'phone' | 'website' | 'location' | 'preferredContactMethod' | 'notes'
>>;

/**
 * Persistence operations for {@link Client} records, owner-scoped.
 */
export interface ClientRepository {
  /** Persist a new client and resolve to the stored record. */
  create(input: NewClient): Promise<Client>;
  /** Resolve to the client with `id`, or `null` when absent. */
  findById(id: UUID): Promise<Client | null>;
  /** List clients by owner, optionally filtered by status. */
  listByOwner(ownerId: UUID, filter?: { status?: ClientStatus }): Promise<Client[]>;
  /** Patch mutable fields of a client; resolve to the updated record or `null`. */
  update(id: UUID, patch: ClientPatch): Promise<Client | null>;
  /**
   * Perform a "delete profile" operation: null contact fields, set deletedAt.
   * Returns the updated client or null if not found.
   */
  deleteProfile(id: UUID): Promise<Client | null>;
  /**
   * Delete a client. Dependent records cascade at the persistence layer.
   * Resolves to whether a record was removed.
   */
  delete(id: UUID): Promise<boolean>;
}

/** Create input for a {@link Project}. */
export type NewProject = New<Project>;
/** Mutable fields of a {@link Project} that an update may patch. */
export type ProjectPatch = Partial<Pick<Project, 'name'>>;

/**
 * Persistence operations for {@link Project} records.
 */
export interface ProjectRepository {
  /** Persist a new project and resolve to the stored record. */
  create(input: NewProject): Promise<Project>;
  /** Resolve to the project with `id`, or `null` when absent. */
  findById(id: UUID): Promise<Project | null>;
  /** List all projects belonging to a client. */
  listByClient(clientId: UUID): Promise<Project[]>;
  /** List all projects owned by `ownerId`. */
  listByOwner(ownerId: UUID): Promise<Project[]>;
  /** Patch mutable fields of a project; resolve to the updated record or `null`. */
  update(id: UUID, patch: ProjectPatch): Promise<Project | null>;
  /** Delete a project (children cascade). Resolves to whether it existed. */
  delete(id: UUID): Promise<boolean>;
}

/** Create input for a {@link Phase}. */
export type NewPhase = New<Phase>;
/**
 * Mutable fields of a {@link Phase} that an update may patch. Identity,
 * `projectId`, and `createdAt` are immutable and therefore excluded.
 */
export type PhasePatch = Partial<
  Pick<
    Phase,
    | 'title'
    | 'ordinal'
    | 'description'
    | 'internalNotes'
    | 'status'
    | 'dueDate'
    | 'approvedByName'
    | 'approvedInitials'
    | 'approvedAt'
  >
>;

/**
 * Persistence operations for {@link Phase} records.
 */
export interface PhaseRepository {
  /** Persist a new phase and resolve to the stored record. */
  create(input: NewPhase): Promise<Phase>;
  /** Persist many phases at once (e.g. default phase initialization). */
  createMany(inputs: readonly NewPhase[]): Promise<Phase[]>;
  /** Resolve to the phase with `id`, or `null` when absent. */
  findById(id: UUID): Promise<Phase | null>;
  /** List all phases of a project (caller orders by ordinal). */
  listByProject(projectId: UUID): Promise<Phase[]>;
  /** Patch mutable fields of a phase; resolve to the updated record or `null`. */
  update(id: UUID, patch: PhasePatch): Promise<Phase | null>;
  /** Delete a phase (children cascade). Resolves to whether it existed. */
  delete(id: UUID): Promise<boolean>;
}

/** Create input for a {@link ChecklistItem}. */
export type NewChecklistItem = New<ChecklistItem>;
/** Mutable fields of a {@link ChecklistItem} that an update may patch. */
export type ChecklistItemPatch = Partial<Pick<ChecklistItem, 'text' | 'complete'>>;

/**
 * Persistence operations for {@link ChecklistItem} records.
 */
export interface ChecklistItemRepository {
  /** Persist a new checklist item and resolve to the stored record. */
  create(input: NewChecklistItem): Promise<ChecklistItem>;
  /** Resolve to the checklist item with `id`, or `null` when absent. */
  findById(id: UUID): Promise<ChecklistItem | null>;
  /** List all checklist items of a phase (caller orders by createdAt). */
  listByPhase(phaseId: UUID): Promise<ChecklistItem[]>;
  /** Patch mutable fields; resolve to the updated record or `null`. */
  update(id: UUID, patch: ChecklistItemPatch): Promise<ChecklistItem | null>;
  /** Delete a checklist item. Resolves to whether it existed. */
  delete(id: UUID): Promise<boolean>;
}

/** Create input for a {@link DesignLink}. */
export type NewDesignLink = New<DesignLink>;

/**
 * Persistence operations for {@link DesignLink} records.
 *
 * Design links are immutable after creation (a link is added or removed, not
 * edited), so no update method is exposed.
 */
export interface DesignLinkRepository {
  /** Persist a new design link and resolve to the stored record. */
  create(input: NewDesignLink): Promise<DesignLink>;
  /** Resolve to the design link with `id`, or `null` when absent. */
  findById(id: UUID): Promise<DesignLink | null>;
  /** List all design links of a phase. */
  listByPhase(phaseId: UUID): Promise<DesignLink[]>;
  /**
   * Delete a design link. Removal of any underlying stored file is handled by
   * the application layer. Resolves to whether the record existed.
   */
  delete(id: UUID): Promise<boolean>;
}

/** Create input for a {@link Comment}. */
export type NewComment = New<Comment>;

/**
 * Persistence operations for {@link Comment} records.
 *
 * Comments are part of the audit trail and immutable once recorded, so no
 * update or delete methods are exposed.
 */
export interface CommentRepository {
  /** Persist a new comment and resolve to the stored record. */
  create(input: NewComment): Promise<Comment>;
  /** Resolve to the comment with `id`, or `null` when absent. */
  findById(id: UUID): Promise<Comment | null>;
  /** List all comments of a phase (caller orders by createdAt ascending). */
  listByPhase(phaseId: UUID): Promise<Comment[]>;
}

/** Create input for an {@link Approval}. */
export type NewApproval = New<Approval>;

/**
 * Persistence operations for {@link Approval} records.
 *
 * Approvals are an immutable audit record (with a denormalized checklist
 * snapshot), so only create and read operations are exposed.
 */
export interface ApprovalRepository {
  /** Persist a new approval and resolve to the stored record. */
  create(input: NewApproval): Promise<Approval>;
  /** Resolve to the approval with `id`, or `null` when absent. */
  findById(id: UUID): Promise<Approval | null>;
  /** List all approvals of a phase (caller orders reverse-chronologically). */
  listByPhase(phaseId: UUID): Promise<Approval[]>;
}

/** Create input for a {@link Task}. */
export type NewTask = New<Task>;
/** Mutable fields of a {@link Task} that an update may patch. */
export type TaskPatch = Partial<Pick<Task, 'title' | 'state' | 'dueDate'>>;

/**
 * Persistence operations for {@link Task} records, owner-scoped.
 */
export interface TaskRepository {
  /** Persist a new task and resolve to the stored record. */
  create(input: NewTask): Promise<Task>;
  /** Resolve to the task with `id`, or `null` when absent. */
  findById(id: UUID): Promise<Task | null>;
  /** List all tasks owned by `ownerId` (caller orders/filters). */
  listByOwner(ownerId: UUID): Promise<Task[]>;
  /** Patch mutable fields of a task; resolve to the updated record or `null`. */
  update(id: UUID, patch: TaskPatch): Promise<Task | null>;
  /** Delete a task. Resolves to whether it existed. */
  delete(id: UUID): Promise<boolean>;
}

/** Create input for an {@link ActivityLog}. */
export type NewActivityLog = New<ActivityLog>;

/**
 * Persistence operations for {@link ActivityLog} records.
 *
 * The activity log is append-only to enforce audit immutability — entries can
 * be created and read but never updated or deleted.
 */
export interface ActivityLogRepository {
  /** Append a new activity-log entry and resolve to the stored record. */
  create(input: NewActivityLog): Promise<ActivityLog>;
  /** Resolve to the activity-log entry with `id`, or `null` when absent. */
  findById(id: UUID): Promise<ActivityLog | null>;
  /**
   * List activity for a project, most recent first. `limit` optionally caps the
   * number of returned entries (e.g. 20 for the dashboard, 50 per project).
   */
  listByProject(projectId: UUID, limit?: number): Promise<ActivityLog[]>;
}

/** Create input for a {@link ShareLink}. */
export type NewShareLink = New<ShareLink>;
/**
 * Mutable fields of a {@link ShareLink} that an update may patch — namely the
 * revocation and first-access timestamps that change over the link's lifetime.
 */
export type ShareLinkPatch = Partial<
  Pick<ShareLink, 'revokedAt' | 'firstAccessedAt'>
>;

/**
 * Persistence operations for {@link ShareLink} records.
 */
export interface ShareLinkRepository {
  /** Persist a new share link and resolve to the stored record. */
  create(input: NewShareLink): Promise<ShareLink>;
  /** Resolve to the share link with `id`, or `null` when absent. */
  findById(id: UUID): Promise<ShareLink | null>;
  /**
   * Resolve a share link by its opaque token, or `null` when no link matches.
   * Used by the unauthenticated portal access path.
   */
  findByToken(token: string): Promise<ShareLink | null>;
  /** List all share links owned by `ownerId`. */
  listByOwner(ownerId: UUID): Promise<ShareLink[]>;
  /**
   * Patch lifecycle fields (e.g. set `revokedAt` to revoke, or stamp
   * `firstAccessedAt`); resolve to the updated record or `null`.
   */
  update(id: UUID, patch: ShareLinkPatch): Promise<ShareLink | null>;
  /** Revoke all active (non-revoked) share links for projects belonging to a client. */
  revokeByClient(clientId: UUID): Promise<number>;
  /** Delete a share link. Resolves to whether it existed. */
  delete(id: UUID): Promise<boolean>;
}

/**
 * Create input for a {@link ClientEmailHistory} record.
 * Omits `id` since it is server-assigned at persistence time.
 */
export type NewClientEmailHistory = Omit<ClientEmailHistory, 'id'>;

/**
 * Persistence operations for {@link ClientEmailHistory} records.
 *
 * Email history is an append-only audit log. Records are created and read but
 * never updated or deleted (immutable communication trail).
 */
export interface EmailHistoryRepository {
  /** Persist a new email history record and resolve to the stored record. */
  create(input: NewClientEmailHistory): Promise<ClientEmailHistory>;
  /** Resolve to the email history entry with `id`, or `null` when absent. */
  findById(id: UUID): Promise<ClientEmailHistory | null>;
  /** List email history for a client, ordered by sentAt DESC. */
  listByClient(clientId: UUID, limit?: number): Promise<ClientEmailHistory[]>;
  /** List email history for a project, ordered by sentAt DESC. */
  listByProject(projectId: UUID, limit?: number): Promise<ClientEmailHistory[]>;
  /** Count total email history entries for a client. */
  countByClient(clientId: UUID): Promise<number>;
  /** Get the most recently sent email for a client + project pair, or `null`. */
  lastSentForClientProject(clientId: UUID, projectId: UUID): Promise<ClientEmailHistory | null>;
}

// ---------------------------------------------------------------------------
// Notification Repository
// ---------------------------------------------------------------------------

/** Create input for a {@link Notification}. */
export type NewNotification = Omit<Notification, 'id' | 'createdAt' | 'isRead'>;

/**
 * Persistence operations for {@link Notification} records.
 *
 * Notifications are append-only from the perspective of content (title/message/type
 * are immutable once created), but the `isRead` flag is mutable to support
 * marking notifications as read.
 */
export interface NotificationRepository {
  /** Persist a new notification and resolve to the stored record. */
  create(input: NewNotification): Promise<Notification>;
  /** List notifications for a user, ordered by createdAt DESC. */
  listByUser(userId: UUID, limit?: number): Promise<Notification[]>;
  /** Count unread notifications for a user. */
  countUnread(userId: UUID): Promise<number>;
  /** Mark a single notification as read. */
  markAsRead(id: UUID): Promise<void>;
  /** Mark all notifications for a user as read. */
  markAllAsRead(userId: UUID): Promise<void>;
}

/**
 * Aggregate of all repository interfaces, convenient for dependency injection
 * into application Server Actions and Route Handlers.
 */
export interface Repositories {
  clients: ClientRepository;
  projects: ProjectRepository;
  phases: PhaseRepository;
  checklistItems: ChecklistItemRepository;
  designLinks: DesignLinkRepository;
  comments: CommentRepository;
  approvals: ApprovalRepository;
  tasks: TaskRepository;
  activityLogs: ActivityLogRepository;
  shareLinks: ShareLinkRepository;
  emailHistory: EmailHistoryRepository;
  notifications: NotificationRepository;
}
