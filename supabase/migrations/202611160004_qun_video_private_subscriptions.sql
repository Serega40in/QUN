-- Limit QUN Video subscription visibility to the subscriber's own rows.
drop policy if exists "Subscriptions are publicly readable" on public.qun_video_subscriptions;
drop policy if exists "Users can read own subscriptions" on public.qun_video_subscriptions;
create policy "Users can read own subscriptions" on public.qun_video_subscriptions
  for select to authenticated using ((select auth.uid()) = subscriber_id);
grant select on public.qun_video_subscriptions to authenticated;
revoke select on public.qun_video_subscriptions from anon;
