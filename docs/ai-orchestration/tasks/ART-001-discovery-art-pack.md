# ART-001 — QUN Discovery: first coherent art pack

**Status:** Ready. **Priority:** High. **Output:** original, optimized game artwork plus manifest. **No paid generation or cloud resources without owner approval.**

## Goal
Create a small but visually outstanding, stylistically consistent first art pack for the QUN Discovery island game. The pack should make the game feel like a cohesive premium world, not five unrelated generated images.

## Required outputs

1. `docs/miniapp/assets/discovery/backgrounds/island-archipelago-bg.webp` — wide archipelago environment background, target 16:9 or wider, minimum 1600×900, no text/UI.
2. `docs/miniapp/assets/discovery/locations/forest-sanctuary.webp` — forest location illustration, target 1024×1024.
3. `docs/miniapp/assets/discovery/locations/mountain-observatory.webp` — mountain location illustration, target 1024×1024.
4. `docs/miniapp/assets/discovery/locations/welcoming-village.webp` — village location illustration, target 1024×1024.
5. `docs/miniapp/assets/discovery/locations/river-delta.webp` — river location illustration, target 1024×1024.
6. `docs/miniapp/assets/discovery/locations/golden-lighthouse.webp` — lighthouse location illustration, target 1024×1024.
7. `docs/miniapp/assets/discovery/manifest.json` — asset inventory including exact dimensions, file sizes, format, generation tool/model if known, prompt revision, source/provenance, and licensing caveats.
8. `docs/miniapp/assets/discovery/README.md` — how to use/replace/optimize the assets.

If the available tool cannot export WebP, deliver optimized PNGs and document the actual format; do not mislabel extensions. If it cannot generate all five locations consistently, produce a style sheet and the best valid partial pack rather than fabricate missing files.

## Copy-ready generation prompt

> Create an original, premium stylized 3D environment illustration for the QUN Discovery game. Art direction: warm, imaginative, polished animated-film environment concept art, original world design, strong readable silhouettes, tactile natural materials, crisp yet gentle details, emerald forest greens, ocean and turquoise blues, restrained warm gold accents, soft cinematic sunlight, coherent physically plausible shadows, inviting atmosphere of curiosity, compassion, ecology, and peaceful exploration. The world is a magical but believable island archipelago with friendly ancient stonework and crystal-clear water. Subject for this image: [REPLACE WITH THE SPECIFIC LOCATION BRIEF BELOW]. Composition must read clearly at thumbnail size and leave a little visual breathing room near the edges. Keep the camera angle, lighting direction, color grading, materials, and detail density consistent with the other QUN Discovery assets. No text, letters, typography, logo, watermark, signature, UI, frame, collage, border, characters from existing IP, imitation of a named studio, horror, combat, dystopia, crypto/finance imagery, or excessive bloom. Deliver a clean high-quality standalone image suitable for a web game; state actual pixel dimensions and file format.

### Subject briefs

- **Background:** panoramic floating/island archipelago linked by winding natural stone paths and sparkling waterways, forested islands, a distant observatory mountain and lighthouse, one clear focal island, atmospheric depth, no people or text. Wide 16:9 composition.
- **Forest:** a serene forest sanctuary with a huge old tree, luminous leaves used sparingly, mossy stones, small stream, sunbeams, and a welcoming path. Square composition.
- **Mountain:** a friendly high mountain observatory on a rounded summit, elegant stone-and-wood structure, layered blue mountains and clouds, sunrise glow, safe inviting path. Square composition.
- **Village:** a welcoming small eco-village of original rounded timber-and-stone cottages, gardens, flowering plants, a communal square, warm windows, integrated into the island landscape. Square composition.
- **River:** a clear winding river splitting into a small delta, stepping stones, reeds, native flowers, wetland plants and visible healthy biodiversity, calm water highlights. Square composition.
- **Lighthouse:** a distinctive friendly lighthouse on a green rocky headland, elegant cream stone and deep teal details, warm golden beacon glow, ocean cliffs and distant islands. Square composition.

## Workflow

1. Inspect current game UI, repository assets, PR #20, and this hub before generation.
2. Generate candidates using an available tool; do not purchase credits or start paid jobs.
3. Compare candidates side by side; reject inconsistent camera, palette, or material styles.
4. Export/optimize the best version of each asset; inspect the actual files at full size and thumbnail size.
5. Save only to the required paths, write truthful manifest and asset README, and report actual dimensions/bytes.
6. Open a focused PR. Do not integrate into game HTML yet; QD-002 handles integration separately.

## Acceptance criteria

- All five location images and one background exist, or a clearly documented partial result explains why not.
- No visible text, watermark, signature, broken anatomy/geometry, accidental collage, or unwanted UI.
- A coherent visual style across the pack; clear focal points at small size.
- Correct real dimensions and formats; web-friendly file sizes, with actual byte counts recorded.
- Manifest has no invented model, provenance, or license claims.
- Preview/contact sheet or direct links included in PR description if available.
- No paid resources used without approval.
