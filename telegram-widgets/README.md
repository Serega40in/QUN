# QUN Telegram Widgets

Prototype pack for Telegram Bot API 10.4 native HTML widgets.

These are **widget source files**, not published Telegram messages. To send them in production, the QUN bot backend must call `sendWidget` with the HTML source and handle `widget_query` updates. Telegram currently supports sending widgets in production only in private chats between users and bots; groups, inline mode and forwarding remain test-server-only. Widgets cannot be posted directly to channels.

## Prototypes

- `daily-intention.html` — a small daily intention picker (local interaction; no backend needed).
- `qun-pulse.html` — community pulse with bot-backed vote requests.
- `roadmap-vote.html` — choose the next QUN feature with bot-backed vote requests.

## Send a widget

Use Bot API 10.4+:

```json
{
  "chat_id": 123456789,
  "html": "<the full contents of the selected HTML file>",
  "caption": "QUN • Daily intention",
  "allow_queries": true
}
```

For the local-only intention picker, omit `allow_queries`. HTML is immutable after sending; to change the design, send a new widget. Keep the caption descriptive for notifications and clients that do not support widgets.

## Backend contract

For the voting prototypes, handle `widget_query.data` values such as `pulse:calm`, `pulse:clarity`, `roadmap:messenger`, `roadmap:ai`, and `roadmap:market`. Validate every value, apply rate limits / duplicate-vote rules, call `answerWidgetQuery` within 15 seconds, and update widget state using `editMessageWidgetData` or `editSharedWidgetData` if live results are implemented. Never trust the widget as the source of truth.

Official docs: https://core.telegram.org/bots/widgets
