-- QUN Finance MVP v1 — additive double-entry journal.
-- Draft migration: reviewed into feature branch only; NOT applied to Supabase.
-- Keeps legacy wallet tables/functions intact. Use only for QUN_TEST balances.
begin;

create table if not exists public.qun_finance_accounts (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid unique references public.qun_wallets(id) on delete restrict,
  asset_code text not null check (asset_code ~ '^[A-Z0-9_]{2,24}$'),
  account_type text not null check (account_type in ('wallet','faucet')),
  created_at timestamptz not null default now(),
  check ((account_type = 'wallet' and wallet_id is not null)
      or (account_type = 'faucet' and wallet_id is null))
);

create unique index if not exists qun_finance_one_system_account_per_asset
  on public.qun_finance_accounts(asset_code, account_type)
  where wallet_id is null;

create table if not exists public.qun_finance_journal_transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  operation_type text not null check (operation_type in ('test_transfer','test_faucet')),
  status text not null default 'posted' check (status in ('pending','posted','reversed')),
  created_by_user_id uuid references auth.users(id) on delete restrict,
  legacy_transaction_id uuid unique,
  created_at timestamptz not null default now()
);

create table if not exists public.qun_finance_journal_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.qun_finance_journal_transactions(id) on delete restrict,
  account_id uuid not null references public.qun_finance_accounts(id) on delete restrict,
  asset_code text not null check (asset_code ~ '^[A-Z0-9_]{2,24}$'),
  direction text not null check (direction in ('debit','credit')),
  amount numeric(28,8) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists qun_finance_entries_tx_idx
  on public.qun_finance_journal_entries(transaction_id);
create index if not exists qun_finance_entries_account_time_idx
  on public.qun_finance_journal_entries(account_id, created_at desc);

alter table public.qun_finance_accounts enable row level security;
alter table public.qun_finance_journal_transactions enable row level security;
alter table public.qun_finance_journal_entries enable row level security;

revoke all on public.qun_finance_accounts from anon, authenticated;
revoke all on public.qun_finance_journal_transactions from anon, authenticated;
revoke all on public.qun_finance_journal_entries from anon, authenticated;
grant select on public.qun_finance_accounts to authenticated;
grant select on public.qun_finance_journal_transactions to authenticated;
grant select on public.qun_finance_journal_entries to authenticated;

drop policy if exists qun_finance_read_own_accounts on public.qun_finance_accounts;
create policy qun_finance_read_own_accounts on public.qun_finance_accounts
  for select to authenticated using (
    exists (select 1 from public.qun_wallets w
      where w.id = wallet_id and w.user_id = (select auth.uid()))
  );

drop policy if exists qun_finance_read_own_journal_transactions on public.qun_finance_journal_transactions;
create policy qun_finance_read_own_journal_transactions on public.qun_finance_journal_transactions
  for select to authenticated using (
    exists (
      select 1
      from public.qun_finance_journal_entries e
      join public.qun_finance_accounts a on a.id = e.account_id
      join public.qun_wallets w on w.id = a.wallet_id
      where e.transaction_id = id and w.user_id = (select auth.uid())
    )
  );

drop policy if exists qun_finance_read_own_journal_entries on public.qun_finance_journal_entries;
create policy qun_finance_read_own_journal_entries on public.qun_finance_journal_entries
  for select to authenticated using (
    exists (
      select 1
      from public.qun_finance_accounts a
      join public.qun_wallets w on w.id = a.wallet_id
      where a.id = account_id and w.user_id = (select auth.uid())
    )
  );

create or replace function public.qun_finance_assert_balanced()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_transaction_id uuid;
  v_count integer;
  v_net numeric;
begin
  v_transaction_id := coalesce(new.transaction_id, old.transaction_id);
  select count(*),
         coalesce(sum(case when direction = 'debit' then amount else -amount end), 0)
    into v_count, v_net
    from public.qun_finance_journal_entries
   where transaction_id = v_transaction_id;
  if v_count < 2 or v_net <> 0 then
    raise exception 'QUN ledger transaction % is not balanced', v_transaction_id;
  end if;
  return null;
end;
$$;

drop trigger if exists qun_finance_entries_balanced on public.qun_finance_journal_entries;
create constraint trigger qun_finance_entries_balanced
  after insert on public.qun_finance_journal_entries
  deferrable initially deferred
  for each row execute function public.qun_finance_assert_balanced();

