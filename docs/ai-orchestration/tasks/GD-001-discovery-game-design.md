# GD-001 — QUN Discovery: game design blueprint

**Status:** Design proposal for implementation in small playable slices  
**Repository:** https://github.com/Serega40in/QUN  
**Game MVP:** [discovery.html](../../miniapp/discovery.html)  
**Art direction:** [ART-003](ART-003-discovery-premium-art-direction.md)  
**Browser QA:** [QD-003](QD-003-discovery-browser-qa.md)

## North star

Build a genuinely fun, welcoming strategy-adventure that earns attention through curiosity, agency, discovery, mastery, creativity, and cooperation—not pressure, manipulation, ads, or financial promises. Children should want to return because their world changes when they make thoughtful choices.

**Player fantasy:** “I am a young explorer who discovers a living archipelago, befriends curious creatures, grows a character, and helps several habitats become a thriving civilization.”

The game should be understandable in seconds, offer a satisfying first session in 3–5 minutes, and gradually reveal deeper strategy over many sessions.

## Product pillars

1. **A world that visibly responds.** A bare island becomes greener, a polluted stream becomes clear, a village gains a garden, and new species return after the player makes meaningful choices.
2. **Progress through play, not lectures.** Teach observation, systems thinking, ecology, creativity, logic, empathy, and collaboration through choices and experiments.
3. **Short actions, real decisions.** Taps collect or inspect; strategic choices decide what to grow, build, research, and protect. Never make tapping the only interesting verb.
4. **A character with identity.** The explorer gains skills, tools, outfits, badges, companion bonds, and story chapters. Cosmetics are earned through play and never sold for real money in the MVP.
5. **Kind social play.** Friends can later visit each other's public islands, contribute to cooperative goals, exchange safe preset postcards, and celebrate discoveries. No open chat or public personal profiles in the child-oriented MVP.
6. **Honest positive impact.** Game points are game points. No token, wallet, financial reward, unverifiable environmental claim, or claim that a child's play directly performs real-world work.

## Core loop

**Notice → Explore → Choose → Build / nurture → See the world change → Learn / unlock → Plan the next expedition.**

A session should contain:
- one immediate discovery or small mystery;
- one active interaction (tap, drag, compare, combine, plant, repair, or solve);
- one meaningful choice with a visible consequence;
- one small reward or story reveal;
- one clear next goal, without a forced countdown.

Avoid idle-only progression. Timers may exist for optional world simulation, but no essential reward should be lost by logging off.

## First-session onboarding (target 3–5 minutes)

1. A small companion, **Lumi**, wakes on the shore and asks the player to help identify a strange glowing seed.
2. Tap three points of interest; each reveals a short animated reaction and a clue, not just a point counter.
3. Use a simple observation puzzle to match the seed to the right habitat.
4. Plant it in a chosen spot. The player sees the island change and meets a friendly creature.
5. Choose one of two starter projects: a wildlife garden or a tiny observation station. Both are viable and lead to different first discoveries.
6. The player names their explorer using a local-only nickname or skips naming. No email, phone number, precise location, or account required for the first playable version.
7. End with a map teaser: “The river is carrying a mysterious blue leaf. Want to investigate next time?” It is an invitation, not a streak threat.

## Progression and strategy

### Character

Use five readable attributes, revealed gradually:
- **Curiosity** — find clues and hidden routes.
- **Care** — restore habitats and help creatures.
- **Ingenuity** — build and solve practical puzzles.
- **Wisdom** — compare evidence and understand consequences.
- **Harmony** — coordinate habitats and community projects.

Attributes unlock different approaches rather than making one player strictly stronger. A task should allow more than one valid solution where possible.

### World layers

1. **Discovery map:** locations, mysteries, branching routes, story beats.
2. **Home island:** small grid or snap-to-place building area; habitats, paths, gardens, observatory, workshop, communal spaces.
3. **Ecosystem simulation:** simple transparent relationships (water, biodiversity, soil, energy, community wellbeing). Avoid opaque punishment mechanics.
4. **Research journal:** collected observations, field sketches, creature cards, “what we learned” entries, and player-authored discoveries.
5. **Expeditions:** short scenarios with constraints, e.g. restore a wetland with limited space while keeping a path open for animals.

### Strategic resources (non-financial)

- **Knowledge** unlocks research and explanations.
- **Seeds** enable planting and habitat restoration.
- **Materials** come from exploration and responsible reuse.
- **Harmony** reflects how well the island's systems and inhabitants work together.

Keep the resource economy legible. No premium currency, paid boosts, loot boxes, energy paywalls, tokenization, crypto wallet, or pay-to-win mechanics.

### Meaningful choices

Prefer trade-offs that teach systems thinking, e.g.:
- plant a fast-growing species now or invest in slower native plants that support more wildlife;
- build a short path or preserve a nesting area;
- expand the village immediately or improve water access first.

Choices should produce understandable consequences, allow repair where sensible, and avoid shaming children for experimentation.

## Quest design

Every quest follows:
**Story hook → action → feedback → explanation → visible world change → optional next challenge.**

