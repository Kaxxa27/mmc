-- Custom migration (not generated from the Drizzle schema): extensions, internal helper
-- functions, triggers, search indexes, Data API lock-down and reference data.

-- 1. Extensions --------------------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;

-- 2. Private schema for internal functions (never exposed through the Data API) ----------------
create schema if not exists private;
revoke all on schema private from public;

-- 3. updated_at maintenance --------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Attach the trigger to every public table that has an updated_at column.
-- Tables added by later migrations must create their own trigger.
do $$
declare
  t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I '
      'for each row execute function private.set_updated_at()',
      t.table_name
    );
  end loop;
end;
$$;

-- 4. Profiles follow Supabase Auth users -------------------------------------------------------
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, lower(coalesce(new.email, '')))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = lower(new.email) where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.handle_auth_user_email_change();

-- 5. Fuzzy title search for the offline / cached catalog ----------------------------------------
create index movies_title_trgm_idx
  on public.movies using gin (title extensions.gin_trgm_ops);
create index movies_original_title_trgm_idx
  on public.movies using gin (original_title extensions.gin_trgm_ops);

-- 6. Data API lock-down ------------------------------------------------------------------------
-- The NestJS API connects as the database owner and is the only way to reach application data.
-- Row level security is enabled on every table (without policies) and the public Data API roles
-- receive no privileges, so the anon/authenticated keys cannot read or change anything here.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- 7. Reference data: TMDB movie genres ---------------------------------------------------------
insert into public.genres (id, name) values
  (28, 'Action'),
  (12, 'Adventure'),
  (16, 'Animation'),
  (35, 'Comedy'),
  (80, 'Crime'),
  (99, 'Documentary'),
  (18, 'Drama'),
  (10751, 'Family'),
  (14, 'Fantasy'),
  (36, 'History'),
  (27, 'Horror'),
  (10402, 'Music'),
  (9648, 'Mystery'),
  (10749, 'Romance'),
  (878, 'Science Fiction'),
  (10770, 'TV Movie'),
  (53, 'Thriller'),
  (10752, 'War'),
  (37, 'Western')
on conflict (id) do update set name = excluded.name;
