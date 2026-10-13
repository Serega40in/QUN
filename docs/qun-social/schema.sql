-- QUN Social schema snapshot / repeatable setup
-- Production schema is already applied to Supabase project qdxjltqlnphvzafapncm.
-- Review before applying to any other environment. Public media URLs are intentional for public posts.

create extension if not exists pgcrypto;
create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text unique, display_name text not null default '',
  bio text not null default '' check(char_length(bio)<=500),
  avatar_url text, cover_url text, updated_at timestamptz not null default now()
);
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '' check(char_length(content)<=10000),
  media_url text, media_urls jsonb not null default '[]'::jsonb,
  media_type text check(media_type in ('image','video') or media_type is null),
  visibility text not null default 'public' check(visibility in ('public','followers','private')),
  like_count integer not null default 0 check(like_count>=0),
  comment_count integer not null default 0 check(comment_count>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.social_posts add column if not exists media_urls jsonb not null default '[]'::jsonb;
create index if not exists social_posts_public_created_idx on public.social_posts(created_at desc) where visibility='public';
create index if not exists social_posts_user_created_idx on public.social_posts(user_id,created_at desc);
create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check(char_length(content) between 1 and 3000),
  created_at timestamptz not null default now()
);
create index if not exists social_comments_post_created_idx on public.social_comments(post_id,created_at);
create table if not exists public.social_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(post_id,user_id)
);
create table if not exists public.social_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(follower_id,following_id),
  check(follower_id<>following_id)
);
create table if not exists public.social_stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_url text not null,
  media_type text not null check(media_type in ('image','video')),
  caption text not null default '' check(char_length(caption)<=500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists social_stories_active_idx on public.social_stories(expires_at desc,created_at desc);
create index if not exists social_stories_user_active_idx on public.social_stories(user_id,expires_at desc);

alter table public.social_profiles enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_likes enable row level security;
alter table public.social_follows enable row level security;
alter table public.social_stories enable row level security;
grant select on public.social_profiles,public.social_posts,public.social_comments to anon,authenticated;
grant insert,update,delete on public.social_profiles,public.social_posts to authenticated;
grant insert,delete on public.social_comments to authenticated;
grant select,insert,delete on public.social_likes to authenticated;
grant select,insert,delete on public.social_follows to authenticated;
grant select on public.social_stories to anon,authenticated;
grant insert,delete on public.social_stories to authenticated;

drop policy if exists social_profiles_read on public.social_profiles;
create policy social_profiles_read on public.social_profiles for select to anon,authenticated using(true);
drop policy if exists social_profiles_insert_own on public.social_profiles;
create policy social_profiles_insert_own on public.social_profiles for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists social_profiles_update_own on public.social_profiles;
create policy social_profiles_update_own on public.social_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists social_posts_read_public_or_own on public.social_posts;
create policy social_posts_read_public_or_own on public.social_posts for select to anon,authenticated using(visibility='public' or user_id=(select auth.uid()));
drop policy if exists social_posts_insert_own on public.social_posts;
create policy social_posts_insert_own on public.social_posts for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists social_posts_update_own on public.social_posts;
create policy social_posts_update_own on public.social_posts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
drop policy if exists social_posts_delete_own on public.social_posts;
create policy social_posts_delete_own on public.social_posts for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists social_comments_read_public_posts on public.social_comments;
create policy social_comments_read_public_posts on public.social_comments for select to anon,authenticated using(exists(select 1 from public.social_posts p where p.id=post_id and (p.visibility='public' or p.user_id=(select auth.uid()))));
drop policy if exists social_comments_insert_own on public.social_comments;
create policy social_comments_insert_own on public.social_comments for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.social_posts p where p.id=post_id and p.visibility='public'));
drop policy if exists social_comments_delete_own on public.social_comments;
create policy social_comments_delete_own on public.social_comments for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists social_likes_read on public.social_likes;
create policy social_likes_read on public.social_likes for select to anon,authenticated using(true);
drop policy if exists social_likes_insert_own on public.social_likes;
create policy social_likes_insert_own on public.social_likes for insert to authenticated with check(user_id=(select auth.uid()));
drop policy if exists social_likes_delete_own on public.social_likes;
create policy social_likes_delete_own on public.social_likes for delete to authenticated using(user_id=(select auth.uid()));
drop policy if exists social_follows_read on public.social_follows;
create policy social_follows_read on public.social_follows for select to authenticated using(true);
drop policy if exists social_follows_insert_own on public.social_follows;
create policy social_follows_insert_own on public.social_follows for insert to authenticated with check(follower_id=(select auth.uid()));
drop policy if exists social_follows_delete_own on public.social_follows;
create policy social_follows_delete_own on public.social_follows for delete to authenticated using(follower_id=(select auth.uid()));
drop policy if exists social_stories_read_active on public.social_stories;
create policy social_stories_read_active on public.social_stories for select to anon,authenticated using(expires_at>now() or user_id=(select auth.uid()));
drop policy if exists social_stories_insert_own on public.social_stories;
create policy social_stories_insert_own on public.social_stories for insert to authenticated with check(user_id=(select auth.uid()) and expires_at>now() and expires_at<=now()+interval '25 hours');
drop policy if exists social_stories_delete_own on public.social_stories;
create policy social_stories_delete_own on public.social_stories for delete to authenticated using(user_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('qun-social-media','qun-social-media',true,104857600,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict(id) do update set public=true,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists qun_social_media_public_read on storage.objects;
create policy qun_social_media_public_read on storage.objects for select to anon,authenticated using(bucket_id='qun-social-media');
drop policy if exists qun_social_media_upload_own_folder on storage.objects;
create policy qun_social_media_upload_own_folder on storage.objects for insert to authenticated with check(bucket_id='qun-social-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists qun_social_media_update_own_folder on storage.objects;
create policy qun_social_media_update_own_folder on storage.objects for update to authenticated using(bucket_id='qun-social-media' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='qun-social-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists qun_social_media_delete_own_folder on storage.objects;
create policy qun_social_media_delete_own_folder on storage.objects for delete to authenticated using(bucket_id='qun-social-media' and (storage.foldername(name))[1]=(select auth.uid())::text);

create or replace function public.social_refresh_post_counts()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_TABLE_NAME='social_likes' then
    if TG_OP='INSERT' then
      update public.social_posts set like_count=(select count(*) from public.social_likes where post_id=new.post_id) where id=new.post_id; return new;
    else
      update public.social_posts set like_count=(select count(*) from public.social_likes where post_id=old.post_id) where id=old.post_id; return old;
    end if;
  else
    if TG_OP='INSERT' then
      update public.social_posts set comment_count=(select count(*) from public.social_comments where post_id=new.post_id) where id=new.post_id; return new;
    else
      update public.social_posts set comment_count=(select count(*) from public.social_comments where post_id=old.post_id) where id=old.post_id; return old;
    end if;
  end if;
end; $$;
revoke all on function public.social_refresh_post_counts() from public,anon,authenticated;
drop trigger if exists social_likes_count_trigger on public.social_likes;
create trigger social_likes_count_trigger after insert or delete on public.social_likes for each row execute function public.social_refresh_post_counts();
drop trigger if exists social_comments_count_trigger on public.social_comments;
create trigger social_comments_count_trigger after insert or delete on public.social_comments for each row execute function public.social_refresh_post_counts();

-- Seed public social profiles for existing QUN ID accounts without overwriting user edits:
insert into public.social_profiles(user_id,username,display_name,avatar_url)
select id,username,coalesce(display_name,''),avatar_url from public.profiles
on conflict(user_id) do nothing;
