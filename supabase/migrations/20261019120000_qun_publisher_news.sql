create extension if not exists pgcrypto;

create table if not exists public.qun_publisher_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,32}$'),
  display_name text not null default '',
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists qun_publisher_profiles_username_idx on public.qun_publisher_profiles (username);

create table if not exists public.qun_articles (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,100}$'),
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 300),
  body_html text not null default '',
  cover_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  tags text[] not null default '{}',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  view_count bigint not null default 0 check (view_count >= 0)
);
create index if not exists qun_articles_public_feed_idx on public.qun_articles (published_at desc) where status = 'published';
create index if not exists qun_articles_author_idx on public.qun_articles (author_id, updated_at desc);
create index if not exists qun_articles_search_idx on public.qun_articles using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || regexp_replace(coalesce(body_html,''), '<[^>]+>', ' ', 'g')));

alter table public.qun_publisher_profiles enable row level security;
alter table public.qun_articles enable row level security;
drop policy if exists "Public can read publisher profiles" on public.qun_publisher_profiles;
create policy "Public can read publisher profiles" on public.qun_publisher_profiles for select to anon, authenticated using (true);
drop policy if exists "Users create own publisher profile" on public.qun_publisher_profiles;
create policy "Users create own publisher profile" on public.qun_publisher_profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Users update own publisher profile" on public.qun_publisher_profiles;
create policy "Users update own publisher profile" on public.qun_publisher_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "Published articles are public" on public.qun_articles;
create policy "Published articles are public" on public.qun_articles for select to anon, authenticated using (status = 'published' or (select auth.uid()) = author_id);
drop policy if exists "Authors create own articles" on public.qun_articles;
create policy "Authors create own articles" on public.qun_articles for insert to authenticated with check ((select auth.uid()) = author_id);
drop policy if exists "Authors update own articles" on public.qun_articles;
create policy "Authors update own articles" on public.qun_articles for update to authenticated using ((select auth.uid()) = author_id) with check ((select auth.uid()) = author_id);
drop policy if exists "Authors delete own articles" on public.qun_articles;
create policy "Authors delete own articles" on public.qun_articles for delete to authenticated using ((select auth.uid()) = author_id);
grant select on public.qun_publisher_profiles, public.qun_articles to anon, authenticated;
grant insert, update, delete on public.qun_publisher_profiles, public.qun_articles to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('qun-publisher-media','qun-publisher-media',true,104857600,array['image/jpeg','image/png','image/webp','image/gif','image/avif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public=true,file_size_limit=104857600,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Public can view QUN Publisher media" on storage.objects;
create policy "Public can view QUN Publisher media" on storage.objects for select to anon, authenticated using (bucket_id='qun-publisher-media');
drop policy if exists "Authenticated users upload QUN Publisher media" on storage.objects;
create policy "Authenticated users upload QUN Publisher media" on storage.objects for insert to authenticated with check (bucket_id='qun-publisher-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users update own QUN Publisher media" on storage.objects;
create policy "Users update own QUN Publisher media" on storage.objects for update to authenticated using (bucket_id='qun-publisher-media' and (storage.foldername(name))[1]=(select auth.uid())::text) with check (bucket_id='qun-publisher-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "Users delete own QUN Publisher media" on storage.objects;
create policy "Users delete own QUN Publisher media" on storage.objects for delete to authenticated using (bucket_id='qun-publisher-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
