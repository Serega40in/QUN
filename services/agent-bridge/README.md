# QUN Agent Bridge 0.1

Локальный мост между MCP-совместимым ИИ-агентом и браузером пользователя.

**Статус:** ранний прототип. Не production-ready.

## Что входит в первую версию

- локальный MCP-сервер на Node.js;
- расширение Chrome / Chromium Manifest V3;
- просмотр списка вкладок после отдельного разрешения;
- чтение текста активной или выбранной вкладки после разрешения конкретного сайта;
- открытие HTTP- и HTTPS-адресов в новой вкладке;
- токен для аутентификации расширения;
- локальный WebSocket, привязанный только к 127.0.0.1.

В этой версии нет управления кликами, ввода текста, отправки форм, покупок, удаления файлов или скрытого управления устройством. Эти действия будут рассматриваться отдельно, с пользовательским подтверждением.

## Требования

- Node.js 20 или новее;
- Chrome / Chromium 116 или новее;
- любой MCP-хост, который может запускать локальный MCP-сервер через stdio.

Пакеты MCP SDK, Zod и ws устанавливаются из npm. Сам проект и локальный режим не требуют платного API или облачного аккаунта.

## Установка без Git (самый простой способ для Windows)

Git устанавливать необязательно. Скачай ZIP-архив этой ветки:

https://github.com/Serega40in/QUN/archive/refs/heads/feature/qun-agent-bridge-v0.1.zip

1. Распакуй архив. Внутри появится папка `QUN-feature-qun-agent-bridge-v0.1`.
2. Открой PowerShell и перейди в папку проекта (если архив распакован в Downloads):

    ```powershell
    cd "$HOME\Downloads\QUN-feature-qun-agent-bridge-v0.1\services\agent-bridge"
    ```

   Если Windows распаковала архив в другое место, замени путь на фактический.
3. Проверь, установлен ли Node.js:

    ```powershell
    node --version
    npm --version
    ```

   Нужен Node.js версии 20 или новее. Если команда `node` не распознана, установи актуальный Node.js LTS с официального сайта https://nodejs.org/ и заново открой PowerShell.
4. Установи зависимости и создай локальный токен:

    ```powershell
    npm install
    npm run token
    ```

5. Дальше следуй разделу «Установка расширения».

## QUN Agent Core: cloud API + local Windows worker

This is the first cloud-control-plane slice. It lets an authenticated QUN local worker poll a strict allow-listed browser command queue; it does not expose an arbitrary shell.

### One-time setup

1. Ensure the Chrome/Chromium QUN Agent Bridge extension is installed. The token for the extension must match the encrypted local token at `%APPDATA%\QUNAgentBridge\bridge-token.dpapi`. If the file is missing, the setup script will prompt for the original token once.
2. Run `Configure-Cloud-Agent.cmd` by double-clicking it.
3. The wizard creates independent random keys and stores them with Windows DPAPI. It copies `QUN_AGENT_DEVICE_KEY` to the clipboard; paste it into the project's [Supabase Edge Function secrets](https://supabase.com/dashboard/project/qdxjltqlnphvzafapncm/functions/secrets) as a secret named `QUN_AGENT_DEVICE_KEY`. Then the wizard copies `QUN_AGENT_MCP_KEY`; save it under that exact name too.
4. Double-click `Start-QUN-AGENT-CORE.cmd`. Keep the window open for the first verification. It starts the local WebSocket bridge and polls the cloud API using outbound HTTPS.
5. In the browser extension popup, click Connect if needed. Open `http://127.0.0.1:43127/` and verify that the browser status is connected.
6. Verify the cloud endpoint in a browser:
   `https://qdxjltqlnphvzafapncm.supabase.co/functions/v1/qun-agent-core/health`
   Both `authenticationConfigured.mcp` and `authenticationConfigured.device` should be `true`.

The local worker makes outbound HTTPS requests; do not forward ports on your router. Secrets are stored encrypted for the Windows user and are never committed to Git.

### Cloud MCP endpoint

`https://qdxjltqlnphvzafapncm.supabase.co/functions/v1/qun-agent-core/mcp`

