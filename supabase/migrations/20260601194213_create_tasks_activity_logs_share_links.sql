-- Migration: tasks, activity_logs, share_links
-- Spec: client-sign-off-dashboard, task 2.3
-- Requirements:
--   8.1  (share link token >= 32 chars, unique, scope check)
--  12.1  (task title 1-200, state open/complete, optional project/phase FKs, due date)
--  13.1  (activity log type check, actor, detail jsonb)
--  13.2  (activity log per-project timeline index)
--  13.3  (activity log append-only by design)
--  17.1  (persistence)
--
-- This is the THIRD schema migration. It depends on `users`, `projects`, and
-- `phases` created in the prior two migrations.
-- Row Level Security policies are intentionally NOT added here (task 3.1).

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  state text not null default 'open' check (state in ('open','complete')),
  project_id uuid references public.projects(id) on delete cascade,
  phase_id uuid references public.phases(id) on delete cascade,
  due_date date,
  created_at timestamptz not null default now()
);
create index on public.tasks (owner_id, state, due_date);

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null check (type in ('comment_created','approval_created','phase_status_changed')),
  actor text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.activity_logs (project_id, created_at desc);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  token text not null unique check (char_length(token) >= 32),
  scope_type text not null check (scope_type in ('project','phase')),
  project_id uuid references public.projects(id) on delete cascade,
  phase_id uuid references public.phases(id) on delete cascade,
  revoked_at timestamptz,
  first_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((scope_type = 'project' and project_id is not null and phase_id is null)
      or (scope_type = 'phase' and phase_id is not null))
);
create unique index on public.share_links (token);
