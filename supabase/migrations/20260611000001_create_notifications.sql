-- Create the notifications table for in-app admin notifications.
-- Notifications are created when clients interact with shared review links
-- (comments, approvals, change requests) and when review links are viewed.

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id uuid REFERENCES public.phases(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN (
    'client_comment', 'client_approval', 'client_changes_requested',
    'phase_status_changed', 'review_link_viewed'
  )),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

-- Index for fetching unread notifications efficiently (partial index).
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

-- Index for paginated listing of all notifications for a user.
CREATE INDEX idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- Row Level Security: each user can only access their own notifications.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notifications_owner ON public.notifications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
