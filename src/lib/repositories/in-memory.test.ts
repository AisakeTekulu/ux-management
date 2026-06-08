import { describe, expect, it } from 'vitest';

import type {
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
} from '@/lib/repositories/interfaces';

import {
  createInMemoryRepositories,
  createTimestampFactory,
} from './in-memory';

/**
 * Unit tests for the in-memory repository fakes: they confirm basic CRUD
 * round-trips, server-field injection, owner/parent scoping, append-only
 * behavior, and that the aggregate factory wires every repository.
 */

const OWNER: string = 'owner-1';

function newClient(overrides: Partial<NewClient> = {}): NewClient {
  return { ownerId: OWNER, name: 'Acme', ...overrides };
}

function newProject(clientId: string, overrides: Partial<NewProject> = {}): NewProject {
  return { clientId, ownerId: OWNER, name: 'Website Redesign', ...overrides };
}

function newPhase(projectId: string, overrides: Partial<NewPhase> = {}): NewPhase {
  return {
    projectId,
    title: 'Discovery',
    ordinal: 1,
    description: '',
    internalNotes: '',
    status: 'Draft',
    dueDate: null,
    approvedByName: null,
    approvedInitials: null,
    approvedAt: null,
    ...overrides,
  };
}

describe('createInMemoryRepositories', () => {
  it('injects deterministic id and createdAt on create', async () => {
    const repos = createInMemoryRepositories();

    const client = await repos.clients.create(newClient());

    expect(client.id).toBe('client_1');
    expect(client.name).toBe('Acme');
    expect(client.createdAt).toBe('2024-01-01T00:00:00.000Z');
  });

  it('supports a client CRUD round-trip', async () => {
    const repos = createInMemoryRepositories();

    const created = await repos.clients.create(newClient());
    expect(await repos.clients.findById(created.id)).toEqual(created);

    const updated = await repos.clients.update(created.id, { name: 'Acme Corp' });
    expect(updated?.name).toBe('Acme Corp');
    expect(updated?.id).toBe(created.id);
    expect(updated?.createdAt).toBe(created.createdAt);

    expect(await repos.clients.delete(created.id)).toBe(true);
    expect(await repos.clients.delete(created.id)).toBe(false);
    expect(await repos.clients.findById(created.id)).toBeNull();
  });

  it('returns null when updating or finding an absent record', async () => {
    const repos = createInMemoryRepositories();

    expect(await repos.clients.findById('missing')).toBeNull();
    expect(await repos.clients.update('missing', { name: 'x' })).toBeNull();
  });

  it('scopes clients by owner', async () => {
    const repos = createInMemoryRepositories();
    await repos.clients.create(newClient({ ownerId: 'a' }));
    await repos.clients.create(newClient({ ownerId: 'a', name: 'Beta' }));
    await repos.clients.create(newClient({ ownerId: 'b', name: 'Gamma' }));

    const forA = await repos.clients.listByOwner('a');
    expect(forA.map((c) => c.name).sort()).toEqual(['Acme', 'Beta']);
  });

  it('scopes projects by client and by owner', async () => {
    const repos = createInMemoryRepositories();
    const c1 = await repos.clients.create(newClient());
    const c2 = await repos.clients.create(newClient({ name: 'Other' }));
    await repos.projects.create(newProject(c1.id, { name: 'P1' }));
    await repos.projects.create(newProject(c2.id, { name: 'P2' }));

    expect((await repos.projects.listByClient(c1.id)).map((p) => p.name)).toEqual(['P1']);
    expect((await repos.projects.listByOwner(OWNER)).map((p) => p.name).sort()).toEqual([
      'P1',
      'P2',
    ]);
  });

  it('creates many phases at once and lists by project', async () => {
    const repos = createInMemoryRepositories();
    const client = await repos.clients.create(newClient());
    const project = await repos.projects.create(newProject(client.id));

    const phases = await repos.phases.createMany([
      newPhase(project.id, { title: 'A', ordinal: 1 }),
      newPhase(project.id, { title: 'B', ordinal: 2 }),
    ]);

    expect(phases).toHaveLength(2);
    expect(phases.map((p) => p.id)).toHaveLength(new Set(phases.map((p) => p.id)).size);
    const listed = await repos.phases.listByProject(project.id);
    expect(listed.map((p) => p.title).sort()).toEqual(['A', 'B']);
  });

  it('patches only the provided phase fields', async () => {
    const repos = createInMemoryRepositories();
    const client = await repos.clients.create(newClient());
    const project = await repos.projects.create(newProject(client.id));
    const phase = await repos.phases.create(newPhase(project.id));

    const updated = await repos.phases.update(phase.id, { status: 'Approved' });

    expect(updated?.status).toBe('Approved');
    expect(updated?.title).toBe(phase.title);
    expect(updated?.ordinal).toBe(phase.ordinal);
  });

  it('round-trips checklist items, design links, comments, and approvals on a phase', async () => {
    const repos = createInMemoryRepositories();
    const client = await repos.clients.create(newClient());
    const project = await repos.projects.create(newProject(client.id));
    const phase = await repos.phases.create(newPhase(project.id));

    const item: NewChecklistItem = {
      phaseId: phase.id,
      text: 'Review copy',
      complete: false,
    };
    const created = await repos.checklistItems.create(item);
    const toggled = await repos.checklistItems.update(created.id, { complete: true });
    expect(toggled?.complete).toBe(true);
    expect((await repos.checklistItems.listByPhase(phase.id))).toHaveLength(1);

    const link: NewDesignLink = {
      phaseId: phase.id,
      kind: 'url',
      url: 'https://example.com',
      storagePath: null,
      fileName: null,
    };
    const designLink = await repos.designLinks.create(link);
    expect((await repos.designLinks.listByPhase(phase.id))[0]?.id).toBe(designLink.id);

    const comment: NewComment = {
      phaseId: phase.id,
      authorType: 'reviewer',
      authorUserId: null,
      authorName: 'Reviewer',
      text: 'Looks good',
    };
    const createdComment = await repos.comments.create(comment);
    expect(await repos.comments.findById(createdComment.id)).toEqual(createdComment);

    const approval: NewApproval = {
      phaseId: phase.id,
      decision: 'Approved',
      reviewerName: 'Jane Reviewer',
      reviewerInitials: 'JR',
      checklistSnapshot: [{ checklistItemId: created.id, text: 'Review copy', complete: true }],
    };
    const createdApproval = await repos.approvals.create(approval);
    expect((await repos.approvals.listByPhase(phase.id))[0]?.id).toBe(createdApproval.id);
  });

  it('orders activity logs most-recent-first and honors the limit', async () => {
    const repos = createInMemoryRepositories();
    const projectId = 'project-x';

    const make = (type: NewActivityLog['type']): NewActivityLog => ({
      projectId,
      type,
      actor: 'designer@example.com',
      detail: {},
    });

    await repos.activityLogs.create(make('comment_created'));
    await repos.activityLogs.create(make('approval_created'));
    const third = await repos.activityLogs.create(make('phase_status_changed'));

    const all = await repos.activityLogs.listByProject(projectId);
    expect(all).toHaveLength(3);
    expect(all[0]?.id).toBe(third.id); // newest first

    const limited = await repos.activityLogs.listByProject(projectId, 2);
    expect(limited).toHaveLength(2);
    expect(limited[0]?.id).toBe(third.id);
  });

  it('resolves share links by token and supports revocation patch', async () => {
    const repos = createInMemoryRepositories();
    const input: NewShareLink = {
      ownerId: OWNER,
      token: 'a'.repeat(32),
      scopeType: 'phase',
      projectId: null,
      phaseId: 'phase-1',
      revokedAt: null,
      firstAccessedAt: null,
    };

    const link = await repos.shareLinks.create(input);
    expect((await repos.shareLinks.findByToken(input.token))?.id).toBe(link.id);
    expect(await repos.shareLinks.findByToken('nope')).toBeNull();

    const revoked = await repos.shareLinks.update(link.id, {
      revokedAt: '2024-02-01T00:00:00.000Z',
    });
    expect(revoked?.revokedAt).toBe('2024-02-01T00:00:00.000Z');
  });

  it('round-trips tasks scoped by owner', async () => {
    const repos = createInMemoryRepositories();
    const input: NewTask = {
      ownerId: OWNER,
      title: 'Fix nav',
      state: 'open',
      projectId: null,
      phaseId: null,
      dueDate: null,
    };

    const task = await repos.tasks.create(input);
    const done = await repos.tasks.update(task.id, { state: 'complete' });
    expect(done?.state).toBe('complete');
    expect((await repos.tasks.listByOwner(OWNER)).map((t) => t.id)).toEqual([task.id]);
  });

  it('does not mutate stored records through returned references', async () => {
    const repos = createInMemoryRepositories();
    const client = await repos.clients.create(newClient());

    client.name = 'mutated locally';

    expect((await repos.clients.findById(client.id))?.name).toBe('Acme');
  });

  it('honors injected id and timestamp providers', async () => {
    let n = 0;
    const repos = createInMemoryRepositories({
      nextId: () => `fixed_${++n}`,
      now: createTimestampFactory(Date.UTC(2030, 0, 1), 0),
    });

    const client = await repos.clients.create(newClient());
    expect(client.id).toBe('fixed_1');
    expect(client.createdAt).toBe('2030-01-01T00:00:00.000Z');
  });
});
