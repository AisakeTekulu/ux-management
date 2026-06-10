/**
 * Supabase-backed implementations of the repository interfaces.
 *
 * Each repository maps domain types to/from the Postgres column naming
 * convention (snake_case) and delegates to `@supabase/supabase-js` for
 * actual persistence. RLS policies on the database enforce ownership scoping
 * transparently — the repositories themselves do not filter by owner because
 * the authenticated Supabase client already restricts visibility.
 *
 * Multi-statement operations (project creation with default phases, client
 * cascade-delete with Storage cleanup) are noted where an RPC would be used
 * in production. Single-table CRUD is implemented directly.
 *
 * _Requirements: 17.1, 17.2, 17.3, 17.7, 17.9_
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  ActivityLog,
  Approval,
  ChecklistItem,
  Client,
  Comment,
  DesignLink,
  Phase,
  Project,
  ShareLink,
  Task,
  UUID,
} from '@/lib/domain/types';
import type { ClientStatus } from '@/lib/domain/types';
import type {
  ActivityLogRepository,
  ApprovalRepository,
  ChecklistItemRepository,
  ChecklistItemPatch,
  ClientPatch,
  ClientRepository,
  CommentRepository,
  DesignLinkRepository,
  NewActivityLog,
  NewApproval,
  NewChecklistItem,
  NewClient,
  NewComment,
  NewDesignLink,
  NewPhase,
  NewProject,
  NewShareLink,
  NewTask,
  PhasePatch,
  PhaseRepository,
  ProjectPatch,
  ProjectRepository,
  Repositories,
  ShareLinkPatch,
  ShareLinkRepository,
  TaskPatch,
  TaskRepository,
} from '@/lib/repositories/interfaces';

// ---------------------------------------------------------------------------
// Row ↔ Domain mappers
// ---------------------------------------------------------------------------

/** Database row shape for the `clients` table. */
interface ClientRow {
  id: string;
  owner_id: string;
  name: string;
  status: 'active' | 'archived';
  deleted_at: string | null;
  created_at: string;
  full_name: string | null;
  business_name: string | null;
  primary_email: string | null;
  secondary_email: string | null;
  phone: string | null;
  website: string | null;
  location: string | null;
  preferred_contact_method: string;
  notes: string | null;
}

/** Database row shape for the `projects` table. */
interface ProjectRow {
  id: string;
  client_id: string;
  owner_id: string;
  name: string;
  created_at: string;
}

/** Database row shape for the `phases` table. */
interface PhaseRow {
  id: string;
  project_id: string;
  title: string;
  ordinal: number;
  description: string;
  internal_notes: string;
  status: string;
  due_date: string | null;
  approved_by_name: string | null;
  approved_initials: string | null;
  approved_at: string | null;
  created_at: string;
}

/** Database row shape for the `checklist_items` table. */
interface ChecklistItemRow {
  id: string;
  phase_id: string;
  text: string;
  complete: boolean;
  created_at: string;
}

/** Database row shape for the `design_links` table. */
interface DesignLinkRow {
  id: string;
  phase_id: string;
  kind: string;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
  created_at: string;
}

/** Database row shape for the `comments` table. */
interface CommentRow {
  id: string;
  phase_id: string;
  author_type: string;
  author_user_id: string | null;
  author_name: string | null;
  text: string;
  created_at: string;
}

/** Database row shape for the `approvals` table. */
interface ApprovalRow {
  id: string;
  phase_id: string;
  decision: string;
  reviewer_name: string;
  reviewer_initials: string;
  checklist_snapshot: unknown;
  created_at: string;
}

/** Database row shape for the `tasks` table. */
interface TaskRow {
  id: string;
  owner_id: string;
  title: string;
  state: string;
  project_id: string | null;
  phase_id: string | null;
  due_date: string | null;
  created_at: string;
}

/** Database row shape for the `activity_logs` table. */
interface ActivityLogRow {
  id: string;
  project_id: string;
  type: string;
  actor: string;
  detail: unknown;
  created_at: string;
}

