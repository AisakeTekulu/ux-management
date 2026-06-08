import { describe, expect, it } from 'vitest';

import {
  DASHBOARD_ACTIVITY_LIMIT,
  PROJECT_ACTIVITY_LIMIT,
  dashboardActivityTimeline,
  orderActivityTimeline,
  orderApprovalHistory,
  orderChecklistItems,
  orderComments,
  projectActivityTimeline,
  sortClientsByName,
  sortOpenTasks,
  sortProjectsByName,
} from '@/lib/domain/ordering';
import type {
  ActivityLog,
  Approval,
  ChecklistItem,
  Client,
  Comment,
  Project,
  Task,
} from '@/lib/domain/types';

/**
 * Unit tests for the pure ordering helpers. These cover concrete examples and
 * edge cases (empty inputs, ties, null due dates, limits). The numbered
 * property-based tests are implemented separately in tasks 9.3–9.10.
 */

function client(id: string, name: string): Client {
  return { id, ownerId: 'owner', name, status: 'active', deletedAt: null, createdAt: '2024-01-01T00:00:00.000Z', fullName: null, businessName: null, primaryEmail: null, secondaryEmail: null, phone: null, website: null, location: null, preferredContactMethod: 'email', notes: null };
}

function project(id: string, name: string): Project {
  return {
    id,
    clientId: 'c1',
    ownerId: 'owner',
    name,
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

function task(id: string, state: Task['state'], dueDate: string | null): Task {
  return {
    id,
    ownerId: 'owner',
    title: id,
    state,
    projectId: null,
    phaseId: null,
    dueDate,
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

function checklistItem(id: string, createdAt: string): ChecklistItem {
  return { id, phaseId: 'p1', text: id, complete: false, createdAt };
}

function comment(id: string, createdAt: string): Comment {
  return {
    id,
    phaseId: 'p1',
    authorType: 'designer',
    authorUserId: 'owner',
    authorName: null,
    text: id,
    createdAt,
  };
}

function approval(id: string, createdAt: string): Approval {
  return {
    id,
    phaseId: 'p1',
    decision: 'Approved',
    reviewerName: 'Jane',
    reviewerInitials: 'JD',
    checklistSnapshot: [],
    createdAt,
  };
}

function activity(id: string, createdAt: string): ActivityLog {
  return {
    id,
    projectId: 'p1',
    type: 'comment_created',
    actor: 'someone',
    detail: {},
    createdAt,
  };
}

describe('sortClientsByName', () => {
  it('orders ascending, case-insensitively', () => {
    const input = [client('1', 'banana'), client('2', 'Apple'), client('3', 'cherry')];
    expect(sortClientsByName(input).map((c) => c.name)).toEqual([
      'Apple',
      'banana',
      'cherry',
    ]);
  });

  it('does not mutate the input', () => {
    const input = [client('1', 'b'), client('2', 'a')];
    const snapshot = input.map((c) => c.id);
    sortClientsByName(input);
    expect(input.map((c) => c.id)).toEqual(snapshot);
  });

  it('handles an empty array', () => {
    expect(sortClientsByName([])).toEqual([]);
  });
});

describe('sortProjectsByName', () => {
  it('orders ascending, case-insensitively', () => {
    const input = [project('1', 'Zeta'), project('2', 'alpha'), project('3', 'Mike')];
    expect(sortProjectsByName(input).map((p) => p.name)).toEqual([
      'alpha',
      'Mike',
      'Zeta',
    ]);
  });

  it('does not mutate the input', () => {
    const input = [project('1', 'b'), project('2', 'a')];
    const snapshot = input.map((p) => p.id);
    sortProjectsByName(input);
    expect(input.map((p) => p.id)).toEqual(snapshot);
  });
});

describe('sortOpenTasks', () => {
  it('excludes completed tasks', () => {
    const input = [task('a', 'complete', '2024-01-01'), task('b', 'open', '2024-01-02')];
    expect(sortOpenTasks(input).map((t) => t.id)).toEqual(['b']);
  });

  it('orders open tasks by ascending due date with null due dates last', () => {
    const input = [
      task('none', 'open', null),
      task('late', 'open', '2024-03-01'),
      task('early', 'open', '2024-01-01'),
    ];
    expect(sortOpenTasks(input).map((t) => t.id)).toEqual(['early', 'late', 'none']);
  });

  it('keeps relative order of multiple null-due tasks (stable)', () => {
    const input = [
      task('n1', 'open', null),
      task('d', 'open', '2024-01-01'),
      task('n2', 'open', null),
    ];
    expect(sortOpenTasks(input).map((t) => t.id)).toEqual(['d', 'n1', 'n2']);
  });

  it('does not mutate the input', () => {
    const input = [task('b', 'open', '2024-02-01'), task('a', 'open', '2024-01-01')];
    const snapshot = input.map((t) => t.id);
    sortOpenTasks(input);
    expect(input.map((t) => t.id)).toEqual(snapshot);
  });
});

describe('orderChecklistItems', () => {
  it('orders ascending by creation timestamp', () => {
    const input = [
      checklistItem('c', '2024-01-03T00:00:00.000Z'),
      checklistItem('a', '2024-01-01T00:00:00.000Z'),
      checklistItem('b', '2024-01-02T00:00:00.000Z'),
    ];
    expect(orderChecklistItems(input).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not mutate the input', () => {
    const input = [
      checklistItem('b', '2024-01-02T00:00:00.000Z'),
      checklistItem('a', '2024-01-01T00:00:00.000Z'),
    ];
    const snapshot = input.map((i) => i.id);
    orderChecklistItems(input);
    expect(input.map((i) => i.id)).toEqual(snapshot);
  });
});

describe('orderComments', () => {
  it('orders oldest to newest by creation timestamp', () => {
    const input = [
      comment('new', '2024-01-03T00:00:00.000Z'),
      comment('old', '2024-01-01T00:00:00.000Z'),
    ];
    expect(orderComments(input).map((c) => c.id)).toEqual(['old', 'new']);
  });
});

describe('orderApprovalHistory', () => {
  it('orders reverse chronological by approval timestamp', () => {
    const input = [
      approval('old', '2024-01-01T00:00:00.000Z'),
      approval('new', '2024-01-03T00:00:00.000Z'),
      approval('mid', '2024-01-02T00:00:00.000Z'),
    ];
    expect(orderApprovalHistory(input).map((a) => a.id)).toEqual(['new', 'mid', 'old']);
  });
});

describe('orderActivityTimeline', () => {
  it('returns the N most recent entries, reverse chronological', () => {
    const input = [
      activity('a', '2024-01-01T00:00:00.000Z'),
      activity('b', '2024-01-02T00:00:00.000Z'),
      activity('c', '2024-01-03T00:00:00.000Z'),
    ];
    expect(orderActivityTimeline(input, 2).map((e) => e.id)).toEqual(['c', 'b']);
  });

  it('returns all entries when the limit exceeds the count', () => {
    const input = [
      activity('a', '2024-01-01T00:00:00.000Z'),
      activity('b', '2024-01-02T00:00:00.000Z'),
    ];
    expect(orderActivityTimeline(input, 10).map((e) => e.id)).toEqual(['b', 'a']);
  });

  it('returns an empty array for a non-positive limit', () => {
    const input = [activity('a', '2024-01-01T00:00:00.000Z')];
    expect(orderActivityTimeline(input, 0)).toEqual([]);
    expect(orderActivityTimeline(input, -5)).toEqual([]);
  });

  it('does not mutate the input', () => {
    const input = [
      activity('a', '2024-01-01T00:00:00.000Z'),
      activity('b', '2024-01-02T00:00:00.000Z'),
    ];
    const snapshot = input.map((e) => e.id);
    orderActivityTimeline(input, 1);
    expect(input.map((e) => e.id)).toEqual(snapshot);
  });
});

describe('dashboard and project timeline limits', () => {
  it('exposes the correct limit constants', () => {
    expect(DASHBOARD_ACTIVITY_LIMIT).toBe(20);
    expect(PROJECT_ACTIVITY_LIMIT).toBe(50);
  });

  it('dashboardActivityTimeline caps at 20 entries', () => {
    const input = Array.from({ length: 25 }, (_, i) =>
      activity(`a${i}`, `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`),
    );
    expect(dashboardActivityTimeline(input)).toHaveLength(20);
  });

  it('projectActivityTimeline caps at 50 entries', () => {
    const input = Array.from({ length: 60 }, (_, i) =>
      activity(`a${i}`, `2024-01-01T00:00:${String(i).padStart(2, '0')}.000Z`),
    );
    expect(projectActivityTimeline(input)).toHaveLength(50);
  });
});
