import type { NotificationView } from '@/lib/api/types';

function text(data: Record<string, unknown>, key: string): string | null {
  const value = data[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

/** Where a notification leads, based on the ids in its `data`. */
export function notificationHref(notification: Pick<NotificationView, 'type' | 'data'>): string {
  const { data } = notification;
  const groupId = text(data, 'groupId');
  const movieNightId = text(data, 'movieNightId');
  const tmdbId = text(data, 'tmdbId');

  switch (notification.type) {
    case 'group_invitation':
      // Pending invitations are listed (with accept / decline) at the top of the groups page.
      return '/groups#invitations';
    case 'movie_night_scheduled':
    case 'movie_night_voting_started':
    case 'movie_night_decided':
      return movieNightId ? `/movie-nights/${movieNightId}` : '/movie-nights';
    case 'group_movie_added':
    case 'group_movie_rated':
      return groupId && tmdbId
        ? `/groups/${groupId}/movies/${tmdbId}`
        : groupId
          ? `/groups/${groupId}`
          : '/groups';
    case 'comment_mention':
      if (movieNightId) return `/movie-nights/${movieNightId}`;
      return groupId && tmdbId
        ? `/groups/${groupId}/movies/${tmdbId}`
        : groupId
          ? `/groups/${groupId}`
          : '/groups';
    case 'group_member_joined':
    case 'group_role_changed':
      return groupId ? `/groups/${groupId}` : '/groups';
    case 'watchlist_release_upcoming':
      return tmdbId ? `/movies/${tmdbId}` : '/watchlist';
    case 'security_new_sign_in':
      return '/settings#sessions';
    default:
      return '/notifications';
  }
}