/** Database row shape for the `share_links` table. */
interface ShareLinkRow {
  id: string;
  owner_id: string;
  token: string;
  scope_type: string;
  project_id: string | null;
  phase_id: string | null;
  revoked_at: string | null;
  first_accessed_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Row → Domain mapping functions
// ---------------------------------------------------------------------------

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    status: row.status,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    fullName: row.full_name,
    businessName: row.business_name,
    primaryEmail: row.primary_email,
    secondaryEmail: row.secondary_email,
    phone: row.phone,
    website: row.website,
    location: row.location,
    preferredContactMethod: (row.preferred_contact_method as Client['preferredContactMethod']) ?? 'email',
    notes: row.notes,
  };
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    clientId: row.client_id,
    ownerId: row.owner_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function toPhase(row: PhaseRow): Phase {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    ordinal: row.ordinal,
    description: row.description,
    internalNotes: row.internal_notes,
    status: row.status as Phase['status'],
    dueDate: row.due_date,
    approvedByName: row.approved_by_name,
    approvedInitials: row.approved_initials,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  };
}

function toChecklistItem(row: ChecklistItemRow): ChecklistItem {
  return {
    id: row.id,
    phaseId: row.phase_id,
    text: row.text,
    complete: row.complete,
    createdAt: row.created_at,
  };
}

function toDesignLink(row: DesignLinkRow): DesignLink {
  return {
    id: row.id,
    phaseId: row.phase_id,
    kind: row.kind as DesignLink['kind'],
    url: row.url,
    storagePath: row.storage_path,
    fileName: row.file_name,
    createdAt: row.created_at,
  };
}

function toComment(row: CommentRow): Comment {
  return {
    id: row.id,
    phaseId: row.phase_id,
    authorType: row.author_type as Comment['authorType'],
    authorUserId: row.author_user_id,
    authorName: row.author_name,
    text: row.text,
    createdAt: row.created_at,
  };
}

function toApproval(row: ApprovalRow): Approval {
  return {
    id: row.id,
    phaseId: row.phase_id,
    decision: row.decision as Approval['decision'],
    reviewerName: row.reviewer_name,
    reviewerInitials: row.reviewer_initials,
    checklistSnapshot: row.checklist_snapshot as Approval['checklistSnapshot'],
    createdAt: row.created_at,
  };
}

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    state: row.state as Task['state'],
    projectId: row.project_id,
    phaseId: row.phase_id,
    dueDate: row.due_date,
    createdAt: row.created_at,
  };
}

