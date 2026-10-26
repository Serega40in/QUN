# QUN Discovery Art Pack (ART-001)

First coherent visual pack for the QUN Discovery browser game MVP.

## Contents

- `backgrounds/island-archipelago-bg.webp` — wide archipelago environment background (target 16:9+, min 1600×900)
- `locations/forest-sanctuary.webp` — forest location (target 1024×1024)
- `locations/mountain-observatory.webp` — mountain location (target 1024×1024)
- `locations/welcoming-village.webp` — village location (target 1024×1024)
- `locations/river-delta.webp` — river location (target 1024×1024)
- `locations/golden-lighthouse.webp` — lighthouse location (target 1024×1024)
- `manifest.json` — inventory with dimensions, formats, provenance

## Art direction (strict)

Premium, warm, imaginative stylized 3D environment art with the finish of high-end animated-film concept art. Original designs only. Strong silhouettes readable at small sizes, tactile natural materials, cinematic but restrained lighting. Palette: emerald/forest greens, ocean/turquoise blues, selective warm gold. Mood: wonder, kindness, ecological care, curiosity, peaceful optimism.

World: floating island archipelago, friendly stone paths, crystal-clear water, forest sanctuary, mountain observatory, welcoming village, river delta, lighthouse.

**Avoided:** text, letters, logos, signatures, watermarks, fake UI, borders, muddy details, excessive bloom, horror, combat, dystopia, gambling/crypto motifs, financial promises. Consistent camera, light direction, color grade, material style and detail density across the pack.

## Usage

These assets are intended for the Discovery game UI (background + location cards / detail views). Prefer WebP for web delivery. Keep file sizes optimized. Do not stretch or crop in a way that breaks the intended composition.

When integrating (task QD-002), reference the paths relative to the miniapp and update any hardcoded placeholders in `discovery.html` only after visual review.

## Optimization notes

- Export as WebP (quality ~80–85) or optimized PNG if WebP unavailable.
- Target web-friendly sizes: background ≤ 400–600 KB, locations ≤ 150–250 KB each if possible.
- Always verify actual pixel dimensions and file size before commit.
- Preserve source files only if they are reasonably sized; do not commit huge intermediate renders or model checkpoints.

## Provenance

Generated with Grok Imagine (xAI) following the exact ART-001 subject briefs and art direction from the QUN AI Orchestration Hub. No paid external generation services or credits were used. No characters or designs from existing IP. Licensing: original for QUN project use; treat as project assets under the repository license.

## Next steps

- Visual review of consistency across the pack.
- QD-002: integrate approved art into the game HTML.
- ART-002 (backlog): location icons and UI micro-assets.
