import {
  Bookmark,
  CalendarDays,
  ChartColumn,
  Clapperboard,
  Compass,
  History,
  House,
  Library,
  type LucideIcon,
  NotebookPen,
  Popcorn,
  Search,
  Users,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: '/', label: 'Home', icon: House },
      { href: '/discover', label: 'Discover', icon: Compass },
      { href: '/search', label: 'Search', icon: Search },
    ],
  },
  {
    title: 'My catalog',
    items: [
      { href: '/my-movies', label: 'My movies', icon: Clapperboard },
      { href: '/watchlist', label: 'Watchlist', icon: Bookmark },
      { href: '/history', label: 'History', icon: History },
      { href: '/reviews', label: 'Reviews', icon: NotebookPen },
      { href: '/stats', label: 'Stats', icon: ChartColumn },
      { href: '/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    title: 'Together',
    items: [
      { href: '/collections', label: 'Collections', icon: Library },
      { href: '/groups', label: 'Groups', icon: Users },
      { href: '/movie-nights', label: 'Movie nights', icon: Popcorn },
    ],
  },
];

/** Bottom navigation on phones; everything else lives in the "More" menu. */
export const MOBILE_PRIMARY = ['/', '/discover', '/my-movies', '/groups'];

export function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
