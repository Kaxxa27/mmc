import { Bookmark, Check, Eye, EyeOff, type LucideIcon } from 'lucide-react';
import type {
  CollectionVisibility,
  GroupKind,
  GroupRole,
  MovieNightStatus,
  MovieStatus,
  NotificationType,
} from './api/types';

export const MOVIE_STATUSES: MovieStatus[] = [
  'want_to_watch',
  'watching',
  'watched',
  'not_interested',
];

export const MOVIE_STATUS_META: Record<
  MovieStatus,
  { label: string; icon: LucideIcon; badge: string; dot: string }
> = {
  want_to_watch: {
    label: 'Want to watch',
    icon: Bookmark,
    badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    dot: 'bg-sky-500',
  },
  watching: {
    label: 'Watching',
    icon: Eye,
    badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  watched: {
    label: 'Watched',
    icon: Check,
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  not_interested: {
    label: 'Not interested',
    icon: EyeOff,
    badge: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-400',
    dot: 'bg-zinc-400',
  },
};

export const GROUP_ROLE_LABEL: Record<GroupRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  family: 'Family',
  friends: 'Friends',
  couple: 'Couple',
  other: 'Other',
};

export const VISIBILITY_META: Record<CollectionVisibility, { label: string; description: string }> =
  {
    private: { label: 'Private', description: 'Only you can see it.' },
    shared: { label: 'Shared', description: 'People and groups you share it with can see it.' },
    public: { label: 'Public', description: 'Anyone with the link can see it.' },
  };

export const MOVIE_NIGHT_STATUS_META: Record<MovieNightStatus, { label: string; badge: string }> = {
  planning: { label: 'Planning', badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  voting: { label: 'Voting', badge: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  decided: { label: 'Decided', badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  completed: { label: 'Completed', badge: 'bg-zinc-500/15 text-zinc-600 dark:text-zinc-300' },
  cancelled: { label: 'Cancelled', badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' },
};

export const NOTIFICATION_LABEL: Record<NotificationType, string> = {
  group_invitation: 'Group invitations',
  group_member_joined: 'New group members',
  group_movie_added: 'Movies added to a group',
  group_movie_rated: 'Group ratings',
  comment_mention: 'Mentions in comments',
  movie_night_scheduled: 'Movie night planned',
  movie_night_voting_started: 'Voting started',
  movie_night_decided: 'Movie night decided',
  watchlist_release_upcoming: 'Upcoming releases from your watchlist',
  security_new_sign_in: 'New sign-ins to your account',
  group_role_changed: 'Role changes in groups',
};

export const LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'ru-RU', label: 'Русский' },
  { value: 'uk-UA', label: 'Українська' },
  { value: 'de-DE', label: 'Deutsch' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'es-ES', label: 'Español' },
  { value: 'it-IT', label: 'Italiano' },
  { value: 'pl-PL', label: 'Polski' },
  { value: 'pt-BR', label: 'Português (Brasil)' },
  { value: 'ja-JP', label: '日本語' },
  { value: 'ko-KR', label: '한국어' },
];

export const REGIONS = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'PL', label: 'Poland' },
  { value: 'UA', label: 'Ukraine' },
  { value: 'RU', label: 'Russia' },
  { value: 'BR', label: 'Brazil' },
  { value: 'JP', label: 'Japan' },
  { value: 'KR', label: 'South Korea' },
];

export const US_CERTIFICATIONS = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
