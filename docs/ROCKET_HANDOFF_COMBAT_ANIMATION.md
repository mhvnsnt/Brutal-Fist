# Rocket Handoff — Combat Animation / Rig Runtime

Baseline: `rocket-update` at `55ed3d6f276157a66e355229256df1b8fd16f876`.

This branch intentionally does **not** replace Rocket-owned `FighterMesh`, `GameBattleArena`, `FighterStateMachine`, or `LocomotionSystem`.

## Additions

### `SyntheticSkinningRuntime.ts`
Provides a real conversion path from static GLB `Mesh` geometry to `SkinnedMesh` geometry with skin indices/weights and the generated Mixamo-compatible skeleton. This is the missing bridge in the existing synthetic-rig implementation: merely creating bones cannot deform a visible ordinary mesh.

### `ProceduralCombatAnimations.ts`
Provides actual `AnimationClip` tracks for the generated skeleton: idle, walk, jab, cross, kick, hit, guard, knockdown, and taunt. Authored clips remain higher priority.

### `SubwayHazardSystem.ts`
Independent RNG train schedule. Falling to the tracks does not start the event. The tracks are playable. Warning/crossing phases are driven by an independent timer and the train can hit any fighter occupying the track zone during crossing.

### `SubwayStageConfig.ts`
Defines the main platform + lower track tier and an adapter onto Rocket's existing `StageConfig` model.

## Integration order

1. In Rocket's `normalizeGLB`, when the diagnostic says no authored rig, call `AutoRigDetector.buildSyntheticRig(cloned)` and then `attachSyntheticSkinning(cloned, syntheticResult)`.
2. Add `buildProceduralCombatAnimations()` clips to the normalized action set only when authored clips do not provide a required state.
3. Keep the existing cloned-scene `AnimationMixer` and UUID retargeting as the authoritative playback path.
4. In `GameBattleArena`, create/tick the subway hazard state independently from fighter positions. Fighter position is queried only for train collision during the crossing window.
5. Use the existing combat state machine to apply train damage/knockback and existing animation states for reactions.
6. Do not introduce a second movement system or a native/C++ physics dependency.

## Validation required before PASS

A fighter is not considered animated until a rendered `SkinnedMesh` reports a bound skeleton and the visible geometry changes during a clip. A state label, moving root, moving invisible bones, or changing mixer time alone is insufficient.
