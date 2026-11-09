-- Private Web Push server state and persisted calls. The Edge Function is the only API
-- actor with SQL privileges; browser sessions cannot read the private VAPID key or SDP.
create table if not exists public.qun_webpush_config (
  singleton boolean primary key default true check (singleton = true),
  public_key text not null,
  private_jwk jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qun_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists qun_push_subscriptions_user_id_idx
  on public.qun_push_subscriptions(user_id);

create table if not exists public.qun_call_invites (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('audio','video')),
  offer jsonb not null,
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','ended','expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 seconds'),
  check (from_user_id <> to_user_id)
);
create index if not exists qun_call_invites_incoming_idx
  on public.qun_call_invites(to_user_id, status, expires_at);
create index if not exists qun_call_invites_conversation_idx
  on public.qun_call_invites(conversation_id, created_at desc);

alter table public.qun_webpush_config enable row level security;
alter table public.qun_push_subscriptions enable row level security;
alter table public.qun_call_invites enable row level security;

revoke all on table public.qun_webpush_config from public, anon, authenticated;
revoke all on table public.qun_push_subscriptions from public, anon, authenticated;
revoke all on table public.qun_call_invites from public, anon, authenticated;

grant select, insert, update, delete on table public.qun_webpush_config to service_role;
grant select, insert, update, delete on table public.qun_push_subscriptions to service_role;
grant select, insert, update, delete on table public.qun_call_invites to service_role;