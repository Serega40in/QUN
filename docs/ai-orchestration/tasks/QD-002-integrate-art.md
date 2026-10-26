# QD-002 — Integrate approved art into Discovery

**Status:** Blocked by ART-001. Do not start until approved artwork exists and its paths are verified.

## Copy-ready prompt

> Read the QUN AI Orchestration Hub, inspect the current game and approved asset PRs, and verify that ART-001 artwork has been merged or is otherwise available from an agreed ref. Integrate the smallest useful subset of approved art into `docs/miniapp/discovery.html` without rewriting the game or touching the repository homepage. Keep the game fast on modest Windows laptops and phones: responsive image sizing, explicit width/height or aspect-ratio reservation, optimized formats, lazy loading where appropriate, useful alt text, and a graceful fallback if an image fails. Preserve keyboard access, contrast, reduced-motion behavior, all game mechanics, and local-only progress. Do not add external trackers, remote asset dependencies, paid services, tokens, payments, or QUN Node calls. Test paths against the eventual GitHub Pages base URL and use relative paths appropriate to the actual site structure. Run available syntax/tests and inspect screenshots at desktop/mobile sizes if browser tools are available; state any missing validation honestly. Open a focused PR and do not merge/deploy.

## Acceptance criteria

- [ ] Approved assets and exact paths verified.
- [ ] Responsive rendering and image-failure fallback work.
- [ ] No horizontal overflow at narrow widths.
- [ ] Game controls and tasks still work.
- [ ] Performance impact documented; assets are optimized.
- [ ] Alt text and accessibility retained.
- [ ] Checks and remaining gaps documented; focused PR opened.
