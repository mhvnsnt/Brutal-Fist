# Rocket.new collaboration workflow

## Current repository

`mhvnsnt/Brutal-Fist` is currently a Vite/React/TypeScript project plus a native-engine vendor boundary. Rocket.new's current documented two-way GitHub sync is for Next.js TypeScript projects; other frameworks may use a one-way push workflow. Do not convert the native engine into a Rocket web app.

## Recommended workflow

1. Connect GitHub in Rocket.new with OAuth.
2. Import/select `mhvnsnt/Brutal-Fist` if Rocket accepts the existing Vite project in the current product version.
3. If Rocket requires Next.js for two-way sync, use a dedicated Rocket-facing branch/workspace rather than converting the native game architecture just to satisfy the builder.
4. Rocket changes should land through a branch/PR, not directly overwrite `main`.
5. `main` remains the canonical integration branch for native engine, Bannon assets, PWA preview, and shared contracts.
6. Pull/merge useful Rocket work back into `main` after review and build/test checks.

## Prompt Rocket with the actual game architecture

- The native Schwarzerblitz engine is the gameplay baseline.
- `vendor/SchwarzerblitzEngine` is upstream engine code; preserve its notices/license.
- Do not copy upstream game characters, stages, music, or other restricted content.
- Bannon fighters must come from real GLB assets only; procedural-only fighters are excluded.
- Use the canonical Bannon skeleton and rest-pose-relative retarget pipeline.
- Never add fighter-specific 180-degree limb patches.
- Preserve the PS1 3D visual target: polygonal/low-poly geometry, textured surfaces, vertex-style era constraints; do not turn the default renderer into NES-style pixel art.
- Keep the chunky retro/8-bit presentation as an optional graphics mode.
- PWA is the preview/test client; native engine is the actual game baseline.

## Safe division of labor

Rocket: UI, PWA presentation, menus, roster browser, settings, asset manifests, documentation, test harnesses, and web-side tooling.

Native game work: engine build, character conversion, `.x` resource generation/loading, native animation/move integration, collision, timing, controller/input, and platform-specific runtime.

Shared contracts: Bannon roster IDs, bios/stats, animation-state names, fighter resource manifests, retarget validation, and graphics-profile definitions.
