'use client';

import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { Spinner } from '@/components/ui/misc';
import { notificationHref } from '@/components/notifications/notification-link';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from '@/lib/queries/notifications';
import { cn, formatRelative } from '@/lib/utils';

function RecentNotifications({ onNavigate }: { onNavigate: () => void }) {
  const router = useRouter();
  const { data, isPending } = useNotifications({ page: 1, pageSize: 8 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  return (
    <div className="w-[min(24rem,calc(100vw-1rem))]">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <p className="font-semibold">Notifications</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => markAll.mutate()}
          disabled={!data?.unreadCount}
          loading={markAll.isPending}
        >
          <CheckCheck aria-hidden />
          Mark all read
        </Button>
      </div>
      <div className="max-h-96 overflow-y-auto">
        {isPending ? (
          <Spinner />
        ) : !data || data.items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            You are all caught up.
          </p>
        ) : (
          <ul className="divide-y">
            {data.items.map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                  onClick={() => {
                    if (!notification.readAt) markRead.mutate(notification.id);
                    onNavigate();
                    router.push(notificationHref(notification));
                  }}
                >
                  <span
                    className={cn(
                      'mt-1.5 size-2 shrink-0 rounded-full',
                      notification.readAt ? 'bg-transparent' : 'bg-primary',
                    )}
                    aria-label={notification.readAt ? undefined : 'Unread'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium leading-snug">
                      {notification.title}
                    </span>
                    {notification.body ? (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                        {notification.body}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {formatRelative(notification.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="border-t p-2">
        <Button asChild variant="ghost" size="sm" className="w-full">
          <Link href="/notifications" onClick={onNavigate}>
            View all notifications
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: unread = 0 } = useUnreadCount(true);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell aria-hidden />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4.5 text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        {open ? <RecentNotifications onNavigate={() => setOpen(false)} /> : null}
      </PopoverContent>
    </Popover>
  );
}
