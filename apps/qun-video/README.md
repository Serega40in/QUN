# QUN Video MVP

A mobile-friendly video platform frontend at `apps/qun-video/`, connected to the existing QUN Supabase project.

## Features implemented
- Supabase email/password sign-up, sign-in and sign-out
- Feed of published video records from Supabase, with illustrative demo cards when the feed is empty
- Upload video files to the `qun-video` Storage bucket (50 MiB per file)
- Public playback URLs for supported browser video formats
- Persistent likes, comments and creator subscriptions for uploaded videos
- Local browser-only saved videos, history and demo-card interactions
- Responsive layout, category filters and text search
- Row Level Security on QUN Video database tables and owner-folder upload policies
- No paid service intentionally enabled by this app

## Configuration
The frontend uses the existing QUN Supabase project URL and a **publishable** client key. Publishable keys are intended for browser use; never put a service-role or secret key in frontend code.

Supabase Auth must allow email/password sign-up. If email confirmation is enabled, new users need to confirm their address before signing in. For a custom production domain, add it to Supabase Auth's allowed redirect/site URL configuration.

## Storage and privacy
The `qun-video` bucket is public for playback and currently configured for up to 50 MiB per file, limited to MP4, WebM, QuickTime and Ogg video MIME types. Uploads require authentication and are restricted to the signed-in user's folder. Public video URLs mean anyone with the URL can watch the media; do not upload private or copyrighted content without rights.

The free tier has usage and bandwidth limits, which can change. This is not a transcoding/CDN pipeline; very large audiences may require a different media delivery architecture.

## Known limitations / verification status
- Demo cards on the home feed are illustrative and have no source video.
- No transcoding, generated thumbnails, creator verification, reporting/moderation, resumable uploads, or robust view-count RPC yet.
- Authentication currently uses email/password; no QUN ID or social sign-in.
- The UI and Supabase integration have **not** been end-to-end tested in a real browser session; account creation, upload and playback still need a live smoke test.
- GitHub Pages must be configured separately to publish this subdirectory at a public URL. A working public deployment URL has not been confirmed.

## Database migrations
- `supabase/migrations/202611160001_qun_video_mvp_core.sql` — core tables, RLS and Storage bucket policies.
- `supabase/migrations/202611160002_qun_video_foreign_key_indexes.sql` — foreign-key indexes.
- `supabase/migrations/202611160003_qun_video_author_name.sql` — idempotent creator display-name column migration for existing deployments.

The schema was applied to the existing QUN Supabase project; no separate paid project was created.
