# Animation Pipeline Truth Check

## Purpose

This is the acceptance contract for proving that a fighter animation is actually working. A console message or a mixer action alone is not sufficient evidence.

## Required chain

`MobileControls → FighterController → FighterStateMachine → AnimationBridge → AnimationMixer → visible cloned skeleton/mesh deformation`

## Evidence levels

- **AUTHORED_CLIP** — animation originates from authored/source motion data and resolves to the target skeleton.
- **RETARGETED_AUTHORED_CLIP** — authored/source motion has been retargeted onto the target skeleton.
- **PLACEHOLDER_TEST_CLIP** — deliberately generated diagnostic motion. It proves mixer/deformation plumbing only and is never a combat-animation PASS.
- **MISSING_CLIP** — no semantic clip was found. Do not silently substitute idle or another unrelated state.

## Verdicts

- **PASS** — authored or retargeted-authored clip is active and measured deformation/bone travel is non-zero and track targets resolve against the visible cloned skeleton.
- **TEST_ONLY** — placeholder clip is active and measurable deformation exists. The authored-animation problem remains open.
- **BLOCKED** — no usable animation or target tracks cannot resolve.
- **UNKNOWN** — required evidence was not measured. UNKNOWN is never PASS.

## State transition trace

Every non-trivial input should be traceable with a correlation id through:

1. input action/button
2. controller action
3. FSM previous state → next state
4. combat state → semantic state
5. semantic state → selected clip
6. clip source classification
7. mixer action start/crossfade
8. target-track resolution
9. measured bone travel / visible deformation

A state transition without a corresponding clip/mixer/deformation record is an incomplete pipeline result.

## Bannon motion-bank rule

The known Bannon motion bank contains Euler rotation channels (`rx`, `ry`, `rz`) in its mocap data. Adapters must preserve that provenance and convert those source rotations into quaternion tracks; they must not describe those records as already-quaternion source data.

## Forbidden false positives

- Do not report PASS because an `AnimationAction` exists.
- Do not report PASS because a procedural placeholder moves a bone.
- Do not report PASS when a missing semantic state silently falls back to idle.
- Do not report PASS when tracks exist but target bone names do not resolve.
- Do not claim the statue problem is fixed until an authored/retargeted clip visibly deforms the target mesh.
