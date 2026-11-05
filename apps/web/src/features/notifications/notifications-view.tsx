'use client';

import { Bell, CheckCheck, Settings, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { notificationHref } from '@/components/notifications/notification-link';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/misc';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NOTIFICATION_LABEL } from '@/lib/constants';
import {
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/lib/queries/notifications';
import { cn, formatRelative } from '@/lib/utils';

export function NotificationsView() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data, isPending, error, refetch } = useNotifications({ unreadOnly, page, pageSize: 20 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const remove = useDeleteNotification();

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Invitations, group activity, movie nights and security alerts."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => markAll.mutate()}
              disabled={!data?.unreadCount}
              loading={markAll.isPending}
            >
              <CheckCheck aria-hidden />
              Mark all as read
            </Button>
            <Button asChild variant="ghost" size="icon" aria-label="Notification settings">
              <Link href="/settings#notifications">
                <Settings aria-hidden />
              </Link>
            </Button>
          </>
        }
      />
      <Tabs
        value={unreadOnly ? 'unread' : 'all'}
        onValueChange={(value) => {
          setUnreadOnly(value === 'unread');
          setPage(1);
        }}
        className="mb-6"
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">
            Unread {data?.unreadCount ? `(${data.unreadCount})` : ''}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description="Group invitations, new movies in your groups and movie-night updates show up here."
        />
      ) : (
        <>
          <Card>
            <ul className="divide-y">
              {data.items.map((notification) => (
                <li
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3',
                    !notification.readAt && 'bg-primary/5',
                  )}
                >
                  <span
                    className={cn(
                      'mt-2 size-2 shrink-0 rounded-full',
                      notification.readAt ? 'bg-transparent' : 'bg-primary',
                    )}
                    aria-label={notification.readAt ? undefined : 'Unread'}
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      if (!notification.readAt) markRead.mutate(notification.id);
                      router.push(notificationHref(notification));
                    }}
                  >
                    <p className="text-sm font-medium hover:underline">{notification.title}</p>
                    {notification.body ? (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                        {notification.body}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {NOTIFICATION_LABEL[notification.type]} ·{' '}
                      {formatRelative(notification.createdAt)}
                    </p>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    {!notification.readAt ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Mark as read"
                        onClick={() => markRead.mutate(notification.id)}
                      >
                        <CheckCheck aria-hidden />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete notification"
                      onClick={() => remove.mutate(notification.id)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
