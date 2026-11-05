import { pgEnum } from 'drizzle-orm/pg-core';

export const movieStatusEnum = pgEnum('movie_status', [
  'want_to_watch',
  'watching',
  'watched',
  'not_interested',
]);

export const groupRoleEnum = pgEnum('group_role', ['owner', 'admin', 'member']);

export const groupKindEnum = pgEnum('group_kind', ['family', 'friends', 'couple', 'other']);

export const invitationKindEnum = pgEnum('invitation_kind', ['email', 'link']);

export const invitationStatusEnum = pgEnum('invitation_status', [
  'pending',
  'accepted',
  'declined',
  'revoked',
]);

export const collectionVisibilityEnum = pgEnum('collection_visibility', [
  'private',
  'shared',
  'public',
]);

export const groupMovieStatusEnum = pgEnum('group_movie_status', ['want_to_watch', 'watched']);

export const movieNightStatusEnum = pgEnum('movie_night_status', [
  'planning',
  'voting',
  'decided',
  'completed',
  'cancelled',
]);

export const decisionMethodEnum = pgEnum('decision_method', ['vote', 'random', 'manual']);

export const notificationTypeEnum = pgEnum('notification_type', [
  'group_invitation',
  'group_member_joined',
  'group_movie_added',
  'group_movie_rated',
  'comment_mention',
  'movie_night_scheduled',
  'movie_night_voting_started',
  'movie_night_decided',
  'watchlist_release_upcoming',
  'security_new_sign_in',
  'group_role_changed',
]);

export const MOVIE_STATUSES = movieStatusEnum.enumValues;
export type MovieStatus = (typeof MOVIE_STATUSES)[number];

export const GROUP_ROLES = groupRoleEnum.enumValues;
export type GroupRole = (typeof GROUP_ROLES)[number];

export const GROUP_KINDS = groupKindEnum.enumValues;
export type GroupKind = (typeof GROUP_KINDS)[number];

export const INVITATION_KINDS = invitationKindEnum.enumValues;
export type InvitationKind = (typeof INVITATION_KINDS)[number];

export const INVITATION_STATUSES = invitationStatusEnum.enumValues;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const COLLECTION_VISIBILITIES = collectionVisibilityEnum.enumValues;
export type CollectionVisibility = (typeof COLLECTION_VISIBILITIES)[number];

export const GROUP_MOVIE_STATUSES = groupMovieStatusEnum.enumValues;
export type GroupMovieStatus = (typeof GROUP_MOVIE_STATUSES)[number];

export const MOVIE_NIGHT_STATUSES = movieNightStatusEnum.enumValues;
export type MovieNightStatus = (typeof MOVIE_NIGHT_STATUSES)[number];

export const DECISION_METHODS = decisionMethodEnum.enumValues;
export type DecisionMethod = (typeof DECISION_METHODS)[number];

export const NOTIFICATION_TYPES = notificationTypeEnum.enumValues;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
