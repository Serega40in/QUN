# QUN Wallet — тестовый MVP

**Страница:** https://serega40in.github.io/QUN/qun-wallet/  
**Статус:** внутренний тестовый ledger, не blockchain и не production wallet.

## Что работает в MVP
- Вход/регистрация через общий QUN ID (тот же Supabase Auth).
- Создание одного QUN Wallet на аккаунт с публичным адресом.
- Одноразовое получение 100 тестовых QUN.
- Переводы между кошельками в одном Supabase-проекте.
- История входящих/исходящих операций.
- Атомарное изменение баланса на сервере, проверка владельца, положительной суммы, точности до 8 знаков, наличия получателя и достаточного баланса.
- RLS: пользователь читает только свой кошелёк и связанные с ним операции; клиенту запрещены прямые INSERT/UPDATE баланса.

## Ограничения и безопасность
- QUN в этом интерфейсе не является выпущенной криптовалютой, не имеет денежной стоимости, не выводится и не обменивается на реальные активы.
- Это custodial-style ledger, связанный с QUN ID, а не non-custodial wallet: приватный ключ/seed phrase и on-chain адреса пока не создаются.
- Не хранить реальные деньги или обещать вознаграждение за запуск QUN Node.
- Следующий этап: проектирование криптографического non-custodial wallet, threat model, выбор протокола/консенсуса, аудит, тесты повторных запросов и конкурирующих переводов.
- Публичный URL — удобная тестовая оболочка, но перед внешним пилотом нужно проверить CORS, RLS/advisors, abuse limits, backups, monitoring и реальную авторизацию на двух отдельных аккаунтах.

## RPC / таблицы
- `public.qun_wallets`: wallet address and balance, one per `auth.users` account.
- `public.qun_wallet_transactions`: append-only transaction records for transfers, test faucet and future rewards.
- `qun_wallet_get_or_create()`: create or return current user's wallet.
- `qun_wallet_claim_test_tokens()`: one-time test faucet (100 QUN).
- `qun_wallet_transfer(p_recipient_address, p_amount, p_request_id, p_memo)`: atomic transfer.

The RPC functions use a fixed `search_path`, check `auth.uid()`, and have execution revoked from `PUBLIC`/anonymous roles. Only authenticated users can execute them. Wallet balances are not writable from the browser.
