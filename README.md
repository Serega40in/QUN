# QUN Messenger

Минималистичный Android-мессенджер экосистемы КЮН.

## Сейчас
- Android-приложение на Kotlin + Jetpack Compose
- фирменный QUN UI: белый / глубокий синий / изумруд / сдержанное золото
- экран авторизации по номеру телефона
- MVP-переход в мессенджер
- список чатов
- GitHub Actions для автоматической сборки debug APK

## Следующий этап
1. Реальная SMS-авторизация (Firebase Auth / Supabase + SMS provider)
2. Backend API + PostgreSQL
3. WebSocket real-time сообщения
4. Профили и поиск пользователей
5. Фото / файлы / голосовые
6. Push-уведомления
7. Группы и каналы
8. QUN Wallet и интеграция QUN Coin

Архитектурный принцип: **QUN Messenger → QUN Platform → QUN Wallet → QUN AI → QUN Coin**.

> На первом этапе мы строим собственный продукт и собственный UX, а не копию Telegram.
