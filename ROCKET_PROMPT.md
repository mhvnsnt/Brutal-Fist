# Rocket.new handoff prompt

Continue `mhvnsnt/Brutal-Fist` from the current GitHub `main` state. Do not rebuild the project from scratch.

## Project architecture

The repository is now a genuine Next.js + TypeScript application so Rocket can use its documented existing-codebase GitHub workflow. The Next.js App Router is the Rocket-facing entry point and renders the existing Brutal Fist React/Three.js game preview. The native Schwarzerblitz engine remains the game's authoritative native baseline.

- Next.js entry: `app/page.tsx`
- Existing game/runtime code: `src/`
- Native engine boundary: `SchwarzerblitzEngine` / `vendor` documentation
- Legacy Vite preview remains available as `preview:vite`
- Bannon is the source for fighter content

Read these first:
- `docs/ROCKET_READY.md`
- `docs/ROCKET_NEW_WORKFLOW.md`
- `docs/ROCKET_TASK_QUEUE.md`
- `docs/ENGINE_OWNERSHIP_MIGRATION.md`
- `docs/NATIVE_BRIDGE.md`
- `docs/RETARGET_PIPELINE.md`
- `docs/BASELINE_PLAYABLE_CHECKLIST.md`

## Rules

- Work from the existing repository; do not replace the architecture.
- Do not turn the default graphics into NES/8-bit pixel art. `PS1_3D` is the default; `RETRO8` is optional; `HIGH_RES` is reserved.
- Only promote Bannon characters with real GLB models. Procedural-only characters are excluded.
- Preserve the unified-skin/canonical-skeleton/rest-pose/normalized-bone retarget gates.
- Never add character-specific 180-degree limb fixes.
- Do not copy restricted upstream Schwarzerblitz game assets.
- Do not implement fake native-engine behavior in the web preview.
- Keep shared roster/animation/resource contracts centralized.
- Work in a branch and prepare a PR/mergeable change; never force-push or overwrite `main`.

## First task

Start with P0 in `docs/ROCKET_TASK_QUEUE.md`. Make the Next.js preview a useful playable Brutal Fist surface: real Bannon roster data, character select, graphics profiles, and clean PS1-style 3D combat presentation. Preserve all native-engine boundaries for the native-engine workstream.

Before claiming the repository is healthy, run the project's build and fix actual errors rather than hiding them or replacing the game with a mock.
