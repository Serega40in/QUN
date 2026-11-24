begin;

select plan(12);

select has_table('public', 'qun_finance_accounts', 'accounts table exists');
select has_table('public', 'qun_finance_journal_transactions', 'journal transactions table exists');
select has_table('public', 'qun_finance_journal_entries', 'journal entries table exists');

select has_column('public', 'qun_finance_journal_transactions', 'request_fingerprint',
  'idempotency payload fingerprint is stored');
select has_column('public', 'qun_finance_journal_transactions', 'legacy_transaction_id',
  'legacy transaction linkage is stored');

select has_function('public', 'qun_finance_transfer_v1',
  array['text', 'numeric', 'uuid', 'text'],
  'transfer wrapper exists');
select has_function('public', 'qun_finance_claim_test_tokens_v1',
  array[]::text[],
  'test faucet wrapper exists');

select ok(
  (select c.relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'qun_finance_accounts'),
  'RLS enabled on accounts'
);
select ok(
  (select c.relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'qun_finance_journal_transactions'),
  'RLS enabled on journal transactions'
);
select ok(
  (select c.relrowsecurity from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'qun_finance_journal_entries'),
  'RLS enabled on journal entries'
);

select ok(
  has_function_privilege('authenticated',
    'public.qun_finance_transfer_v1(text,numeric,uuid,text)', 'EXECUTE'),
  'authenticated can call transfer wrapper'
);
select ok(
  has_function_privilege('authenticated',
    'public.qun_finance_claim_test_tokens_v1()', 'EXECUTE'),
  'authenticated can call faucet wrapper'
);

select * from finish();
rollback;
