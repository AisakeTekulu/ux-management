/**
 * In-memory implementations of the repository interfaces.
 *
 * These fakes back the domain and application unit/property tests: they satisfy
 * exactly the same contracts as the Supabase-backed repositories (task 12.2)
 * but run fully in-memory with no I/O, so property tests can execute hundreds of
 * iterations quickly and deterministically.
 *
 * Each repository wraps the generic {@link InMemoryStore} foundation (see
 * `src/test/fakes.ts`), which clones records on the way in and out so callers
 * cannot mutate stored state by reference. Server-assigned fields (`id`,
 * `createdAt`) are injected on `create`, using pluggable id/timestamp providers
 * so tests can pin them for reproducibility.
 *
 * The append-only repositories (`comments`, `approvals`, `activityLogs`) and the
 * create-only ones (`designLinks`) expose only the methods their interfaces
 * declare, mirroring the audit-immutability posture of the real schema.
 *
 * _Requirements: 17.1_
 */

import type {
  ActivityLog,
  Approval,
  ChecklistItem,
  Client,
  ClientEmailHistory,
  ClientStatus,
  Comment,
  DesignLink,
  ISOTimestamp,
  Notification,
  Phase,
  Project,
  ShareLink,
  Task,
  UUID,
} from '@/lib/domain/types';
import type {
  ActivityLogRepository,
  ApprovalRepository,
  ChecklistItemRepository,
  ClientPatch,
  ClientRepository,
  CommentRepository,
  DesignLinkRepository,
  EmailHistoryRepository,
  NewActivityLog,
  NewApproval,
  NewChecklistItem,
  NewClient,
  NewClientEmailHistory,
  NewComment,
  NewDesignLink,
  NewNotification,
  NewPhase,
  NewProject,
  NewShareLink,
  NewTask,
  NotificationRepository,
  PhasePatch,
  PhaseRepository,
  ProjectPatch,
  ProjectRepository,
  ChecklistItemPatch,
  Repositories,
  ShareLinkPatch,
  ShareLinkRepository,
  TaskPatch,
  TaskRepository,
} from '@/lib/repositories/interfaces';
import { InMemoryStore, createIdFactory } from '@/test/fakes';

/**
 * A persisted entity carrying the server-assigned identity and creation
 * timestamp every record in this domain shares.
 */
type Persisted = { id: UUID; createdAt: ISOTimestamp };

/**
 * Build a deterministic, monotonic UTC timestamp generator for tests.
 *
 * Each call returns an ISO-8601 timestamp `stepMs` after the previous one,
 * starting at `startMs`. Monotonic timestamps keep `createdAt`-based ordering
 * meaningful and reproducible without depending on the wall clock.
 */
export function createTimestampFactory(
  startMs: number = Date.UTC(2024, 0, 1, 0, 0, 0),
  stepMs = 1000,
): () => ISOTimestamp {
  let current = startMs;
  return () => {
    const stamp = new Date(current).toISOString();
    current += stepMs;
    return stamp;
  };
}

/** Options controlling deterministic id/timestamp injection for tests. */
export interface InMemoryRepositoriesOptions {
  /**
   * Id generator shared by every repository. When omitted, each repository uses
   * its own entity-prefixed monotonic factory (e.g. `client_1`, `project_1`).
   */
  nextId?: () => UUID;
  /**
   * Timestamp generator used for every `createdAt`. When omitted, a single
   * monotonic factory is shared across repositories so creation order is
   * globally deterministic.
   */
  now?: () => ISOTimestamp;
}

/**
 * A generic CRUD wrapper over {@link InMemoryStore} that assigns `id` and
 * `createdAt` on create. Concrete repositories delegate to an instance of this
 * and add their own list/find-by helpers.
 */
class CrudStore<T extends Persisted> {
  readonly store: InMemoryStore<T>;

  constructor(
    private readonly nextId: () => UUID,
    private readonly now: () => ISOTimestamp,
    seed: readonly T[] = [],
  ) {
    this.store = new InMemoryStore<T>(seed);
  }

  create(input: Omit<T, 'id' | 'createdAt'>): T {
    const record = {
      ...input,
      id: this.nextId(),
      createdAt: this.now(),
    } as T;
    return this.store.insert(record);
  }

  findById(id: UUID): T | null {
    return this.store.get(id) ?? null;
  }

  update(id: UUID, patch: Partial<T>): T | null {
    return this.store.update(id, patch) ?? null;
  }

  delete(id: UUID): boolean {
    return this.store.delete(id);
  }

  list(): T[] {
    return this.store.list();
  }

  filter(predicate: (record: T) => boolean): T[] {
    return this.store.filter(predicate);
  }
}

class InMemoryClientRepository implements ClientRepository {
  constructor(private readonly crud: CrudStore<Client>) {}

