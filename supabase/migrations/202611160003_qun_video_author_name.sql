-- Add creator display names for QUN Video uploads.
-- Idempotent so it can safely be applied to the existing project or a fresh schema.
alter table public.qun_video_videos
  add column if not exists author_name text not null default 'Автор QUN'
  check (char_length(author_name) between 1 and 80);
