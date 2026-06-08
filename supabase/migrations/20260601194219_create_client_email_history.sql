-- Migration: client_email_history table
-- Spec: client-crm-review-links, task 1.2
-- Requirements: 8.1 (email history storage fields),
--               8.2 (referential integrity with clients, projects, phases),
--               8.3 (queryable by client_id),
--               8.4 (queryable by project_id),
--               11.2 (create client_email_history table),
--               11.3 (RLS scoped to owner_id — policy added in task 1.3),
--               11.4 (indexes on client_id and project_id)
--
-- This table stores an append-only log of all review link emails sent to
-- clients. It references clients, projects, phases, and users with
-- appropriate cascade/set-null behavior.

CREATE TABLE public.client_email_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.phases(id) ON DELETE SET NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  message text NOT NULL,
  sent_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivery_status text NOT NULL DEFAULT 'sent'
    CHECK (delivery_status IN ('sent', 'failed', 'pending'))
);

CREATE INDEX idx_email_history_client ON public.client_email_history(client_id);
CREATE INDEX idx_email_history_project ON public.client_email_history(project_id);
CREATE INDEX idx_email_history_sent_at ON public.client_email_history(sent_at DESC);
