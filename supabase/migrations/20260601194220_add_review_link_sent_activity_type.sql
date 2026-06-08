-- Migration: Add 'review_link_sent' to activity_logs type CHECK constraint
-- Spec: client-crm-review-links, task 1.4
-- Requirements: 7.1, 7.2
--
-- The activity_logs.type column currently allows:
--   'comment_created', 'approval_created', 'phase_status_changed'
--
-- This migration drops the existing CHECK constraint and replaces it with
-- one that also includes 'review_link_sent' to support logging review link
-- email sends as activity entries.

-- Drop the existing inline CHECK constraint.
-- PostgreSQL names inline check constraints as: {table}_{column}_check
ALTER TABLE public.activity_logs
  DROP CONSTRAINT activity_logs_type_check;

-- Re-add the CHECK constraint with the new value included.
ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_type_check
  CHECK (type IN ('comment_created', 'approval_created', 'phase_status_changed', 'review_link_sent'));
