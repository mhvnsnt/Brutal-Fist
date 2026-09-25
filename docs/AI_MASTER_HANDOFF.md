# Brutal Fist — AI Master Handoff

## Read this first
Brutal Fist is a real 3D fighting/wrestling game. Do not rebuild it as a generic React prototype.

## ABSOLUTE BANNON CHARACTER RULE

**NO GLB = NO CHARACTER.**

Only an actual Bannon character GLB can create a Brutal Fist fighter record. Without a qualifying GLB there is no Character Select entry, fighter data, stats/bio presentation, moveset, attire, match actor, native character slot, or procedural/fallback replacement.

A GLB is necessary but not sufficient. Rig, skin, rest-pose, transform, animation and measured QA gates still apply. `UNKNOWN` is never PASS. `BLOCKED_RIG` and `BLOCKED_QA` are not playable until their gates pass.

There is **no four-attire maximum**. Every actual Bannon character GLB must be inventoried and mapped either to a new fighter identity or an attire/model variant. Never discard an additional GLB because an identity already exists.

Fighter-facing systems must consume the validated GLB-backed catalog. Do not build a second roster that can silently introduce procedural or metadata-only fighters. Do not fabricate stats, bios, moves or other authoritative character facts when Bannon data is missing.

Before changing roster, Character Select, attires, movesets, fighter data, match spawning or native character conversion, read:
- `docs/BANNON_GLB_CHARACTER_LAW.md`
- `docs/BANNON_GLB_INVENTORY.md`
- `docs/DEV_CONVERSATION_LOG.md`

### Canonical architecture
- Native gameplay foundation: `mhvnsnt/SchwarzerblitzEngine`.
- User-owned fighter/content authority: `mhvnsnt/Bannon`.
- Historical implementation sources: `mhvnsnt/brutalfistgrokversion`, `two`, `three`, `four`, `five`, `six`.
- Animation/control-rig reference: `mhvnsnt/NightSkyEngine`.
- Tooling/build reference: `mhvnsnt/Combat-RPG-prototype-`.
- Current integration target: `mhvnsnt/Brutal-Fist`.

## What to assemble

### Player-facing flow
BOOT → TITLE/ATTRACT → MAIN MENU

MAIN MENU → ARCADE → CHARACTER SELECT → FIGHTER DETAIL/BIO → STAGE SELECT → VS → MATCH → RESULT → NEXT MATCH/ENDING

MAIN MENU → VERSUS → P1 SELECT → P2 SELECT → STAGE → VS → MATCH → RESULT → REMATCH/SELECT/MENU

MAIN MENU → TRAINING → SETUP → MATCH → PAUSE/TRAINING OPTIONS → RESET/EXIT

MAIN MENU → OPTIONS → GRAPHICS/AUDIO/CONTROLS/GAMEPLAY → BACK

### Actual match flow
MATCH INIT → resource validation → spawn/facing → round intro → active combat.

Active combat must support movement, sidestep, crouch, guard, light/heavy attacks, hit/block reactions, hit-stop, poise, grapple, grapple control, throw, pin attempt, pin verification, escape, knockdown, wake, KO and round/match results.

## Bannon content pipeline
Actual Bannon GLB → unified skinned mesh → canonical skeleton → real rest pose → normalized bone identity → rest-pose-relative retarget → pose/motion QA → fighter animation controller → native/web runtime.

Use Bannon's real data and assets. Preserve source identity, name, authoritative bio/stats/DNA/attire metadata and provenance when available. Procedural-only records are never substitutes for real GLBs.

## Visual target
Default = `PS1_3D`: early-3D polygonal character presentation, texture limits, vertex quantization/wobble and low-resolution presentation inspired by the visual language of PS1 fighting games.

Do NOT turn the default into NES/8-bit pixel art.

Optional graphics modes:
- `PS1_3D` — canonical/default.
- `RETRO8` — preserve the existing harsher pixel/retro look as an alternate setting.
- `HIGH_RES` — reserved for future higher-fidelity assets/rendering.

The renderer must make these profiles actual settings, not decorative labels.

## Repository integration rules
1. Inspect every listed source repository before replacing a subsystem.
2. Compare all six historical Grok versions; newest does not automatically mean complete.
3. Preserve unique working combat, animation, roster, QA, menu, PWA, native and tooling work.
4. Integrate rather than blindly concatenate projects.
5. Keep native engine ownership separate from the web/PWA compatibility surface.
6. Never put GitHub/API credentials in shipped game code.
7. Public Bannon assets can be fetched by public URL when appropriate; no Drive OAuth/token should be required for an anyone-accessible asset URL.
8. A menu button is not a finished feature until the underlying system works.

## Current technical contracts
- Simulation: fixed 60 Hz.
- Bannon baseline: 10,000 HP unless authoritative fighter data specifies otherwise.
- Maximum body velocity: 3.8 m/s.
- Damage scale: 8.
- Maximum hit-stop: 5 frames.
- Heavy hit-stop: 4 frames.
- Pin shoulder-space tolerance: 0.15 m.
- Poise enabled; zero-poise behavior can hand off to full-body ragdoll/native physics.
- Native physics ownership stays native; browser presentation must not fake ownership.

## QA law
UNKNOWN is never PASS.

Measure real transforms and gameplay state. Validate mesh/skinning, bones, rest pose, animation transforms, contacts, pin geometry, camera framing, state transitions, frame timing and resource availability.

## AI implementation sequence
1. Establish/build the native foundation.
2. Make the canonical game state machine executable.
3. Exhaustively inventory Bannon character GLBs and all actual attire variants.
4. Gate fighters by actual GLB availability and animation readiness.
5. Integrate authoritative Bannon stats/bios/moves only after GLB existence is established.
6. Integrate the real animation retarget/evaluation pipeline.
7. Connect input → combat state machine → animation → physics → camera.
8. Complete match/round/KO/result loops.
9. Complete Arcade/Versus/Training/Options loops.
10. Add stage and presentation systems.
11. Validate native and PWA compatibility paths.
12. Only then expand content/polish/narrative.

## Narrative
The existing canon is intentionally light. Brutal Fist is a competitive combat/wrestling world. Fighters enter for personal motivations such as pride, reputation, money, survival, revenge or competition. Character bios, intros, rivalries and arcade endings can expand this over time.

Do not block the game on a large story system and do not fabricate established lore that does not exist.

## Definition of done
A player can boot the game, enter a mode, select real GLB-backed fighters, select a stage, see the actual fighters, fight a complete match with movement/attacks/defense/grapples/throws/pins/knockdowns/KO, see results, rematch/continue, and return to the menu. The native foundation remains real underneath the presentation.
