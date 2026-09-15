# BRUTAL FIST — MASTER GAME SPECIFICATION

## 0. Purpose

This is the canonical assembly brief for Grok and every other AI working on `mhvnsnt/Brutal-Fist`.

Build **Brutal Fist** as the complete game, not as a dashboard, mockup, disconnected menu demo, or disposable browser fighting game.

The guiding idea is simple:

> **Schwarzerblitz is the native foundation. Bannon supplies the project's fighters/content. The Grok versions preserve historical work. Brutal Fist is the finished game.**

The PWA/Next.js/Three.js surface is a development, preview, QA, and compatibility client. It must exercise the same shared game contracts as the native target. It is not permission to replace the native engine with a fake web-only game.

---

# 1. GAME IDENTITY

**Title:** Brutal Fist

**Genre:** 3D fighting / wrestling combat game.

**Core feel:** aggressive, physical, arcade-oriented combat with wrestling/grappling depth, grounded impact, throws, knockdowns, pins, escapes, and character-specific identity.

**Primary visual identity:** low-poly early-3D / PS1-era presentation. The target is closer to the visual language of games such as Tekken 3 and Evil Zone than an 8-bit game.

**Graphics profiles:**
- `PS1_3D` — default and canonical.
- `RETRO8` — optional alternate presentation.
- `HIGH_RES` — reserved for a future mode.

Do not make NES/pixel graphics the default merely because a web generator can produce them easily.

**Simulation:** fixed 60 Hz.

**Native foundation:** Schwarzerblitz Engine.

**Content authority:** Bannon.

**Development/compatibility surface:** Next.js/React/Three.js/PWA.

---

# 2. SOURCE REPOSITORIES — ALL MUST BE CONSIDERED

Grok must inspect and use the following repositories before major implementation decisions. They are complementary sources, not interchangeable replacements.

## A. Native foundation

### `mhvnsnt/SchwarzerblitzEngine`
Role:
- native game-engine foundation;
- native resource semantics;
- native character/stage architecture;
- animation/combat/runtime conventions;
- camera and gameplay architecture where useful;
- native build target.

Rule: preserve the native engine boundary. Do not replace it with React.

Important: do not copy restricted proprietary upstream characters, stages, music, or other proprietary content. Use the open-source engine architecture and legally usable project material.

## B. Historical Brutal Fist development snapshots

### `mhvnsnt/brutalfistgrokversion`
### `mhvnsnt/brutalfistgrokversiontwo`
### `mhvnsnt/brutalfistgrokversionthree`
### `mhvnsnt/brutalfistgrokversionfour`
### `mhvnsnt/brutalfistgrokversionfive`
### `mhvnsnt/brutalfistgrokversionsix`

These are **historical source snapshots**, not disposable duplicates.

Inspect all six. Compare them. Preserve unique useful systems even when a newer snapshot omitted or regressed something older.

Mine them for:
- menus and menu presentation;
- character select systems;
- roster metadata;
- combat systems;
- animation/state handling;
- browser/PWA work;
- native integration work;
- QA and validation;
- UI presentation;
- stages/camera ideas;
- audio/resource organization;
- game-flow improvements;
- fixes and regressions.

Priority is not simply “latest version wins.” The best verified implementation wins, while unique older functionality must not be lost.

## C. Animation/control-rig reference

### `mhvnsnt/NightSkyEngine`

Use as an Unreal animation/control-rig/reference source where it provides useful techniques for:
- animation state organization;
- input/control concepts;
- Control Rig/Manny/Quinn-style animation references;
- character motion architecture;
- animation tooling.

It does NOT replace Schwarzerblitz as the native engine.

## D. Tooling/build orchestration reference

### `mhvnsnt/Combat-RPG-prototype-`

Mine for useful:
- combat tooling;
- build orchestration;
- project automation;
- GitHub/build integration patterns;
- development infrastructure.

Do not blindly transplant unrelated game design. Do not ship credentials/PATs or unsafe credential handling.

## E. Fighter/content authority

### `mhvnsnt/Bannon`

This is the authoritative source for Brutal Fist's user-owned fighter/content material.

Use real Bannon assets and data for:
- fighters;
- models/GLBs;
- animations/clips;
- bios;
- stats;
- moves where available;
- portraits;
- character identity;
- fighter-specific physics parameters;
- validated resource manifests.

Do not invent fake fighters to fill the roster.

A fighter only becomes a promoted playable fighter after its required validation gates pass.

---

# 3. SOURCE PRIORITY / NO-LOSS LAW

When sources disagree, use this order:

1. explicit Brutal Fist/user requirements;
2. canonical Brutal Fist shared contracts;
3. authoritative Bannon fighter/content data;
4. Schwarzerblitz native semantics;
5. best verified implementation from Grok v1-v6;
6. NightSkyEngine animation/control-rig techniques;
7. Combat-RPG tooling techniques.

