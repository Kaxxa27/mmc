/** Shapes of the NestJS API responses (mirrors apps/api). Dates arrive as ISO strings. */

export type MovieStatus = 'want_to_watch' | 'watching' | 'watched' | 'not_interested';
export type GroupRole = 'owner' | 'admin' | 'member';
export type GroupKind = 'family' | 'friends' | 'couple' | 'other';
export type CollectionVisibility = 'private' | 'shared' | 'public';
export type GroupMovieStatus = 'want_to_watch' | 'watched';
export type MovieNightStatus = 'planning' | 'voting' | 'decided' | 'completed' | 'cancelled';
export type DataSource = 'tmdb' | 'local';
export type NotificationType =
  | 'group_invitation'
  | 'group_member_joined'
  | 'group_movie_added'
  | 'group_movie_rated'
  | 'comment_mention'
  | 'movie_night_scheduled'
  | 'movie_night_voting_started'
  | 'movie_night_decided'
  | 'watchlist_release_upcoming'
  | 'security_new_sign_in'
  | 'group_role_changed';

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  code: string;
  message: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GenreRef {
  id: number;
  name: string;
}

export interface UserMovieState {
  status: MovieStatus | null;
  isFavorite: boolean;
  rating: number | null;
  lastWatchedOn: string | null;
}

export interface MovieSummary {
  tmdbId: number;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  genres: GenreRef[];
  posterPath: string | null;
  posterUrl: string | null;
  backdropPath: string | null;
  backdropUrl: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  popularity: number | null;
  /** Present for signed-in users; `null` when the movie is not in their catalog. */
  userState?: UserMovieState | null;
}

export interface MovieWithRuntime extends MovieSummary {
  runtime: number | null;
}

export interface MovieListResult {
  items: MovieSummary[];
  page: number;
  totalPages: number;
  totalResults: number;
  source: DataSource;
}

export interface PersonRef {
  tmdbId: number;
  name: string;
  profileUrl: string | null;
}

export interface CastMember extends PersonRef {
  character: string | null;
  order: number;
}

export interface CrewMember extends PersonRef {
  job: string;
}

export interface MovieCrew {
  directors: CrewMember[];
  writers: CrewMember[];
  producers: CrewMember[];
  cinematographers: CrewMember[];
  composers: CrewMember[];
  editors: CrewMember[];
}

export interface MovieVideo {
  key: string;
  name: string;
  type: string;
  site: 'YouTube';
  official: boolean;
  url: string;
  embedUrl: string;
  publishedAt: string | null;
}

export interface WatchProvider {
  providerId: number;
  name: string;
  logoUrl: string | null;
}

export interface WatchAvailability {
  region: string;
  link: string | null;
  subscription: WatchProvider[];
  free: WatchProvider[];
  ads: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
  attribution: string;
  checkedAt: string;
}

export interface MovieDetails extends MovieSummary {
  imdbId: string | null;
  tagline: string | null;
  runtime: number | null;
  releaseStatus: string | null;
  originalLanguage: string | null;
  productionCountries: { code: string; name: string }[];
  spokenLanguages: { code: string; name: string }[];
  certification: string | null;
  certifications: Record<string, string>;
  alternativeTitles: string[];
  cast: CastMember[];
  crew: MovieCrew;
  videos: MovieVideo[];
  similar: MovieSummary[];
  recommendations: MovieSummary[];
  watchProviders: WatchAvailability | null;
  source: DataSource;
}

export interface PersonSummary extends PersonRef {
  knownForDepartment: string | null;
  knownFor: string[];
}

export interface PersonMovieCredit extends MovieSummary {
  character?: string | null;
  job?: string;
}

export interface PersonDetails extends PersonSummary {
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  alsoKnownAs: string[];
  acting: PersonMovieCredit[];
  directing: PersonMovieCredit[];
  writing: PersonMovieCredit[];
  producing: PersonMovieCredit[];
}