  async create(input: NewClient): Promise<Client> {
    return this.crud.create({
      ...input,
      status: 'active',
      deletedAt: null,
      fullName: input.fullName ?? null,
      businessName: input.businessName ?? null,
      primaryEmail: input.primaryEmail ?? null,
      secondaryEmail: input.secondaryEmail ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      location: input.location ?? null,
      preferredContactMethod: input.preferredContactMethod ?? 'email',
      notes: input.notes ?? null,
    });
  }

  async findById(id: UUID): Promise<Client | null> {
    return this.crud.findById(id);
  }

  async listByOwner(ownerId: UUID, filter?: { status?: ClientStatus }): Promise<Client[]> {
    return this.crud.filter((client) => {
      if (client.ownerId !== ownerId) return false;
      if (filter?.status && client.status !== filter.status) return false;
      return true;
    });
  }

  async update(id: UUID, patch: ClientPatch): Promise<Client | null> {
    return this.crud.update(id, patch);
  }

  async deleteProfile(id: UUID): Promise<Client | null> {
    const now = new Date().toISOString();
    return this.crud.update(id, { name: 'Deleted Client', deletedAt: now });
  }

  async delete(id: UUID): Promise<boolean> {
    return this.crud.delete(id);
  }
}

class InMemoryProjectRepository implements ProjectRepository {
  constructor(private readonly crud: CrudStore<Project>) {}

  async create(input: NewProject): Promise<Project> {
    return this.crud.create(input);
  }

  async findById(id: UUID): Promise<Project | null> {
    return this.crud.findById(id);
  }

  async listByClient(clientId: UUID): Promise<Project[]> {
    return this.crud.filter((project) => project.clientId === clientId);
  }

  async listByOwner(ownerId: UUID): Promise<Project[]> {
    return this.crud.filter((project) => project.ownerId === ownerId);
  }

  async update(id: UUID, patch: ProjectPatch): Promise<Project | null> {
    return this.crud.update(id, patch);
  }

  async delete(id: UUID): Promise<boolean> {
    return this.crud.delete(id);
  }
}

class InMemoryPhaseRepository implements PhaseRepository {
  constructor(private readonly crud: CrudStore<Phase>) {}

  async create(input: NewPhase): Promise<Phase> {
    return this.crud.create(input);
  }

  async createMany(inputs: readonly NewPhase[]): Promise<Phase[]> {
    return inputs.map((input) => this.crud.create(input));
  }

  async findById(id: UUID): Promise<Phase | null> {
    return this.crud.findById(id);
  }

  async listByProject(projectId: UUID): Promise<Phase[]> {
    return this.crud.filter((phase) => phase.projectId === projectId);
  }

  async update(id: UUID, patch: PhasePatch): Promise<Phase | null> {
    return this.crud.update(id, patch);
  }

  async delete(id: UUID): Promise<boolean> {
    return this.crud.delete(id);
  }
}

class InMemoryChecklistItemRepository implements ChecklistItemRepository {
  constructor(private readonly crud: CrudStore<ChecklistItem>) {}

  async create(input: NewChecklistItem): Promise<ChecklistItem> {
    return this.crud.create(input);
  }

  async findById(id: UUID): Promise<ChecklistItem | null> {
    return this.crud.findById(id);
  }

  async listByPhase(phaseId: UUID): Promise<ChecklistItem[]> {
    return this.crud.filter((item) => item.phaseId === phaseId);
  }

  async update(
    id: UUID,
    patch: ChecklistItemPatch,
  ): Promise<ChecklistItem | null> {
    return this.crud.update(id, patch);
  }

  async delete(id: UUID): Promise<boolean> {
    return this.crud.delete(id);
  }
}

class InMemoryDesignLinkRepository implements DesignLinkRepository {
  constructor(private readonly crud: CrudStore<DesignLink>) {}

  async create(input: NewDesignLink): Promise<DesignLink> {
    return this.crud.create(input);
  }

  async findById(id: UUID): Promise<DesignLink | null> {
    return this.crud.findById(id);
  }

  async listByPhase(phaseId: UUID): Promise<DesignLink[]> {
    return this.crud.filter((link) => link.phaseId === phaseId);
  }

  async delete(id: UUID): Promise<boolean> {
    return this.crud.delete(id);
  }
}

class InMemoryCommentRepository implements CommentRepository {
  constructor(private readonly crud: CrudStore<Comment>) {}

  async create(input: NewComment): Promise<Comment> {
    return this.crud.create(input);
  }

  async findById(id: UUID): Promise<Comment | null> {
    return this.crud.findById(id);
  }

  async listByPhase(phaseId: UUID): Promise<Comment[]> {
    return this.crud.filter((comment) => comment.phaseId === phaseId);
  }
}

class InMemoryApprovalRepository implements ApprovalRepository {
  constructor(private readonly crud: CrudStore<Approval>) {}