Never blindly concatenate repositories.

Never discard an older implementation simply because a newer Grok snapshot exists.

Before removing a system, compare all six Grok snapshots and document what is being preserved or replaced.

---

# 4. STORY / NARRATIVE CANON

Brutal Fist currently has **light narrative canon**. Do not invent a giant lore bible and then make gameplay depend on it.

The story should initially function as atmosphere, character identity, rivalry, and arcade presentation rather than blocking the game from being playable.

The central premise:

**Brutal Fist is a violent competitive fighting/wrestling world where distinct fighters enter combat for personal reasons, reputation, survival, pride, money, revenge, competition, or their own agendas.**

The game should communicate personality through:
- character bios;
- intro poses/animations;
- versus presentation;
- stage selection;
- win poses;
- short arcade endings or result text when appropriate;
- rival encounters as the narrative system grows.

Do not claim a detailed story already exists. The narrative is intentionally expandable.

## Narrative expansion path

Future arcade structure can introduce:
- fighter-specific motivations;
- rival fights;
- tournament progression;
- boss/gatekeeper encounters;
- short pre-fight/post-fight scenes;
- alternate endings;
- unlockable characters/stages/cosmetics if the underlying content exists.

Narrative must never justify fake assets or fake fighter data.

---

# 5. COMPLETE PLAYER FLOW

The game must be assembled as one coherent flow, not isolated screens.

## BOOT

1. Engine/runtime initializes.
2. Validate required shared contracts/resources.
3. Establish graphics profile.
4. Establish input/device capabilities.
5. Show Brutal Fist branding.
6. Transition to title/attract.

## TITLE / ATTRACT

- Brutal Fist logo.
- atmospheric combat presentation.
- Press Start / equivalent input.
- attract/demo presentation may be added later.

## MAIN MENU

Primary entries:
- Arcade
- Versus
- Training
- Options

Future entries may include:
- Extras
- Records
- Gallery
- Unlocks
- additional modes

Do not expose a menu item as functional unless its underlying system exists.

## OPTIONS

Shared options should include whatever systems actually exist, such as:
- graphics profile (`PS1_3D`, `RETRO8`, `HIGH_RES` reserved);
- audio/music levels;
- controls/input mapping;
- camera/accessibility settings where implemented;
- display/PWA settings where applicable.

Options must modify real settings, not decorative toggles.

## ARCADE

Flow:

`Arcade -> Fighter Select -> Fighter Details -> Stage/Match Setup -> VS Presentation -> Match -> Result -> Next Opponent -> ... -> Ending -> Arcade Complete -> Menu`

The first complete version may use a deterministic opponent ladder while the deeper tournament/narrative system grows.

## VERSUS

Flow:

`Versus -> P1 Fighter Select -> P2 Fighter Select -> Stage Select -> Match Rules -> VS -> Match -> Result -> Rematch / Fighter Select / Menu`

Both fighters must be real validated fighters.

## TRAINING

Flow:

`Training -> Fighter Select -> Opponent/Training Dummy Setup -> Stage -> Match -> Training Controls -> Reset -> Rematch/Exit`

Training should eventually expose useful controls such as:
- reset positions;
- reset health;
- reset round;
- CPU behavior;
- guard behavior;
- grapple/pin testing;
- hitbox/hurtbox/debug views where appropriate.

## CHARACTER SELECT

The select screen is not merely a list of names.

Show, when available:
- fighter name;
- portrait;
- model preview;
- bio;
- stats;
- style/identity;
- animation/resource readiness;
- validation status.

Invalid/unavailable fighters must be visibly unavailable or excluded. Never silently substitute a procedural actor.

## FIGHTER DETAILS

Use Bannon data. Do not fabricate biography or stats.

The roster is expected to grow from the actual Bannon source rather than remain at the initial seeded set.

Known Bannon-origin identities include examples such as Bannon, Cierra, Marquis, Nexus Prime, MDickie Legend, Crash Dummy, The Chairman, Brisk CJ, Blue P6, Golem, Zephyr, Titan, Viper, Kage, Brutus, Mortus, Ronin, Cain Elias, Atlas Vance, and other real source fighters as validated.

Do not treat this example list as permission to invent missing records; source-of-truth validation decides the final roster.

## STAGE SELECT

Build a real reusable stage-selection system.

Stages must have:
- valid geometry;
- collision/ring/fighting bounds;
- camera rules;
- spawn points;
- lighting/material configuration;
- audio/resource references where available.

Do not fill stage slots with fake screenshots or nonfunctional placeholders.

## VS PRESENTATION

Show:
- P1 fighter;
- P2 fighter;
- names;
- VS presentation;
- loading/readiness state;
- stage identity;
- optional intro animation/audio.

