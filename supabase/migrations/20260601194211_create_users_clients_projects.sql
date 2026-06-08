-- Migration: users, clients, projects
-- Spec: client-sign-off-dashboard, task 2.1
-- Requirements: 2.1 (client name 1-100), 3.1 (project name 1-120), 3.5
--               (case-insensitive project name uniqueness per client),
--               17.1 (persistence), 17.2 (project -> client FK enforcement)
--
-- This is the FIRST schema migration. Phases and phase-child tables follow in
-- task 2.2; tasks, activity_logs, and share_links follow in task 2.3.
-- Row Level Security policies are intentionally NOT added here (task 3.1).

-- gen_random_uuid() is provided by pgcrypto. It is available by default on
-- Supabase, but we guard the extension so this migration is self-contained.
create extension if not exists pgcrypto with schema extensions;

-- Designer accounts mirror Supabase auth.users (1:1)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now()
);
create index on public.clients (owner_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create index on public.projects (client_id);
-- Case-insensitive uniqueness of project name within a client (R3.5)
create unique index projects_client_name_ci
  on public.projects (client_id, lower(btrim(name)));
