-- Migration: client data retention – status, deleted_at, approval immutability
-- Spec: client-data-retention, task 1.1
-- Requirements: 1.1 (client status field), 1.2 (default active),
--               7.1 (approval immutability), 7.4 (reject approval mutation)
--
-- Adds a lifecycle status column and soft-delete timestamp to clients,
-- creates a composite index for owner+status filtering, and installs a
-- trigger that prevents any UPDATE or DELETE on the approvals table.

-- 1. Add client_status enum type with allowed values
create type public.client_status as enum ('active', 'archived');

-- 2. Add status column with default 'active'
alter table public.clients
  add column status public.client_status not null default 'active';

-- 3. Add deleted_at column (null means profile still exists)
alter table public.clients
  add column deleted_at timestamptz default null;

-- 4. Composite index for filtering clients by owner and status
create index clients_owner_status on public.clients (owner_id, status);

-- 5. Approval immutability trigger function
create or replace function public.prevent_approval_mutation()
returns trigger as $$
begin
  raise exception 'Approval records are immutable and cannot be modified or deleted.';
  return null;
end;
$$ language plpgsql;

-- 6. Attach trigger BEFORE UPDATE OR DELETE on approvals table
create trigger approvals_immutable
  before update or delete on public.approvals
  for each row
  execute function public.prevent_approval_mutation();
