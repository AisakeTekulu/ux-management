'use server';

/**
 * Server Actions for the notifications feature.
 *
 * These actions are called by client components (NotificationBell, notifications
 * page) to fetch and manage notification state for the authenticated admin user.
 */

import { createClient } from '@/lib/supabase/server';
import { createSupabaseRepositories } from '@/lib/repositories/supabase';
import type { Result, AppError } from '@/lib/domain/result';
import { ok, err, appError } from '@/lib/domain/result';

export interface NotificationData {
  id: string;
  projectId: string | null;
  phaseId: string | null;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export async function getNotifications(limit?: number): Promise<Result<NotificationData[], AppError>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err(appError('unauthorized', 'Authentication required.'));

  const repos = createSupabaseRepositories(supabase);
  const notifications = await repos.notifications.listByUser(user.id, limit ?? 50);
  return ok(notifications);
}

export async function getUnreadCount(): Promise<Result<number, AppError>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err(appError('unauthorized', 'Authentication required.'));

  const repos = createSupabaseRepositories(supabase);
  const count = await repos.notifications.countUnread(user.id);
  return ok(count);
}

export async function markNotificationRead(id: string): Promise<Result<void, AppError>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err(appError('unauthorized', 'Authentication required.'));

  const repos = createSupabaseRepositories(supabase);
  await repos.notifications.markAsRead(id);
  return ok(undefined);
}

export async function markAllNotificationsRead(): Promise<Result<void, AppError>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return err(appError('unauthorized', 'Authentication required.'));

  const repos = createSupabaseRepositories(supabase);
  await repos.notifications.markAllAsRead(user.id);
  return ok(undefined);
}
