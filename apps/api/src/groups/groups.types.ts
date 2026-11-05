import type {
  GroupKind,
  GroupMovieStatus,
  GroupRole,
  MovieStatus,
} from '../database/schema/enums.js';
import type { MovieSummary } from '../movies/movie.types.js';
import type { PersonView } from './user-directory.service.js';

export interface GroupSummary {
  id: string;
  name: string;
  description: string | null;
  kind: GroupKind;
  avatarUrl: string | null;
  archived: boolean;
  myRole: GroupRole;
  memberCount: number;
  movieCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberView extends PersonView {
  role: GroupRole;
  joinedAt: Date;
}

export interface GroupDetails extends GroupSummary {
  members: MemberView[];
}

export interface GroupMovieMemberStatus {
  userId: string;
  displayName: string;
  /** The member's personal status for this movie (`null` = not in their catalog). */
  status: MovieStatus | null;
}

export interface GroupMovieView {
  movie: MovieSummary & { runtime: number | null };
  status: GroupMovieStatus;
  watchedOn: string | null;
  note: string | null;
  addedBy: PersonView | null;
  addedAt: Date;
  groupRating: { average: number | null; count: number; mine: number | null };
  members: GroupMovieMemberStatus[];
}

export interface GroupRatingView {
  user: PersonView;
  rating: number;
  review: string | null;
  containsSpoilers: boolean;
  updatedAt: Date;
}

export interface GroupMovieDetails extends GroupMovieView {
  ratings: GroupRatingView[];
  commentCount: number;
}