function toActivityLog(row: ActivityLogRow): ActivityLog {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as ActivityLog['type'],
    actor: row.actor,
    detail: row.detail as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

function toShareLink(row: ShareLinkRow): ShareLink {
  return {
    id: row.id,
    ownerId: row.owner_id,
    token: row.token,
    scopeType: row.scope_type as ShareLink['scopeType'],
    projectId: row.project_id,
    phaseId: row.phase_id,
    revokedAt: row.revoked_at,
    firstAccessedAt: row.first_accessed_at,
    createdAt: row.created_at,
  };
}

// ---------------------------------------------------------------------------
// Helper: throw on Supabase errors
// ---------------------------------------------------------------------------

function throwIfError<T>(
  result: { data: T | null; error: { message: string } | null },
  context: string,
): T {
  if (result.error) {
    throw new Error(`[SupabaseRepo] ${context}: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error(`[SupabaseRepo] ${context}: no data returned`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Repository implementations
// ---------------------------------------------------------------------------

class SupabaseClientRepository implements ClientRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewClient): Promise<Client> {
    const result = await this.db
      .from('clients')
      .insert({
        owner_id: input.ownerId,
        name: input.name,
        full_name: input.fullName ?? null,
        business_name: input.businessName ?? null,
        primary_email: input.primaryEmail ?? null,
        secondary_email: input.secondaryEmail ?? null,
        phone: input.phone ?? null,
        website: input.website ?? null,
        location: input.location ?? null,
        preferred_contact_method: input.preferredContactMethod ?? 'email',
        notes: input.notes ?? null,
      })
      .select()
      .single();
    return toClient(throwIfError(result, 'clients.create'));
  }

  async findById(id: UUID): Promise<Client | null> {
    const result = await this.db
      .from('clients')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] clients.findById: ${result.error.message}`,
      );
    }
    return result.data ? toClient(result.data) : null;
  }

  async listByOwner(ownerId: UUID, filter?: { status?: ClientStatus }): Promise<Client[]> {
    let query = this.db
      .from('clients')
      .select()
      .eq('owner_id', ownerId);
    if (filter?.status) {
      query = query.eq('status', filter.status);
    }
    const result = await query;
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] clients.listByOwner: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toClient);
  }

  async update(id: UUID, patch: ClientPatch): Promise<Client | null> {
    const updates: Record<string, unknown> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.deletedAt !== undefined) updates.deleted_at = patch.deletedAt;
    // CRM fields: camelCase → snake_case mapping
    if (patch.fullName !== undefined) updates.full_name = patch.fullName;
    if (patch.businessName !== undefined) updates.business_name = patch.businessName;
    if (patch.primaryEmail !== undefined) updates.primary_email = patch.primaryEmail;
    if (patch.secondaryEmail !== undefined) updates.secondary_email = patch.secondaryEmail;
    if (patch.phone !== undefined) updates.phone = patch.phone;
    if (patch.website !== undefined) updates.website = patch.website;
    if (patch.location !== undefined) updates.location = patch.location;
    if (patch.preferredContactMethod !== undefined) updates.preferred_contact_method = patch.preferredContactMethod;
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (Object.keys(updates).length === 0) return this.findById(id);

    const result = await this.db
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] clients.update: ${result.error.message}`,
      );
    }
    return result.data ? toClient(result.data) : null;
  }

  async deleteProfile(id: UUID): Promise<Client | null> {
    const now = new Date().toISOString();
    const result = await this.db
      .from('clients')
      .update({ name: 'Deleted Client', deleted_at: now })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] clients.deleteProfile: ${result.error.message}`,
      );
    }
    return result.data ? toClient(result.data) : null;
  }

  async delete(id: UUID): Promise<boolean> {
    // NOTE: In production, client cascade-delete with Storage cleanup would
    // use an RPC to atomically delete all dependent records and collect
    // storage paths for post-delete cleanup. Here we rely on the database
    // ON DELETE CASCADE for relational data; Storage cleanup is handled by
    // the application layer as a post-delete step.
    const result = await this.db
      .from('clients')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] clients.delete: ${result.error.message}`,
      );
    }
    return result.data !== null;
  }
}

class SupabaseProjectRepository implements ProjectRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewProject): Promise<Project> {
    // NOTE: In production, project creation with default phases would use an
    // RPC (or a database function) to atomically insert the project row and
    // its 10 default phases in a single transaction. The PhaseRepository's
    // createMany handles the phase insertion separately; the caller (Server
    // Action) orchestrates both calls.
    const result = await this.db
      .from('projects')
      .insert({
        client_id: input.clientId,
        owner_id: input.ownerId,
        name: input.name,
      })
      .select()
      .single();
    return toProject(throwIfError(result, 'projects.create'));
  }

  async findById(id: UUID): Promise<Project | null> {
    const result = await this.db
      .from('projects')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] projects.findById: ${result.error.message}`,
      );
    }
    return result.data ? toProject(result.data) : null;
  }

  async listByClient(clientId: UUID): Promise<Project[]> {
    const result = await this.db
      .from('projects')
      .select()
      .eq('client_id', clientId);
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] projects.listByClient: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toProject);
  }

  async listByOwner(ownerId: UUID): Promise<Project[]> {
    const result = await this.db
      .from('projects')
      .select()
      .eq('owner_id', ownerId);
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] projects.listByOwner: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toProject);
  }

  async update(id: UUID, patch: ProjectPatch): Promise<Project | null> {
    const updates: Record<string, unknown> = {};
    if (patch.name !== undefined) updates.name = patch.name;
    if (Object.keys(updates).length === 0) return this.findById(id);

    const result = await this.db
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] projects.update: ${result.error.message}`,
      );
    }
    return result.data ? toProject(result.data) : null;
  }

  async delete(id: UUID): Promise<boolean> {
    const result = await this.db
      .from('projects')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] projects.delete: ${result.error.message}`,
      );
    }
    return result.data !== null;
  }
}

