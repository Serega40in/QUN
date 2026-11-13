-- S40in AI Income
-- Dedicated tables in the existing QUN Supabase project.
-- Every row belongs to one authenticated QUN ID (auth.uid()).

create table if not exists public.ai_income_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_amount_usd numeric(12,2) not null default 25 check (goal_amount_usd > 0),
  goal_label text not null default 'ChatGPT Plus',
  target_plan text not null default 'Plus',
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_income_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  client_name text not null default '',
  platform text not null default 'Direct',
  service text not null default '',
  amount numeric(12,2) not null default 0 check (amount >= 0),
  currency text not null default 'RUB' check (currency in ('RUB','EUR','USD','USDT')),
  status text not null default 'lead' check (status in ('lead','contacted','proposal','accepted','production','delivered','paid','lost')),
  due_date date,
  link text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_income_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.ai_income_orders(id) on delete set null,
  kind text not null check (kind in ('income','expense','reserve')),
  title text not null check (char_length(title) between 1 and 140),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'RUB' check (currency in ('RUB','EUR','USD','USDT')),
  note text not null default '',
  booked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint ai_income_reserve_usd_only check (kind <> 'reserve' or currency = 'USD')
);

create table if not exists public.ai_income_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  detail text not null default '',
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  status text not null default 'todo' check (status in ('todo','doing','done')),
  due_date date,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_income_orders_user_created_idx on public.ai_income_orders(user_id, created_at desc);
create index if not exists ai_income_transactions_user_booked_idx on public.ai_income_transactions(user_id, booked_at desc);
create index if not exists ai_income_tasks_user_status_idx on public.ai_income_tasks(user_id, status, created_at desc);

alter table public.ai_income_settings enable row level security;
alter table public.ai_income_orders enable row level security;
alter table public.ai_income_transactions enable row level security;
alter table public.ai_income_tasks enable row level security;

revoke all on public.ai_income_settings, public.ai_income_orders, public.ai_income_transactions, public.ai_income_tasks from anon, public;
grant select, insert, update, delete on public.ai_income_settings, public.ai_income_orders, public.ai_income_transactions, public.ai_income_tasks to authenticated;

drop policy if exists ai_income_settings_owner_all on public.ai_income_settings;
create policy ai_income_settings_owner_all on public.ai_income_settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists ai_income_orders_owner_all on public.ai_income_orders;
create policy ai_income_orders_owner_all on public.ai_income_orders for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists ai_income_transactions_owner_all on public.ai_income_transactions;
create policy ai_income_transactions_owner_all on public.ai_income_transactions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists ai_income_tasks_owner_all on public.ai_income_tasks;
create policy ai_income_tasks_owner_all on public.ai_income_tasks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
