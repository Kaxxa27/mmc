import { NOTIFICATION_TYPES, type NotificationType } from '../database/schema/enums.js';
import type { NotificationPreferences } from '../database/schema/profiles.js';

export type NotificationChannel = 'inApp' | 'email';

/**
 * Defaults per notification type. Email is opt-in for everything except the few messages people
 * usually want in their inbox; users can change every value in their settings.
 */
export const NOTIFICATION_DEFAULTS: Record<
  NotificationType,
  Record<NotificationChannel, boolean>
> = {
  group_invitation: { inApp: true, email: false },
  group_member_joined: { inApp: true, email: false },
  group_movie_added: { inApp: true, email: false },
  group_movie_rated: { inApp: true, email: false },
  comment_mention: { inApp: true, email: false },
  movie_night_scheduled: { inApp: true, email: true },
  movie_night_voting_started: { inApp: true, email: false },
  movie_night_decided: { inApp: true, email: true },
  watchlist_release_upcoming: { inApp: true, email: false },
  security_new_sign_in: { inApp: true, email: false },
  group_role_changed: { inApp: true, email: false },
};

export function isEnabled(
  preferences: NotificationPreferences | null | undefined,
  type: NotificationType,
  channel: NotificationChannel,
): boolean {
  const override = preferences?.[channel]?.[type];
  return typeof override === 'boolean' ? override : NOTIFICATION_DEFAULTS[type][channel];
}

export interface EffectivePreference {
  type: NotificationType;
  inApp: boolean;
  email: boolean;
}

export function effectivePreferences(
  preferences: NotificationPreferences | null | undefined,
): EffectivePreference[] {
  return NOTIFICATION_TYPES.map((type) => ({
    type,
    inApp: isEnabled(preferences, type, 'inApp'),
    email: isEnabled(preferences, type, 'email'),
  }));
}

/** Applies a partial update and drops overrides equal to the default (keeps the JSON small). */
export function mergePreferences(
  current: NotificationPreferences | null | undefined,
  updates: { type: NotificationType; inApp?: boolean; email?: boolean }[],
): NotificationPreferences {
  const next: Required<NotificationPreferences> = {
    inApp: { ...(current?.inApp ?? {}) },
    email: { ...(current?.email ?? {}) },
  };
  for (const update of updates) {
    for (const channel of ['inApp', 'email'] as const) {
      const value = update[channel];
      if (value === undefined) continue;
      if (value === NOTIFICATION_DEFAULTS[update.type][channel]) {
        delete next[channel][update.type];
      } else {
        next[channel][update.type] = value;
      }
    }
  }
  return next;
}
