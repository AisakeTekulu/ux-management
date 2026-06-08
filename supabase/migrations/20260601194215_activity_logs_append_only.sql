-- Migration: Enforce append-only audit immutability on activity_logs
-- Spec: client-sign-off-dashboard, task 3.2
-- Requirements:
--   13.6  Retain Approval and Comment Activity_Log entries as part of the
--         Audit_Trail for a minimum of 7 years from the entry timestamp.
--   13.7  Reject any request to modify or delete an Audit_Trail Activity_Log
--         entry; preserve the original entry unchanged.
--
-- RETENTION POSTURE (R13.6):
--   No scheduled purge job exists. Activity_logs rows are retained indefinitely
--   (minimum 7 years from entry timestamp). Approvals and comments inherit the
--   same no-purge retention. Any future retention policy change requires an
--   explicit migration and stakeholder approval.
--
-- IMMUTABILITY ENFORCEMENT (R13.7):
--   The authenticated role is granted INSERT and SELECT only on activity_logs.
--   UPDATE and DELETE are explicitly revoked. This ensures that once an audit
--   entry is written, it cannot be modified or removed through the application
--   layer, regardless of RLS policies.
--
-- This migration runs AFTER 20260601194214_add_rls_policies.sql which enables
-- RLS and creates a permissive `for all` policy on activity_logs. We replace
-- that policy with restricted INSERT/SELECT-only policies to enforce
-- append-only semantics.

-- ============================================================================
-- Step 1: Drop the overly-permissive "for all" policy from task 3.1
-- ============================================================================
-- The task 3.1 migration created `activity_logs_owner` as a `for all` policy,
-- which would permit UPDATE and DELETE. We replace it with separate INSERT and
-- SELECT policies to enforce immutability.
drop policy if exists activity_logs_owner on public.activity_logs;

-- ============================================================================
-- Step 2: Revoke UPDATE/DELETE privileges at the role level (defense-in-depth)
-- ============================================================================
-- Even without an RLS policy allowing it, explicitly revoking these privileges
-- ensures that no code path can UPDATE or DELETE audit rows.
revoke update, delete on public.activity_logs from authenticated;
revoke update, delete on public.activity_logs from anon;

-- ============================================================================
-- Step 3: Grant only INSERT and SELECT to the authenticated role
-- ============================================================================
-- INSERT: application writes new audit entries when events occur
-- SELECT: designer reads the activity timeline for their projects
grant insert, select on public.activity_logs to authenticated;

-- ============================================================================
-- Step 4: Create restricted RLS policies (INSERT and SELECT only)
-- ============================================================================

-- SELECT: designer can only read activity logs for projects they own
create policy activity_logs_select_owner on public.activity_logs
  for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = activity_logs.project_id
        and p.owner_id = auth.uid()
    )
  );

-- INSERT: designer can only insert activity logs for projects they own
create policy activity_logs_insert_owner on public.activity_logs
  for insert
  with check (
    exists (
      select 1 from public.projects p
      where p.id = activity_logs.project_id
        and p.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- NO UPDATE or DELETE policies are created.
-- ============================================================================
-- Combined with the revoked privileges above, this provides defense-in-depth:
--   Layer 1: PostgreSQL privileges deny UPDATE/DELETE at the role level
--   Layer 2: RLS has no UPDATE/DELETE policies, so even if privileges were
--            somehow restored, RLS would still block mutations
--
-- The only way to remove data from activity_logs is via the service_role
-- (superuser) which bypasses RLS and privilege restrictions. This is
-- intentional for disaster-recovery scenarios only and must never be used
-- in normal application flow.
--
-- NO-PURGE RETENTION (R13.6):
-- There is no scheduled job, cron task, or application code that deletes
-- activity_log rows. Rows are retained for a minimum of 7 years from their
-- created_at timestamp. Any change to this retention posture requires:
--   1. A new migration explicitly documenting the change
--   2. Stakeholder approval
--   3. Compliance review (audit trail integrity)