Configure an MCP client with Streamable HTTP using two headers: `apikey: sb_publishable_aCUwbGYj_kUU8nVUu1kWmQ_-d-8fp8L` and `x-qun-agent-key: <your QUN_AGENT_MCP_KEY>`. The publishable key is a public project identifier; only the second header is secret. The secret is stored in the MCP client's credential settings, never in this repository.

The current ChatGPT Free plan cannot connect custom MCP servers directly from ChatGPT Web. The assistant in this session can still use the already-connected QUN Supabase integration to create an allow-listed command row and read its result, once the local worker is online. On plans/surfaces that support custom MCP, the remote endpoint provides the same tools directly.

### Cloud API endpoints

- `GET /health` — public, non-sensitive service health and boolean secret-configuration status.
- `POST /agent/heartbeat` — authenticated local worker publishes device status.
- `POST /agent/next` — authenticated worker claims one queued allow-listed command.
- `POST /agent/result` — authenticated worker posts the command result.
- `POST /mcp` — authenticated MCP Streamable HTTP endpoint.

MCP tools currently exposed: `qun_agent_status`, `qun_browser_list_tabs`, `qun_browser_read_active_page`, `qun_browser_open_url`, and `qun_agent_get_command_result`.

### Safety scope

- The cloud queue accepts only `browser.list_tabs`, `browser.read_active_page`, and `browser.open_url`.
- There is no arbitrary command, shell, file deletion, payment, or form-submission API.
- The browser extension still enforces site-specific read permission and optional permission for listing tabs.
- Device and MCP keys are separate. The Edge Function checks authentication before any state-changing operation.
- This is a first working slice, not yet a Windows service or an Android control agent.

## Установка в Claude Desktop (рекомендуемый путь для локальной проверки)

Для Claude Desktop подготовлен self-contained пакет MCPB, который не требует npm-зависимостей и ручного редактирования конфигурационного JSON:

- Исходник MCPB: [claude-mcpb](claude-mcpb/README.md)
- Манифест: [manifest.json](claude-mcpb/manifest.json)
- Сервер без внешних runtime-зависимостей: [server/index.js](claude-mcpb/server/index.js)
- Помощник копирования токена: [scripts/Copy-Token-To-Clipboard.cmd](scripts/Copy-Token-To-Clipboard.cmd)

Чтобы собрать установочный пакет из исходников, в каталоге `services/agent-bridge/claude-mcpb` выполни `npx -y @anthropic-ai/mcpb pack`. Готовый файл `.mcpb` устанавливается в Claude Desktop через Settings → Extensions → Advanced settings → Install Extension.

Перед установкой останови вручную запущенный Node.js сервер, если он слушает порт 43127. В Chrome расширение должно остаться установленным. При конфигурации MCPB вставь тот же токен, который сохранён в расширении; поле чувствительного значения Claude Desktop хранит через ОС.

Текущая реализация предоставляет только чтение разрешённых страниц, список вкладок (с отдельным разрешением) и открытие HTTP(S)-адресов. Клики, ввод текста и управление Windows/Android пока не реализованы.

## Удобная установка на Windows и подключение к ChatGPT Desktop

После установки Node.js, `npm install` и браузерного расширения можно больше не запускать MCP Inspector вручную.

1. Проверь, что расширение QUN Agent Bridge установлено и в нём сохранён токен.
2. Закрой тестовый Node.js сервер, если он запущен в отдельном PowerShell окне (Ctrl+C).
3. Дважды щёлкни `SETUP-QUN-AGENT-BRIDGE.cmd` в этой папке.
4. Введи тот же токен, который уже сохранён в расширении. Поле ввода скрыто.
5. Установщик сохранит токен в Windows DPAPI-хранилище текущего пользователя (`%APPDATA%\QUNAgentBridge\bridge-token.dpapi`). Он намеренно не меняет `config.toml`.
6. В ChatGPT Desktop открой Settings → MCP servers → Add server. Укажи:
   - Name: `QUN Agent Bridge`
   - Transport: `STDIO`
   - Command: `powershell.exe`
   - Arguments: строку, которую установщик покажет в конце (начинается с `-NoLogo -NoProfile`).
7. Сохрани сервер и нажми Restart. Открой расширение Chrome и нажми Connect, если оно ещё не подключилось.

