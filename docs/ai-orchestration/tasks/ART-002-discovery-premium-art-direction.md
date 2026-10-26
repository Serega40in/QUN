# ART-002 — QUN Discovery: premium art direction and asset upgrade

**Status:** Ready for an AI art / game-art agent  
**Parent:** QUN Discovery browser MVP and ART-001 starter vector pack  
**Repository:** https://github.com/Serega40in/QUN  
**Start here:** [AI orchestration hub](../README.md)  
**Current game:** [docs/miniapp/discovery.html](../../miniapp/discovery.html)  
**Current assets:** [Discovery assets](../../miniapp/assets/discovery/README.md)

## Mission

Elevate QUN Discovery from a functional lightweight vector prototype to a visually coherent, memorable, premium-quality illustrated exploration world. Keep it lightweight, accessible, mobile-first, and usable on modest hardware. Preserve the existing playable interactions.

This task is for a visual-art agent. Do not rebuild the game or claim that static art is a finished game.

## Visual direction

Create a warm, luminous, nature-positive fantasy archipelago: sophisticated storybook illustration with polished game-art composition, rich environmental depth, readable silhouettes, tactile painterly textures, and restrained magical details. It should feel optimistic, alive, curious, and quietly wondrous—not childish clip-art, generic AI fantasy, or a noisy UI.

Suggested palette:
- deep ocean blue and midnight teal for depth;
- lush forest green and emerald;
- warm sunlight, pale ivory clouds, muted stone;
- small gold accents for discovery / points;
- clear turquoise water and a restrained coral accent.

World identity: nature, learning, local community, science, ecological restoration, and discovery. No weapons, combat, loot-box imagery, casino cues, token/coin promises, or speculative-finance symbolism.

### Art consistency rules

- One coherent light direction, perspective language, palette, material treatment, and level of detail across all locations.
- Each location must have a distinct silhouette and instantly readable focal point.
- Keep key subjects inside a generous safe area; leave room for UI overlays and cropping.
- No embedded text, letters, logos, UI controls, watermarks, signatures, or fake typography in generated art.
- Avoid excessive tiny details that disappear on phone screens.
- Do not copy identifiable copyrighted characters, franchises, or a living artist's signature style.
- The QUN identity can be added separately as real UI/vector branding, never hallucinated inside generated images.

## Target assets and destinations

Prefer local assets committed to this repository. Keep current filenames and update them in place only when the new files have been reviewed and tested. If a new variant is needed, use a new descriptive filename and update the manifest.

| Asset | Destination | Composition |
|---|---|---|
| Island world panorama | `docs/miniapp/assets/discovery/backgrounds/island-archipelago-bg.svg` or a documented raster alternative | Wide, layered archipelago; readable island silhouettes; water, distant haze, soft sunlit path; safe center for responsive crop |
| Forest sanctuary | `docs/miniapp/assets/discovery/locations/forest-sanctuary.svg` or documented raster alternative | Ancient but welcoming forest, clear path, luminous canopy, subtle biodiversity |
| Mountain observatory | `docs/miniapp/assets/discovery/locations/mountain-observatory.svg` or documented raster alternative | Distinct mountain silhouette and small scientific observatory; sunrise / star-map mood without text |
| Welcoming village | `docs/miniapp/assets/discovery/locations/welcoming-village.svg` or documented raster alternative | Warm sustainable village, gardens, shared spaces, human scale; no identifiable people |
| River delta | `docs/miniapp/assets/discovery/locations/river-delta.svg` or documented raster alternative | Branching water, wetland plants, birds, clear ecological story |
| Golden lighthouse | `docs/miniapp/assets/discovery/locations/golden-lighthouse.svg` or documented raster alternative | Strong lighthouse silhouette, golden beacon, cliffs and sea; warm but not over-saturated |

If the tool cannot export SVG, use optimized WebP or PNG, preserve the existing relative-path structure, update `manifest.json` and its validation accordingly, and document the source/tool/license. Do not add external image URLs or runtime image-generation dependencies.

## Prompt for an image-generation agent

Use this as the shared art-direction prompt, then create one tailored prompt per asset:

