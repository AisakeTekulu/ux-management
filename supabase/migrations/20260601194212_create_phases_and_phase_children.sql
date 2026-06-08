-- Migration: phases and phase-child tables
-- Spec: client-sign-off-dashboard, task 2.2
-- Requirements:
--   4.3  (phase ordering / ordinal uniqueness per project)
--   5.1  (checklist item text 1-500)
--   6.1  (design link URL allow-list / kind check)
--   7.1  (comment text 1-5000, author attribution)
--   9.4  (approval decision, name/initials)
--   9.5  (approval checklist snapshot)
--  17.1  (persistence)
--  17.3  (FK enforcement + on delete cascade from phases to children)
--  17.6  (denormalized checklist_snapshot jsonb on approvals)
--
-- This is the SECOND schema migration. It depends on `projects` and `users`
-- created in 20260601194211_create_users_clients_projects.sql.
-- tasks, activity_logs, and share_links follow in task 2.3.
-- Row Level Security policies are intentionally NOT added here (task 3.1).

create table public.phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  ordinal int not null,
  description text not null default '' check (char_length(description) <= 5000),
  internal_notes text not null default '' check (char_length(internal_notes) <= 5000),
  status text not null default 'Draft'
    check (status in ('Draft','Sent to Client','Waiting for Feedback',
                      'Changes Requested','Approved','Completed')),
  due_date date,
  approved_by_name text,
  approved_initials text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, ordinal)
);
create index on public.phases (project_id);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases(id) on delete cascade,
  text text not null check (char_length(btrim(text)) between 1 and 500),
  complete boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.checklist_items (phase_id, created_at);

create table public.design_links (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases(id) on delete cascade,
  kind text not null check (kind in ('url','file')),
  url text check (url is null or char_length(url) <= 2048),
  storage_path text,
  file_name text,
  created_at timestamptz not null default now(),
  check ((kind = 'url' and url is not null and storage_path is null)
      or (kind = 'file' and storage_path is not null))
);
create index on public.design_links (phase_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases(id) on delete cascade,
  author_type text not null check (author_type in ('designer','reviewer')),
  author_user_id uuid references public.users(id),
  author_name text,
  text text not null check (char_length(btrim(text)) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index on public.comments (phase_id, created_at);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.phases(id) on delete cascade,
  decision text not null check (decision in ('Approved','Changes Requested')),
  reviewer_name text not null check (char_length(btrim(reviewer_name)) between 1 and 100),
  reviewer_initials text not null check (char_length(btrim(reviewer_initials)) between 1 and 10),
  checklist_snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.approvals (phase_id, created_at desc);
