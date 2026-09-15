# Seele handoff — Brutal Fist

You are continuing an existing game repository, not starting a new game from scratch.

Repository: `mhvnsnt/Brutal-Fist`

Read first:
- `docs/SEELE_BUILD_BRIEF.md`
- `ROCKET_PROMPT.md`
- `docs/ROCKET_NEW_WORKFLOW.md`
- `docs/ROCKET_TASK_QUEUE.md`
- `docs/SCHWARZERBLITZ_BRUTAL_FIST.md`
- `docs/NATIVE_BRIDGE.md`
- `docs/RETARGET_PIPELINE.md`
- `docs/BASELINE_PLAYABLE_CHECKLIST.md`

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

## Fighters

Use real Bannon fighter data and assets from the repository. Never invent fake roster entries merely to fill space.

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

Do not copy restricted upstream game assets.

## Development rules

- Inspect before changing.
- Reuse existing code and manifests.
- Prefer systemic fixes over fighter-specific hacks.
- Preserve existing working functionality.
- Test/typecheck/build after significant changes.
- Keep documentation synchronized.
- Never force-push or overwrite `main`.
- Use a feature branch and PR when GitHub write access is available.

## If GitHub write access is unavailable

Continue building the complete project locally/exportably. Do not stop at a mockup because GitHub credentials are unavailable. Leave a complete, deterministic project state that a Git-capable bridge can commit and push to `mhvnsnt/Brutal-Fist`.

## Priority

P0: make the real game loop and real roster playable in the web runtime.

P1: deepen shared fighter/combat/animation contracts.

P2: build visual QA and animation validation tooling.

P3: advance native Schwarzerblitz integration without weakening the native boundary.

Always optimize for the finished Brutal Fist game, not for producing the appearance of progress in a prototype.
