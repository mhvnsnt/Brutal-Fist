# Brutal Fist — Seele Production Build Brief

## Mission

Build the actual Brutal Fist game from this repository. Do not reinterpret Brutal Fist as a disposable prototype, mockup, dashboard, or unrelated browser fighting demo.

Brutal Fist is a complete 3D fighting/wrestling game built around the open-source Schwarzerblitz native engine, with Bannon supplying the project's fighter/content source. The web/Next.js/Three.js runtime is the AI-accessible development, preview, QA, and compatibility surface; it must remain contract-compatible with the native game rather than replacing it.

## Production target

The finished player experience should contain:

- title/attract sequence
- main menu
- settings/options
- character select
- real fighter roster
- fighter bios/stats/portraits
- versus loading/presentation
- complete match initialization
- movement, facing, guard and crouch
- attacks with startup/active/recovery semantics
- hit reactions and knockdown/wake states
- throws/grapples as the combat architecture expands
- rounds, win/KO, rematch and return-to-menu
- real 3D stages and camera/stage-space rules
- audio/resource integration
- training and additional game modes as their underlying systems become implemented

Do not create menu entries that pretend systems exist when they do not. Build reusable systems underneath the presentation.

## Fighter/content authority

Bannon is the source for Brutal Fist fighter content. Use real Bannon assets and shared manifests. Do not invent fake fighter data to fill the roster.

A fighter is eligible only when its required asset/rig/animation validation gates pass. Failed fighters must be visibly marked invalid or excluded; never silently substitute procedural characters.

Preserve these gates:

- unified skin
- canonical skeleton
- canonical rest pose
- normalized bones
- retarget validation
- animation-state coverage
- pose sanity
- mirrored/inverted limb detection
- finite transforms

Never solve a systemic retarget problem with a fighter-specific 180-degree bone hack.

## Visual target

`PS1_3D` is the default visual identity: low-poly 3D fighting-game presentation inspired by the PS1/early-3D era.

`RETRO8` is optional.

`HIGH_RES` is reserved for future use.

Do not make pixel/NES graphics the default simply because a web-game generator can produce them easily.

## Engine ownership

Schwarzerblitz remains the native game-engine foundation. Do not replace it with React or a fake browser implementation.

The web runtime may provide a playable compatibility implementation and development tools, but shared gameplay contracts must remain centralized so native and web targets can converge.

Keep native conversion/resource boundaries intact. Do not copy restricted upstream Schwarzerblitz game characters, stages, music, or other proprietary content.

## AI development behavior

When implementing a feature:

1. Inspect the existing architecture first.
2. Reuse existing contracts, components, engine systems, manifests and validation tools.
3. Implement the underlying game system, not merely its UI representation.
4. Make the web preview visibly exercise the real system.
5. Preserve native-engine boundaries.
6. Run available typecheck/build/tests.
7. Document shared-contract changes.
8. Work on a branch and prepare a mergeable change; do not force-push or overwrite `main`.

## GitHub handoff

If the AI environment has GitHub write access, push changes through a feature branch and PR workflow. Never blindly replace `main`.

If the AI environment cannot push to GitHub, export the complete project changes without flattening or renaming the repository. A separate Git-capable agent/bridge can then validate, commit, push and open the PR against `mhvnsnt/Brutal-Fist`.

## Definition of success

Success means Brutal Fist becomes a coherent, playable game with real fighter content, real combat systems, real animation validation, real 3D presentation and a native-engine path—not a collection of screens that merely looks like a game.
