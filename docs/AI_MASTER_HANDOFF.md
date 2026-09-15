# Brutal Fist — AI Master Handoff

## Read this first
Brutal Fist is a real 3D fighting/wrestling game. Do not rebuild it as a generic React prototype.

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

## Bannon content rules
Use Bannon's real data and assets. The authoritative roster lives in Bannon's `src/data/roster.json`.

Only promote fighters whose actual required GLB/model resources exist and pass validation. Procedural-only fighters are not substitutes for real GLB fighters.

Preserve each fighter's source ID, name, bio, stats, DNA, attire metadata and provenance. Do not invent biographies or silently rewrite source data.

Animation pipeline:
Bannon GLB → unified skinned mesh → canonical skeleton → real rest pose → normalized bone identity → rest-pose-relative retarget → pose/motion QA → fighter animation controller → native/web runtime.

Never repair a backwards limb with a character-specific 180° Euler hack.

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
- Bannon baseline: 10,000 HP unless fighter data specifies otherwise.
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
3. Integrate the complete Bannon roster manifest.
4. Gate fighters by actual GLB availability and animation readiness.
5. Integrate the real animation retarget/evaluation pipeline.
6. Connect input → combat state machine → animation → physics → camera.
7. Complete match/round/KO/result loops.
8. Complete Arcade/Versus/Training/Options loops.
9. Add stage and presentation systems.
10. Validate native and PWA compatibility paths.
11. Only then expand content/polish/narrative.

## Narrative
The existing canon is intentionally light. Brutal Fist is a competitive combat/wrestling world. Fighters enter for personal motivations such as pride, reputation, money, survival, revenge or competition. Character bios, intros, rivalries and arcade endings can expand this over time.

Do not block the game on a large story system and do not fabricate established lore that does not exist.

## Definition of done
A player can boot the game, enter a mode, select real fighters, select a stage, see the actual fighters, fight a complete match with movement/attacks/defense/grapples/throws/pins/knockdowns/KO, see results, rematch/continue, and return to the menu. The native foundation remains real underneath the presentation.
