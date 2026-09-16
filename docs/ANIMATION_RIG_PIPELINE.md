# Brutal Fist Animation + Rig Pipeline

## Current diagnosis

Locomotion can translate the fighter while the rendered mesh remains statue-stiff. That is not animation success. Translation is gameplay movement; deformation of the visible SkinnedMesh is animation success.

The repository already has Rocket's `FighterMesh` mixer/state architecture. This layer adds a real authored-motion source and a repair path for static GLBs.

## Bannon authored motion source

`mhvnsnt/Bannon/assets/moves/clips_available.json` currently enumerates 973 authored clips. Individual clip files such as `COMBO_PUNCH.json` contain timestamped bone rotations using Mixamo-compatible names. Those are real motion data, not a procedural spring substitute.

`src/engine/animation/BannonClipRuntime.ts` converts those JSON keys into `QuaternionKeyframeTrack`s targeted at the actual rendered skeleton. Three.js supports quaternion bone tracks and `AnimationMixer` playback on the rendered clone. citehttps://threejs.org/docs/pages/module-SkeletonUtils.html

Core mappings currently include:

- idle / Neutral -> `BOX_IDLE`
- walk -> `DRUNK_WALK`
- light -> `COMBO_PUNCH`
- heavy -> `BIG_BODY_BLOW`
- guard -> `CENTER_BLOCK`
- hitstun -> `BIG_RIB_HIT`

The state machine remains responsible for move/frame timing. The clip source does not decide startup, active, recovery, or hit timing.

## Automatic rig repair

`tools/animation/auto_rig_humanoid.py` provides an open-source Blender repair lane:

`GLB -> deterministic humanoid armature -> automatic weights -> GLB export`

Blender Rigify is also an available open-source rigging system, but Rigify creates the control/bone system and does not itself perform the mesh skinning step. The pipeline therefore treats rig creation and skin binding as separate gates. citehttps://docs.blender.org/manual/en/5.3/addons/rigify/introduction.html

## Non-negotiable validation

A model cannot become PASS because:

- an animation name resolves;
- a state changes;
- an invisible skeleton moves;
- the root translates;
- a bind-pose screenshot looks correct.

The rendered SkinnedMesh must deform. Animated bounds should change when appropriate. Bone hitboxes must follow the same rendered skeleton. Unknown remains blocked.

## Source integration

Tekken and Schwarzerblitz research/source material is integrated through adapters and measured contracts, not by creating a second combat engine. When an external clip is used, its bone mapping, timing source, and target skeleton must be recorded.
