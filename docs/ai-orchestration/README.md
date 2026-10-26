# QUN AI Orchestration Hub

**Single entry point for any AI agent contributing to QUN.** Read this hub, choose the requested task, follow its copy-ready prompt, save files only to the specified paths, validate the real outputs, and open a focused PR.

- Repository: https://github.com/Serega40in/QUN
- Discovery game PR: https://github.com/Serega40in/QUN/pull/20
- Game source on implementation branch: https://github.com/Serega40in/QUN/blob/feat/qun-browser-game-mvp/docs/miniapp/discovery.html

## Universal prompt for any AI

Copy this into your AI agent:

> You are a contributing agent for QUN. Start by reading this orchestration hub: https://github.com/Serega40in/QUN/blob/feat/qun-browser-game-mvp/docs/ai-orchestration/README.md . Inspect the actual repository state and the chosen task before acting. Use a dedicated `feat/<task-id>-<short-name>` branch. Do not overwrite unrelated files or the main homepage. Follow the task acceptance criteria exactly. Save outputs only to specified paths. Validate actual outputs and report the commands/checks you really ran; never invent tests, previews, provenance, or success. Do not spend money or activate paid services/resources without explicit owner approval. Do not introduce tokens, wallets, payments, financial rewards, personal-data collection, or claims of QUN Node integration unless explicitly authorized. Open a focused PR and do not merge/deploy without approval. Finish with changed paths, commit/PR links, evidence, limitations, and the next best task. If no task is specified, recommend the highest-priority task rather than silently expanding scope.

## Task registry

| ID | Task | Status | Task brief and prompt |
|---|---|---|---|
| QD-001 | Audit and verify the Discovery game MVP | Ready | [Task prompt](tasks/QD-001-game-audit.md) |
| ART-001 | Create a coherent Discovery art pack | Ready | [Task prompt](tasks/ART-001-discovery-art-pack.md) |
| ART-002 | Create location icons and UI micro-assets | Backlog | [Task prompt](tasks/ART-002-ui-assets.md) |
| QD-002 | Integrate approved art into the game | Blocked by ART-001 | [Task prompt](tasks/QD-002-integrate-art.md) |

## QUN Discovery art direction

Aim for premium, warm, imaginative stylized 3D environment art with the finish of high-end animated-film concept art, but with original designs—not imitations of specific studios, films, or characters. Strong silhouettes, readable at small sizes, tactile natural materials, cinematic but restrained lighting, emerald/forest greens, ocean blues, and selective warm gold. Mood: wonder, kindness, ecological care, curiosity, peaceful optimism. World: floating island archipelago, friendly stone paths, crystal-clear water, forest sanctuary, mountain observatory, welcoming village, river delta, lighthouse.

Avoid text, letters, logos, signatures, watermarks, fake UI, borders, muddy details, excessive bloom, horror, combat, dystopia, gambling/crypto motifs, and financial promises. Keep a consistent camera, light direction, color grade, material style, and detail density across the pack.

## Exact output locations

- `docs/miniapp/assets/discovery/backgrounds/` — backgrounds.
- `docs/miniapp/assets/discovery/locations/` — location art.
- `docs/miniapp/assets/discovery/icons/` — icons and UI details.
- `docs/miniapp/assets/discovery/manifest.json` — filenames, dimensions, format, prompt/version, tool/model if known, provenance/licensing caveats.
- `docs/miniapp/assets/discovery/README.md` — usage and optimization notes.

Use lowercase kebab-case filenames, WebP/PNG as appropriate, and optimize file size. Never commit credentials, API keys, personal data, or model checkpoints. Preserve source files when practical, but do not add huge intermediate files.

## Done means verified

1. Inspect current branch, files, open PRs, and existing assets.
2. Work on a dedicated branch and only the selected task.
3. Check actual outputs, not just prompts.
4. Run relevant checks and report exact evidence and known gaps.
5. Document asset provenance/licensing honestly.
6. Do not pay for or activate resources without approval.
7. Open a PR and leave it unmerged until review.

**Current-state warning:** Discovery is a static browser-game MVP proposed in PR #20. Do not claim it is merged, published, browser-tested, multiplayer, or integrated with QUN Node without direct evidence.