class SupabasePhaseRepository implements PhaseRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewPhase): Promise<Phase> {
    const result = await this.db
      .from('phases')
      .insert({
        project_id: input.projectId,
        title: input.title,
        ordinal: input.ordinal,
        description: input.description,
        internal_notes: input.internalNotes,
        status: input.status,
        due_date: input.dueDate,
        approved_by_name: input.approvedByName,
        approved_initials: input.approvedInitials,
        approved_at: input.approvedAt,
      })
      .select()
      .single();
    return toPhase(throwIfError(result, 'phases.create'));
  }

  async createMany(inputs: readonly NewPhase[]): Promise<Phase[]> {
    // NOTE: In production this would be part of a transactional RPC that
    // creates the project and all default phases atomically. Here we use a
    // single bulk insert which Supabase executes as one statement.
    if (inputs.length === 0) return [];
    const rows = inputs.map((input) => ({
      project_id: input.projectId,
      title: input.title,
      ordinal: input.ordinal,
      description: input.description,
      internal_notes: input.internalNotes,
      status: input.status,
      due_date: input.dueDate,
      approved_by_name: input.approvedByName,
      approved_initials: input.approvedInitials,
      approved_at: input.approvedAt,
    }));
    const result = await this.db.from('phases').insert(rows).select();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] phases.createMany: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toPhase);
  }

  async findById(id: UUID): Promise<Phase | null> {
    const result = await this.db
      .from('phases')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] phases.findById: ${result.error.message}`,
      );
    }
    return result.data ? toPhase(result.data) : null;
  }

  async listByProject(projectId: UUID): Promise<Phase[]> {
    const result = await this.db
      .from('phases')
      .select()
      .eq('project_id', projectId)
      .order('ordinal', { ascending: true });
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] phases.listByProject: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toPhase);
  }

  async update(id: UUID, patch: PhasePatch): Promise<Phase | null> {
    const updates: Record<string, unknown> = {};
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.ordinal !== undefined) updates.ordinal = patch.ordinal;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.internalNotes !== undefined)
      updates.internal_notes = patch.internalNotes;
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.dueDate !== undefined) updates.due_date = patch.dueDate;
    if (patch.approvedByName !== undefined)
      updates.approved_by_name = patch.approvedByName;
    if (patch.approvedInitials !== undefined)
      updates.approved_initials = patch.approvedInitials;
    if (patch.approvedAt !== undefined) updates.approved_at = patch.approvedAt;
    if (Object.keys(updates).length === 0) return this.findById(id);

    const result = await this.db
      .from('phases')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] phases.update: ${result.error.message}`,
      );
    }
    return result.data ? toPhase(result.data) : null;
  }

  async delete(id: UUID): Promise<boolean> {
    const result = await this.db
      .from('phases')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] phases.delete: ${result.error.message}`,
      );
    }
    return result.data !== null;
  }
}

class SupabaseChecklistItemRepository implements ChecklistItemRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewChecklistItem): Promise<ChecklistItem> {
    const result = await this.db
      .from('checklist_items')
      .insert({
        phase_id: input.phaseId,
        text: input.text,
        complete: input.complete,
      })
      .select()
      .single();
    return toChecklistItem(throwIfError(result, 'checklist_items.create'));
  }

  async findById(id: UUID): Promise<ChecklistItem | null> {
    const result = await this.db
      .from('checklist_items')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] checklist_items.findById: ${result.error.message}`,
      );
    }
    return result.data ? toChecklistItem(result.data) : null;
  }

  async listByPhase(phaseId: UUID): Promise<ChecklistItem[]> {
    const result = await this.db
      .from('checklist_items')
      .select()
      .eq('phase_id', phaseId)
      .order('created_at', { ascending: true });
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] checklist_items.listByPhase: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toChecklistItem);
  }

  async update(
    id: UUID,
    patch: ChecklistItemPatch,
  ): Promise<ChecklistItem | null> {
    const updates: Record<string, unknown> = {};
    if (patch.text !== undefined) updates.text = patch.text;
    if (patch.complete !== undefined) updates.complete = patch.complete;
    if (Object.keys(updates).length === 0) return this.findById(id);

    const result = await this.db
      .from('checklist_items')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] checklist_items.update: ${result.error.message}`,
      );
    }
    return result.data ? toChecklistItem(result.data) : null;
  }

  async delete(id: UUID): Promise<boolean> {
    const result = await this.db
      .from('checklist_items')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] checklist_items.delete: ${result.error.message}`,
      );
    }
    return result.data !== null;
  }
}

class SupabaseDesignLinkRepository implements DesignLinkRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewDesignLink): Promise<DesignLink> {
    const result = await this.db
      .from('design_links')
      .insert({
        phase_id: input.phaseId,
        kind: input.kind,
        url: input.url,
        storage_path: input.storagePath,
        file_name: input.fileName,
      })
      .select()
      .single();
    return toDesignLink(throwIfError(result, 'design_links.create'));
  }

  async findById(id: UUID): Promise<DesignLink | null> {
    const result = await this.db
      .from('design_links')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] design_links.findById: ${result.error.message}`,
      );
    }
    return result.data ? toDesignLink(result.data) : null;
  }

  async listByPhase(phaseId: UUID): Promise<DesignLink[]> {
    const result = await this.db
      .from('design_links')
      .select()
      .eq('phase_id', phaseId)
      .order('created_at', { ascending: true });
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] design_links.listByPhase: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toDesignLink);
  }

  async delete(id: UUID): Promise<boolean> {
    const result = await this.db
      .from('design_links')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] design_links.delete: ${result.error.message}`,
      );
    }
    return result.data !== null;
  }
}