  async create(input: NewApproval): Promise<Approval> {
    return this.crud.create(input);
  }

  async findById(id: UUID): Promise<Approval | null> {
    return this.crud.findById(id);
  }

  async listByPhase(phaseId: UUID): Promise<Approval[]> {
    return this.crud.filter((approval) => approval.phaseId === phaseId);
  }
}

class InMemoryTaskRepository implements TaskRepository {
  constructor(private readonly crud: CrudStore<Task>) {}

  async create(input: NewTask): Promise<Task> {
    return this.crud.create(input);
  }

  async findById(id: UUID): Promise<Task | null> {
    return this.crud.findById(id);
  }

  async listByOwner(ownerId: UUID): Promise<Task[]> {
    return this.crud.filter((task) => task.ownerId === ownerId);
  }

  async update(id: UUID, patch: TaskPatch): Promise<Task | null> {
    return this.crud.update(id, patch);
  }

  async delete(id: UUID): Promise<boolean> {
    return this.crud.delete(id);
  }
}

class InMemoryActivityLogRepository implements ActivityLogRepository {
  constructor(private readonly crud: CrudStore<ActivityLog>) {}

  async create(input: NewActivityLog): Promise<ActivityLog> {
    return this.crud.create(input);
  }

  async findById(id: UUID): Promise<ActivityLog | null> {
    return this.crud.findById(id);
  }

  async listByProject(projectId: UUID, limit?: number): Promise<ActivityLog[]> {
    // Most recent first, mirroring the `(project_id, created_at desc)` index.
    const entries = this.crud
      .filter((entry) => entry.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return limit === undefined ? entries : entries.slice(0, Math.max(0, limit));
  }
}

class InMemoryShareLinkRepository implements ShareLinkRepository {
  constructor(private readonly crud: CrudStore<ShareLink>) {}

  async create(input: NewShareLink): Promise<ShareLink> {
    return this.crud.create(input);
  }

  async findById(id: UUID): Promise<ShareLink | null> {
    return this.crud.findById(id);
  }

  async findByToken(token: string): Promise<ShareLink | null> {
    return this.crud.filter((link) => link.token === token)[0] ?? null;
  }

  async listByOwner(ownerId: UUID): Promise<ShareLink[]> {
    return this.crud.filter((link) => link.ownerId === ownerId);
  }

  async update(id: UUID, patch: ShareLinkPatch): Promise<ShareLink | null> {
    return this.crud.update(id, patch);
  }

  async revokeByClient(clientId: UUID): Promise<number> {
    const projectIds = await this._getProjectIdsByClient(clientId);
    if (projectIds.length === 0) return 0;

    const allRecords = this.crud.list();
    const now = new Date().toISOString();
    let count = 0;
    for (const link of allRecords) {
      if (link.projectId && projectIds.includes(link.projectId) && link.revokedAt === null) {
        this.crud.update(link.id, { revokedAt: now });
        count++;
      }
    }
    return count;
  }

  /** @internal — injected by factory so revokeByClient can find projects. */
  _getProjectIdsByClient: (clientId: UUID) => Promise<UUID[]> = async () => [];

  async delete(id: UUID): Promise<boolean> {
    return this.crud.delete(id);
  }
}

// ─── Email History Repository ───────────────────────────────────────────────

/**
 * In-memory implementation of {@link EmailHistoryRepository}.
 *
 * Email history is append-only (no update or delete). Queries support
 * client/project filtering and ordering by sentAt descending.
 *
 * Unlike other repositories, `ClientEmailHistory` has no `createdAt` field
 * (it uses `sentAt` provided by the caller), so we use `InMemoryStore` directly
 * rather than `CrudStore`.
 */
export class InMemoryEmailHistoryRepository implements EmailHistoryRepository {
  readonly store: InMemoryStore<ClientEmailHistory>;
  private readonly nextId: () => UUID;

  constructor(nextId?: () => UUID) {
    this.store = new InMemoryStore<ClientEmailHistory>();
    this.nextId = nextId ?? createIdFactory('emailhist');
  }

  async create(input: NewClientEmailHistory): Promise<ClientEmailHistory> {
    const record: ClientEmailHistory = { id: this.nextId(), ...input };
    return this.store.insert(record);
  }

  async findById(id: UUID): Promise<ClientEmailHistory | null> {
    return this.store.get(id) ?? null;
  }

