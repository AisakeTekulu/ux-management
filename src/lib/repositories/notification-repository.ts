/**
 * Supabase-backed implementation of {@link NotificationRepository}.
 *
 * Notifications are created by the service-role client (from portal routes
 * where the reviewer is unauthenticated) and read by the authenticated admin
 * user through RLS-scoped queries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Notification, UUID } from '@/lib/domain/types';
import type {
  NewNotification,
  NotificationRepository,
} from '@/lib/repositories/interfaces';

// ---------------------------------------------------------------------------
// Row type & mapper
// ---------------------------------------------------------------------------

/** Database row shape for the `notifications` table. */
export interface NotificationRow {
  id: string;
  user_id: string;
  project_id: string | null;
  phase_id: string | null;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

/** Map a database row to the domain `Notification` type. */
export function notificationRowToDomain(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    projectId: row.project_id,
    phaseId: row.phase_id,
    type: row.type as Notification['type'],
    title: row.title,
    message: row.message,
    isRead: row.is_read,
    createdAt: row.created_at,
    metadata: row.metadata ?? {},
  };
}

// ---------------------------------------------------------------------------
// Repository implementation
// ---------------------------------------------------------------------------

export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private readonly db: SupabaseClient) {}

  async create(input: NewNotification): Promise<Notification> {
    const result = await this.db
      .from('notifications')
      .insert({
        user_id: input.userId,
        project_id: input.projectId,
        phase_id: input.phaseId,
        type: input.type,
        title: input.title,
        message: input.message,
        metadata: input.metadata,
      })
      .select()
      .single();
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] notifications.create: ${result.error.message}`,
      );
    }
    return notificationRowToDomain(result.data as NotificationRow);
  }

  async listByUser(userId: UUID, limit?: number): Promise<Notification[]> {
    let query = this.db
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (limit !== undefined && limit > 0) {
      query = query.limit(limit);
    }
    const result = await query;
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] notifications.listByUser: ${result.error.message}`,
      );
    }
    return (result.data as NotificationRow[]).map(notificationRowToDomain);
  }

  async countUnread(userId: UUID): Promise<number> {
    const result = await this.db
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] notifications.countUnread: ${result.error.message}`,
      );
    }
    return result.count ?? 0;
  }

  async markAsRead(id: UUID): Promise<void> {
    const result = await this.db
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] notifications.markAsRead: ${result.error.message}`,
      );
    }
  }

  async markAllAsRead(userId: UUID): Promise<void> {
    const result = await this.db
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (result.error) {
      throw new Error(
        `[SupabaseRepo] notifications.markAllAsRead: ${result.error.message}`,
      );
    }
  }
}
