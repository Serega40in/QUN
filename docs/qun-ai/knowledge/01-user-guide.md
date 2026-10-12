# QUN AI — user guide for the QUN ecosystem
Version: 1.0 · Updated: 2026-10-12

Only the Messenger currently has a verified public entry point in the project inventory. Other product flows must not be described as live until checked.

## 1. Getting started with QUN Messenger
Open: https://serega40in.github.io/QUN/

The documented MVP supports username/password access, user profiles, user search and personal text conversations.

### Create an account / sign in
1. Open the official web app.
2. Use the registration option shown in the current interface if you are a new user.
3. Choose a username and a strong, unique password.
4. To return, use your username (or linked phone number, if configured) and password.
5. SMS sign-in is currently disabled by project decision. Do not wait for an SMS code unless a later release explicitly restores that flow.

If the actual interface differs from these steps, follow the current app interface and report the discrepancy. Never send a password to another user or support.

### Find a person and start a conversation
1. Open the user search in the app.
2. Search by display name or exact @username.
3. Check the profile carefully so you do not message the wrong person.
4. Open the personal conversation or create one using the controls currently available.
5. Send a short test message and confirm it appears.
6. If the person is found but cannot be messaged, possible causes include account state, conversation permissions or a current app limitation. Do not claim the user has been blocked or that messages were delivered unless the app confirms it.

### If messages do not appear
- Refresh once and check the connection.
- Confirm you are signed into the intended account.
- Try a short message with the other participant online.
- Do not share screenshots exposing private messages, tokens or personal information publicly.
- If the issue persists, record approximate time, browser/device and a redacted error. Never include passwords, access tokens or private keys.

### Privacy and security
- Use a unique password and sign out on shared devices.
- The privacy page is a draft and may need operator details and legal review: https://serega40in.github.io/QUN/privacy.html
- Do not assume end-to-end encryption is available unless an official release confirms it.
- Never share passwords, recovery codes, seed phrases or private keys with anyone claiming to be support.

## 2. QUN AI
Open: https://serega40in.github.io/QUN/qun-ai/

QUN AI is intended to help users understand the ecosystem, navigate available features and find official information. It should provide concise steps and relevant verified links. If it cannot verify current feature status, it must say so rather than fabricate a tutorial.

Useful questions:
- “Как войти в QUN Messenger?”
- “Как найти пользователя по @username?”
- “Что уже работает в QUN, а что пока в разработке?”
- “Где посмотреть официальный статус QUN Wallet?”
- “Как подключить компьютер как тестовый QUN Node?” — only when an approved installation guide exists.

## 3. QUN Platform / QUN Market
The intended direction is a marketplace/platform for products and services, potentially with AI help preparing product cards. This source does not verify a released seller dashboard or working “add product” flow.

If asked how to list a product:
1. Check the current official platform link and release notes.
2. If live listing is confirmed, explain the actual fields and controls from verified UI.
3. If it is not available, explain that listing/publishing is still being developed. Do not invent a URL, buttons, payment, moderation, shipping or seller fees.

Potential future listing checklist (planning only, not a live workflow):
- Product name and category
- Clear description and real specifications
- Price and currency
- Original photos the seller has rights to use
- Availability, delivery/pickup terms and location if relevant
- Seller contact or messaging option, if supported
- Accurate claims and clear refund/return terms where applicable

Never imply a draft product is publicly listed or payment has been received without confirmation.

## 4. QUN Wallet and QUN Coin
Wallet and cryptocurrency user flows are not verified as released by this guide. Do not ask users to send funds, import seed phrases into a website, install unofficial wallet files, or use an address copied from chat.

Before giving instructions, verify:
- official release announcement and app URL;
- supported network and chain ID;
- official contract/token address, if applicable;
- deposit/withdrawal and fee behavior;
- transaction confirmation method;
- wallet recovery/security instructions;
- independent contract/security review status, if available.

If unverified, say: “QUN Wallet / public QUN Coin transactions are not yet confirmed as available for general use. I don't want to risk your funds by giving you an unverified address or procedure.”

## 5. QUN Node and distributed storage
QUN's architecture direction is gradual decentralization. The first planned engineering milestone is Node 0.1 and Storage 0.1 on test data and several independent nodes.

Until an official installation guide and testnet are released:
- Do not ask users to install random scripts or expose ports.
- Do not store private messages, real user data, credentials or keys on volunteer nodes.
- Do not promise rewards for running a node unless an official approved rewards program exists.
- Treat health indicators in static Guardian as demonstration UI, not proof of live network status.

Architecture: https://github.com/Serega40in/QUN/blob/main/docs/architecture/distributed-backend.md

## 6. QUN MAP
QUN MAP is paused as of 2026-10-12. Explain that the branch is frozen for now and may be revisited later; do not describe it as an active released service.

## 7. Safe escalation
When a feature is not confirmed, use:
“I can explain the intended design, but I can't confirm this feature is available in the current release. Here is the official project page I can verify: https://github.com/Serega40in/QUN. I won't invent instructions that could cause you to lose access or funds.”

For technical issues, ask for a redacted error description. Do not request credentials or secrets.