class SupabaseCommentRepository implements CommentRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewComment): Promise<Comment> {
    const result = await this.db
      .from('comments')
      .insert({
        phase_id: input.phaseId,
        author_type: input.authorType,
        author_user_id: input.authorUserId,
        author_name: input.authorName,
        text: input.text,
      })
      .select()
      .single();
    return toComment(throwIfError(result, 'comments.create'));
  }

  async findById(id: UUID): Promise<Comment | null> {
    const result = await this.db
      .from('comments')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] comments.findById: ${result.error.message}`,
      );
    }
    return result.data ? toComment(result.data) : null;
  }

  async listByPhase(phaseId: UUID): Promise<Comment[]> {
    const result = await this.db
      .from('comments')
      .select()
      .eq('phase_id', phaseId)
      .order('created_at', { ascending: true });
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] comments.listByPhase: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toComment);
  }
}

class SupabaseApprovalRepository implements ApprovalRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewApproval): Promise<Approval> {
    const result = await this.db
      .from('approvals')
      .insert({
        phase_id: input.phaseId,
        decision: input.decision,
        reviewer_name: input.reviewerName,
        reviewer_initials: input.reviewerInitials,
        checklist_snapshot: input.checklistSnapshot,
      })
      .select()
      .single();
    return toApproval(throwIfError(result, 'approvals.create'));
  }

  async findById(id: UUID): Promise<Approval | null> {
    const result = await this.db
      .from('approvals')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] approvals.findById: ${result.error.message}`,
      );
    }
    return result.data ? toApproval(result.data) : null;
  }

  async listByPhase(phaseId: UUID): Promise<Approval[]> {
    const result = await this.db
      .from('approvals')
      .select()
      .eq('phase_id', phaseId)
      .order('created_at', { ascending: false });
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] approvals.listByPhase: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toApproval);
  }
}

class SupabaseTaskRepository implements TaskRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewTask): Promise<Task> {
    const result = await this.db
      .from('tasks')
      .insert({
        owner_id: input.ownerId,
        title: input.title,
        state: input.state,
        project_id: input.projectId,
        phase_id: input.phaseId,
        due_date: input.dueDate,
      })
      .select()
      .single();
    return toTask(throwIfError(result, 'tasks.create'));
  }

  async findById(id: UUID): Promise<Task | null> {
    const result = await this.db
      .from('tasks')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] tasks.findById: ${result.error.message}`,
      );
    }
    return result.data ? toTask(result.data) : null;
  }

  async listByOwner(ownerId: UUID): Promise<Task[]> {
    const result = await this.db
      .from('tasks')
      .select()
      .eq('owner_id', ownerId);
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] tasks.listByOwner: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toTask);
  }

  async update(id: UUID, patch: TaskPatch): Promise<Task | null> {
    const updates: Record<string, unknown> = {};
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.state !== undefined) updates.state = patch.state;
    if (patch.dueDate !== undefined) updates.due_date = patch.dueDate;
    if (Object.keys(updates).length === 0) return this.findById(id);

    const result = await this.db
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] tasks.update: ${result.error.message}`,
      );
    }
    return result.data ? toTask(result.data) : null;
  }

  async delete(id: UUID): Promise<boolean> {
    const result = await this.db
      .from('tasks')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] tasks.delete: ${result.error.message}`,
      );
    }
    return result.data !== null;
  }
}

class SupabaseActivityLogRepository implements ActivityLogRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewActivityLog): Promise<ActivityLog> {
    const result = await this.db
      .from('activity_logs')
      .insert({
        project_id: input.projectId,
        type: input.type,
        actor: input.actor,
        detail: input.detail,
      })
      .select()
      .single();
    return toActivityLog(throwIfError(result, 'activity_logs.create'));
  }

  async findById(id: UUID): Promise<ActivityLog | null> {
    const result = await this.db
      .from('activity_logs')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] activity_logs.findById: ${result.error.message}`,
      );
    }
    return result.data ? toActivityLog(result.data) : null;
  }

  async listByProject(
    projectId: UUID,
    limit?: number,
  ): Promise<ActivityLog[]> {
    let query = this.db
      .from('activity_logs')
      .select()
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (limit !== undefined && limit > 0) {
      query = query.limit(limit);
    }
    const result = await query;
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] activity_logs.listByProject: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toActivityLog);
  }
}

