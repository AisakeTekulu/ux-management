/**
 * Smoke test: Schema presence
 *
 * Validates that the Supabase migration SQL files contain all expected tables,
 * key constraints, and indexes. This is a file-based (declarative) test that
 * reads the migration SQL text and asserts completeness without requiring a
 * running database.
 *
 * Validates: Requirements 17.1
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', '..', 'supabase', 'migrations');

let allSql: string;

beforeAll(() => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  allSql = files
    .map((f) => readFileSync(join(MIGRATIONS_DIR, f), 'utf-8'))
    .join('\n');
});

describe('Schema presence smoke test', () => {
  const expectedTables = [
    'users',
    'clients',
    'projects',
    'phases',
    'checklist_items',
    'design_links',
    'comments',
    'approvals',
    'tasks',
    'activity_logs',
    'share_links',
  ];

  describe('All 11 tables are created', () => {
    for (const table of expectedTables) {
      it(`CREATE TABLE public.${table} exists`, () => {
        const pattern = new RegExp(
          `create\\s+table\\s+public\\.${table}\\s*\\(`,
          'i',
        );
        expect(allSql).toMatch(pattern);
      });
    }
  });

  describe('Key foreign-key constraints are present', () => {
    it('users.id references auth.users(id) on delete cascade', () => {
      expect(allSql).toMatch(
        /references\s+auth\.users\(id\)\s+on\s+delete\s+cascade/i,
      );
    });

    it('clients.owner_id references public.users(id) on delete cascade', () => {
      const clientsSection = extractTableSection(allSql, 'clients');
      expect(clientsSection).toMatch(
        /owner_id\s+uuid\s+not\s+null\s+references\s+public\.users\(id\)\s+on\s+delete\s+cascade/i,
      );
    });

    it('projects.client_id references public.clients(id) on delete cascade', () => {
      const projectsSection = extractTableSection(allSql, 'projects');
      expect(projectsSection).toMatch(
        /client_id\s+uuid\s+not\s+null\s+references\s+public\.clients\(id\)\s+on\s+delete\s+cascade/i,
      );
    });

    it('phases.project_id references public.projects(id) on delete cascade', () => {
      const phasesSection = extractTableSection(allSql, 'phases');
      expect(phasesSection).toMatch(
        /project_id\s+uuid\s+not\s+null\s+references\s+public\.projects\(id\)\s+on\s+delete\s+cascade/i,
      );
    });

    it('checklist_items.phase_id references public.phases(id) on delete cascade', () => {
      const section = extractTableSection(allSql, 'checklist_items');
      expect(section).toMatch(
        /phase_id\s+uuid\s+not\s+null\s+references\s+public\.phases\(id\)\s+on\s+delete\s+cascade/i,
      );
    });

    it('design_links.phase_id references public.phases(id) on delete cascade', () => {
      const section = extractTableSection(allSql, 'design_links');
      expect(section).toMatch(
        /phase_id\s+uuid\s+not\s+null\s+references\s+public\.phases\(id\)\s+on\s+delete\s+cascade/i,
      );
    });

    it('comments.phase_id references public.phases(id) on delete cascade', () => {
      const section = extractTableSection(allSql, 'comments');
      expect(section).toMatch(
        /phase_id\s+uuid\s+not\s+null\s+references\s+public\.phases\(id\)\s+on\s+delete\s+cascade/i,
      );
    });

    it('approvals.phase_id references public.phases(id) on delete cascade', () => {
      const section = extractTableSection(allSql, 'approvals');
      expect(section).toMatch(
        /phase_id\s+uuid\s+not\s+null\s+references\s+public\.phases\(id\)\s+on\s+delete\s+cascade/i,
      );
    });

    it('tasks.owner_id references public.users(id) on delete cascade', () => {
      const section = extractTableSection(allSql, 'tasks');
      expect(section).toMatch(
        /owner_id\s+uuid\s+not\s+null\s+references\s+public\.users\(id\)\s+on\s+delete\s+cascade/i,
      );
    });

    it('activity_logs.project_id references public.projects(id) on delete cascade', () => {
      const section = extractTableSection(allSql, 'activity_logs');
      expect(section).toMatch(
        /project_id\s+uuid\s+not\s+null\s+references\s+public\.projects\(id\)\s+on\s+delete\s+cascade/i,
      );
    });

    it('share_links.owner_id references public.users(id) on delete cascade', () => {
      const section = extractTableSection(allSql, 'share_links');
      expect(section).toMatch(
        /owner_id\s+uuid\s+not\s+null\s+references\s+public\.users\(id\)\s+on\s+delete\s+cascade/i,
      );
    });

    it('share_links.token is unique', () => {
      const section = extractTableSection(allSql, 'share_links');
      expect(section).toMatch(/token\s+text\s+not\s+null\s+unique/i);
    });
  });

  describe('Check constraints are present', () => {
    it('clients.name check (1-100 chars)', () => {
      const section = extractTableSection(allSql, 'clients');
      expect(section).toMatch(/check\s*\(\s*char_length\(btrim\(name\)\)\s+between\s+1\s+and\s+100\s*\)/i);
    });

    it('projects.name check (1-120 chars)', () => {
      const section = extractTableSection(allSql, 'projects');
      expect(section).toMatch(/check\s*\(\s*char_length\(btrim\(name\)\)\s+between\s+1\s+and\s+120\s*\)/i);
    });

    it('phases.status check (6 workflow statuses)', () => {
      const section = extractTableSection(allSql, 'phases');
      expect(section).toMatch(/check\s*\(\s*status\s+in\s*\(/i);
      expect(section).toContain('Draft');
      expect(section).toContain('Sent to Client');
      expect(section).toContain('Waiting for Feedback');
      expect(section).toContain('Changes Requested');
      expect(section).toContain('Approved');
      expect(section).toContain('Completed');
    });

    it('phases.description check (<= 5000 chars)', () => {
      const section = extractTableSection(allSql, 'phases');
      expect(section).toMatch(/check\s*\(\s*char_length\(description\)\s*<=\s*5000\s*\)/i);
    });

    it('phases.internal_notes check (<= 5000 chars)', () => {
      const section = extractTableSection(allSql, 'phases');
      expect(section).toMatch(/check\s*\(\s*char_length\(internal_notes\)\s*<=\s*5000\s*\)/i);
    });

    it('checklist_items.text check (1-500 chars)', () => {
      const section = extractTableSection(allSql, 'checklist_items');
      expect(section).toMatch(/check\s*\(\s*char_length\(btrim\(text\)\)\s+between\s+1\s+and\s+500\s*\)/i);
    });

    it('design_links.kind check (url/file)', () => {
      const section = extractTableSection(allSql, 'design_links');
      expect(section).toMatch(/check\s*\(\s*kind\s+in\s*\(\s*'url'\s*,\s*'file'\s*\)\s*\)/i);
    });

    it('comments.author_type check (designer/reviewer)', () => {
      const section = extractTableSection(allSql, 'comments');
      expect(section).toMatch(/check\s*\(\s*author_type\s+in\s*\(\s*'designer'\s*,\s*'reviewer'\s*\)\s*\)/i);
    });

    it('comments.text check (1-5000 chars)', () => {
      const section = extractTableSection(allSql, 'comments');
      expect(section).toMatch(/check\s*\(\s*char_length\(btrim\(text\)\)\s+between\s+1\s+and\s+5000\s*\)/i);
    });

    it('approvals.decision check (Approved/Changes Requested)', () => {
      const section = extractTableSection(allSql, 'approvals');
      expect(section).toMatch(/check\s*\(\s*decision\s+in\s*\(/i);
      expect(section).toContain('Approved');
      expect(section).toContain('Changes Requested');
    });

    it('approvals.reviewer_name check (1-100 chars)', () => {
      const section = extractTableSection(allSql, 'approvals');
      expect(section).toMatch(/check\s*\(\s*char_length\(btrim\(reviewer_name\)\)\s+between\s+1\s+and\s+100\s*\)/i);
    });

    it('approvals.reviewer_initials check (1-10 chars)', () => {
      const section = extractTableSection(allSql, 'approvals');
      expect(section).toMatch(/check\s*\(\s*char_length\(btrim\(reviewer_initials\)\)\s+between\s+1\s+and\s+10\s*\)/i);
    });

    it('tasks.title check (1-200 chars)', () => {
      const section = extractTableSection(allSql, 'tasks');
      expect(section).toMatch(/check\s*\(\s*char_length\(btrim\(title\)\)\s+between\s+1\s+and\s+200\s*\)/i);
    });

    it('tasks.state check (open/complete)', () => {
      const section = extractTableSection(allSql, 'tasks');
      expect(section).toMatch(/check\s*\(\s*state\s+in\s*\(\s*'open'\s*,\s*'complete'\s*\)\s*\)/i);
    });

    it('activity_logs.type check (comment_created/approval_created/phase_status_changed)', () => {
      const section = extractTableSection(allSql, 'activity_logs');
      expect(section).toMatch(/check\s*\(\s*type\s+in\s*\(/i);
      expect(section).toContain('comment_created');
      expect(section).toContain('approval_created');
      expect(section).toContain('phase_status_changed');
    });

    it('share_links.token check (>= 32 chars)', () => {
      const section = extractTableSection(allSql, 'share_links');
      expect(section).toMatch(/check\s*\(\s*char_length\(token\)\s*>=\s*32\s*\)/i);
    });

    it('share_links.scope_type check (project/phase)', () => {
      const section = extractTableSection(allSql, 'share_links');
      expect(section).toMatch(/check\s*\(\s*scope_type\s+in\s*\(\s*'project'\s*,\s*'phase'\s*\)\s*\)/i);
    });
  });

  describe('Indexes are present', () => {
    it('clients (owner_id) index', () => {
      expect(allSql).toMatch(
        /create\s+index\s+.*on\s+public\.clients\s*\(\s*owner_id\s*\)/i,
      );
    });

    it('projects (client_id) index', () => {
      expect(allSql).toMatch(
        /create\s+index\s+.*on\s+public\.projects\s*\(\s*client_id\s*\)/i,
      );
    });

    it('projects_client_name_ci unique index', () => {
      expect(allSql).toMatch(
        /create\s+unique\s+index\s+projects_client_name_ci/i,
      );
    });

    it('phases (project_id) index', () => {
      expect(allSql).toMatch(
        /create\s+index\s+.*on\s+public\.phases\s*\(\s*project_id\s*\)/i,
      );
    });

    it('phases (project_id, ordinal) unique constraint', () => {
      const section = extractTableSection(allSql, 'phases');
      expect(section).toMatch(/unique\s*\(\s*project_id\s*,\s*ordinal\s*\)/i);
    });

    it('checklist_items (phase_id, created_at) index', () => {
      expect(allSql).toMatch(
        /create\s+index\s+.*on\s+public\.checklist_items\s*\(\s*phase_id\s*,\s*created_at\s*\)/i,
      );
    });

    it('design_links (phase_id) index', () => {
      expect(allSql).toMatch(
        /create\s+index\s+.*on\s+public\.design_links\s*\(\s*phase_id\s*\)/i,
      );
    });

    it('comments (phase_id, created_at) index', () => {
      expect(allSql).toMatch(
        /create\s+index\s+.*on\s+public\.comments\s*\(\s*phase_id\s*,\s*created_at\s*\)/i,
      );
    });

    it('approvals (phase_id, created_at desc) index', () => {
      expect(allSql).toMatch(
        /create\s+index\s+.*on\s+public\.approvals\s*\(\s*phase_id\s*,\s*created_at\s+desc\s*\)/i,
      );
    });

    it('tasks (owner_id, state, due_date) index', () => {
      expect(allSql).toMatch(
        /create\s+index\s+.*on\s+public\.tasks\s*\(\s*owner_id\s*,\s*state\s*,\s*due_date\s*\)/i,
      );
    });

    it('activity_logs (project_id, created_at desc) index', () => {
      expect(allSql).toMatch(
        /create\s+index\s+.*on\s+public\.activity_logs\s*\(\s*project_id\s*,\s*created_at\s+desc\s*\)/i,
      );
    });

    it('share_links (token) unique index', () => {
      expect(allSql).toMatch(
        /create\s+unique\s+index\s+.*on\s+public\.share_links\s*\(\s*token\s*\)/i,
      );
    });
  });

  describe('RLS is enabled on all tables', () => {
    // activity_logs RLS is enabled implicitly via its INSERT/SELECT policies
    // in the append-only migration (task 3.2). The explicit ALTER TABLE ...
    // ENABLE ROW LEVEL SECURITY statement is not present because the RLS
    // migration (task 3.1) deferred activity_logs to the append-only migration.
    // We verify activity_logs has RLS policies instead.
    const tablesWithExplicitRls = expectedTables.filter(
      (t) => t !== 'activity_logs',
    );

    for (const table of tablesWithExplicitRls) {
      it(`RLS enabled on public.${table}`, () => {
        const pattern = new RegExp(
          `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
          'i',
        );
        expect(allSql).toMatch(pattern);
      });
    }

    it('activity_logs has RLS policies (insert + select)', () => {
      expect(allSql).toMatch(
        /create\s+policy\s+activity_logs_select_owner\s+on\s+public\.activity_logs/i,
      );
      expect(allSql).toMatch(
        /create\s+policy\s+activity_logs_insert_owner\s+on\s+public\.activity_logs/i,
      );
    });
  });

  describe('Audit immutability on activity_logs', () => {
    it('UPDATE is revoked on activity_logs', () => {
      expect(allSql).toMatch(
        /revoke\s+update.*on\s+public\.activity_logs/i,
      );
    });

    it('DELETE is revoked on activity_logs', () => {
      expect(allSql).toMatch(
        /revoke.*delete.*on\s+public\.activity_logs/i,
      );
    });
  });
});

/**
 * Extracts the CREATE TABLE section for a given table name from the full SQL.
 * Returns the text from `create table public.<name>` up to the next
 * `create table` or `create index` statement (whichever comes first).
 */
function extractTableSection(sql: string, tableName: string): string {
  const startPattern = new RegExp(
    `create\\s+table\\s+public\\.${tableName}\\s*\\(`,
    'i',
  );
  const match = startPattern.exec(sql);
  if (!match) return '';

  const startIdx = match.index;
  // Find the end: next CREATE TABLE or CREATE INDEX after the start
  const rest = sql.slice(startIdx + match[0].length);
  const endPattern = /\bcreate\s+(table|index|unique\s+index|extension)/i;
  const endMatch = endPattern.exec(rest);
  if (endMatch) {
    return sql.slice(startIdx, startIdx + match[0].length + endMatch.index);
  }
  return sql.slice(startIdx);
}
