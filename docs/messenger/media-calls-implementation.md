# QUN Messenger web media and calls — implementation checklist

Status: implementation branch; not a claim of shipped functionality.

## Existing foundation
- Web client: `docs/messenger/index.html`
- Private voice bucket and conversation-member RLS: `supabase/migrations/202610130001_voice_messages_storage.sql`
- Product roadmap: this directory's `communications-roadmap.md`

## Phase 1 — voice messages and attachments
- [ ] Inspect the existing message schema and render/send functions before changing their contracts.
- [ ] Add a media composer without replacing existing text-send behavior.
- [ ] Record audio with MediaRecorder where supported; show recording duration, cancel, preview, send, upload progress and playback.
- [ ] Upload to private Supabase Storage only; store a message attachment metadata record only after upload succeeds; clean up orphaned objects on failure.
- [ ] Add a separate private attachment bucket with strict MIME/size allowlist and conversation-member RLS; never use public URLs for private messages.
- [ ] Add file picker and drag/drop, safe display name, file size, progress, retry, download; do not render arbitrary uploaded HTML/SVG inline.
- [ ] Check schema compatibility, duplicate-send handling, RLS, and mobile layouts.

## Phase 2 — 1:1 calls
- [ ] Define call state machine and authenticated signaling contract before UI work.
- [ ] WebRTC audio first, then camera video; incoming-call accept/reject, mute, camera toggle, hang-up, reconnect/failed states.
- [ ] Keep signaling records scoped to call participants; validate every operation server-side.
- [ ] Configure STUN/TURN from environment/secrets, never hardcode credentials. Document TURN deployment and cost implications.
- [ ] Test two authenticated users in separate browser profiles and Android browsers/devices, including denied permissions, NAT, network loss and cleanup.

## Verification gate
- [ ] Web and Android build/CI pass.
- [ ] Two-account tests for voice, attachments and calls pass.
- [ ] Storage access tests prove non-members cannot read, upload or delete.
- [ ] Review and merge only after the PR checks and manual test evidence.
