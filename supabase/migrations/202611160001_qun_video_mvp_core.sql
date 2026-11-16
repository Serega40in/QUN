-- QUN Video MVP core schema. Applied to Supabase project qdxjltqlnphvzafapncm.
create table if not exists public.qun_video_videos (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(title) between 1 and 120),
 description text not null default '' check (char_length(description) <= 5000),
 category text not null default 'Другое' check (char_length(category) <= 40),
 object_path text not null unique,
 thumbnail_url text,
 duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
 status text not null default 'published' check (status in ('draft','published','unlisted')),
 views_count bigint not null default 0 check (views_count >= 0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 author_name text not null default 'Автор QUN' check (char_length(author_name) between 1 and 80)
);
create index if not exists qun_video_videos_feed_idx on public.qun_video_videos(status, created_at desc);
create index if not exists qun_video_videos_owner_idx on public.qun_video_videos(user_id, created_at desc);
create table if not exists public.qun_video_comments (
 id uuid primary key default gen_random_uuid(),
 video_id uuid not null references public.qun_video_videos(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 content text not null check (char_length(content) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists qun_video_comments_feed_idx on public.qun_video_comments(video_id, created_at desc);
create table if not exists public.qun_video_likes (
 video_id uuid not null references public.qun_video_videos(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(video_id,user_id)
);
create table if not exists public.qun_video_subscriptions (
 creator_id uuid not null references auth.users(id) on delete cascade,
 subscriber_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(creator_id,subscriber_id),
 check (creator_id <> subscriber_id)
);
alter table public.qun_video_videos enable row level security;
alter table public.qun_video_comments enable row level security;
alter table public.qun_video_likes enable row level security;
alter table public.qun_video_subscriptions enable row level security;
drop policy if exists "Public can view published QUN videos" on public.qun_video_videos;
create policy "Public can view published QUN videos" on public.qun_video_videos for select to anon, authenticated using (status in ('published','unlisted') or (select auth.uid()) = user_id);
drop policy if exists "Creators can upload QUN videos" on public.qun_video_videos;
create policy "Creators can upload QUN videos" on public.qun_video_videos for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Creators can update own QUN videos" on public.qun_video_videos;
create policy "Creators can update own QUN videos" on public.qun_video_videos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Creators can delete own QUN videos" on public.qun_video_videos;
create policy "Creators can delete own QUN videos" on public.qun_video_videos for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Comments visible for public videos" on public.qun_video_comments;
create policy "Comments visible for public videos" on public.qun_video_comments for select to anon, authenticated using (exists (select 1 from public.qun_video_videos v where v.id = video_id and (v.status in ('published','unlisted') or v.user_id = (select auth.uid()))));
drop policy if exists "Signed-in viewers can comment" on public.qun_video_comments;
create policy "Signed-in viewers can comment" on public.qun_video_comments for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from public.qun_video_videos v where v.id = video_id and v.status in ('published','unlisted')));
drop policy if exists "Users can delete own comments" on public.qun_video_comments;
create policy "Users can delete own comments" on public.qun_video_comments for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Likes are publicly readable" on public.qun_video_likes;
create policy "Likes are publicly readable" on public.qun_video_likes for select to anon, authenticated using (true);
drop policy if exists "Users can like as themselves" on public.qun_video_likes;
create policy "Users can like as themselves" on public.qun_video_likes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can remove own likes" on public.qun_video_likes;
create policy "Users can remove own likes" on public.qun_video_likes for delete to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Subscriptions are publicly readable" on public.qun_video_subscriptions;
create policy "Subscriptions are publicly readable" on public.qun_video_subscriptions for select to anon, authenticated using (true);
drop policy if exists "Users can subscribe as themselves" on public.qun_video_subscriptions;
create policy "Users can subscribe as themselves" on public.qun_video_subscriptions for insert to authenticated with check ((select auth.uid()) = subscriber_id);
drop policy if exists "Users can cancel own subscriptions" on public.qun_video_subscriptions;
create policy "Users can cancel own subscriptions" on public.qun_video_subscriptions for delete to authenticated using ((select auth.uid()) = subscriber_id);
grant select on public.qun_video_videos, public.qun_video_comments, public.qun_video_likes, public.qun_video_subscriptions to anon, authenticated;
grant insert, update, delete on public.qun_video_videos to authenticated;
grant insert, delete on public.qun_video_comments, public.qun_video_likes, public.qun_video_subscriptions to authenticated;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('qun-video','qun-video',true,52428800,array['video/mp4','video/webm','video/quicktime','video/ogg'])
on conflict (id) do update set public=true,file_size_limit=52428800,allowed_mime_types=array['video/mp4','video/webm','video/quicktime','video/ogg'];
drop policy if exists "Public can read published QUN video files" on storage.objects;
create policy "Public can read published QUN video files" on storage.objects for select to anon, authenticated using (bucket_id='qun-video');
drop policy if exists "Users upload QUN video files to own folder" on storage.objects;
create policy "Users upload QUN video files to own folder" on storage.objects for insert to authenticated with check (bucket_id='qun-video' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users update own QUN video files" on storage.objects;
create policy "Users update own QUN video files" on storage.objects for update to authenticated using (bucket_id='qun-video' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='qun-video' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users delete own QUN video files" on storage.objects;
create policy "Users delete own QUN video files" on storage.objects for delete to authenticated using (bucket_id='qun-video' and (storage.foldername(name))[1]=(select auth.uid())::text);
