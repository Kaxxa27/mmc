import type { CollectionVisibility } from '../database/schema/enums.js';
import type { MovieSummary } from '../movies/movie.types.js';

export interface PersonView {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface CollectionPermissions {
  /** Add, remove and reorder movies. */
  canEdit: boolean;
  /** Rename, change visibility, share and delete. */
  canManage: boolean;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  /** Explicit cover, or the poster of the first movie. */
  coverImageUrl: string | null;
  visibility: CollectionVisibility;
  group: { id: string; name: string } | null;
  owner: PersonView;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
  permissions: CollectionPermissions;
}

export interface CollectionItemView {
  movie: MovieSummary & { runtime: number | null };
  note: string | null;
  position: number;
  addedAt: Date;
  addedBy: PersonView | null;
}

export interface CollectionDetails extends CollectionSummary {
  items: CollectionItemView[];
}

export interface CollectionShareView {
  id: string;
  group: { id: string; name: string } | null;
  user: PersonView | null;
  createdAt: Date;
}
