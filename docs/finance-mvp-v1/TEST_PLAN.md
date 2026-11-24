# QUN Finance MVP v1 — проверка перед применением

Этот план обязателен перед применением `202611240001_qun_finance_double_entry_v1.sql`.
**Не запускайте migration на production до успешного staging-прогона.** Текущие балансы — только QUN_TEST.

## Блокирующие проверки

1. Применить migration на отдельной disposable/staging базе, где можно потерять данные.
2. Проверить, что migration завершается целиком и все три таблицы созданы.
3. Проверить, что открывающие проводки сбалансированы и сумма кредитов wallet accounts равна сумме исходных положительных балансов на момент cutover.
4. Проверить, что обычный authenticated пользователь не может напрямую INSERT/UPDATE/DELETE ledger rows.
5. Прогнать сценарии с двумя отдельными пользователями A и B.
6. Проверить повтор запроса, повторное использование ключа с другими параметрами, недостаточный баланс и конкурентные переводы.
7. Проверить существующий Wallet UI и legacy RPC после migration.
8. Только после результатов сохранить тестовый отчёт и рассматривать включение ledger RPC в UI.

## SQL-инварианты после migration

Выполнять только в staging:

```sql
-- Каждый posted journal transaction должен иметь минимум две проводки,
-- а дебеты и кредиты по каждой транзакции должны совпадать.
select jt.id,
       count(e.id) as entry_count,
       coalesce(sum(case when e.direction = 'debit' then e.amount else 0 end), 0) as debits,
       coalesce(sum(case when e.direction = 'credit' then e.amount else 0 end), 0) as credits
from public.qun_finance_journal_transactions jt
left join public.qun_finance_journal_entries e on e.transaction_id = jt.id
where jt.status = 'posted'
group by jt.id
having count(e.id) < 2
    or coalesce(sum(case when e.direction = 'debit' then e.amount else 0 end), 0)
       <> coalesce(sum(case when e.direction = 'credit' then e.amount else 0 end), 0);

-- Wallet account openings must reconcile to wallet balances at the cutover.
select w.id, w.balance,
       coalesce(sum(case when e.direction = 'credit' then e.amount
                         when e.direction = 'debit' then -e.amount else 0 end), 0) as journal_net
from public.qun_wallets w
join public.qun_finance_accounts a on a.wallet_id = w.id and a.asset_code = 'QUN_TEST'
left join public.qun_finance_journal_entries e on e.account_id = a.id
group by w.id, w.balance
having coalesce(sum(case when e.direction = 'credit' then e.amount
                         when e.direction = 'debit' then -e.amount else 0 end), 0) <> w.balance;
```

Both queries should return zero rows immediately after migration. The second comparison is only a cutover check: after test transfers, legacy balances and journal balances should continue to reconcile, but concurrent writes and any legacy-only operations must be tested explicitly.

## Behavioural test matrix

| Scenario | Expected result |
|---|---|
| A claims faucet once | Exactly +100 QUN_TEST and one balanced journal transaction |
| A claims faucet again | Rejected; no second balance change and no extra journal rows |
| A transfers 10 to B | A −10, B +10; exactly two balanced entries |
| Retry same request ID with same payload | No duplicate balance movement or journal transaction |
| Reuse request ID with a different recipient/amount | Reject as idempotency conflict; never silently treat as a new transfer |
| A sends more than balance | Rejected; no legacy or journal mutation |
| Two concurrent transfers overspend A | At most the affordable amount succeeds; no negative balance |
| A reads B's private account/history | No rows returned |
| Authenticated client writes directly to journal tables | Permission denied |
| A and B both check faucet state in UI | Each state reflects only their own wallet |
| Existing wallet page / legacy RPC | No regression before UI cutover |

## Notes for release

- The draft wrappers call legacy RPCs so balances and journal updates share one PostgreSQL transaction; this still needs staging verification.
- Before production-like use, explicitly test same-key/different-payload handling. A successful replay must verify the original operation rather than blindly trusting a request ID.
- Do not call these units cryptocurrency, deposits, or money. TON integration is a separate testnet milestone and must not be mixed with QUN_TEST accounting.
- Record the database version, commit SHA, test accounts (non-sensitive aliases only), query results, and screenshots/logs without tokens or personal data.
