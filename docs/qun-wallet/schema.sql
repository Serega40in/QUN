-- QUN Wallet testnet ledger schema.
-- Applied to Supabase project qdxjltqlnphvzafapncm on 2026-10-13.
-- TESTNET ONLY: this is an internal database ledger, not a blockchain.

create table if not exists public.qun_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  address text not null unique default ('QUN' || upper(replace(gen_random_uuid()::text, '-', ''))),
  balance numeric(28,8) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.qun_wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  sender_wallet_id uuid references public.qun_wallets(id) on delete restrict,
  recipient_wallet_id uuid not null references public.qun_wallets(id) on delete restrict,
  sender_address text,
  recipient_address text,
  amount numeric(28,8) not null check (amount > 0),
  tx_type text not null check (tx_type in ('transfer','test_faucet','node_reward')),
  request_id uuid,
  memo text not null default '' check (char_length(memo) <= 240),
  created_at timestamptz not null default now(),
  check (sender_wallet_id is null or sender_wallet_id <> recipient_wallet_id)
);

create unique index if not exists qun_wallet_transfer_request_once
  on public.qun_wallet_transactions(sender_wallet_id, request_id)
  where sender_wallet_id is not null and request_id is not null;
create unique index if not exists qun_wallet_test_faucet_once
  on public.qun_wallet_transactions(recipient_wallet_id)
  where tx_type = 'test_faucet';
create index if not exists qun_wallet_tx_sender_created_idx
  on public.qun_wallet_transactions(sender_wallet_id, created_at desc);
create index if not exists qun_wallet_tx_recipient_created_idx
  on public.qun_wallet_transactions(recipient_wallet_id, created_at desc);

alter table public.qun_wallets enable row level security;
alter table public.qun_wallet_transactions enable row level security;
revoke all on public.qun_wallets from anon, authenticated;
revoke all on public.qun_wallet_transactions from anon, authenticated;
grant select on public.qun_wallets to authenticated;
grant select on public.qun_wallet_transactions to authenticated;

drop policy if exists qun_wallet_read_own on public.qun_wallets;
create policy qun_wallet_read_own on public.qun_wallets
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists qun_wallet_tx_read_own on public.qun_wallet_transactions;
create policy qun_wallet_tx_read_own on public.qun_wallet_transactions
  for select to authenticated using (
    exists (select 1 from public.qun_wallets w
      where w.id = sender_wallet_id and w.user_id = (select auth.uid()))
    or exists (select 1 from public.qun_wallets w
      where w.id = recipient_wallet_id and w.user_id = (select auth.uid()))
  );

create or replace function public.qun_wallet_get_or_create()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.qun_wallets%rowtype;
begin
  if v_uid is null then raise exception 'QUN ID login required'; end if;
  insert into public.qun_wallets(user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_wallet from public.qun_wallets where user_id = v_uid;
  return jsonb_build_object('id',v_wallet.id,'address',v_wallet.address,'balance',v_wallet.balance,'created_at',v_wallet.created_at);
end;
$$;

create or replace function public.qun_wallet_claim_test_tokens()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.qun_wallets%rowtype;
  v_tx public.qun_wallet_transactions%rowtype;
begin
  if v_uid is null then raise exception 'QUN ID login required'; end if;
  insert into public.qun_wallets(user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_wallet from public.qun_wallets where user_id = v_uid for update;
  if exists (select 1 from public.qun_wallet_transactions where recipient_wallet_id = v_wallet.id and tx_type = 'test_faucet') then
    raise exception 'Test QUN has already been claimed for this wallet';
  end if;
  update public.qun_wallets set balance = balance + 100 where id = v_wallet.id returning * into v_wallet;
  insert into public.qun_wallet_transactions(sender_wallet_id,recipient_wallet_id,sender_address,recipient_address,amount,tx_type,memo)
    values (null,v_wallet.id,null,v_wallet.address,100,'test_faucet','One-time QUN testnet faucet') returning * into v_tx;
  return jsonb_build_object('transaction_id',v_tx.id,'amount',v_tx.amount,'balance',v_wallet.balance);
end;
$$;

create or replace function public.qun_wallet_transfer(
  p_recipient_address text, p_amount numeric, p_request_id uuid, p_memo text default ''
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_sender public.qun_wallets%rowtype;
  v_recipient public.qun_wallets%rowtype;
  v_tx public.qun_wallet_transactions%rowtype;
  v_memo text := coalesce(p_memo,'');
begin
  if v_uid is null then raise exception 'QUN ID login required'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000000 then raise exception 'Amount must be positive and within the allowed limit'; end if;
  if p_amount <> round(p_amount,8) then raise exception 'Maximum precision is 8 decimal places'; end if;
  if p_request_id is null then raise exception 'Request ID required'; end if;
  if char_length(v_memo) > 240 then raise exception 'Memo is too long'; end if;
  insert into public.qun_wallets(user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_sender from public.qun_wallets where user_id = v_uid;
  select * into v_recipient from public.qun_wallets where address = upper(trim(p_recipient_address));
  if v_recipient.id is null then raise exception 'Recipient QUN wallet not found'; end if;
  if v_recipient.id = v_sender.id then raise exception 'Cannot send QUN to your own wallet'; end if;
  perform 1 from public.qun_wallets where id in (v_sender.id,v_recipient.id) order by id for update;
  select * into v_sender from public.qun_wallets where id = v_sender.id;
  select * into v_recipient from public.qun_wallets where id = v_recipient.id;
  select * into v_tx from public.qun_wallet_transactions where sender_wallet_id = v_sender.id and request_id = p_request_id;
  if v_tx.id is not null then return jsonb_build_object('transaction_id',v_tx.id,'amount',v_tx.amount,'status','already_processed'); end if;
  if v_sender.balance < p_amount then raise exception 'Insufficient QUN balance'; end if;
  update public.qun_wallets set balance = balance - p_amount where id = v_sender.id;
  update public.qun_wallets set balance = balance + p_amount where id = v_recipient.id;
  insert into public.qun_wallet_transactions(sender_wallet_id,recipient_wallet_id,sender_address,recipient_address,amount,tx_type,request_id,memo)
    values (v_sender.id,v_recipient.id,v_sender.address,v_recipient.address,p_amount,'transfer',p_request_id,v_memo) returning * into v_tx;
  return jsonb_build_object('transaction_id',v_tx.id,'amount',v_tx.amount,'sender_address',v_sender.address,'recipient_address',v_recipient.address,'sender_balance',v_sender.balance-p_amount,'status','confirmed','created_at',v_tx.created_at);
end;
$$;

revoke all on function public.qun_wallet_get_or_create() from public, anon;
revoke all on function public.qun_wallet_claim_test_tokens() from public, anon;
revoke all on function public.qun_wallet_transfer(text,numeric,uuid,text) from public, anon;
grant execute on function public.qun_wallet_get_or_create() to authenticated;
grant execute on function public.qun_wallet_claim_test_tokens() to authenticated;
grant execute on function public.qun_wallet_transfer(text,numeric,uuid,text) to authenticated;
