# Brutal Fist — Rocket Mobile Game Contract

This repository is a mobile-first fighting game/app. Development is intentionally centered on Next.js, TypeScript, React and React Three Fiber so the project can be built and iterated from a phone through Rocket.new.

## Non-negotiable architecture

- Do not redirect Brutal Fist into Unreal Engine, desktop C++, or native-only tooling.
- R3F/Three.js is the 3D presentation/runtime surface for the mobile build.
- Keep the UI in React/TypeScript and keep game data deterministic and data-driven.
- Use Schwarzerblitz and the connected Tekken/fighting-game repositories as architecture/reference material; adapt patterns rather than copying incompatible runtimes wholesale.
- Bannon is the playable content authority.
- NO GLB = NO CHARACTER. Never create a fallback/procedural fighter when a required Bannon GLB is absent or fails QA.
- `UNKNOWN` is never `PASS`.

## Character Select → Stage Select → VS → Combat

After both fighters are confirmed, Character Select MUST transition to a dedicated Stage Select screen. It must not jump directly into combat.

Stage Select is modern fighting-game style:

1. Fighter selections lock.
2. Stage Select appears.
3. Bottom UI contains lightweight 2D stage thumbnails.
4. A single live R3F Canvas provides the selected stage's 3D preview.
5. Selecting a thumbnail swaps the stage geometry in that one Canvas.
6. The preview camera continuously makes a restrained cinematic orbit and vertical float to reveal different scenery.
7. Random is a selectable stage entry.
8. Confirm resolves Random to a concrete stageId.
9. The selected stageId is passed into the combat renderer.
10. Combat owns the locked fighting camera; Stage Select's cinematic camera must never remain active during the match.

## Mobile performance rule

NEVER create one live WebGL/R3F Canvas per thumbnail. There must be one live preview renderer on Stage Select. Thumbnails are React UI and should remain cheap.

Combat should likewise keep one primary R3F Canvas. Prefer low-poly geometry, inexpensive materials, bounded draw calls, and a fixed render/pixel-ratio budget suitable for phones.

## Preview camera

The Stage Select preview camera may orbit slowly around the stage center and float vertically using elapsed-time sine motion. It should be visually active but bounded. It must not run expensive post-processing or create additional render targets for each stage tile.

## Stage system

Stages are identified by stable `stageId` values. The stage catalog is data-driven. Current entries include:

- `random`
- `training-grid`
- `urban-night`

The Training Grid remains available for mechanics/frame-data testing but is not the presentation default. Urban Night is the current presentation default.

## Combat handoff

The selected `stageId` is authoritative for the match renderer. Fighters keep the same validated Bannon GLB assets selected in Character Select. Do not replace them with thumbnails, silhouettes, primitive placeholders, or unrelated external characters.

## Research source policy

Schwarzerblitz, Tekken 3 research/recompiled projects, Tekken UE4/HY352/Tek3Ex research, and other connected fighting-game repositories can inform:

- game-flow/state-machine structure
- frame/timing data representation
- collision/hitbox organization
- animation lifecycle
- camera behavior
- resource organization
- arcade-style presentation

External retail character/animation assets are not automatically imported merely because a research repository contains them. Only assets that are actually available and authorized for this project may become game content.

## Rocket change discipline

Rocket changes must preserve this contract, the Bannon GLB roster gate, the Stage Select handoff, and the connected research source declarations. Do not delete research submodules or replace the mobile R3F runtime with a desktop/native architecture.
