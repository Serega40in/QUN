# QUN Mobile Browser Agent

## Current implementation

QUN Android includes a native WebView browser and a paired agent channel backed by the existing QUN Agent Core / Supabase infrastructure.

## Connect the phone

1. Install the latest signed QUN APK (version 0.18.0 / versionCode 19).
2. Sign in with QUN ID.
3. Open **Браузер** from the app's top bar.
4. Tap **Подключить** in the QUN Agent panel.
5. Keep the browser screen open and the phone connected to the internet while issuing remote commands.

The app creates a short-lived pairing code through the authenticated QUN ID session, pairs the device as `qun-android-main`, and stores the device token encrypted with Android Keystore. The pairing code is single-use and expires after five minutes.

## Supported commands

Commands are stored in `public.qun_agent_commands` and consumed by the phone's QUN browser agent.

- `browser.list_tabs`
- `browser.read_active_page`
- `browser.open_url`
- `browser.execute_plan`

The mobile agent polls while the browser screen is active and sends results back to the same command record. It sends periodic heartbeats to `public.qun_agent_devices`.

## Safety boundaries

- The user signs into websites directly in the browser; website passwords are not sent to QUN Agent Core.
- Password fields cannot be filled by the remote browser plan.
- Submit/publish, delete, send, payment, and similar destructive/transaction buttons are blocked by the mobile agent.
- Final publication or other consequential actions must be completed by the user until an explicit confirmation flow is implemented.
- Commands are limited to navigation, page reading, ordinary clicks, text entry, scrolling, and short waits.

## Backend

- Edge Function: `qun-agent-core`
- Authenticated pairing endpoint: `POST /pult/create-pairing` (QUN ID access token)
- Device pairing: `POST /pult/pair`
- Device heartbeat/queue/result endpoints: `/pult/heartbeat`, `/pult/peek`, `/pult/claim`, `/pult/result`
- MCP tools added for mobile browser: `qun_mobile_browser_status`, `qun_mobile_browser_list_tabs`, `qun_mobile_browser_read_page`, `qun_mobile_browser_open_url`, `qun_mobile_browser_execute_plan`

This is an initial foreground-agent release. Background execution when the app is closed, independent per-tab WebView sessions, and a dedicated in-app approval screen for consequential actions are not implemented yet.