ChatGPT Desktop, Codex CLI и расширение Codex используют общий MCP-конфиг Codex host. В нём поддерживаются локальные STDIO MCP-серверы. В чате ChatGPT Web локальный MCP-процесс напрямую не виден; для веб-подключения нужен удалённый MCP endpoint или Secure MCP Tunnel на поддерживаемом тарифе/поверхности.

После запуска MCP-сервера открой локальную панель:

    http://127.0.0.1:43127/

Она показывает состояние сервера и браузерного соединения. Состояние API:

    http://127.0.0.1:43127/health

Сервер по-прежнему привязан только к loopback-интерфейсу. Не открывай порт 43127 в роутере и не публикуй его в интернете.

## Установка локального сервера

Из этой папки выполни:

    npm install
    npm run token

Команда token выведет случайный секрет из 64 hex-символов. Сохрани его в менеджере паролей или локально. Не отправляй токен в чат и не добавляй его в Git.

## Установка расширения

1. Открой chrome://extensions.
2. Включи режим разработчика.
3. Нажми «Загрузить распакованное расширение».
4. Выбери папку services/agent-bridge/extension.
5. Открой меню расширения, вставь токен из npm run token и нажми «Сохранить токен и подключиться».

Для чтения сайта открой нужную страницу и в popup нажми «Разрешить чтение текущего сайта». Разрешение выдаётся для одного origin, например https://example.com.

Для списка вкладок отдельно нажми «Разрешить просмотр всех вкладок». Это разрешение открывает агенту метаданные всех вкладок, включая заголовки и URL.

## Подключение к MCP-хосту

Локальный MCP-сервер запускается самим MCP-хостом. В его конфигурации добавь сервер:

    {
      "mcpServers": {
        "qun-agent-bridge": {
          "command": "node",
          "args": [
            "C:/path/to/QUN/services/agent-bridge/src/index.js"
          ],
          "env": {
            "QUN_AGENT_TOKEN": "ВСТАВЬ_СЮДА_ТОТ_ЖЕ_64-СИМВОЛЬНЫЙ_ТОКЕН"
          }
        }
      }
    }

Замени путь на реальный путь к репозиторию на своём компьютере. Используй тот же токен, что сохранён в расширении. После изменения конфигурации перезапусти MCP-хост.

При запуске сервер откроет локальный endpoint состояния:

    http://127.0.0.1:43127/health

Он доступен только на этом компьютере и не предназначен для публикации в интернете.

## Доступные MCP-инструменты

| Инструмент | Назначение |
| --- | --- |
| browser_status | Состояние локального подключения |
| browser_list_tabs | Список вкладок; требует разрешение tabs |
| browser_read_active_page | Чтение текста страницы; требует разрешение сайта |
| browser_open_url | Открытие HTTP(S)-адреса в новой вкладке |

Содержимое веб-страниц считается недоверенными данными. Веб-страница может содержать попытки prompt injection; агент должен анализировать её как материал, а не исполнять инструкции страницы.

## Безопасность

- Сервер привязывается только к 127.0.0.1; изменение на 0.0.0.0 запрещено.
- WebSocket принимает соединения только от loopback и Chrome Extension Origin.
- Расширение и сервер обмениваются случайным токеном; токен не хранится в репозитории.
- Разрешение на чтение страниц выдаётся пользователем отдельно для каждого сайта.
- Разрешение tabs запрашивается отдельно.
- Чтение ограничено 14 000 символами за один вызов.
- Внутренние страницы браузера, file://, javascript:, data: и URL с встроенными учётными данными не поддерживаются.
- Не запускай локальный мост из неизвестного MCP-хоста и не передавай токен сторонним приложениям.

## Проверка

    npm test

Проверки тестируют валидацию URL. Ручная интеграционная проверка требует установленного Chrome/Chromium и MCP-хоста.

## Дальнейший план

1. Подтвердить работу на Windows + Chrome.
2. Добавить отдельный экран очереди действий с ручным подтверждением.
3. Добавить безопасные click/type только для явно выбранной вкладки и после подтверждения.
4. Изучить поддержку Firefox.
5. Отдельно спроектировать Windows desktop agent и Android companion.

## Лицензия

MIT. См. LICENSE.
