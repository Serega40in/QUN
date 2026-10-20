-- QUN Compute queue safety v1: bounded attempts, leases, stale-job recovery.
alter table public.qun_compute_jobs
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists last_heartbeat_at timestamptz;

alter table public.qun_compute_jobs
  drop constraint if exists qun_compute_jobs_attempt_count_check,
  add constraint qun_compute_jobs_attempt_count_check check (attempt_count >= 0),
  drop constraint if exists qun_compute_jobs_max_attempts_check,
  add constraint qun_compute_jobs_max_attempts_check check (max_attempts between 1 and 5);

create index if not exists qun_compute_jobs_lease_idx
  on public.qun_compute_jobs (lease_expires_at)
  where status = 'running';

create or replace function public.qun_claim_compute_job(p_node_id uuid)
returns setof public.qun_compute_jobs
language plpgsql
security definer
set search_path = ''
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
     where j.status = 'queued'
       and j.job_type = 'health_check'
     order by j.priority desc, j.created_at asc
     for update skip locked
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

revoke all on function public.qun_claim_compute_job(uuid) from public;
revoke all on function public.qun_claim_compute_job(uuid) from anon;
revoke all on function public.qun_claim_compute_job(uuid) from authenticated;
grant execute on function public.qun_claim_compute_job(uuid) to service_role;
