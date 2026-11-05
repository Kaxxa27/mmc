import {
  effectivePreferences,
  isEnabled,
  mergePreferences,
  NOTIFICATION_DEFAULTS,
} from './notification-preferences.js';

describe('notification preferences', () => {
  it('falls back to defaults', () => {
    expect(isEnabled({}, 'movie_night_decided', 'email')).toBe(true);
    expect(isEnabled(null, 'group_movie_added', 'email')).toBe(false);
  });

  it('honours overrides', () => {
    const prefs = { email: { group_movie_added: true }, inApp: { group_movie_rated: false } };
    expect(isEnabled(prefs, 'group_movie_added', 'email')).toBe(true);
    expect(isEnabled(prefs, 'group_movie_rated', 'inApp')).toBe(false);
  });

  it('merges updates and removes values equal to the default', () => {
    const merged = mergePreferences({ email: { group_movie_added: true } }, [
      { type: 'group_movie_added', email: false },
      { type: 'comment_mention', email: true, inApp: true },
    ]);
    expect(merged.email).toEqual({ comment_mention: true });
    expect(merged.inApp).toEqual({});
  });

  it('lists every notification type', () => {
    expect(effectivePreferences({}).map((p) => p.type)).toEqual(Object.keys(NOTIFICATION_DEFAULTS));
  });
});
