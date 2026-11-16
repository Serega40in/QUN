# QUN Video MVP

A mobile-friendly video platform frontend at `apps/qun-video/`, connected to the existing QUN Supabase project.

## Working features
- Supabase email/password sign-up and sign-in
- Public feed of uploaded video records
- Upload video files to the `qun-video` Storage bucket
- Public playback URLs for supported browser video formats
- Persistent comments, likes and creator subscriptions
- Responsive UI, categories and text search
- Row Level Security on all QUN Video public tables
- No paid service intentionally enabled by this app

## Configuration
The frontend uses the QUN Supabase project URL and a **publishable** client key. Publishable keys are intended for browser use; never put a service-role or secret key in frontend code.

Supabase Auth must allow email/password sign-up. If email confirmation is enabled, new users need to confirm their address before signing in. For a custom production domain, add it to Supabase Auth's allowed redirect/site URL configuration.

## Storage limits
The `qun-video` bucket is public for playback and currently configured for up to 50 MiB per file, limited to MP4, WebM, QuickTime and Ogg video MIME types. Uploads require authentication and are restricted to the signed-in user's folder. Public video URLs mean anyone with the URL can watch the media; do not upload private or copyrighted content without rights.

The free tier has usage and bandwidth limits, which can change. This is not a transcoding/CDN pipeline; very large audiences may require a different media delivery architecture.

## Known limitations
- The demo cards on the home feed are illustrative and have no source video.
- No transcoding, thumbnails, creator verification, reporting/moderation, upload resume, or robust view-count RPC yet.
- Authentication currently uses email/password; no QUN ID or social sign-in.
- The frontend has not yet been end-to-end tested in a real browser session after deployment.
- GitHub Pages must be configured separately to publish this subdirectory at a public URL.

## Database
Migration source: `supabase/migrations/202611160001_qun_video_mvp_core.sql`. The schema was applied to the existing QUN Supabase project; it does not create a separate paid project.
