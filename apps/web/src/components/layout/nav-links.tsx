'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { cn } from '@/lib/utils';
import { isActive, MOBILE_PRIMARY, NAV_SECTIONS, type NavItem } from './nav';

function SidebarList({ pathname }: { pathname: string | null }) {
  return (
    <nav className="flex flex-col gap-6" aria-label="Main">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.title ?? index} className="flex flex-col gap-0.5">
          {section.title ? (
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
          ) : null}
          {section.items.map((item) => (
            <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </div>
      ))}
    </nav>
  );
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="size-4.5 shrink-0" aria-hidden />
      {item.label}
    </Link>
  );
}

function ActiveSidebarList() {
  return <SidebarList pathname={usePathname()} />;
}

/**
 * Reading the pathname suspends while dynamic routes prerender (Cache Components),
 * so the links render without highlighting until the URL is known.
 */
export function SidebarNav() {
  return (
    <Suspense fallback={<SidebarList pathname={null} />}>
      <ActiveSidebarList />
    </Suspense>
  );
}

const ALL_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);
const PRIMARY_ITEMS = ALL_ITEMS.filter((item) => MOBILE_PRIMARY.includes(item.href));

/** Items that are not in the bottom bar (for the phone "More" menu). */
export const MORE_ITEMS = ALL_ITEMS.filter((item) => !MOBILE_PRIMARY.includes(item.href));

function BottomList({ pathname }: { pathname: string | null }) {
  return (
    <>
      {PRIMARY_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function ActiveBottomList() {
  return <BottomList pathname={usePathname()} />;
}

export function BottomNavLinks() {
  return (
    <Suspense fallback={<BottomList pathname={null} />}>
      <ActiveBottomList />
    </Suspense>
  );
}
