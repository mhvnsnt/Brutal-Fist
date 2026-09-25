# Retarget failure gates

A fighter is rejected if the retargeter detects:

- rigid/named-part binding
- multiple competing skins
- missing pelvis/root
- missing left/right leg chain
- missing left/right arm chain
- bind-pose mismatch beyond the configured tolerance
- animation tracks that resolve to no destination bone
- 180-degree chain inversions
- mirrored left/right limbs
- non-finite transforms

The correction is pipeline-level: normalize bone names, establish a canonical rest pose, compute retarget deltas relative to that rest pose, then apply animation tracks. Do not repair a single character by hard-coded Euler offsets.

No procedural body is permitted as a fallback when this gate fails.
