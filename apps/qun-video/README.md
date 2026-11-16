# QUN Video MVP

A standalone, mobile-friendly video platform frontend under `apps/qun-video/`.

## Current prototype features
- Responsive video discovery feed and category filters
- Search across title, author, category, and description
- Video detail view, local likes, saved list, watch history
- Follow channels and add comments
- Select a local video file for preview in the current browser session
- No paid services or third-party analytics

## Important limitations
This is an early **frontend MVP**, not yet a multi-user hosted video service. Demo cards do not contain playable source media. Uploaded files use browser object URLs and are not uploaded to a server; they may stop working after reload and are not shared with other users. Metadata is stored in localStorage on the current device only. Authentication, shared database, durable media storage, transcoding, moderation, and abuse protection are not implemented yet.

## Next steps for a real public MVP
1. Create a free Supabase project and configure Auth + database tables for profiles, videos, likes, subscriptions, and comments.
2. Add Row Level Security policies and server-side validation.
3. Store video files in a suitable storage provider with upload limits; large-file delivery and transcoding may require a separate media pipeline.
4. Add upload progress, thumbnail generation, playback, reporting, moderation, and privacy/terms pages.
5. Deploy as a separate app using GitHub Pages for the static frontend and free backend tiers where available. Free-tier limits and availability can change.

## Preview
Open `index.html` locally or serve this folder with a static web server. The root QUN repository's existing GitHub Pages configuration may not automatically publish this subdirectory at a dedicated URL.

## Security
Never put service-role keys or other secrets in frontend code. Only publish public client configuration intended for browser use.