-- Wallet users may read their own account/journal rows, but cannot write ledger rows directly.
create or replace function public.qun_finance_transfer_v1(
  p_recipient_address text,
  p_amount numeric,
  p_request_id uuid,
  p_memo text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sender public.qun_wallets%rowtype;
  v_recipient public.qun_wallets%rowtype;
  v_sender_account uuid;
  v_recipient_account uuid;
  v_journal_id uuid;
  v_existing public.qun_finance_journal_transactions%rowtype;
  v_result jsonb;
  v_legacy_id uuid;
begin
  if v_uid is null then raise exception 'QUN ID login required'; end if;
  if p_request_id is null then raise exception 'Request ID required'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000000
     or p_amount <> round(p_amount,8) then
    raise exception 'Invalid QUN_TEST amount';
  end if;

  perform public.qun_wallet_get_or_create();
  select * into v_sender from public.qun_wallets where user_id = v_uid;
  select * into v_recipient from public.qun_wallets
   where address = upper(trim(p_recipient_address));
  if v_recipient.id is null then raise exception 'Recipient QUN wallet not found'; end if;
  if v_recipient.id = v_sender.id then raise exception 'Cannot send QUN to your own wallet'; end if;

  -- A pre-existing legacy transfer with this key has no guaranteed journal history.
  if exists (select 1 from public.qun_wallet_transactions
              where sender_wallet_id = v_sender.id and request_id = p_request_id) then
    select * into v_existing from public.qun_finance_journal_transactions
     where idempotency_key = p_request_id;
    if v_existing.id is not null and v_existing.created_by_user_id = v_uid then
      return jsonb_build_object('status','already_processed','ledger_transaction_id',v_existing.id);
    end if;
    raise exception 'Legacy transaction requires reconciliation before journal migration';
  end if;

  insert into public.qun_finance_accounts(wallet_id,asset_code,account_type)
  values (v_sender.id,'QUN_TEST','wallet')
  on conflict (wallet_id) do nothing;
  select id into v_sender_account from public.qun_finance_accounts where wallet_id = v_sender.id;

  insert into public.qun_finance_accounts(wallet_id,asset_code,account_type)
  values (v_recipient.id,'QUN_TEST','wallet')
  on conflict (wallet_id) do nothing;
  select id into v_recipient_account from public.qun_finance_accounts where wallet_id = v_recipient.id;

  insert into public.qun_finance_journal_transactions
    (idempotency_key,operation_type,created_by_user_id,status)
  values (p_request_id,'test_transfer',v_uid,'posted')
  on conflict (idempotency_key) do nothing
  returning id into v_journal_id;

  if v_journal_id is null then
    select * into v_existing from public.qun_finance_journal_transactions
     where idempotency_key = p_request_id;
    if v_existing.created_by_user_id = v_uid and v_existing.operation_type = 'test_transfer' then
      return jsonb_build_object('status','already_processed','ledger_transaction_id',v_existing.id);
    end if;
    raise exception 'Idempotency key already used';
  end if;

  v_result := public.qun_wallet_transfer(
    p_recipient_address, p_amount, p_request_id, coalesce(p_memo,'')
  );
  if coalesce(v_result->>'status','') = 'already_processed' then
    raise exception 'Legacy transaction requires reconciliation before journal migration';
  end if;
  v_legacy_id := nullif(v_result->>'transaction_id','')::uuid;

  update public.qun_finance_journal_transactions
     set legacy_transaction_id = v_legacy_id
   where id = v_journal_id;

  insert into public.qun_finance_journal_entries
    (transaction_id,account_id,asset_code,direction,amount)
  values
    (v_journal_id,v_sender_account,'QUN_TEST','debit',p_amount),
    (v_journal_id,v_recipient_account,'QUN_TEST','credit',p_amount);

  return v_result || jsonb_build_object('ledger_transaction_id',v_journal_id,'ledger','double-entry-v1');
end;
$$;

create or replace function public.qun_finance_claim_test_tokens_v1()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.qun_wallets%rowtype;
  v_wallet_account uuid;
  v_faucet_account uuid;
  v_result jsonb;
  v_legacy_id uuid;
  v_journal_id uuid;
begin
  if v_uid is null then raise exception 'QUN ID login required'; end if;
  perform public.qun_wallet_get_or_create();
  select * into v_wallet from public.qun_wallets where user_id = v_uid for update;

  if exists (select 1 from public.qun_wallet_transactions
              where recipient_wallet_id = v_wallet.id and tx_type = 'test_faucet') then
    raise exception 'Existing faucet claim requires reconciliation before journal migration';
  end if;

  insert into public.qun_finance_accounts(wallet_id,asset_code,account_type)
  values (v_wallet.id,'QUN_TEST','wallet')
  on conflict (wallet_id) do nothing;
  select id into v_wallet_account from public.qun_finance_accounts where wallet_id = v_wallet.id;

  insert into public.qun_finance_accounts(wallet_id,asset_code,account_type)
  values (null,'QUN_TEST','faucet')
  on conflict (asset_code,account_type) where wallet_id is null do nothing;
  select id into v_faucet_account from public.qun_finance_accounts
   where wallet_id is null and asset_code = 'QUN_TEST' and account_type = 'faucet';

  v_result := public.qun_wallet_claim_test_tokens();
  v_legacy_id := nullif(v_result->>'transaction_id','')::uuid;
  v_journal_id := gen_random_uuid();

  insert into public.qun_finance_journal_transactions
    (id,idempotency_key,operation_type,status,created_by_user_id,legacy_transaction_id)
  values (v_journal_id,v_legacy_id,'test_faucet','posted',v_uid,v_legacy_id);

  insert into public.qun_finance_journal_entries
    (transaction_id,account_id,asset_code,direction,amount)
  values
    (v_journal_id,v_faucet_account,'QUN_TEST','debit',100),
    (v_journal_id,v_wallet_account,'QUN_TEST','credit',100);

  return v_result || jsonb_build_object('ledger_transaction_id',v_journal_id,'ledger','double-entry-v1');
end;
$$;

revoke all on function public.qun_finance_assert_balanced() from public, anon, authenticated;
revoke all on function public.qun_finance_transfer_v1(text,numeric,uuid,text) from public, anon;
revoke all on function public.qun_finance_claim_test_tokens_v1() from public, anon;
grant execute on function public.qun_finance_transfer_v1(text,numeric,uuid,text) to authenticated;
grant execute on function public.qun_finance_claim_test_tokens_v1() to authenticated;

commit;