Quest families:
- **Observe:** compare leaf shapes, notice animal tracks, map water flow.
- **Solve:** patterns, spatial reasoning, resource planning, cause and effect.
- **Create:** design a garden, compose a short soundscape, draw a creature, build a bridge.
- **Care:** restore a habitat, help a character, reduce waste in a village simulation.
- **Collaborate:** combine discoveries or contribute to a shared fictional-world goal.
- **Reflect:** choose what evidence supports a conclusion; more than one answer may be accepted if explained.

Keep reading loads short, use clear language, accessible contrast, captions for audio, touch-friendly targets, keyboard access, reduced motion, and adjustable challenge.

## Retention without manipulation

- Daily discoveries are optional bonuses, never a punishment or a streak that resets.
- No fake scarcity, countdown pressure, fear-of-missing-out, random paid rewards, or repeated nagging notifications.
- Offer a natural stopping point after each quest.
- Return play should reveal a gentle world change or a new clue, not a penalty for absence.
- Let the player pause, mute, reset, and review progress easily.
- Test whether players return because the game is fun, not because they feel guilty.

## Friend and community loop (later phase)

Build social features only after the single-player loop is fun and privacy/security have been reviewed.

Phase ideas:
- share a non-personal island postcard or a generated invite code;
- visit a friend's island in read-only mode;
- cooperative weekly world goal with contribution summaries;
- team research board where each player contributes an observation;
- optional public gallery of player creations with moderation and report controls.

Child-safety requirements:
- no open direct messaging in the initial social release;
- no location sharing or real names by default;
- no public uploads until moderation, consent, reporting, and deletion are designed;
- private progress by default; parental controls and age-appropriate privacy review before account-based features;
- social participation never required to complete the main game.

## QUN ecosystem connection

The game can introduce QUN projects through optional, transparent “world-builder” chapters:
- learn how messaging helps a community coordinate;
- learn what a decentralized node does through a safe simulated network puzzle;
- explore how marketplaces compare needs, quality, and reuse;
- help improve the game by submitting ideas through an adult-facing, clearly external feedback page.

Do not require players to join Telegram, install software, share personal data, recruit friends, or perform real unpaid work to progress. Any invitation to share is optional and appears after a satisfying accomplishment. Never imply that a share guarantees rewards.

## Visual identity and animation

The current SVG art is a functional placeholder pack, not the final art target. Build one coherent visual system:
- storybook environmental art with polished depth and tactile materials;
- strong silhouettes that read at phone size;
- one consistent camera, lighting direction, color grade, and material language;
- emerald and forest greens, ocean blue, turquoise, warm sunlight, selective gold;
- lively but restrained animation: water, leaves, fireflies, character reactions, construction stages, creature idle behavior;
- visual state changes for every important achievement;
- reusable character rigs / layered sprites or lightweight CSS/SVG animation where appropriate.

Do not add large assets until measured. Prefer optimized local assets; no remote runtime dependencies. Preserve loading speed on modest phones and older computers. Avoid imitation of specific studios, franchises, or characters.

## MVP scope: next playable slice

Implement only what can be tested in the browser and persisted locally:
1. a real player/companion panel and a visible level / XP bar;
2. one home-island building or planting interaction;
3. two resource types with clear earn/spend rules;
4. one short branching quest with a choice and visible result;
5. one creature that reacts to the habitat state;
6. a journal entry that records what the player discovered;
7. save / refresh / reset behavior with malformed-save protection;
8. mobile-first touch controls and accessible keyboard behavior.

Keep data local and make no account, multiplayer, backend, Node, wallet, or token claims. This slice must remain lightweight and deployable as static GitHub Pages.

## Suggested release ladder

- **Slice A — Feel:** polished art direction, micro-animations, responsive interaction, satisfying tap feedback.
- **Slice B — Grow:** character progression, resources, planting/building, visible world evolution.
- **Slice C — Think:** branching quests, puzzles, research journal, strategic trade-offs.
- **Slice D — Care:** companion creatures, ecosystem feedback, accessibility and age-appropriate testing.
- **Slice E — Share safely:** invite postcards and cooperative goals after privacy/security review.
- **Slice F — Connect:** optional QUN ecosystem educational chapters; no forced recruitment or crypto incentives.

Each slice should be a focused PR, preserve the main QUN homepage, pass static checks, and include real screenshots or explicit disclosure if screenshots/browser tests were not run. Do not merge or deploy a PR without owner approval.

## Success criteria

Measure quality rather than addiction:
- a new player can start without instructions from an adult;
- first meaningful choice happens within 90 seconds;
- a 5-minute session contains multiple kinds of interaction, not just tapping;
- players can explain why a world change happened;
- players voluntarily choose another quest after a clear stopping point;
- controls work on narrow phones and with keyboard;
- no broken assets, console errors, external trackers, or accidental personal-data collection;
- children can stop without losing earned progress or being shamed.

## Agent prompt

> Read this complete GD-001 blueprint, the current docs/miniapp/discovery.html, ART-003, QD-003, and the current asset manifest before editing. Inspect repository state and test conventions. Implement only MVP Slice A or another explicitly selected slice on a dedicated feature branch. Keep the game static and lightweight, use original local assets, preserve accessibility and local-save safety, and do not add accounts, chat, crypto, tokens, payments, paid APIs, or external runtime dependencies. Run actual checks and report exact commands/results. Open a focused PR; do not merge or deploy. Never claim a feature works without evidence.