> Create original premium environmental game art for “QUN Discovery”, a peaceful nature-and-science exploration game set on a luminous archipelago. Sophisticated storybook game illustration, layered atmospheric depth, intentional readable composition, refined materials and texture, rich but restrained emerald/teal/ocean-blue palette with warm sunlight and tiny gold accents. The world communicates curiosity, ecological care, learning, community, hope, and quiet wonder. Mobile-first readability, clean silhouette hierarchy, balanced negative space, polished production-art finish. No text, typography, logos, UI, watermark, signature, weapons, combat, coins, crypto symbols, casino cues, copyrighted characters, or recognizable franchise elements. Match the shared visual language across all assets.

### Asset-specific prompts

1. **Panorama:** wide cinematic archipelago viewed from a slightly elevated angle; foreground shore and foliage frame the scene, several distinct islands recede through atmospheric haze, clear turquoise channels, forest canopy, mountain peak, tiny welcoming village, river delta and lighthouse visible as separate landmarks. Preserve calm low-detail negative space in the upper area for interface text; compose for center crop on narrow screens.
2. **Forest sanctuary:** a welcoming ancient forest clearing with a winding path, luminous emerald canopy, ferns, moss, small flowers, filtered sunlight and subtle biodiversity. Strong focal clearing; no fantasy monsters.
3. **Mountain observatory:** a small elegant observatory perched on a dramatic but inviting green mountain ridge, sunrise glow, distant layered peaks and a few subtle stars fading from the sky. Observatory must remain recognizable at thumbnail size.
4. **Welcoming village:** a small sustainable village with warm timber-and-stone homes, gardens, fruit trees, community square and winding paths, nestled among green hills. Peaceful, lived-in, inviting; no text or detailed faces.
5. **River delta:** clear river splitting into winding channels through a lush wetland delta, reeds, islands, gentle cascades and a few small birds. Emphasize water flow and healthy habitat.
6. **Golden lighthouse:** a graceful lighthouse on a green rocky headland, warm golden beacon cutting through coastal mist, layered blue sea and soft clouds. Strong silhouette and luminous focal point.

## Technical and quality requirements

- Keep total initial art payload modest; target under **1.5 MB total** for the six assets where feasible. Report actual file sizes, do not guess.
- Prefer WebP for raster imagery; use SVG for genuinely vector artwork. Do not wrap a large raster in SVG and call it vector.
- No remote font, script, tracking pixel, or third-party image request.
- Preserve accessible text labels and alt text in the game UI.
- Ensure images degrade gracefully if an asset is missing.
- Update `manifest.json` for every changed asset: path, role, dimensions, format, provenance, license, and whether external references are present.
- Keep asset paths relative and verify every reference from `docs/miniapp/discovery.html`.
- Do not remove or break current locations, tasks, score rules, reset, local persistence, keyboard access, reduced-motion support, or small-screen layout.
- Never describe local browser points as cryptocurrency, transferable rewards, or money.

## Definition of done

- [ ] All six assets share one visual direction and each focal point is clear at phone-thumbnail size.
- [ ] Files are optimized and actual byte sizes recorded in the manifest or asset README.
- [ ] Provenance, generation/editing tool, license/usage rights, and any manual edits are documented honestly.
- [ ] No external runtime asset requests.
- [ ] All local references and manifest metadata validate.
- [ ] Static tests and CI pass.
- [ ] Human review includes desktop and narrow mobile screenshots.
- [ ] Existing gameplay behavior remains unchanged.
- [ ] PR description distinguishes automated checks from actual browser/E2E testing.

## Agent execution contract

1. Read the orchestration hub, current game HTML, current asset README and manifest before editing.
2. Inspect existing assets first; do not replace files blindly.
3. Work on a feature branch, change only relevant files, and open a PR against the appropriate parent branch.
4. Include a concise change list, before/after screenshots if available, measured asset sizes, tests run, and known limitations.
5. Never merge, publish a production deployment, buy credits/domains, or enable paid APIs without explicit authorization.
6. If image generation is unavailable, produce a better art brief and/or hand-authored vector refinement; state the limitation rather than claiming generated artwork exists.
