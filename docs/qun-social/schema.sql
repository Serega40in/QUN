-- QUN Social initial schema
-- Apply only after reviewing against the current Supabase schema.
-- Project: qdxjltqlnphvzafapncm
create extension if not exists pgcrypto;

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 10000),
  media_url text,
  media_type text check (media_type in ('image','video') or media_type is null),
  visibility text not null default 'public' check (visibility in ('public','followers','private')),
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_posts_public_created_idx on public.social_posts (created_at desc) where visibility = 'public';
create index if not exists social_posts_user_created_idx on public.social_posts (user_id, created_at desc);

create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text,
  cover_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists social_comments_post_created_idx on public.social_comments(post_id, created_at);

create table if not exists public.social_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);

create table if not exists public.social_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id,following_id),
  check(follower_id <> following_id)
);

alter table public.social_posts enable row level security;
alter table public.social_profiles enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_likes enable row level security;
alter table public.social_follows enable row level security;

drop policy if exists "public posts readable" on public.social_posts;
create policy "public posts readable" on public.social_posts for select to anon, authenticated using (visibility='public' or user_id=auth.uid());
drop policy if exists "users create own posts" on public.social_posts;
create policy "users create own posts" on public.social_posts for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "users edit own posts" on public.social_posts;
create policy "users edit own posts" on public.social_posts for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
drop policy if exists "users delete own posts" on public.social_posts;
create policy "users delete own posts" on public.social_posts for delete to authenticated using (user_id=auth.uid());

drop policy if exists "profiles readable" on public.social_profiles;
create policy "profiles readable" on public.social_profiles for select to anon, authenticated using (true);
drop policy if exists "users insert own profile" on public.social_profiles;
create policy "users insert own profile" on public.social_profiles for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "users update own profile" on public.social_profiles;
create policy "users update own profile" on public.social_profiles for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists "comments readable on public posts" on public.social_comments;
create policy "comments readable on public posts" on public.social_comments for select to anon, authenticated using (exists(select 1 from public.social_posts p where p.id=post_id and (p.visibility='public' or p.user_id=auth.uid())));
drop policy if exists "authenticated users comment" on public.social_comments;
create policy "authenticated users comment" on public.social_comments for insert to authenticated with check (user_id=auth.uid() and exists(select 1 from public.social_posts p where p.id=post_id and p.visibility='public'));
drop policy if exists "authors delete own comments" on public.social_comments;
create policy "authors delete own comments" on public.social_comments for delete to authenticated using (user_id=auth.uid());

drop policy if exists "likes readable" on public.social_likes;
create policy "likes readable" on public.social_likes for select to anon, authenticated using (true);
drop policy if exists "users like as themselves" on public.social_likes;
create policy "users like as themselves" on public.social_likes for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "users remove own likes" on public.social_likes;
create policy "users remove own likes" on public.social_likes for delete to authenticated using (user_id=auth.uid());

drop policy if exists "follows readable" on public.social_follows;
create policy "follows readable" on public.social_follows for select to authenticated using (true);
drop policy if exists "users follow as themselves" on public.social_follows;
create policy "users follow as themselves" on public.social_follows for insert to authenticated with check (follower_id=auth.uid());
drop policy if exists "users unfollow as themselves" on public.social_follows;
create policy "users unfollow as themselves" on public.social_follows for delete to authenticated using (follower_id=auth.uid());

-- Create a private-by-default media bucket in Supabase Storage named qun-social-media.
-- Use a separate reviewed Storage policy migration for uploads; do not make the bucket public until
-- the team explicitly decides how public profile media should be served.