class SupabaseShareLinkRepository implements ShareLinkRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewShareLink): Promise<ShareLink> {
    const result = await this.db
      .from('share_links')
      .insert({
        owner_id: input.ownerId,
        token: input.token,
        scope_type: input.scopeType,
        project_id: input.projectId,
        phase_id: input.phaseId,
        revoked_at: input.revokedAt,
        first_accessed_at: input.firstAccessedAt,
      })
      .select()
      .single();
    return toShareLink(throwIfError(result, 'share_links.create'));
  }

  async findById(id: UUID): Promise<ShareLink | null> {
    const result = await this.db
      .from('share_links')
      .select()
      .eq('id', id)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] share_links.findById: ${result.error.message}`,
      );
    }
    return result.data ? toShareLink(result.data) : null;
  }

  async findByToken(token: string): Promise<ShareLink | null> {
    const result = await this.db
      .from('share_links')
      .select()
      .eq('token', token)
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] share_links.findByToken: ${result.error.message}`,
      );
    }
    return result.data ? toShareLink(result.data) : null;
  }

  async listByOwner(ownerId: UUID): Promise<ShareLink[]> {
    const result = await this.db
      .from('share_links')
      .select()
      .eq('owner_id', ownerId);
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] share_links.listByOwner: ${result.error.message}`,
      );
    }
    return (result.data ?? []).map(toShareLink);
  }

  async update(id: UUID, patch: ShareLinkPatch): Promise<ShareLink | null> {
    const updates: Record<string, unknown> = {};
    if (patch.revokedAt !== undefined) updates.revoked_at = patch.revokedAt;
    if (patch.firstAccessedAt !== undefined)
      updates.first_accessed_at = patch.firstAccessedAt;
    if (Object.keys(updates).length === 0) return this.findById(id);

    const result = await this.db
      .from('share_links')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] share_links.update: ${result.error.message}`,
      );
    }
    return result.data ? toShareLink(result.data) : null;
  }

  async revokeByClient(clientId: UUID): Promise<number> {
    // Find all projects for the client
    const projectsResult = await this.db
      .from('projects')
      .select('id')
      .eq('client_id', clientId);
    if (projectsResult.error) {
      throw new Error(
        `[SupabaseRepo] share_links.revokeByClient: ${projectsResult.error.message}`,
      );
    }
    const projectIds = (projectsResult.data ?? []).map((p: { id: string }) => p.id);
    if (projectIds.length === 0) return 0;

    // Revoke all active share links for those projects
    const now = new Date().toISOString();
    const result = await this.db
      .from('share_links')
      .update({ revoked_at: now })
      .in('project_id', projectIds)
      .is('revoked_at', null)
      .select('id');
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] share_links.revokeByClient: ${result.error.message}`,
      );
    }
    return (result.data ?? []).length;
  }

  async delete(id: UUID): Promise<boolean> {
    const result = await this.db
      .from('share_links')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] share_links.delete: ${result.error.message}`,
      );
    }
    return result.data !== null;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

import { SupabaseEmailHistoryRepository } from '@/lib/repositories/email-history-repository';
import { SupabaseNotificationRepository } from '@/lib/repositories/notification-repository';

/**
 * Create the full {@link Repositories} aggregate backed by a Supabase client.
 *
 * The caller provides the Supabase client instance — typically the SSR server
 * client from `@/lib/supabase/server` for authenticated admin operations, or
 * the service-role client for unauthenticated portal paths.
 *
 * Usage:
 * ```ts
 * import { createClient } from '@/lib/supabase/server';
 * import { createSupabaseRepositories } from '@/lib/repositories/supabase';
 *
 * const supabase = await createClient();
 * const repos = createSupabaseRepositories(supabase);
 * ```
 */
export function createSupabaseRepositories(db: SupabaseClient): Repositories {
  return {
    clients: new SupabaseClientRepository(db),
    projects: new SupabaseProjectRepository(db),
    phases: new SupabasePhaseRepository(db),
    checklistItems: new SupabaseChecklistItemRepository(db),
    designLinks: new SupabaseDesignLinkRepository(db),
    comments: new SupabaseCommentRepository(db),
    approvals: new SupabaseApprovalRepository(db),
    tasks: new SupabaseTaskRepository(db),
    activityLogs: new SupabaseActivityLogRepository(db),
    shareLinks: new SupabaseShareLinkRepository(db),
    emailHistory: new SupabaseEmailHistoryRepository(db),
    notifications: new SupabaseNotificationRepository(db),
  };
}
