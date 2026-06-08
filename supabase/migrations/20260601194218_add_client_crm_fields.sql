-- Migration: extend clients table with CRM profile fields
-- Spec: client-crm-review-links, task 1.1
-- Requirements: 1.1 (extended client fields), 1.2 (backward compatibility),
--               1.5 (preferred_contact_method enum constraint),
--               1.6 (notes max 5000 chars), 11.1 (schema extension)
--
-- All new columns are nullable except preferred_contact_method which defaults
-- to 'email'. This is a non-breaking additive migration — existing rows get
-- NULL for optional fields and 'email' for preferred_contact_method.

ALTER TABLE public.clients
  ADD COLUMN full_name text DEFAULT NULL,
  ADD COLUMN business_name text DEFAULT NULL,
  ADD COLUMN primary_email text DEFAULT NULL,
  ADD COLUMN secondary_email text DEFAULT NULL,
  ADD COLUMN phone text DEFAULT NULL,
  ADD COLUMN website text DEFAULT NULL,
  ADD COLUMN location text DEFAULT NULL,
  ADD COLUMN preferred_contact_method text NOT NULL DEFAULT 'email'
    CHECK (preferred_contact_method IN ('email', 'phone', 'other')),
  ADD COLUMN notes text DEFAULT NULL
    CHECK (notes IS NULL OR char_length(notes) <= 5000);
