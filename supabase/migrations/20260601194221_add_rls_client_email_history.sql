-- Migration: RLS policies for client_email_history
-- Spec: client-crm-review-links, task 1.3
-- Requirements: 8.5 (RLS scoped to owner_id of related client),
--               11.3 (apply RLS policies on client_email_history)
--
-- This migration enables Row Level Security on the client_email_history
-- table and creates a policy that restricts access so users can only
-- manage email history they sent OR email history for clients they own.

ALTER TABLE public.client_email_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage email history for their own clients"
  ON public.client_email_history
  FOR ALL
  USING (
    sent_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.clients
      WHERE clients.id = client_email_history.client_id
        AND clients.owner_id = auth.uid()
    )
  );
