# Rocket.new task queue

This file is the handoff contract for Rocket.new and any other web-focused AI working on Brutal Fist.

## Branch rule

- Never rewrite or force-push `main`.
- Work on a feature branch or Rocket-managed update branch.
- Submit changes for merge into `main`.
- Do not replace the native engine with a web-game approximation.

## P0 — do first

1. Make the PWA preview launch cleanly on phone and desktop.
2. Build the real Brutal Fist character-select/roster screen from the Bannon fighter manifest.
3. Show fighter name, bio, stats and portrait/model availability from the shared roster contract.
4. Add graphics-profile selection:
   - `PS1_3D` = default
   - `RETRO8` = optional
   - `HIGH_RES` = reserved/future
5. Keep the combat canvas 3D and polygonal; do not introduce NES-style pixel rendering as the default.

## P1 — shared game contracts

- fighter IDs
- roster metadata
- animation-state names
- fighter resource manifests
- graphics profiles
- retarget validation status
- PWA/native runtime capability flags

Do not duplicate these contracts in UI components. Import the shared contract.

## P2 — QA tooling

Build web-side tools that visualize, but do not mutate, retarget QA:

- skeleton validity
- unified skin status
- missing animation states
- pose samples
- mirrored/non-finite transform failures
- GLB eligibility

A failed fighter must be marked invalid, never silently replaced with a procedural model.

## P3 — native integration handoff

Rocket should not implement native `.x` conversion or native Schwarzerblitz gameplay unless explicitly assigned. Leave those boundaries intact for the native-engine work.

## Definition of done

A Rocket change is ready for merge when it:

- preserves existing game architecture;
- passes TypeScript/build checks available in the workspace;
- does not add fake fighter data;
- does not introduce proprietary upstream game assets;
- keeps PS1_3D as the default visual profile;
- works with the PWA preview;
- documents any shared-contract changes.