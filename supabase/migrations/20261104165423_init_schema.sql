CREATE TYPE "public"."collection_visibility" AS ENUM('private', 'shared', 'public');--> statement-breakpoint
CREATE TYPE "public"."decision_method" AS ENUM('vote', 'random', 'manual');--> statement-breakpoint
CREATE TYPE "public"."group_kind" AS ENUM('family', 'friends', 'couple', 'other');--> statement-breakpoint
CREATE TYPE "public"."group_movie_status" AS ENUM('want_to_watch', 'watched');--> statement-breakpoint
CREATE TYPE "public"."group_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TYPE "public"."invitation_kind" AS ENUM('email', 'link');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."movie_night_status" AS ENUM('planning', 'voting', 'decided', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."movie_status" AS ENUM('want_to_watch', 'watching', 'watched', 'not_interested');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('group_invitation', 'group_member_joined', 'group_movie_added', 'group_movie_rated', 'comment_mention', 'movie_night_scheduled', 'movie_night_voting_started', 'movie_night_decided', 'watchlist_release_upcoming', 'security_new_sign_in');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"username" text,
	"first_name" text,
	"last_name" text,
	"bio" text,
	"avatar_url" text,
	"language" text DEFAULT 'en-US' NOT NULL,
	"region" text DEFAULT 'US' NOT NULL,
	"favorite_genre_ids" integer[] DEFAULT '{}' NOT NULL,
	"notification_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_format" CHECK (username ~ '^[a-z0-9_]{3,30}$'),
	CONSTRAINT "profiles_first_name_length" CHECK (char_length(first_name) <= 60),
	CONSTRAINT "profiles_last_name_length" CHECK (char_length(last_name) <= 60),
	CONSTRAINT "profiles_bio_length" CHECK (char_length(bio) <= 500)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "genres" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "genres" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movie_views" (
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"view_count" integer DEFAULT 1 NOT NULL,
	"last_viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movie_views_user_id_movie_id_pk" PRIMARY KEY("user_id","movie_id")
);
--> statement-breakpoint
ALTER TABLE "movie_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tmdb_id" integer NOT NULL,
	"imdb_id" text,
	"title" text NOT NULL,
	"original_title" text,
	"original_language" text,
	"overview" text,
	"tagline" text,
	"release_date" date,
	"runtime" integer,
	"release_status" text,
	"poster_path" text,
	"backdrop_path" text,
	"genre_ids" integer[] DEFAULT '{}' NOT NULL,
	"origin_countries" text[] DEFAULT '{}' NOT NULL,
	"popularity" real,
	"vote_average" real,
	"vote_count" integer,
	"adult" boolean DEFAULT false NOT NULL,
	"certifications" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"details_fetched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "movies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tmdb_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tmdb_cache" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"kind" "invitation_kind" NOT NULL,
	"email" text,
	"token_hash" text NOT NULL,
	"role" "group_role" DEFAULT 'member' NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"max_uses" integer,
	"use_count" integer DEFAULT 0 NOT NULL,
	"invited_by" uuid,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_invitations_role_not_owner" CHECK (role <> 'owner'),
	CONSTRAINT "group_invitations_email_kind" CHECK ((kind = 'email') = (email is not null)),
	CONSTRAINT "group_invitations_max_uses_positive" CHECK (max_uses is null or max_uses > 0)
);
--> statement-breakpoint
ALTER TABLE "group_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "group_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "group_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_movie_ratings" (
	"group_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"review" text,
	"contains_spoilers" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_movie_ratings_group_id_movie_id_user_id_pk" PRIMARY KEY("group_id","movie_id","user_id"),
	CONSTRAINT "group_movie_ratings_rating_range" CHECK (rating between 1 and 10),
	CONSTRAINT "group_movie_ratings_review_length" CHECK (char_length(review) <= 5000)
);
--> statement-breakpoint
ALTER TABLE "group_movie_ratings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "group_movies" (
	"group_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"status" "group_movie_status" DEFAULT 'want_to_watch' NOT NULL,
	"watched_on" date,
	"note" text,
	"added_by" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_movies_group_id_movie_id_pk" PRIMARY KEY("group_id","movie_id"),
	CONSTRAINT "group_movies_note_length" CHECK (char_length(note) <= 1000)
);
--> statement-breakpoint
ALTER TABLE "group_movies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" "group_kind" DEFAULT 'family' NOT NULL,
	"avatar_url" text,
	"owner_id" uuid NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_name_length" CHECK (char_length(name) between 1 and 80),
	CONSTRAINT "groups_description_length" CHECK (char_length(description) <= 500)
);
--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movie_night_candidates" (
	"movie_night_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"added_by" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movie_night_candidates_movie_night_id_movie_id_pk" PRIMARY KEY("movie_night_id","movie_id")
);
--> statement-breakpoint
ALTER TABLE "movie_night_candidates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movie_night_participants" (
	"movie_night_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movie_night_participants_movie_night_id_user_id_pk" PRIMARY KEY("movie_night_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "movie_night_participants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movie_night_votes" (
	"movie_night_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movie_night_votes_movie_night_id_user_id_pk" PRIMARY KEY("movie_night_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "movie_night_votes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "movie_nights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"created_by" uuid,
	"title" text NOT NULL,
	"description" text,
	"scheduled_at" timestamp with time zone,
	"status" "movie_night_status" DEFAULT 'planning' NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"selected_movie_id" uuid,
	"decision_method" "decision_method",
	"decided_at" timestamp with time zone,
	"decided_by" uuid,
	"voting_started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "movie_nights_title_length" CHECK (char_length(title) between 1 and 120),
	CONSTRAINT "movie_nights_description_length" CHECK (char_length(description) <= 1000)
);
--> statement-breakpoint
ALTER TABLE "movie_nights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"body" text NOT NULL,
	"rating" smallint,
	"contains_spoilers" boolean DEFAULT false NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_rating_range" CHECK (rating between 1 and 10),
	CONSTRAINT "reviews_body_length" CHECK (char_length(body) between 1 and 10000)
);
--> statement-breakpoint
ALTER TABLE "reviews" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_movies" (
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"status" "movie_status",
	"is_favorite" boolean DEFAULT false NOT NULL,
	"rating" smallint,
	"notes" text,
	"last_watched_on" date,
	"status_changed_at" timestamp with time zone,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_movies_user_id_movie_id_pk" PRIMARY KEY("user_id","movie_id"),
	CONSTRAINT "user_movies_rating_range" CHECK (rating between 1 and 10),
	CONSTRAINT "user_movies_notes_length" CHECK (char_length(notes) <= 2000)
);
--> statement-breakpoint
ALTER TABLE "user_movies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "watch_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"watched_on" date NOT NULL,
	"rating" smallint,
	"notes" text,
	"is_rewatch" boolean DEFAULT false NOT NULL,
	"movie_night_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_events_rating_range" CHECK (rating between 1 and 10),
	CONSTRAINT "watch_events_notes_length" CHECK (char_length(notes) <= 2000)
);
--> statement-breakpoint
ALTER TABLE "watch_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collection_items" (
	"collection_id" uuid NOT NULL,
	"movie_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"note" text,
	"added_by" uuid,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_collection_id_movie_id_pk" PRIMARY KEY("collection_id","movie_id"),
	CONSTRAINT "collection_items_note_length" CHECK (char_length(note) <= 500)
);
--> statement-breakpoint
ALTER TABLE "collection_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collection_shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"group_id" uuid,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_shares_single_target" CHECK (num_nonnulls(group_id, user_id) = 1)
);
--> statement-breakpoint
ALTER TABLE "collection_shares" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"group_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"cover_image_url" text,
	"visibility" "collection_visibility" DEFAULT 'private' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_name_length" CHECK (char_length(name) between 1 and 100),
	CONSTRAINT "collections_description_length" CHECK (char_length(description) <= 1000)
);
--> statement-breakpoint
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"movie_id" uuid,
	"movie_night_id" uuid,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_body_length" CHECK (char_length(body) between 1 and 2000),
	CONSTRAINT "comments_single_target" CHECK (num_nonnulls(movie_id, movie_night_id) = 1)
);
--> statement-breakpoint
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "auth_otp_state" (
	"email_hash" text PRIMARY KEY NOT NULL,
	"last_sent_at" timestamp with time zone NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_otp_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limit_buckets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_views" ADD CONSTRAINT "movie_views_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_views" ADD CONSTRAINT "movie_views_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_invited_by_profiles_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_invitations" ADD CONSTRAINT "group_invitations_accepted_by_profiles_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_movie_ratings" ADD CONSTRAINT "group_movie_ratings_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_movie_ratings" ADD CONSTRAINT "group_movie_ratings_group_movie_fk" FOREIGN KEY ("group_id","movie_id") REFERENCES "public"."group_movies"("group_id","movie_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_movies" ADD CONSTRAINT "group_movies_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_movies" ADD CONSTRAINT "group_movies_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_movies" ADD CONSTRAINT "group_movies_added_by_profiles_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_night_candidates" ADD CONSTRAINT "movie_night_candidates_movie_night_id_movie_nights_id_fk" FOREIGN KEY ("movie_night_id") REFERENCES "public"."movie_nights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_night_candidates" ADD CONSTRAINT "movie_night_candidates_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_night_candidates" ADD CONSTRAINT "movie_night_candidates_added_by_profiles_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_night_participants" ADD CONSTRAINT "movie_night_participants_movie_night_id_movie_nights_id_fk" FOREIGN KEY ("movie_night_id") REFERENCES "public"."movie_nights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_night_participants" ADD CONSTRAINT "movie_night_participants_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_night_votes" ADD CONSTRAINT "movie_night_votes_candidate_fk" FOREIGN KEY ("movie_night_id","movie_id") REFERENCES "public"."movie_night_candidates"("movie_night_id","movie_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_night_votes" ADD CONSTRAINT "movie_night_votes_participant_fk" FOREIGN KEY ("movie_night_id","user_id") REFERENCES "public"."movie_night_participants"("movie_night_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_nights" ADD CONSTRAINT "movie_nights_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_nights" ADD CONSTRAINT "movie_nights_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_nights" ADD CONSTRAINT "movie_nights_selected_movie_id_movies_id_fk" FOREIGN KEY ("selected_movie_id") REFERENCES "public"."movies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movie_nights" ADD CONSTRAINT "movie_nights_decided_by_profiles_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movies" ADD CONSTRAINT "user_movies_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_movies" ADD CONSTRAINT "user_movies_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_events" ADD CONSTRAINT "watch_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_events" ADD CONSTRAINT "watch_events_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_events" ADD CONSTRAINT "watch_events_movie_night_id_movie_nights_id_fk" FOREIGN KEY ("movie_night_id") REFERENCES "public"."movie_nights"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_added_by_profiles_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_shares" ADD CONSTRAINT "collection_shares_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_shares" ADD CONSTRAINT "collection_shares_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_shares" ADD CONSTRAINT "collection_shares_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_movie_night_id_movie_nights_id_fk" FOREIGN KEY ("movie_night_id") REFERENCES "public"."movie_nights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_key" ON "profiles" USING btree ("username");--> statement-breakpoint
CREATE INDEX "profiles_email_idx" ON "profiles" USING btree ("email");--> statement-breakpoint
CREATE INDEX "movie_views_user_recent_idx" ON "movie_views" USING btree ("user_id","last_viewed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "movies_tmdb_id_key" ON "movies" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "movies_genre_ids_idx" ON "movies" USING gin ("genre_ids");--> statement-breakpoint
CREATE INDEX "movies_release_date_idx" ON "movies" USING btree ("release_date");--> statement-breakpoint
CREATE INDEX "tmdb_cache_expires_at_idx" ON "tmdb_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "group_invitations_token_hash_key" ON "group_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "group_invitations_group_idx" ON "group_invitations" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_invitations_pending_email_idx" ON "group_invitations" USING btree ("email") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "group_members_user_idx" ON "group_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_members_single_owner_key" ON "group_members" USING btree ("group_id") WHERE role = 'owner';--> statement-breakpoint
CREATE INDEX "group_movies_group_status_idx" ON "group_movies" USING btree ("group_id","status");--> statement-breakpoint
CREATE INDEX "groups_owner_idx" ON "groups" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "movie_night_participants_user_idx" ON "movie_night_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "movie_nights_group_schedule_idx" ON "movie_nights" USING btree ("group_id","scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reviews_user_movie_key" ON "reviews" USING btree ("user_id","movie_id");--> statement-breakpoint
CREATE INDEX "reviews_public_movie_idx" ON "reviews" USING btree ("movie_id","published_at") WHERE is_public;--> statement-breakpoint
CREATE INDEX "user_movies_user_status_idx" ON "user_movies" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_movies_user_added_idx" ON "user_movies" USING btree ("user_id","added_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_movies_movie_idx" ON "user_movies" USING btree ("movie_id");--> statement-breakpoint
CREATE INDEX "watch_events_user_date_idx" ON "watch_events" USING btree ("user_id","watched_on" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "watch_events_user_movie_idx" ON "watch_events" USING btree ("user_id","movie_id");--> statement-breakpoint
CREATE INDEX "collection_items_position_idx" ON "collection_items" USING btree ("collection_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_shares_group_key" ON "collection_shares" USING btree ("collection_id","group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_shares_user_key" ON "collection_shares" USING btree ("collection_id","user_id");--> statement-breakpoint
CREATE INDEX "collection_shares_group_idx" ON "collection_shares" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "collection_shares_user_idx" ON "collection_shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "collections_owner_idx" ON "collections" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "collections_group_idx" ON "collections" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "comments_group_movie_idx" ON "comments" USING btree ("group_id","movie_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_movie_night_idx" ON "comments" USING btree ("movie_night_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id") WHERE read_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_dedupe_key" ON "notifications" USING btree ("user_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_window_idx" ON "rate_limit_buckets" USING btree ("window_started_at");