export interface PeopleSearchResult {
  items: PersonSummary[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export interface CombinedSearchResult {
  movies: MovieListResult;
  people: PersonSummary[];
}

export interface ProfileView {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  language: string;
  region: string;
  favoriteGenres: GenreRef[];
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryEntry {
  movie: MovieWithRuntime;
  status: MovieStatus | null;
  isFavorite: boolean;
  rating: number | null;
  notes: string | null;
  lastWatchedOn: string | null;
  watchCount: number;
  addedAt: string;
  updatedAt: string;
}

export interface WatchEventView {
  id: string;
  movie: MovieWithRuntime;
  watchedOn: string;
  rating: number | null;
  notes: string | null;
  isRewatch: boolean;
  movieNightId: string | null;
  createdAt: string;
}

export interface DefaultList {
  key: 'watchlist' | 'watching' | 'watched' | 'favorites' | 'highest_rated' | 'recently_added';
  name: string;
  count: number;
  query: Record<string, string>;
  preview: MovieWithRuntime[];
}

export interface LibraryStats {
  totals: {
    inCatalog: number;
    watched: number;
    wantToWatch: number;
    watching: number;
    notInterested: number;
    favorites: number;
    rated: number;
    reviews: number;
    viewings: number;
  };
  averageRating: number | null;
  totalWatchTimeMinutes: number;
  topGenres: { id: number; name: string; count: number }[];
  viewingsByMonth: { month: string; count: number }[];
  mostActiveMonths: { month: string; count: number }[];
}

export interface ReviewView {
  id: string;
  movie: MovieSummary;
  body: string;
  rating: number | null;
  containsSpoilers: boolean;
  isPublic: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicReviewView {
  id: string;
  author: { username: string | null; displayName: string; avatarUrl: string | null };
  body: string;
  rating: number | null;
  containsSpoilers: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

export interface PersonView {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  username?: string | null;
}

export interface CollectionPermissions {
  canEdit: boolean;
  canManage: boolean;
}

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  visibility: CollectionVisibility;
  group: { id: string; name: string } | null;
  owner: PersonView;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  permissions: CollectionPermissions;
}

export interface CollectionItemView {
  movie: MovieWithRuntime;
  note: string | null;
  position: number;
  addedAt: string;
  addedBy: PersonView | null;
}

export interface CollectionDetails extends CollectionSummary {
  items: CollectionItemView[];
}

export interface CollectionShareView {
  id: string;
  group: { id: string; name: string } | null;
  user: PersonView | null;
  createdAt: string;
}

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
  createdAt: string;
  updatedAt: string;
}

export interface MemberView extends PersonView {
  role: GroupRole;
  joinedAt: string;
}

export interface GroupDetails extends GroupSummary {
  members: MemberView[];
}

export interface GroupMovieMemberStatus {
  userId: string;
  displayName: string;
  status: MovieStatus | null;
}

export interface GroupMovieView {
  movie: MovieWithRuntime;
  status: GroupMovieStatus;
  watchedOn: string | null;
  note: string | null;
  addedBy: PersonView | null;
  addedAt: string;
  groupRating: { average: number | null; count: number; mine: number | null };
  members: GroupMovieMemberStatus[];
}

export interface GroupRatingView {
  user: PersonView;
  rating: number;
  review: string | null;
  containsSpoilers: boolean;
  updatedAt: string;
}

export interface GroupMovieDetails extends GroupMovieView {
  ratings: GroupRatingView[];
  commentCount: number;
}

export interface CommentView {
  id: string;
  author: PersonView;
  body: string;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export type InvitationStatus =
  'pending' | 'accepted' | 'declined' | 'revoked' | 'expired' | 'exhausted';

export interface InvitationView {
  id: string;
  kind: 'email' | 'link';
  email: string | null;
  role: GroupRole;
  status: InvitationStatus;
  expiresAt: string;
  maxUses: number | null;
  useCount: number;
  invitedBy: PersonView | null;
  createdAt: string;
}

export interface CreatedLinkInvitation extends InvitationView {
  token: string;
  url: string;
}

export interface InvitationGroupView {
  id: string;
  name: string;
  kind: GroupKind;
  avatarUrl: string | null;
  memberCount: number;
}

export interface InvitationPreview {
  kind: 'email' | 'link';
  status: InvitationStatus;
  role: GroupRole;
  expiresAt: string;
  group: InvitationGroupView;
  invitedBy: { displayName: string } | null;
  emailHint: string | null;
}

export interface MyInvitationView {
  id: string;
  role: GroupRole;
  expiresAt: string;
  group: InvitationGroupView;
  invitedBy: PersonView | null;
}

export interface AcceptInvitationResult {
  groupId: string;
  joined: boolean;
}

export type WatchedFilter = 'any' | 'all' | 'none';

export interface MovieNightCriteria {
  genreIds?: number[];
  minRating?: number;
  maxRuntime?: number;
  maxCertification?: string;
  certificationCountry?: string;
  excludeWatchedBy?: WatchedFilter;
  includeParticipantWatchlists?: boolean;
}

export interface MovieNightSummary {
  id: string;
  group: { id: string; name: string };
  title: string;
  description: string | null;
  scheduledAt: string | null;
  status: MovieNightStatus;
  decisionMethod: 'vote' | 'random' | 'manual' | null;
  selectedMovie: MovieWithRuntime | null;
  participantCount: number;
  candidateCount: number;
  createdBy: PersonView | null;
  createdAt: string;
}

export interface CandidateView {
  movie: MovieWithRuntime;
  votes: number;
  voters: PersonView[] | null;
  addedBy: PersonView | null;
}

export interface MovieNightDetails extends MovieNightSummary {
  criteria: MovieNightCriteria;
  participants: PersonView[];
  candidates: CandidateView[];
  votesCast: number;
  myVoteTmdbId: number | null;
  votingStartedAt: string | null;
  decidedAt: string | null;
  decidedBy: PersonView | null;
  completedAt: string | null;
  cancelledAt: string | null;
  finalRatings: { average: number | null; ratings: { user: PersonView; rating: number }[] } | null;
  permissions: {
    canManage: boolean;
    canVote: boolean;
    canAddCandidates: boolean;
    isParticipant: boolean;
  };
}

export interface SuggestionView {
  movie: MovieWithRuntime;
  score: number;
  reasons: string[];
  wantedBy: number;
  watchedBy: number;
  inGroupWatchlist: boolean;
}

export interface NotificationView {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList extends Paginated<NotificationView> {
  unreadCount: number;
}

export interface NotificationPreference {
  type: NotificationType;
  inApp: boolean;
  email: boolean;
}

export interface HomeSection {
  key: string;
  title: string;
  movies: MovieSummary[];
}

export interface HomeMovieNight {
  id: string;
  title: string;
  scheduledAt: string | null;
  status: MovieNightStatus;
  group: { id: string; name: string };
  selectedMovie: MovieSummary | null;
}

export interface HomeView {
  welcome: { displayName: string } | null;
  sections: HomeSection[];
  recentlyAdded: LibraryEntry[] | null;
  watchlist: LibraryEntry[] | null;
  upcomingMovieNights: HomeMovieNight[] | null;
  groupActivity:
    | { type: NotificationType; title: string; data: Record<string, unknown>; createdAt: string }[]
    | null;
}

export interface RecommendationSection {
  key: string;
  title: string;
  basedOn?: MovieSummary;
  movies: MovieSummary[];
}

export type CalendarEvent =
  | {
      type: 'viewing';
      date: string;
      id: string;
      movie: MovieSummary;
      rating: number | null;
      isRewatch: boolean;
      movieNightId: string | null;
    }
  | {
      type: 'movie_night';
      date: string;
      startsAt: string;
      id: string;
      title: string;
      status: MovieNightStatus;
      group: { id: string; name: string };
      selectedMovie: MovieSummary | null;
      isParticipant: boolean;
    }
  | { type: 'release'; date: string; movie: MovieSummary }
  | {
      type: 'watched_together';
      date: string;
      group: { id: string; name: string };
      movie: MovieSummary;
    };

export interface CalendarView {
  from: string;
  to: string;
  events: CalendarEvent[];
}

/** What the BFF returns after a sign-in (tokens stay in httpOnly cookies). */
export interface SessionInfo {
  user: { id: string; email: string };
  needsOnboarding: boolean;
  expiresAt: number;
}

export interface OtpRequestResult {
  email: string;
  codeLength: number;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
}

export interface ActiveSession {
  id: string;
  current: boolean;
  device: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string;
}

export interface AppConfigView {
  movieData: {
    provider: string;
    mode: 'live' | 'mock' | 'offline';
    attribution: string;
    attributionUrl: string;
    imageBaseUrl: string;
  };
  defaults: { language: string; region: string };
  features: { devTools: boolean; demoAccounts?: boolean };
  certificationScales: Record<string, string[]>;
}

export interface DemoWorld {
  users: { name: string; email: string; userId: string; expiresAt: number }[];
  groupId: string;
  movieNightId: string | null;
  collectionId: string | null;
  tryNext: string[];
}
