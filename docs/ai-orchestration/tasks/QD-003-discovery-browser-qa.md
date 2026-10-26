# QD-003 — Discovery real-browser and responsive QA

**Status:** Ready for a browser-testing agent; not yet executed  
**Game:** [discovery.html](../../miniapp/discovery.html)  
**Assets:** [Discovery art README](../../miniapp/assets/discovery/README.md)  
**Hub:** [AI orchestration README](../README.md)

## Goal

Verify real browser behavior. Static tests and CI do not prove interactive behavior or publication of GitHub Pages.

## Viewport matrix

- Desktop: 1440 × 900
- Laptop: 1280 × 720
- Tablet portrait: 768 × 1024
- Phone: 390 × 844
- Narrow phone: 320 × 700

Test with a local static HTTP server and then separately test the published Pages URL only if it can be independently opened. Use Chromium and one additional engine if available. Save genuine screenshots; never fabricate evidence.

## Functional checklist

- [ ] Page loads without uncaught JavaScript errors.
- [ ] Panorama and five location illustrations load with no broken local requests.
- [ ] All locations are selectable by mouse/touch and keyboard; labels and detail content match selection.
- [ ] First visit awards points once; revisiting gives no duplicate points.
- [ ] Three-location task and impact-learning task work.
- [ ] Refresh preserves progress; reset returns to initial state.
- [ ] Unknown and duplicate IDs injected into localStorage do not inflate points or crash the page.
- [ ] Blocking one illustration leaves text and interactions usable.
- [ ] No console errors or unexpected external requests.
- [ ] Visible focus, sensible tab order, accessible names, and reduced-motion behavior are verified.
- [ ] No horizontal overflow or clipped controls at any viewport.

## Prompt for a browser automation agent

> In the QUN repo, read this checklist, `docs/miniapp/discovery.html`, and `docs/ai-orchestration/tests/discovery-static.test.mjs`. Inspect existing test conventions before adding Playwright. If appropriate, add a minimal reproducible Playwright setup with pinned dependencies and a local static HTTP server (not `file://`). Test initial load, all five locations, once-only scoring, persistence, reset, malformed saved progress, missing-image fallback, and the viewport matrix. Capture screenshots as CI artifacts if possible. Do not alter game behavior just to pass tests. Report exact commands, browser versions, actual results, screenshots/artifacts, failures, and limitations. Open a focused PR; do not merge it.

## GitHub Pages check

Expected URL if Pages publishes the repository's `docs` folder:

`https://serega40in.github.io/QUN/miniapp/discovery.html`

This is only the expected URL pattern, not proof the page is published. Verify Pages configuration and make an actual HTTP/browser request before calling it live.

## Completion report

- Commit / PR:
- Browsers and versions:
- Viewports tested:
- Commands executed:
- Automated results:
- Manual interaction results:
- Screenshots / artifacts:
- Pages URL verified (yes/no, evidence):
- Known issues:
