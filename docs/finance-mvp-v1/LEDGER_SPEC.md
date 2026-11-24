# QUN Finance MVP v1 — спецификация ledger

## Текущее состояние

Существующие `qun_wallets.balance` и `qun_wallet_transactions` сохраняются для обратной совместимости. Не переключать production UI на новую модель, пока миграция не проверена.

## Целевая модель

### accounts
- id UUID
- owner_user_id nullable UUID для системных счетов
- asset_code (например, QUN_TEST, TON_TEST; fiat asset только после legal/provider approval)
- account_type (user, faucet, clearing, fee, suspense)
- created_at
- уникальность по owner + asset + account_type с корректной обработкой NULL

### journal_transactions
- id UUID
- idempotency_key
- operation_type
- status
- created_by_user_id
- external_reference nullable
- metadata JSONB с allowlist полей, без секретов
- created_at
- уникальный idempotency key в соответствующей области

### journal_entries
- id UUID
- transaction_id FK
- account_id FK
- direction (debit/credit)
- amount_minor_units BIGINT либо точная NUMERIC
- asset_code
- created_at
- CHECK amount > 0
- запрет UPDATE/DELETE для клиентских ролей
- индексы transaction_id, account_id + created_at

## Правило проводки

Для внутреннего перевода X QUN_TEST:
- debit user sender: X
- credit user recipient: X

Для тестового faucet:
- debit system faucet: X
- credit user recipient: X

Проверка сбалансированности должна выполняться в одной серверной транзакции до фиксации. В PostgreSQL обычный CHECK не может проверять сумму по нескольким строкам; использовать безопасную server-side функцию/процедуру и при необходимости deferred constraint trigger.

## Миграция

1. Создать новые таблицы рядом с существующими, не менять и не удалять старые.
2. Для каждой существующей операции сформировать проводки только после reconciliation; записи с неоднозначным sender/faucet требуют ручного правила.
3. Сверить рассчитанный баланс каждого кошелька с текущим balance.
4. Запустить read-only сверку и тесты конкурентных переводов.
5. Переключать чтение только отдельным релизом с feature flag.
6. Оставить rollback-путь до подтверждённого завершения пилота.

## Обязательные тесты

- Успешный перевод A -> B.
- Отказ при недостаточном балансе.
- Отказ на нулевую/отрицательную сумму и лишнюю точность.
- Самоперевод отклонён.
- Повтор idempotency key не удваивает перевод.
- Два конкурентных перевода не могут потратить одни и те же средства.
- Неавторизованный пользователь не вызывает RPC.
- Пользователь A не читает транзакции пользователя B, если он не является участником операции.
- Каждая операция сбалансирована по активу.
- Faucet можно получить один раз на wallet, не один раз глобально.