## MATCH INITIALIZATION

Establish:
- fighters;
- stage;
- spawn positions;
- facing;
- health/max health;
- poise;
- round state;
- camera;
- animation controllers;
- physics owner;
- 60 Hz simulation;
- input state.

## MATCH

Core loop:

`Neutral -> Movement -> Attack/Guard -> Hit/Block -> Hitstun/Blockstun -> Recovery -> Neutral`

Expanded combat:

`Neutral -> Grapple -> Control -> Throw / Escape / Pin Attempt -> Pinned / Escaped -> Recovery`

Physical systems must remain authoritative rather than being fake UI animations.

## ROUND SYSTEM

Support:
- round start;
- round timer;
- health;
- round win;
- KO;
- match win;
- multiple rounds as the match rules require.

## KNOCKDOWN / WAKE

A defeated/knocked-down fighter must have real state transitions and recovery behavior.

Do not simply teleport fighters back to neutral.

## GRAPPLE / THROW / PIN

Use the existing GrappleSystem and Bannon combat contract.

Required concepts:
- engagement;
- control;
- escape input;
- throw;
- pin attempt;
- physical pin verification;
- pinned state;
- escape/release.

Physical pin validation uses the project's measured shoulder/ring-space contract rather than arbitrary character-specific offsets.

## POISE / HIT-STOP

Use the Bannon combat contract:
- fixed 60 Hz;
- deterministic hit-stop;
- poise;
- heavy-hit behavior;
- bounded root motion;
- native physics ownership;
- explicit full-body ragdoll handoff when zero-poise behavior requires it.

Do not fake physics ownership in the UI layer.

## MATCH RESULT

Show:
- winner;
- loser;
- KO/decision/result type;
- optional stats;
- rematch/next/menu choices.

## POST-MATCH

Arcade:
- next opponent or ending.

Versus:
- rematch;
- fighter select;
- menu.

Training:
- reset;
- continue;
- exit.

---

# 6. COMBAT DESIGN CONTRACT

Simulation is 60 Hz.

Existing Bannon contract values include:
- maximum body velocity: 3.8 m/s;
- damage scale: 8;
- maximum hit-stop: 5 frames;
- heavy hit-stop: 4 frames;
- physical pin shoulder tolerance: 0.15 m;
- starting HP: 10000;
- poise enabled;
- zero-poise behavior: full-body-ragdoll;
- native physics owner: Jolt/native runtime;
- heavy hit active-ragdoll blend;
- bounded/swept root motion.

Do not casually alter these constants to make a demo look better. Change shared contracts deliberately and validate them.

---

# 7. ANIMATION / CHARACTER RULES

Every promoted fighter must pass:

- real GLB/source asset check;
- unified skin validation;
- canonical skeleton validation;
- canonical rest-pose validation;
- normalized bone identity;
- rest-pose-relative retarget correction;
- animation-state coverage;
- finite transform validation;
- mirrored/inverted limb checks;
- pose sanity checks.

No fighter-specific 180-degree bone hacks.

No silent procedural replacement.

No “FALLBACK ACTOR” pretending an invalid fighter is playable.

If required resources fail, fail closed and tell the player/developer why.

---

# 8. CORE ANIMATION STATES

At minimum:

- idle
- walk
- light
- heavy
- guard
- hit
- block
- grapple
- throw
- pin
- KO

Expanded states may include:
- crouch;
- knockdown;
- wake;
- victory;
- defeat;
- intro;
- taunt;
- transition states;
- native ragdoll handoff.

Animation names must remain shared contracts rather than duplicated UI strings.

---

# 9. CAMERA / STAGE / PRESENTATION

The game should feel like a real early-3D fighting game.

Camera responsibilities:
- keep both fighters readable;
- respect stage bounds;
- react to spacing;
- support close grapple/pin presentation;
- avoid clipping through fighters/stage;
- maintain consistent framing;
- use stage-specific rules where needed.

Do not solve camera problems by modifying character bones.

---

# 10. MENU DESIGN SOURCES

Grok should compare all six historical Brutal Fist repositories for menu systems before designing the final menu architecture.

Combine the strongest verified elements from:
- older Grok menu implementations;
- newer Grok menu implementations;
- Schwarzerblitz's native game-flow conventions;
- Bannon's identity/content data;
- NightSky's control/animation references where relevant.

The goal is one coherent Brutal Fist identity, not six incompatible menu systems pasted together.

Canonical menu hierarchy:

`BOOT`
`  -> TITLE / ATTRACT`
`      -> MAIN MENU`
`          -> ARCADE`
`              -> CHARACTER SELECT`
`              -> FIGHTER DETAILS`
`              -> STAGE / MATCH SETUP`
`              -> VS`
`              -> MATCH`
`              -> RESULT`
`              -> NEXT MATCH / ENDING`
`          -> VERSUS`
`              -> P1 SELECT`
`              -> P2 SELECT`
`              -> STAGE`
`              -> VS`
`              -> MATCH`
`              -> RESULT`
`              -> REMATCH / SELECT / MENU`
`          -> TRAINING`
`              -> SETUP`
`              -> MATCH`
`              -> RESET / OPTIONS / EXIT`
`          -> OPTIONS`
`              -> GRAPHICS`
`              -> AUDIO`
`              -> CONTROLS`
`              -> ACCESSIBILITY / CAMERA where implemented`

---

# 11. WEB / PWA RULES

The web client exists to make the game easy for AI systems and humans to inspect, assemble, QA, and play.

It may provide:
- playable compatibility match;
- 3D preview;
- roster browser;
- animation QA;
- resource validation;
- game-flow testing;
- debug/telemetry views.

It must NOT:
- become a fake replacement for native Schwarzerblitz;
- invent fighters;
- silently replace invalid assets;
- bypass shared contracts;
- flatten native systems into UI-only simulations.

---

# 12. AI ASSEMBLY INSTRUCTIONS

When Grok opens this repository:

1. Read this file first.
2. Read `docs/GROK_BUILD_FLOW.md`.
3. Read `docs/SOURCE_INTEGRATION_MATRIX.md`.
4. Read `SEELE_PROMPT.md` and `docs/SEELE_BUILD_BRIEF.md`.
5. Read `docs/BASELINE_PLAYABLE_CHECKLIST.md`.
6. Read `docs/AI_AGENT_HANDOFF.md`.
7. Inspect `src/engine`, `src/data`, `src/components`, `src/hooks`, and `src/types.ts`.
8. Inspect all six Grok source repositories.
9. Inspect `SchwarzerblitzEngine`, `NightSkyEngine`, `Combat-RPG-prototype-`, and `Bannon`.
10. Compare implementations before adding replacements.
11. Build the complete player flow in dependency order.
12. Keep native and web contracts aligned.
13. Run build/typecheck/tests after each coherent system change.
14. Do not declare a feature complete because its menu button exists. It is complete only when the underlying system works.

---

# 13. BUILD ORDER

### Phase 1 — Foundation
- clean boot;
- title;
- main menu;
- options;
- shared contracts;
- input;
- fixed 60 Hz loop.

### Phase 2 — Roster
- authoritative Bannon roster snapshot;
- portraits;
- bios;
- stats;
- real GLB availability;
- validation gates;
- character select.

### Phase 3 — Match
- stage;
- camera;
- spawn/facing;
- movement;
- guard/crouch;
- light/heavy attacks;
- hit/block reactions;
- health;
- round timer.

### Phase 4 — Wrestling/combat depth
- grapple;
- control;
- escape;
- throw;
- pin verification;
- knockdown/wake;
- poise;
- hit-stop;
- ragdoll/native physics handoff.

### Phase 5 — Complete game loop
- round win;
- KO;
- match result;
- rematch;
- Arcade progression;
- Training reset;
- return to menu.

### Phase 6 — Content expansion
- more Bannon fighters;
- more validated animations;
- stages;
- audio;
- intros/outros;
- rival encounters;
- arcade narrative;
- unlocks/extras where real systems exist.

### Phase 7 — Native convergence
- native Bannon manifests;
- native resource conversion;
- native acceptance tests;
- native gameplay parity;
- final platform builds.

---

# 14. QUALITY LAWS

**UNKNOWN is never PASS.**

No claim without measurement or an executable validation.

Use measurements in real units where appropriate: metres, degrees, frames, health, velocity, timing.

Validate:
- geometry;
- bones;
- skinned vertices;
- bind/rest pose;
- animation transforms;
- camera framing;
- contact/pin geometry;
- state transitions;
- runtime ownership.

A beautiful menu with broken gameplay is not a finished game.

A playable web mockup with no native path is not a finished game.

A fighter that looks right but fails its skeleton/animation/resource gates is not a valid fighter.

---

# 15. DEFINITION OF DONE

Brutal Fist is considered meaningfully playable when a user can:

`Boot -> Title -> Main Menu -> choose a mode -> select real fighters -> select/setup a stage -> see both fighters -> start a match -> move -> attack -> defend -> hit/block -> grapple -> throw/escape/pin -> knockdown/wake -> win rounds -> KO -> see result -> rematch/continue/return -> repeat`

And when the same shared contracts support the native Schwarzerblitz path.

The long-term finished game adds:
- full Bannon roster;
- complete validated animations;
- multiple stages;
- audio;
- polished menus;
- Arcade progression;
- character-driven narrative;
- native engine parity;
- QA/validation tooling;
- stable builds.

**Build the game, not the appearance of a game.**
