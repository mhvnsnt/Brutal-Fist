# Bannon Animation Bridge Contract

## Purpose

Connect the Bannon authored motion bank to Rocket's existing FighterStateMachine and real authored GLB skeletons without replacing Rocket's rigging or locomotion systems.

## Evidence classes

- `AUTHORED_CLIP`: source clip contains authored animation data.
- `RETARGETED_AUTHORED_CLIP`: authored source successfully mapped to the target skeleton.
- `PLACEHOLDER_TEST_CLIP`: procedural/test-only clip. It may verify mixer wiring but is never combat-authoritative.
- `MISSING_CLIP`: no usable clip.
- `UNKNOWN`: insufficient evidence.

`PLACEHOLDER_TEST_CLIP` must never be promoted to `PASS` by the animation integrity gate.

## Bannon source formats

Bannon's motion bank may contain rotation channels expressed as `rx/ry/rz` as well as richer pose data. Do not assume every source record already contains quaternion `q` channels. A source adapter must preserve the reference skeleton rest pose when converting Euler channels to Three.js quaternion tracks.

The documented Bannon reference rig is `BANNON_rigged.glb`. It is a source/reference skeleton, not permission to synthesize runtime bones or weights on a static fighter mesh.

## Runtime boundary

```text
Bannon authored motion
  -> source adapter
  -> canonical bone mapping
  -> retarget validation
  -> AnimationClip
  -> AnimationMixer on visible cloned scene
  -> authored skinned GLB deformation
```

Rocket remains authoritative for CharacterPipeline, FighterMesh, FighterStateMachine, locomotion, hitboxes, and rig/weight production. This bridge only supplies animation data and validation.

## Merge rule

Integrate this bridge after Rocket's current `rocket-update` head. Never reset or replace Rocket's implementation to land the animation lane.
