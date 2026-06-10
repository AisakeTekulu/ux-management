'use client';

/**
 * Notifications page — lists all notifications for the authenticated admin,
 * grouped by project, with mark-as-read controls.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationData,
} from '@/lib/actions/notifications';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const result = await getNotifications(100);
    if (result.ok) setNotifications(result.value);
    setLoading(false);
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Group by project
  const grouped = notifications.reduce<Record<string, NotificationData[]>>((acc, n) => {
    const key = n.projectId ?? 'general';
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-subdued" />
        {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" />)}
      </div>
    );
  }

  return (
    <div className="space-y-token-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Notifications</h1>
          <p className="mt-0.5 text-sm text-text-subdued">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-sm font-medium text-primary hover:text-primary-hovered transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <div className="p-token-6">
            <EmptyState
              title="No notifications"
              description="You'll be notified when clients comment, approve, or request changes on your projects."
            />
          </div>
        </Card>
      ) : (
        <div className="space-y-token-4">
          {Object.entries(grouped).map(([projectId, items]) => (
            <div key={projectId} className="rounded-lg border border-border bg-surface overflow-hidden">
              <div className="border-b border-border bg-surface-subdued px-token-4 py-token-2">
                <h2 className="text-xs font-semibold text-text-subdued uppercase tracking-wide">
                  {projectId === 'general' ? 'General' : 'Project'}
                </h2>
              </div>
              <ul className="divide-y divide-border">
                {items.map((n) => (
                  <li
                    key={n.id}
                    className={`flex items-start gap-token-3 px-token-4 py-token-3 ${!n.isRead ? 'bg-primary/5' : ''}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.isRead ? 'bg-primary' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.isRead ? 'font-semibold text-text' : 'text-text'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-text-subdued mt-0.5 truncate">{n.message}</p>
                      <p className="text-xs text-text-subdued mt-1">
                        {new Date(n.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={() => handleMarkRead(n.id)}
                        className="shrink-0 text-xs font-medium text-primary hover:text-primary-hovered"
                      >
                        Mark read
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
