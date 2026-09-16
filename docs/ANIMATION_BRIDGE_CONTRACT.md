# Brutal-Fist Animation Bridge Contract

This is the animation-side contract between the authored-rig lane and the combat runtime.

## Authority

- The source GLB's authored skeleton and skin weights are authoritative.
- Runtime never generates bones, skin weights, or replacement skeletons.
- Static GLBs are repaired offline or replaced by an authored rigged asset.
- Animation data may come from permitted/open Bannon sources or other sources with documented redistribution rights.

## Flow

```text
source FBX/BVH/animated GLB
        |
        v
source bone names
        |
        v
canonical semantic bone map
        |
        v
retargeted AnimationClip
        |
        v
track validation against target skeleton
        |
        v
AnimationMixer(visible SkeletonUtils.clone())
        |
        v
clipAction().play()
        |
        v
mixer.update(delta)
        |
        v
visible SkinnedMesh deformation
```

## Canonical bones

`Hips`, `Spine`, `Chest`, `Neck`, `Head`, `LUpperArm`, `LForeArm`, `LHand`, `RUpperArm`, `RForeArm`, `RHand`, `LUpperLeg`, `LLowerLeg`, `LFoot`, `RUpperLeg`, `RLowerLeg`, `RFoot`.

The retarget layer resolves aliases from Mixamo, FBX/BVH conventions, and Bannon naming into these semantic names. UUIDs are not used as cross-file identity.

## Runtime invariant

The mixer root must be the visible cloned scene. Root translation/root-motion belongs to the outer gameplay actor. Skeletal motion belongs to the cloned character scene.

## PASS criteria

A clip is usable only when:

1. target has a real skeleton;
2. target has real skinned geometry;
3. clip has tracks;
4. tracks resolve against the target skeleton;
5. action is created from the visible clone;
6. mixer advances;
7. measured bone travel is non-zero for an animation expected to move that bone.

`UNKNOWN` is never treated as `PASS`.
