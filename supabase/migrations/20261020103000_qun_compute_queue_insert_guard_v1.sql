-- Harden direct authenticated inserts so clients can only create fresh queued jobs.
drop policy if exists qun_compute_jobs_insert_own on public.qun_compute_jobs;
create policy qun_compute_jobs_insert_own
on public.qun_compute_jobs
for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and status = 'queued'
  and assigned_node_id is null
  and attempt_count = 0
  and max_attempts = 3
  and lease_expires_at is null
  and last_heartbeat_at is null
  and result = '{}'::jsonb
  and started_at is null
  and finished_at is null
);
