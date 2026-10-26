-- Private QUN Messenger file attachments. Never make this bucket public.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('qun-chat-attachments','qun-chat-attachments',false,8388608,
 array['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']::text[])
on conflict (id) do update set public=false,file_size_limit=8388608,
 allowed_mime_types=excluded.allowed_mime_types;

-- Permit common browser voice recording formats in the existing private voice bucket.
update storage.buckets set allowed_mime_types=array['audio/mp4','audio/webm','audio/webm;codecs=opus']::text[],file_size_limit=8388608,public=false
where id='qun-voice-messages';

drop policy if exists "QUN attachment upload by conversation member" on storage.objects;
create policy "QUN attachment upload by conversation member" on storage.objects for insert to authenticated
with check (bucket_id='qun-chat-attachments'
 and (storage.foldername(name))[2]=auth.uid()::text
 and exists(select 1 from public.conversation_members cm where cm.conversation_id::text=(storage.foldername(name))[1] and cm.user_id=auth.uid()));

drop policy if exists "QUN attachment read by conversation members" on storage.objects;
create policy "QUN attachment read by conversation members" on storage.objects for select to authenticated
using (bucket_id='qun-chat-attachments'
 and exists(select 1 from public.conversation_members cm where cm.conversation_id::text=(storage.foldername(name))[1] and cm.user_id=auth.uid()));

drop policy if exists "QUN attachment delete by sender" on storage.objects;
create policy "QUN attachment delete by sender" on storage.objects for delete to authenticated
using (bucket_id='qun-chat-attachments' and (storage.foldername(name))[2]=auth.uid()::text
 and exists(select 1 from public.conversation_members cm where cm.conversation_id::text=(storage.foldername(name))[1] and cm.user_id=auth.uid()));
