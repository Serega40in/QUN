# QD-001 — Audit and verify Discovery game MVP

**Status:** Ready. **Goal:** verify the actual static game in PR #20 and fix evidence-backed defects without widening scope.

## Copy-ready prompt

> Audit the QUN Discovery browser-game MVP in `docs/miniapp/discovery.html` on the implementation branch and PR https://github.com/Serega40in/QUN/pull/20. First inspect repository conventions and the full source. Do not assume the page is deployed or browser-tested. Test or statically verify every interactive location, task completion, one-time points, reload persistence, reset, keyboard accessibility, mobile layout, reduced-motion behavior, safe dynamic DOM insertion, and graceful handling of missing/corrupt localStorage. Use the available environment honestly: run syntax checks or automated tests if possible; if no browser is available, state that limitation and do not invent visual results. Fix concrete defects only, add reproducible tests where practical, and document commands/results. Keep this a static client-side prototype: no accounts, server, wallet, token, payment, analytics, or QUN Node integration. Work on a dedicated branch and open a focused PR; do not merge or deploy.

## Checklist

- [ ] Source and repository state inspected.
- [ ] Inline JavaScript syntax checked using an available parser/runtime, or blocker stated.
- [ ] Visit each of the five places; points are awarded only once per place.
- [ ] Mission/task progress updates correctly.
- [ ] Reload persistence works; reset clears all intended local progress.
- [ ] Invalid/missing saved state cannot crash the game.
- [ ] Keyboard operation and focus states are usable; accessible labels exist.
- [ ] Narrow/mobile viewport and reduced-motion behavior reviewed where tooling permits.
- [ ] No external requests, tracking, credentials, or unsafe HTML injection added.
- [ ] Test evidence and remaining gaps recorded in PR.
