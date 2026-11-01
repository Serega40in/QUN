-- Index owner-bound one-time GPU enrollment codes for dashboard listing and cleanup.
create index if not exists qun_node_enrollment_owner_idx
  on public.qun_node_enrollment_codes(owner_id);
