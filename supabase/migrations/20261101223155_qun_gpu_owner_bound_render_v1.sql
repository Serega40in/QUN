-- QUN GPU owner-bound rendering v1
-- Applied to project qdxjltqlnphvzafapncm on 2026-11-01.
-- A registered linux-gpu node can claim media jobs only for its owner_id.
-- Existing desktop/mobile nodes remain limited to health_check tasks.

alter table public.qun_node_enrollment_codes
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

alter table public.qun_nodes
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

create index if not exists qun_nodes_owner_platform_idx
  on public.qun_nodes(owner_id, platform, last_seen_at);

create or replace function public.qun_register_node(
  p_code_hash text,
  p_node_name text,
  p_platform text,
  p_token_hash text
)
returns table(node_id uuid, registered_at timestamptz)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_node_id uuid;
  v_registered_at timestamptz;
  v_owner_id uuid;
begin
  if p_node_name is null or length(trim(p_node_name)) < 1 or length(p_node_name) > 80 then
    raise exception 'Invalid node name';
  end if;
  if p_platform is null or length(p_platform) > 40 then
    raise exception 'Invalid platform';
  end if;

  update public.qun_node_enrollment_codes
     set used_at = now()
   where code_hash = p_code_hash
     and used_at is null
     and expires_at > now()
   returning owner_id into v_owner_id;

  if not found then
    raise exception 'Enrollment code is invalid, expired, or already used';
  end if;

  insert into public.qun_nodes(owner_id, node_name, platform, token_hash, last_seen_at)
  values (v_owner_id, trim(p_node_name), p_platform, p_token_hash, now())
  returning public.qun_nodes.node_id, public.qun_nodes.registered_at
       into v_node_id, v_registered_at;

  return query select v_node_id, v_registered_at;
end;
$function$;

create or replace function public.qun_claim_compute_job(p_node_id uuid)
returns setof public.qun_compute_jobs
language plpgsql
security definer
set search_path to ''
as $function$
begin
  update public.qun_compute_jobs j
     set status = case when j.attempt_count >= j.max_attempts then 'failed' else 'queued' end,
         assigned_node_id = null,
         lease_expires_at = null,
         finished_at = case when j.attempt_count >= j.max_attempts then now() else null end,
         error_message = case
           when j.attempt_count >= j.max_attempts then 'Worker lease expired; retry limit reached'
           else 'Worker lease expired; returned to queue for retry'
         end,
         updated_at = now()
   where j.status = 'running'
     and j.lease_expires_at is not null
     and j.lease_expires_at <= now();

  return query
  with candidate as (
    select j.job_id
      from public.qun_compute_jobs j
      join public.qun_nodes n on n.node_id = p_node_id
     where j.status = 'queued'
       and (
         j.job_type = 'health_check'
         or (
           n.platform = 'linux-gpu'
           and n.owner_id is not null
           and j.owner_id = n.owner_id
           and j.job_type in ('image_generation', 'video_generation', 'audio_generation', 'comfyui_workflow')
         )
       )
     order by j.priority desc, j.created_at asc
     for update of j skip locked
     limit 1
  )
  update public.qun_compute_jobs j
     set status = 'running',
         assigned_node_id = p_node_id,
         attempt_count = j.attempt_count + 1,
         started_at = now(),
         finished_at = null,
         lease_expires_at = now() + interval '3 minutes',
         last_heartbeat_at = now(),
         error_message = null,
         updated_at = now()
    from candidate c
   where j.job_id = c.job_id
  returning j.*;
end;
$function$;

revoke all on function public.qun_register_node(text,text,text,text) from public;
revoke all on function public.qun_register_node(text,text,text,text) from anon, authenticated;
grant execute on function public.qun_register_node(text,text,text,text) to service_role;

revoke all on function public.qun_claim_compute_job(uuid) from public;
revoke all on function public.qun_claim_compute_job(uuid) from anon, authenticated;
grant execute on function public.qun_claim_compute_job(uuid) to service_role;

update storage.buckets
   set allowed_mime_types = array[
     'video/mp4','video/webm','video/quicktime',
     'image/jpeg','image/png','image/webp',
     'audio/mpeg','audio/wav','audio/x-wav','audio/flac','audio/ogg','audio/aac','audio/mp4','audio/webm'
   ]
 where id = 'qun-studio-media';

do $policy$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and policyname = 'QUN Studio users can upload own exports'
  ) then
    create policy "QUN Studio users can upload own exports"
      on storage.objects
      for insert
      to authenticated
      with check (
        bucket_id = 'qun-studio-media'
        and (storage.foldername(name))[1] = (select auth.uid()::text)
      );
  end if;
end;
$policy$;
