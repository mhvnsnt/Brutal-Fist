# BRUTAL FIST — GROK FULL GAME BUILD FLOW

This is the assembly contract for Grok's build interface. Build the game in this order and keep each screen connected to the next playable state. Do not create disconnected mock screens.

## 0. NON-NEGOTIABLE IDENTITY

- Product: Brutal Fist.
- Native foundation: Schwarzerblitz Engine.
- Fighter/content authority: Bannon.
- Historical implementation references: brutalfistgrokversion, two, three, four, five, six.
- Animation/control reference: NightSkyEngine.
- Tooling/build reference: Combat-RPG-prototype-.
- Default visual profile: PS1_3D.
- Web build is the playable/AI-accessible compatibility surface, not a replacement for the native engine.
- Never invent fake Bannon fighters when a real asset is unavailable.

## 1. PLAYER FLOW — ASSEMBLE THIS FIRST

BOOT
  -> TITLE / ATTRACT
  -> PRESS START
  -> MAIN MENU
      -> ARCADE
      -> VERSUS
      -> TRAINING
      -> OPTIONS

ARCADE
  -> CHARACTER SELECT
  -> FIGHTER DETAIL / BIO
  -> STAGE SELECT
  -> VS PRESENTATION
  -> MATCH INTRO
  -> ROUND 1
  -> ROUND RESULT
  -> NEXT ROUND or KO
  -> MATCH RESULT
  -> REMATCH / CHARACTER SELECT / MAIN MENU

VERSUS
  -> CHARACTER SELECT P1
  -> CHARACTER SELECT P2
  -> STAGE SELECT
  -> VS PRESENTATION
  -> MATCH INTRO
  -> ROUND 1
  -> ROUND 2+ as required
  -> KO / MATCH RESULT
  -> REMATCH / CHARACTER SELECT / MAIN MENU

TRAINING
  -> CHARACTER SELECT
  -> STAGE SELECT
  -> TRAINING MATCH
  -> PAUSE / TRAINING OPTIONS
  -> RESET POSITIONS / RESET HEALTH / DUMMY BEHAVIOR
  -> EXIT -> MAIN MENU

OPTIONS
  -> GRAPHICS
  -> AUDIO
  -> CONTROLS
  -> GAMEPLAY
  -> BACK -> MAIN MENU

## 2. MATCH FLOW — NEVER SKIP THE UNDERLYING STATES

MATCH_INIT
  -> LOAD FIGHTERS
  -> VALIDATE FIGHTER RESOURCES
  -> LOAD STAGE
  -> PLACE P1/P2
  -> FACE OPPONENT
  -> ROUND_INTRO
  -> FIGHT_ACTIVE

FIGHT_ACTIVE supports:
- idle / walk / sidestep
- crouch
- guard
- light attack
- heavy attack
- hitstun / blockstun
- hit-stop
- poise damage and poise break
- grapple engage
- grapple control
- throw
- pin attempt
- pin verification
- escape input
- knockdown
- wake
- KO

ROUND_END
  -> determine winner
  -> if rounds remain: reset positions and start next round
  -> otherwise MATCH_RESULT

MATCH_RESULT
  -> winner/loser presentation
  -> rematch
  -> character select
  -> main menu

## 3. CHARACTER SELECT CONTRACT

Build character select from the shared Bannon roster/resource manifest, not hardcoded UI names.

Each fighter card should expose:
- fighter ID
- name
- portrait if available
- bio
- stats
- max HP
- speed
- strength
- poise
- physics scale
- model availability
- animation coverage
- validation status

Only fighters passing the required validation gates are playable. Missing/invalid resources must fail closed. Never show a procedural "fallback actor" as a real fighter.

## 4. VS PRESENTATION CONTRACT

Show:
- P1 fighter
- P2 fighter
- VS
- stage
- loading/validation state

Do not enter combat until both fighters and the stage are ready. Do not fake readiness with a timer alone.

## 5. COMBAT INPUT CONTRACT

Keyboard reference:
- WASD = movement
- J = light
- K = heavy
- L = guard
- U = grapple
- I = escape
- O = pin

Mobile controls must map to the same shared InputBitmask contract. Do not create a second gameplay system for mobile.

## 6. COMBAT PRESENTATION

HUD:
- P1 health
- P2 health
- round/timer state
- fighter names
- KO state

3D presentation:
- real fighter models
- real animation states when validated
- stage-space boundaries
- camera tracking
- facing
- hit reactions
- grapple/throw/pin presentation

## 7. BUILD ORDER FOR GROK

Phase A — Game shell
1. Boot/title.
2. Main menu.
3. Options shell.
4. Screen/state router.
5. Persist selected mode/fighters/stage.

Phase B — Roster
1. Load shared Bannon roster.
2. Build character-select grid.
3. Build fighter detail card.
4. Add resource/validation badges.
5. Remove hardcoded P1/P2 fighter selection.

Phase C — Match setup
1. Stage selection.
2. VS presentation.
3. Match initialization.
4. Resource readiness gate.

Phase D — Combat
1. Movement/facing.
2. Guard/crouch.
3. Light/heavy frame data.
4. Hitstun/blockstun.
5. Hit-stop.
6. Poise.
7. Grapple/control/throw.
8. Pin/escape verification.
9. Knockdown/wake.
10. Round and KO state machine.

Phase E — Presentation
1. Camera.
2. Real fighter model rendering for both players.
3. Animation-controller integration.
4. Stage geometry.
5. Audio hooks.
6. PS1_3D graphics profile.

Phase F — Complete loops
1. Arcade progression.
2. Versus rematch.
3. Training reset/options.
4. Pause.
5. Return-to-menu.
6. Save/persistent settings where supported.

## 8. IMPLEMENTATION RULES

- Reuse existing shared contracts before adding new ones.
- Do not duplicate fighter data in React components.
- Do not hardcode P1/P2 identities.
- Do not use a timer to pretend a loading operation is complete.
- Do not silently substitute missing models or animations.
- Do not replace native Schwarzerblitz gameplay with a browser-only fake.
- Do not add proprietary upstream Schwarzerblitz content.
- Preserve useful unique work from all six Grok snapshots; newer snapshots are not automatically authoritative.
- Keep the fixed simulation at 60 Hz.
- Native ownership remains native for physics/resource boundaries.

## 9. BUILD-INTERFACE ACCEPTANCE TEST

Grok's build is acceptable only when a tester can visibly perform this complete path:

Boot -> Press Start -> Main Menu -> Versus -> Select P1 -> Select P2 -> Select Stage -> VS -> Match Intro -> Move -> Guard -> Light -> Heavy -> Hit Reaction -> Grapple -> Throw -> Pin Attempt -> Escape/Pin Resolution -> Knockdown/Wake -> KO -> Match Result -> Rematch -> Character Select -> Main Menu.

Also verify:

Main Menu -> Arcade -> Character Select -> Stage -> Match -> Result -> Next Match.

Main Menu -> Training -> Character Select -> Stage -> Training -> Reset -> Exit.

Main Menu -> Options -> change setting -> Back -> Main Menu.

If any link is missing, implement the underlying state transition instead of adding another visual-only button.

## 10. GROK HANDOFF RULE

Treat this document as the canonical assembly sequence. Before changing architecture, inspect the existing source contracts and the source-integration matrix. Build from the repository's existing systems instead of generating a new unrelated fighting-game scaffold.
