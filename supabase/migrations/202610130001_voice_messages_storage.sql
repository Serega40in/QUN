-- Private storage for QUN Messenger voice notes.
-- Object key format: <conversation UUID>/<sender UUID>/<random UUID>.m4a
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'qun-voice-messages',
  'qun-voice-messages',
  false,
  9437184,
  array['audio/mp4']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 9437184,
    allowed_mime_types = array['audio/mp4']::text[];

drop policy if exists "QUN voice upload by conversation member" on storage.objects;
create policy "QUN voice upload by conversation member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'qun-voice-messages'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "QUN voice read by conversation members" on storage.objects;
create policy "QUN voice read by conversation members"
on storage.objects for select to authenticated
using (
  bucket_id = 'qun-voice-messages'
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid()
  )
);

drop policy if exists "QUN voice delete by sender" on storage.objects;
create policy "QUN voice delete by sender"
on storage.objects for delete to authenticated
using (
  bucket_id = 'qun-voice-messages'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id::text = (storage.foldername(name))[1]
      and cm.user_id = auth.uid()
  )
);
