# КЮН / QUN

Единая цифровая экосистема: мессенджер, платформа и будущие сервисы КЮН.

## QUN Ecosystem

- **Страница концепции:** https://serega40in.github.io/QUN/ecosystem/
- **QUN Foundation — рабочий пакет учреждения и первого транша:** https://serega40in.github.io/QUN/foundation/
- **Документы и финансовая модель фонда:** [папка foundation](docs/foundation/00-start.md)
- **Проект устава:** [рабочая редакция 0.1](docs/foundation/ustav-proekt.md)
- **Проект решения учредителей:** [шаблон](docs/foundation/reshenie-uchreditelya-proekt.md)
- **Тестовая модель первого транша 1 000 000 ₽:** [финансовая модель](docs/foundation/finmodel-1m.md)
- **Подготовка регистрации:** [чек-лист](docs/foundation/checklist-registracii.md)

> Документы фонда — проекты для юридической проверки. Не считать фонд зарегистрированным до внесения записи в ЕГРЮЛ. Не публиковать персональные данные учредителей.

## База знаний QUN AI и архитектура

- **Русская база знаний QUN AI:** [главный источник фактов](docs/qun-ai/knowledge/00-glavnaya-baza-znaniy.md), [руководство пользователя](docs/qun-ai/knowledge/01-rukovodstvo-polzovatelya.md), [каталог проектов](docs/qun-ai/knowledge/03-katalog-proektov-qun.md), [правила ответов](docs/qun-ai/knowledge/02-pravila-otvetov-i-testy.md).
- **QUN Node:** [страница проекта](https://serega40in.github.io/QUN/node/), [веб-панель локального узла](https://serega40in.github.io/QUN/node/dashboard/), [спецификация](docs/qun-ai/knowledge/04-qun-node-storage-01.md), [исходный код и инструкции](services/qun-node/README.md). Windows EXE/установщик и Android APK собираются отдельными workflow GitHub Actions; до проверки артефактов и выпуска подписанных релизов считать их тестовыми сборками.
- **Распределённая архитектура:** [документ v0.1](docs/architecture/distributed-backend.md).
- **Важно:** наличие документации не означает автоматическое обучение QUN AI. Подключение runtime-инструкции к Supabase Edge Function требует успешного развёртывания и проверки.

## QUN Wallet и распределённая сеть

- **QUN Wallet (testnet MVP):** https://serega40in.github.io/QUN/qun-wallet/
- **Описание кошелька и ограничения:** [docs/qun-wallet/README.md](docs/qun-wallet/README.md)
- **QUN Node + Storage:** [проект](https://serega40in.github.io/QUN/node/), [панель](https://serega40in.github.io/QUN/node/dashboard/)
- **План мощности для 1 млн активных пользователей и пилота 100+ устройств:** [capacity plan v0.1](docs/architecture/qun-network-capacity-plan-v0.1.md)

> QUN Wallet сейчас использует внутренний тестовый ledger в Supabase, а не блокчейн. Тестовые QUN не имеют денежной стоимости. Реальные выплаты, mainnet и публичная сеть из 100+ устройств не запущены; для них нужны отдельные криптографические, нагрузочные и security-аудиты.

## Проекты

- **Веб-мессенджер:** https://serega40in/QUN/
- **Политика конфиденциальности (проект, требует заполнения данных оператора):** https://serega40in.github.io/QUN/privacy.html
- **Android:** Kotlin + Jetpack Compose, пакет `com.qun.messenger`.
- **Backend:** Supabase Auth + PostgreSQL + Row Level Security.
- **Сборка Android:** GitHub Actions workflow `.github/workflows/build-apk.yml`.
- **Публикация веб-версии:** `.github/workflows/deploy-web.yml`.

## Возможности MVP

- регистрация по username и паролю без SMS;
- вход по username или привязанному телефону и паролю;
- профили и поиск пользователей по имени и @username;
- создание личных диалогов и отправка сообщений;
- обновление переписки и списка диалогов с периодическим опросом;
- адаптивный веб-интерфейс и Android-клиент.

Веб- и Android-клиенты используют общий Supabase-проект. В клиентском приложении применяется только публичный publishable key; секретные серверные ключи должны храниться только на стороне сервера.

## Публикация веб-версии

GitHub Actions автоматически разворачивает содержимое папки `docs/` на GitHub Pages: https://serega40in.github.io/QUN/

- [Deploy QUN Web](https://github.com/Serega40in/QUN/actions/workflows/deploy-web.yml)
- [Build QUN Android APK](https://github.com/Serega40in/QUN/actions/workflows/build-apk.yml)

## Статус и ограничения перед публичным запуском

- SMS-вход отключён по решению проекта. Привязанный телефон не подтверждает владение номером без отдельной проверки.
- Старый тестовый endpoint входа отключён. Android-клиент в текущем исходном коде обращается к `qun-auth` и поддерживает вход по логину и паролю.
- Старые тестовые аккаунты могут требовать отдельной активации; не передавайте коды переноса третьим лицам.
- Перед широким запуском необходимо проверить регистрацию и переписку между двумя независимыми аккаунтами, правила доступа RLS, выход и повторный вход, восстановление доступа и удаление аккаунта.
- Политику конфиденциальности нужно дополнить достоверными данными оператора, контактами и фактическими сроками/условиями обработки данных до публичной публикации.

## Архитектура

**QUN Messenger → QUN Platform → QUN MAP → QUN Wallet → QUN AI → QUN Coin**

Текущий приоритет — надёжный вход, приватность профилей и стабильная переписка между пользователями.
