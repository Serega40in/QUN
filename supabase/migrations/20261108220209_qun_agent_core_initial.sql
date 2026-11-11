create table if not exists public.qun_agent_devices (
  device_id text primary key check (device_id ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  name text not null default 'QUN Agent Device' check (char_length(name) between 1 and 100),
  platform text not null default 'windows' check (platform in ('windows', 'android', 'browser', 'other')),
  status text not null default 'offline' check (status in ('online', 'stale', 'offline', 'error')),
  version text not null default '0.1.0' check (char_length(version) <= 40),
  capabilities jsonb not null default '[]'::jsonb check (jsonb_typeof(capabilities) = 'array'),
  last_seen_at timestamptz,
  last_error text check (last_error is null or char_length(last_error) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qun_agent_commands (
  command_id uuid primary key default gen_random_uuid(),
  device_id text not null references public.qun_agent_devices(device_id) on delete cascade,
  action text not null check (action in ('browser.list_tabs', 'browser.read_active_page', 'browser.open_url')),
  args jsonb not null default '{}'::jsonb check (jsonb_typeof(args) = 'object' and pg_column_size(args) <= 16384),
  status text not null default 'queued' check (status in ('queued', 'leased', 'succeeded', 'failed', 'cancelled')),
  requested_by text not null default 'assistant' check (char_length(requested_by) between 1 and 100),
  result jsonb check (result is null or pg_column_size(result) <= 65536),
  error_message text check (error_message is null or char_length(error_message) <= 2000),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  lease_expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists qun_agent_commands_device_status_created_idx
  on public.qun_agent_commands (device_id, status, created_at asc);
create index if not exists qun_agent_commands_created_idx
  on public.qun_agent_commands (created_at desc);
create index if not exists qun_agent_devices_last_seen_idx
  on public.qun_agent_devices (last_seen_at desc);

alter table public.qun_agent_devices enable row level security;
alter table public.qun_agent_commands enable row level security;

revoke all on table public.qun_agent_devices from public, anon, authenticated;
revoke all on table public.qun_agent_commands from public, anon, authenticated;
grant all on table public.qun_agent_devices to service_role;
grant all on table public.qun_agent_commands to service_role;
