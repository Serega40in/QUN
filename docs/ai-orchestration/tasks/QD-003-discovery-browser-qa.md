# QD-003 — QUN Discovery browser QA and responsive verification

**Status:** Ready for browser-testing agent / human reviewer  
**Game:** [`docs/miniapp/discovery.html`](../../miniapp/discovery.html)  
**Assets:** [Discovery asset pack](../../miniapp/assets/discovery/README.md)  
**Orchestration hub:** [README](../README.md)

## Goal

Verify the playable Discovery MVP in a real browser, including responsive layout and actual interactions. Static tests and CI are useful but do not prove browser behavior or GitHub Pages publication.

## Browser matrix

Test the local file through a local static HTTP server where possible, then test the published Pages URL only after its availability is independently confirmed.

Minimum viewport matrix:
- Desktop: 1440 × 900
- Laptop: 1280 × 720
- Tablet portrait: 768 × 1024
- Phone: 390 × 844
- Narrow phone: 320 × 700

Use Chromium and, if available, one additional browser engine. Capture screenshots at each viewport. Do not fabricate screenshots or report a test as passed without running it.

## Functional test checklist

- [ ] Page loads without uncaught JavaScript errors.
- [ ] Panorama and all five location illustrations load; no broken local requests.
- [ ] Every location can be selected by mouse/touch and keyboard.
- [ ] Selected-location title, description and illustration match the selected location.
- [ ] Visit a location and verify points/progress update once.
- [ ] Revisit the same location; points must not be awarded twice.
- [ ] Complete the three-location task and confirm its state.
- [ ] Complete the impact-learning task and confirm its state.
- [ ] Refresh the page; local progress persists.
- [ ] Corrupt localStorage with unknown and duplicate place IDs; the app must recover safely and not inflate points.
- [ ] Reset progress; score and tasks return to the initial state.
- [ ] Disable or block one illustration; text and interactions remain usable.
- [ ] Check browser console and network panel for errors and unexpected external requests.
- [ ] Verify visible focus, sensible tab order, accessible names, and reduced-motion behavior.
- [ ] Confirm no horizontal overflow or clipped controls at every viewport.

## Playwright agent prompt

> Work in the QUN repository. Read `docs/miniapp/discovery.html`, `docs/ai-orchestration/tests/discovery-static.test.mjs`, and this QA checklist. Add a minimal, reproducible Playwright browser smoke-test setup only if the repository's existing test conventions support it. Keep dependency changes narrowly scoped and pin versions. Serve the static game using a local HTTP server, not a `file://` URL. Test initial load, selecting all five locations, once-only scoring, persistence after reload, reset, malformed saved progress, missing-image fallback, and the viewport matrix above. Capture screenshots as CI artifacts when possible. Do not change gameplay behavior to make tests pass. Do not claim GitHub Pages is live unless the exact URL is successfully opened and tested. Report exact commands, browser versions, results, screenshots/artifacts, and failures. Open a feature branch and PR; do not merge it.

## Publication check

Expected URL if the repository's GitHub Pages source is the `docs` folder:

`https://serega40in.github.io/QUN/miniapp/discovery.html`

This is an expected URL pattern, **not a statement that the page is currently published**. Verify the configured Pages source and make a real HTTP/browser request before calling it live. If publication cannot be checked, report it as unverified.

## Completion report template

- Commit / PR:
- Browsers and versions:
- Viewports tested:
- Commands executed:
- Automated test results:
- Manual interaction results:
- Screenshots / artifacts:
- Pages URL verified (yes/no, with evidence):
- Known issues:
