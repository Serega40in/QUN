# QUN Discovery — original vector art pack

This is the first integrated illustration pass for the browser game. It uses hand-authored SVG vector artwork to keep the experience light on modest PCs and phones. It is **not yet the final high-end 3D/concept-art pass** described in the art direction; it establishes an original, consistent palette and world motif without spending money on generation services.

## Files

- `backgrounds/island-archipelago-bg.svg` — 1600×900 panoramic archipelago.
- `locations/forest-sanctuary.svg` — 1024×1024 forest sanctuary.
- `locations/mountain-observatory.svg` — 1024×1024 mountain observatory.
- `locations/welcoming-village.svg` — 1024×1024 village.
- `locations/river-delta.svg` — 1024×1024 river delta.
- `locations/golden-lighthouse.svg` — 1024×1024 lighthouse.

See [manifest.json](manifest.json) for the machine-readable inventory.

## Implementation

The game loads these assets with relative paths from `docs/miniapp/discovery.html`. The location illustration appears in the selected-place panel; if an illustration fails to load, the game hides the broken image and keeps the textual description usable. The panoramic image is an additional illustration above the interactive map.

SVGs are resolution-independent and do not require remote requests, external fonts, or scripts. Keep new art in this directory, use lowercase kebab-case filenames, add accurate dimensions and provenance to the manifest, and verify the actual file before marking a task complete.

## Style direction

Emerald/forest greens, ocean and turquoise blues, natural stone, restrained warm gold, gentle light, and peaceful exploration. These first illustrations are clean stylized vector art. A later art task may replace them with a richer cohesive rendered-art pack after owner review.

## Provenance and use

These SVG files were authored directly for this repository and do not embed external image URLs. No paid services were used for this initial pack. This note is not a substitute for checking the repository's license and third-party obligations before redistribution.
