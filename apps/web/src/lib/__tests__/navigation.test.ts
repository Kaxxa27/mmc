import { describe, expect, it } from 'vitest';
import { niceTicks } from '@/components/charts/charts';
import { isActive } from '@/components/layout/nav';
import { notificationHref } from '@/components/notifications/notification-link';

describe('notificationHref', () => {
  it('links each notification to the place it is about', () => {
    expect(
      notificationHref({ type: 'group_invitation', data: { groupId: 'g1', invitationId: 'i1' } }),
    ).toBe('/groups#invitations');
    expect(
      notificationHref({
        type: 'movie_night_decided',
        data: { groupId: 'g1', movieNightId: 'n1', tmdbId: 862 },
      }),
    ).toBe('/movie-nights/n1');
    expect(
      notificationHref({
        type: 'group_movie_rated',
        data: { groupId: 'g1', tmdbId: 862, rating: 9 },
      }),
    ).toBe('/groups/g1/movies/862');
    expect(
      notificationHref({
        type: 'comment_mention',
        data: { groupId: 'g1', commentId: 'c1', movieNightId: 'n2' },
      }),
    ).toBe('/movie-nights/n2');
    expect(notificationHref({ type: 'watchlist_release_upcoming', data: { tmdbId: 550 } })).toBe(
      '/movies/550',
    );
    expect(notificationHref({ type: 'security_new_sign_in', data: { method: 'otp' } })).toBe(
      '/settings#sessions',
    );
  });

  it('falls back to list pages when ids are missing', () => {
    expect(notificationHref({ type: 'group_member_joined', data: {} })).toBe('/groups');
    expect(notificationHref({ type: 'movie_night_scheduled', data: {} })).toBe('/movie-nights');
  });
});

describe('isActive', () => {
  it('matches the section and its sub-pages, home only exactly', () => {
    expect(isActive('/groups/abc', '/groups')).toBe(true);
    expect(isActive('/groupsx', '/groups')).toBe(false);
    expect(isActive('/discover', '/')).toBe(false);
    expect(isActive('/', '/')).toBe(true);
    expect(isActive(null, '/')).toBe(false);
  });
});

describe('niceTicks', () => {
  it.each([
    [0, [0, 1]],
    [3, [0, 1, 2, 3]],
    [7, [0, 2, 4, 6, 8]],
    [18, [0, 5, 10, 15, 20]],
    [230, [0, 100, 200, 300]],
  ])('max %s -> %j', (max, expected) => {
    expect(niceTicks(max)).toEqual(expected);
  });
});
