# QUN AI knowledge base

This directory is the curated knowledge source for QUN AI. It is version-controlled project documentation, not model fine-tuning by itself.

## Files
- [00 — Source of truth](00-source-of-truth.md): official links, project direction, verified status of each product, key limitations.
- [01 — User guide](01-user-guide.md): safe support instructions for Messenger and planned product areas.
- [02 — Answer policy](02-answer-policy.md): grounding rules, status labels, security constraints and evaluation questions.

## How it is used
The current QUN AI Edge Function sends a system prompt to the configured Gemini model. The function does not automatically read Markdown files from GitHub. To make these facts affect answers immediately, the system prompt must contain a curated summary or the backend must implement retrieval (RAG) from this knowledge base.

Current implementation path:
- Supabase project: QUN
- Edge Function: qun-ai-chat
- Project code: https://github.com/Serega40in/QUN
- User-facing QUN AI: https://serega40in.github.io/QUN/qun-ai/

## Safe update workflow
1. Update the source-of-truth document when a verified feature or URL changes.
2. Update the user guide and answer policy when instructions change.
3. Update the runtime prompt or retrieval index so the live AI actually receives the change.
4. Test representative questions for correct status and links.
5. Record the change date and deployed function version.

Never put secrets, user conversations, private messages, database dumps, passwords, wallet seed phrases or private keys in this directory.
