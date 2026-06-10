'use client';

/**
 * NotificationBell — header icon showing the unread notification count.
 *
 * Polls the server every 30 seconds for updated counts and navigates to
 * the /notifications page on click.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUnreadCount } from '@/lib/actions/notifications';

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const router = useRouter();

  const fetchCount = useCallback(async () => {
    const result = await getUnreadCount();
    if (result.ok) setCount(result.value);
  }, []);

  useEffect(() => {
    fetchCount();
    // Poll every 30 seconds for new notifications
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return (
    <button
      type="button"
      onClick={() => router.push('/notifications')}
      className="relative inline-flex items-center justify-center h-9 w-9 rounded-lg hover:bg-surface-hovered transition-colors"
      aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
    >
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-red px-1 text-[10px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
