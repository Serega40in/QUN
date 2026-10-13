# QUN Social

QUN Social is the social feed for the QUN ecosystem. It uses the existing QUN ID endpoint and the same Supabase project as QUN Messenger and QUN AI.

## Web app

GitHub Pages path: https://serega40in.github.io/QUN/qun-social/

## Implemented in the first live version

- Existing QUN ID sign-in and registration through the `qun-auth` Edge Function.
- Public posts backed by Supabase Postgres.
- Multiple image/video uploads backed by Supabase Storage.
- Dedicated shareable post links (`?post=...`) that open a single publication and its discussion.
- Native share-sheet / copy-link fallback for posts and stories.
- Photo/video Stories with captions, public links, a story viewer, and automatic 24-hour expiry.
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
- `social_stories` (active stories are public; owner can delete; default lifetime 24 hours)
- Storage bucket `qun-social-media`

Migrations have been applied to Supabase project `qdxjltqlnphvzafapncm`. Public media URLs are intentionally enabled for public social posts; do not upload private or sensitive media to this bucket.

## Notes

- The main app page remains `docs/index.html`; QUN Social is added as a separate route under `docs/qun-social/`.
- Changes to the website are committed to the main branch and should be verified in GitHub Actions / Pages after deployment.
- Stories use `social_stories`; expired items are hidden by row-level policy and by the client query. Storage media remains public, so story media URLs can remain reachable after a story expires if someone saved the direct media URL; the story itself disappears from QUN Social after 24 hours.
- Real-time subscriptions, notifications, and dedicated public profile layouts remain future enhancements.
