# Rocket.new handoff prompt

Continue `mhvnsnt/Brutal-Fist` from the current GitHub state. Do not rebuild the project from scratch.

The native Schwarzerblitz engine is the game's baseline. The PWA/React/Three.js side is the preview/testing client. Bannon is the source for our fighter content.

Read these first:
- `docs/ROCKET_NEW_WORKFLOW.md`
- `docs/ROCKET_TASK_QUEUE.md`
- `docs/ENGINE_OWNERSHIP_MIGRATION.md`
- `docs/NATIVE_BRIDGE.md`
- `docs/RETARGET_PIPELINE.md`
- `docs/BASELINE_PLAYABLE_CHECKLIST.md`

Rules:
- Work from the existing repository; do not replace the architecture.
- Do not turn the default graphics into NES/8-bit pixel art. `PS1_3D` is the default; `RETRO8` is optional; `HIGH_RES` is reserved.
- Only promote Bannon characters with real GLB models. Procedural-only characters are excluded.
- Preserve the unified-skin/canonical-skeleton/rest-pose/normalized-bone retarget gates.
- Never add character-specific 180-degree limb fixes.
- Do not copy restricted upstream Schwarzerblitz game assets.
- Do not implement fake native-engine behavior in the PWA.
- Keep shared roster/animation/resource contracts centralized.
- Work in a branch and prepare a PR/mergeable change; never force-push or overwrite `main`.

Start with P0 in `docs/ROCKET_TASK_QUEUE.md`. Make the PWA a useful playable preview: real Bannon roster data, character select, graphics profiles, and a clean 3D PS1-style combat presentation. Preserve all native-engine boundaries for the native-engine workstream.