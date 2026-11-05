'use client';

import { Bell, LogOut, NotebookPen, Settings } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/menu';
import { Avatar } from '@/components/ui/misc';
import type { ProfileView } from '@/lib/api/types';
import { useSignOut } from '@/lib/queries/core';

export function UserMenu({ me }: { me: ProfileView }) {
  const signOut = useSignOut();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full transition-opacity hover:opacity-90 focus-visible:outline-2"
        aria-label="Account menu"
      >
        <Avatar name={me.displayName} src={me.avatarUrl} size="sm" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <Avatar name={me.displayName} src={me.avatarUrl} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{me.displayName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {me.username ? `@${me.username}` : me.email}
            </p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden />
            Profile & settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/reviews">
            <NotebookPen aria-hidden />
            My reviews
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/notifications">
            <Bell aria-hidden />
            Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut.mutate('local')} disabled={signOut.isPending}>
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
