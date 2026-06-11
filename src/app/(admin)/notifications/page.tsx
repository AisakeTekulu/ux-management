'use client';

/**
 * Notifications page — lists all notifications for the authenticated admin,
 * grouped by date (Today, Yesterday, Earlier), with mark-as-read controls
 * and click-to-navigate.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { relativeTime, formatTimestamp } from '@/lib/format-date';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationData,
} from '@/lib/actions/notifications';

/** Group notifications by date: Today, Yesterday, Earlier */
function groupByDate(notifications: NotificationData[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const groups: { label: string; items: NotificationData[] }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ];

  for (const n of notifications) {
    const d = new Date(n.createdAt);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day.getTime() >= today.getTime()) {
      groups[0]!.items.push(n);
    } else if (day.getTime() >= yesterday.getTime()) {
      groups[1]!.items.push(n);
    } else {
      groups[2]!.items.push(n);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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

  /** Navigate to the source of the notification and mark it as read. */
  const handleNotificationClick = async (n: NotificationData) => {
    if (!n.isRead) {
      markNotificationRead(n.id).catch(() => {});
      setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, isRead: true } : item));
    }

    if (n.phaseId && n.projectId) {
      router.push(`/projects/${n.projectId}/phases/${n.phaseId}`);
    } else if (n.projectId) {
      router.push(`/projects/${n.projectId}`);
    }
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const dateGroups = groupByDate(notifications);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-subdued" />
        {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-surface" />)}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-token-5">
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
          <div className="flex flex-col items-center justify-center py-12 px-token-4">
            {/* Bell illustration for empty state */}
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-subdued">
              <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-text-subdued">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <EmptyState
              title="All caught up!"
              description="You'll be notified when clients comment, approve, or request changes on your projects."
            />
          </div>
        </Card>
      ) : (
        <div className="space-y-token-5">
          {dateGroups.map((group) => (
            <div key={group.label}>
              <h2 className="mb-token-2 text-xs font-semibold text-text-subdued uppercase tracking-wide">
                {group.label}
              </h2>
              <div className="rounded-lg border border-border bg-surface overflow-hidden">
                <ul className="divide-y divide-border">
                  {group.items.map((n) => (
                    <li
                      key={n.id}
                      className={`flex items-start gap-token-3 px-token-4 py-token-3 cursor-pointer hover:bg-surface-hovered transition-colors ${!n.isRead ? 'bg-primary/5' : ''}`}
                      onClick={() => handleNotificationClick(n)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleNotificationClick(n); }}
                    >
                      {/* Blue dot for unread */}
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${!n.isRead ? 'bg-blue-500' : 'bg-transparent'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!n.isRead ? 'font-semibold text-text' : 'text-text'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-text-subdued mt-0.5 truncate">{n.message}</p>
                        <p
                          className="text-xs text-text-subdued mt-1"
                          title={formatTimestamp(n.createdAt)}
                        >
                          {relativeTime(n.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-token-2 shrink-0">
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                            className="text-xs font-medium text-primary hover:text-primary-hovered"
                          >
                            Mark read
                          </button>
                        )}
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="text-text-subdued" strokeLinecap="round">
                          <path d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
