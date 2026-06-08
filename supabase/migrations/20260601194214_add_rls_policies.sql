-- Migration: Row Level Security policies on all tables (except activity_logs)
-- Spec: client-sign-off-dashboard, task 3.1
-- Requirements: 1.5 (restrict management functions to authenticated Designers),
--               4.8 (owner-scoped access to phase internal notes and data)
--
-- Enables RLS on every table and adds owner-scoped policies for the Designer
-- (authenticated, auth.uid() present). Tables with a direct owner_id column
-- use a simple equality check. Child tables without owner_id authorize via
-- their parent chain back to the owning project/user.
--
-- The Client_Reviewer (unauthenticated) accesses data through a server-only
-- service-role client that bypasses RLS; scope enforcement lives in application
-- code (see design.md).
--
-- NOTE: activity_logs RLS and append-only restrictions are handled in a
-- separate migration (task 3.2: 20260601194214_activity_logs_append_only.sql).

-- ============================================================================
-- 1. USERS — owner-scoped (user can only see/manage their own row)
-- ============================================================================
alter table public.users enable row level security;

create policy users_owner on public.users
  for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- ============================================================================
-- 2. CLIENTS — owner-scoped via owner_id
-- ============================================================================
alter table public.clients enable row level security;

create policy clients_owner on public.clients
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================================
-- 3. PROJECTS — owner-scoped via owner_id
-- ============================================================================
alter table public.projects enable row level security;

create policy projects_owner on public.projects
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================================
-- 4. TASKS — owner-scoped via owner_id
-- ============================================================================
alter table public.tasks enable row level security;

create policy tasks_owner on public.tasks
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================================
-- 5. SHARE_LINKS — owner-scoped via owner_id
-- ============================================================================
alter table public.share_links enable row level security;

create policy share_links_owner on public.share_links
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================================
-- 6. PHASES — owner-via-parent (project -> owner_id)
-- ============================================================================
alter table public.phases enable row level security;

create policy phases_owner on public.phases
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = phases.project_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = phases.project_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 7. CHECKLIST_ITEMS — owner-via-parent (phase -> project -> owner_id)
-- ============================================================================
alter table public.checklist_items enable row level security;

create policy checklist_items_owner on public.checklist_items
  for all
  using (
    exists (
      select 1 from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = checklist_items.phase_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = checklist_items.phase_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. DESIGN_LINKS — owner-via-parent (phase -> project -> owner_id)
-- ============================================================================
alter table public.design_links enable row level security;

create policy design_links_owner on public.design_links
  for all
  using (
    exists (
      select 1 from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = design_links.phase_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = design_links.phase_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 9. COMMENTS — owner-via-parent (phase -> project -> owner_id)
-- ============================================================================
alter table public.comments enable row level security;

create policy comments_owner on public.comments
  for all
  using (
    exists (
      select 1 from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = comments.phase_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = comments.phase_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 10. APPROVALS — owner-via-parent (phase -> project -> owner_id)
-- ============================================================================
alter table public.approvals enable row level security;

create policy approvals_owner on public.approvals
  for all
  using (
    exists (
      select 1 from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = approvals.phase_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.phases ph
      join public.projects p on p.id = ph.project_id
      where ph.id = approvals.phase_id
        and p.owner_id = auth.uid()
    )
  );
