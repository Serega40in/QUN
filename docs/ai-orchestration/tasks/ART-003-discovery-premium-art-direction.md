# ART-003 — QUN Discovery premium art direction

**Status:** Ready for an art agent  
**Repository:** https://github.com/Serega40in/QUN  
**Start here:** [AI orchestration hub](../README.md)  
**Game:** [discovery.html](../../miniapp/discovery.html)  
**Current assets:** [asset README](../../miniapp/assets/discovery/README.md)

## Mission

Upgrade the existing lightweight hand-authored SVG pack into a cohesive, premium-quality illustrated exploration world without breaking gameplay. This is an art task, not permission to rewrite the game, publish, or spend money.

## Art direction

A luminous, nature-positive fantasy archipelago in a polished storybook game-art style: atmospheric depth, tactile natural materials, readable silhouettes, intentional composition, subtle magical wonder, warm sunlight, and restrained detail. Palette: deep ocean blue, turquoise, emerald and forest greens, pale ivory clouds, natural stone, selective gold accents. Mood: curiosity, kindness, ecological care, learning, community and peaceful optimism.

No combat, weapons, casino/loot-box cues, coins or crypto imagery, financial promises, text, fake typography, logos, UI, watermark, signature, copied franchise characters, or recognizable imitation of a specific artist.

## Target assets

Keep the current paths unless a reviewed alternative format requires updating the manifest:
- `docs/miniapp/assets/discovery/backgrounds/island-archipelago-bg.svg` — wide archipelago panorama with distinct island silhouettes and safe center crop.
- `docs/miniapp/assets/discovery/locations/forest-sanctuary.svg` — welcoming forest clearing, winding path, luminous canopy and biodiversity.
- `docs/miniapp/assets/discovery/locations/mountain-observatory.svg` — recognizable observatory on a green mountain ridge, sunrise and layered peaks.
- `docs/miniapp/assets/discovery/locations/welcoming-village.svg` — sustainable village, gardens, shared spaces and human scale.
- `docs/miniapp/assets/discovery/locations/river-delta.svg` — clear branching water, wetland plants and birds.
- `docs/miniapp/assets/discovery/locations/golden-lighthouse.svg` — strong lighthouse silhouette, golden beacon, cliffs and sea.

## Shared generation prompt

> Create original premium environmental game art for “QUN Discovery”, a peaceful nature-and-science exploration game set on a luminous archipelago. Sophisticated storybook game illustration, layered atmospheric depth, intentional readable composition, refined materials and texture, restrained emerald/teal/ocean-blue palette with warm sunlight and small gold accents. Communicate curiosity, ecological care, learning, community, hope and quiet wonder. Mobile-first readability, clean silhouette hierarchy, balanced negative space, polished production-art finish. No text, typography, logos, UI, watermark, signature, weapons, combat, coins, crypto symbols, casino cues, copyrighted characters or recognizable franchise elements. Match the shared visual language across all assets.

Tailor the composition to each asset listed above. No text should be embedded in the art. Keep focal subjects away from edges for responsive crops.

## Technical requirements

- Target under 1.5 MB total for six assets where feasible; measure and report actual byte sizes.
- Prefer optimized WebP for raster and genuine SVG for vector art. Never call a large embedded raster “vector”.
- No remote images, fonts, scripts, tracking, or runtime generation calls.
- Update `manifest.json` and asset README with dimensions, format, provenance, tool/model if known, license/usage rights, and external-reference status.
- Preserve relative paths, alt text, missing-image fallback, keyboard access, reduced-motion support, score rules, tasks, reset and local persistence.
- Do not describe local points as cryptocurrency, transferable rewards, or money.

## Definition of done

- [ ] Six assets have one coherent visual language and recognizable silhouettes at phone-thumbnail size.
- [ ] Actual sizes are measured and documented.
- [ ] Provenance and rights are documented honestly.
- [ ] Local references and manifest validate; no external runtime requests.
- [ ] Static tests and CI pass.
- [ ] Desktop and narrow-phone screenshots are reviewed.
- [ ] Existing gameplay is unchanged.
- [ ] PR states exactly which tests ran and what remains unverified.

## Agent contract

Read the hub, game HTML, asset README and manifest first. Work in a focused feature branch. Do not replace assets blindly. Report changed paths, screenshots, sizes, tests, provenance and limitations. If image generation is unavailable, improve the brief or hand-authored vectors and say so. No paid services, merging, or deployment without explicit approval.
