-- Supporting indexes for common owner/follower lookups.
create index if not exists qun_video_comments_user_idx on public.qun_video_comments(user_id);
create index if not exists qun_video_likes_user_idx on public.qun_video_likes(user_id);
create index if not exists qun_video_subscriptions_subscriber_idx on public.qun_video_subscriptions(subscriber_id);
