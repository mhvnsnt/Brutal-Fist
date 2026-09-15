# Seele handoff — Brutal Fist

You are continuing an existing game repository, not starting a new game from scratch.

Repository: `mhvnsnt/Brutal-Fist`

## Mandatory source repositories

Before implementing major systems, inspect and reuse the relevant work from **all** of these repositories:

- `mhvnsnt/SchwarzerblitzEngine`
- `mhvnsnt/brutalfistgrokversionsix`
- `mhvnsnt/brutalfistgrokversionfive`
- `mhvnsnt/brutalfistgrokversionfour`
- `mhvnsnt/brutalfistgrokversionthree`
- `mhvnsnt/brutalfistgrokversiontwo`
- `mhvnsnt/brutalfistgrokversion`
- `mhvnsnt/NightSkyEngine`
- `mhvnsnt/Combat-RPG-prototype-`
- `mhvnsnt/Bannon`

Read `docs/SOURCE_INTEGRATION_MATRIX.md` and `src/integration/SourceIntegration.ts` first. They define the cross-repository ownership and provenance rules.

The Grok repositories are historical snapshots, not disposable duplicates. Compare them before replacing systems. A newer snapshot may omit something that existed in an earlier version.

## What you are building

Build Brutal Fist as the finished 3D fighting/wrestling game described by the repository architecture.

Do NOT treat the current browser runtime as the final scope. The browser/Next.js/Three.js layer is the visual development, playtest, QA and compatibility surface for a game whose native foundation is Schwarzerblitz.

Do NOT replace the architecture with a generic generated fighting-game template.

## Game identity

- Native foundation: Schwarzerblitz Engine.
- Fighter/content source: Bannon.
- Default visual profile: `PS1_3D`.
- Optional visual profile: `RETRO8`.
- Reserved future profile: `HIGH_RES`.
- Browser stack: Next.js + TypeScript + React + Three.js/R3F.
- Shared contracts: fighter roster, stats, bios, resources, animation states, retarget validation, graphics profiles, runtime capabilities.

## Required player experience

Build toward a real game flow:

Boot → Title/Attract → Main Menu → Character Select → Versus Presentation → Match → Round/Combat → KO/Win → Rematch or Return to Menu.

Combat must be a real state-driven system with movement, facing, guard/crouch, attacks, startup/active/recovery, hit reactions, knockdowns/wake, collision/hitbox semantics and an extensible path for throws/grapples and deeper wrestling mechanics.

Build actual systems beneath menus. Do not create fake buttons that only animate.

## Cross-repository systems to integrate

### Schwarzerblitz
Use its native game-engine rules, timing/resource semantics, input/camera behavior and native integration boundary. Preserve upstream license/asset restrictions.

### Grok v1–v6
Mine every snapshot for unique combat, animation, roster, native, QA, browser, asset and tooling work. Prefer the newest verified implementation but preserve useful older deltas.

v6 is known to contain `native/source/roster.json`, real GLB source files, native QA/source directories and a detailed browser-game building skill. v2 contains extensive game-loop/3D/collision/mobile QA doctrine. v3/v4/v5 contain earlier native/BannonSource/roster implementations.

### NightSkyEngine
Use its Unreal Control Rig, Manny/Quinn animation infrastructure, gameplay tags, input configuration and animation workflows as references for the Unreal/native side. Do not replace Schwarzerblitz with NightSky.

### Combat-RPG-prototype-
Use its combat-agent/build orchestration and GitHub-connector architecture as development-tool references. Never put repository credentials or PAT handling into the shipped game runtime.

### Bannon
Treat Bannon as the authoritative fighter/content source. Integrate its real fighter assets and applicable combat/physics concepts, including bounded root motion, hit-stop, active-ragdoll hooks, poise, localized damage, grapple/pin physics, telemetry and camera response where they can be represented safely in the shared/native contracts.

Bannon's current architecture ledger specifies:
- `MAX_BODY_VEL = 3.8 m/s`
- `DMG_SCALE = 8.0`
- physical pin shoulder tolerance `0.15 m`
- 3–5 frame heavy-strike hit-stop
- native C++ ownership for physics/combat loops

Do not pretend these are browser-native Jolt implementations until they actually are. Represent them as shared contracts and implement native behavior at the appropriate boundary.

## Fighters

Use real Bannon fighter data and assets from the repository. Grok snapshot rosters may be migration inputs, but the canonical promoted fighter must resolve to a real validated Bannon asset/resource.

Require the existing validation gates before promotion:

- unified skin
- canonical skeleton
- canonical rest pose
- normalized bones
- retarget validation
- animation-state coverage
- pose sanity
- mirrored/inverted limb detection
- finite transforms

Do not add character-specific 180-degree limb corrections.

## Visuals

PS1_3D is the default. The game should look like an early 3D fighting game: polygonal fighters, real 3D stages, strong silhouettes, appropriate lighting/materials and deliberate low-poly presentation.

Do not turn the game into NES/pixel art by default.

## Native boundary

Schwarzerblitz remains authoritative for the native game. Do not implement fake native behavior in the browser and claim it is native.

If a feature belongs to the shared game contract, implement the contract first so both runtime targets can consume it.

Do not copy restricted upstream Schwarzerblitz game assets.

## Development rules

- Inspect all relevant source repositories before replacing an existing subsystem.
- Reuse existing code and manifests.
- Preserve unique historical work from older Grok snapshots.
- Prefer systemic fixes over fighter-specific hacks.
- Preserve existing working functionality.
- Test/typecheck/build after significant changes.
- Keep documentation and source provenance synchronized.
- Never force-push or overwrite `main`.
- Use a feature branch and PR when GitHub write access is available.

## If GitHub write access is unavailable

Continue building the complete project locally/exportably. Do not stop at a mockup because GitHub credentials are unavailable. Leave a complete, deterministic project state that a Git-capable bridge can commit and push to `mhvnsnt/Brutal-Fist`.

## Priority

P0: make the real game loop and real roster playable in the web runtime.

P1: deepen shared fighter/combat/animation contracts using the source repositories.

P2: build visual QA and animation validation tooling.

P3: advance native Schwarzerblitz integration without weakening the native boundary.

P4: mine historical Grok snapshots for missing systems and merge the best verified pieces rather than allowing regressions.

Always optimize for the finished Brutal Fist game, not for producing the appearance of progress in a prototype.