  async listByClient(clientId: UUID, limit?: number): Promise<ClientEmailHistory[]> {
    const all = this.store
      .filter((r) => r.clientId === clientId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return limit !== undefined ? all.slice(0, limit) : all;
  }

  async listByProject(projectId: UUID, limit?: number): Promise<ClientEmailHistory[]> {
    const all = this.store
      .filter((r) => r.projectId === projectId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return limit !== undefined ? all.slice(0, limit) : all;
  }

  async countByClient(clientId: UUID): Promise<number> {
    return this.store.filter((r) => r.clientId === clientId).length;
  }

  async lastSentForClientProject(
    clientId: UUID,
    projectId: UUID,
  ): Promise<ClientEmailHistory | null> {
    const matches = this.store
      .filter((r) => r.clientId === clientId && r.projectId === projectId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return matches[0] ?? null;
  }
}

// ─── Notification Repository ────────────────────────────────────────────────

/**
 * In-memory implementation of {@link NotificationRepository}.
 *
 * Notifications support create, list, and mark-as-read operations.
 */
export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly crud: CrudStore<Notification>;

  constructor(nextId?: () => UUID, now?: () => ISOTimestamp) {
    this.crud = new CrudStore<Notification>(
      nextId ?? createIdFactory('notif'),
      now ?? (() => new Date().toISOString()),
    );
  }

  async create(input: NewNotification): Promise<Notification> {
    return this.crud.create({ ...input, isRead: false });
  }

  async listByUser(userId: UUID, limit?: number): Promise<Notification[]> {
    const all = this.crud
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return limit !== undefined ? all.slice(0, Math.max(0, limit)) : all;
  }

  async countUnread(userId: UUID): Promise<number> {
    return this.crud.filter((n) => n.userId === userId && !n.isRead).length;
  }

  async markAsRead(id: UUID): Promise<void> {
    this.crud.update(id, { isRead: true } as Partial<Notification>);
  }

  async markAllAsRead(userId: UUID): Promise<void> {
    const unread = this.crud.filter((n) => n.userId === userId && !n.isRead);
    for (const n of unread) {
      this.crud.update(n.id, { isRead: true } as Partial<Notification>);
    }
  }
}

/**
 * The fully-wired in-memory {@link Repositories} aggregate, with the concrete
 * repository instances exposed for seeding/inspection in tests.
 */
export interface InMemoryRepositories extends Repositories {
  clients: InMemoryClientRepository;
  projects: InMemoryProjectRepository;
  phases: InMemoryPhaseRepository;
  checklistItems: InMemoryChecklistItemRepository;
  designLinks: InMemoryDesignLinkRepository;
  comments: InMemoryCommentRepository;
  approvals: InMemoryApprovalRepository;
  tasks: InMemoryTaskRepository;
  activityLogs: InMemoryActivityLogRepository;
  shareLinks: InMemoryShareLinkRepository;
  emailHistory: InMemoryEmailHistoryRepository;
  notifications: InMemoryNotificationRepository;
}

/**
 * Create a fully-wired in-memory {@link Repositories} aggregate for tests.
 *
 * Pass `nextId` and/or `now` to pin id and timestamp generation for fully
 * reproducible runs; otherwise each repository uses an entity-prefixed
 * monotonic id factory and a shared monotonic UTC clock.
 */
export function createInMemoryRepositories(
  options: InMemoryRepositoriesOptions = {},
): InMemoryRepositories {
  const now = options.now ?? createTimestampFactory();
  const idFor = (prefix: string): (() => UUID) =>
    options.nextId ?? createIdFactory(prefix);

  const projects = new InMemoryProjectRepository(
    new CrudStore<Project>(idFor('project'), now),
  );
  const shareLinks = new InMemoryShareLinkRepository(
    new CrudStore<ShareLink>(idFor('sharelink'), now),
  );

  // Wire up the project lookup for revokeByClient
  shareLinks._getProjectIdsByClient = async (clientId: UUID) => {
    const projectList = await projects.listByClient(clientId);
    return projectList.map((p) => p.id);
  };

  return {
    clients: new InMemoryClientRepository(
      new CrudStore<Client>(idFor('client'), now),
    ),
    projects,
    phases: new InMemoryPhaseRepository(
      new CrudStore<Phase>(idFor('phase'), now),
    ),
    checklistItems: new InMemoryChecklistItemRepository(
      new CrudStore<ChecklistItem>(idFor('checklist'), now),
    ),
    designLinks: new InMemoryDesignLinkRepository(
      new CrudStore<DesignLink>(idFor('designlink'), now),
    ),
    comments: new InMemoryCommentRepository(
      new CrudStore<Comment>(idFor('comment'), now),
    ),
    approvals: new InMemoryApprovalRepository(
      new CrudStore<Approval>(idFor('approval'), now),
    ),
    tasks: new InMemoryTaskRepository(new CrudStore<Task>(idFor('task'), now)),
    activityLogs: new InMemoryActivityLogRepository(
      new CrudStore<ActivityLog>(idFor('activity'), now),
    ),
    shareLinks,
    emailHistory: new InMemoryEmailHistoryRepository(idFor('emailhist')),
    notifications: new InMemoryNotificationRepository(idFor('notif'), now),
  };
}
