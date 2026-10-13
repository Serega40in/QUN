# QUN Social

QUN Social is the social feed for the QUN ecosystem. It uses the existing QUN ID endpoint and the same Supabase project as QUN Messenger and QUN AI.

## Web app

GitHub Pages path: https://serega40in.github.io/QUN/qun-social/

## Implemented in the first live version

- Existing QUN ID sign-in and registration through the `qun-auth` Edge Function.
- Public posts backed by Supabase Postgres.
- Multiple image/video uploads backed by Supabase Storage.
- Profile editing: username, display name, bio, avatar and cover image.
- Persisted likes and comments with database-maintained counts.
- Follow/unfollow relationships and a feed filter for followed accounts.
- Links between QUN Social, QUN Messenger, and QUN AI.
- RLS policies restrict post/profile ownership and media uploads to the signed-in user's folder.

## Supabase objects

- `social_profiles`
- `social_posts` (including `media_urls jsonb`)
- `social_comments`
- `social_likes`
- `social_follows`
- Storage bucket `qun-social-media`

Migrations have been applied to Supabase project `qdxjltqlnphvzafapncm`. Public media URLs are intentionally enabled for public social posts; do not upload private or sensitive media to this bucket.

## Notes

- The main app page remains `docs/index.html`; QUN Social is added as a separate route under `docs/qun-social/`.
- Changes to the website are committed to the main branch and should be verified in GitHub Actions / Pages after deployment.
- Real-time subscriptions, stories, notifications, and advanced profile layouts remain future enhancements.
