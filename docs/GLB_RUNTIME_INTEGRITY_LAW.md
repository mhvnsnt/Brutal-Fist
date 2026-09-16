# Brutal Fist — GLB Runtime Integrity Law

**Status: HARD / FAIL-CLOSED**

This is an agent-facing runtime law for every future AI/developer working on fighters, animation, locomotion, combat, rendering, or asset ingestion.

## 1. The visible mesh is the authority

An animation is not working because an `AnimationAction` exists, a mixer is ticking, or a hidden skeleton changes.

A fighter animation passes only when the **rendered SkinnedMesh visibly deforms from the intended animation data**.

Every animation integration must establish this chain:

`GLB animation clip → AnimationMixer/Action → cloned target skeleton → SkinnedMesh skeleton → rendered vertices`

Do not claim PASS from skeleton/bone telemetry alone.

## 2. Never use plain Object3D.clone() for animated skinned fighters

For animated GLB fighters, `scene.clone(true)` is prohibited as the authoritative clone path.

Use Three.js `SkeletonUtils.clone()` so SkinnedMesh instances are correctly associated with cloned bones. This is a known Three.js requirement for independently animated character instances.

Reference: Three.js SkeletonUtils documentation and game example.

## 3. Animation timing must be measured, not guessed

For every combat animation:

- Record source clip name and duration.
- Record the state/action that selected it.
- Record action start time/frame.
- Record startup/active/recovery timing from the combat data source.
- Record crossfade duration separately from gameplay frame data.
- Do not silently use a visually convenient fallback clip when the required move clip is missing.
- Re-triggering the same attack must restart from the correct frame, not merely set the same state again.
- Hit-stop must freeze the same animation clock that drives the visible mesh.

A 3D animation being visually similar is not evidence that its gameplay timing is correct.

## 4. Movement authority must be explicit

Every movement state must identify its authority:

- **Programmatic locomotion:** gameplay code moves the fighter root; locomotion animation is cosmetic.
- **Baked root motion:** animation root displacement is sampled and transferred into gameplay/world movement.
- **Synthesized attack motion:** displacement is generated from measured move timing and must be synchronized to the attack window.

Never let animation and gameplay independently move the same character root without an explicit ownership rule. That creates skating, double movement, drift, or desynchronization.

## 5. Floor contact is a measured invariant

For grounded states, the rendered character must satisfy:

`lowest visible/skinned contact point >= floor - tolerance`

and must not visibly float above the floor beyond the allowed tolerance.

Bind-pose bounding-box normalization alone is not sufficient because animation can move feet below the bind-pose floor. Runtime QA must inspect the **animated SkinnedMesh**, not only the original scene or skeleton.

Do not fix floor errors by arbitrary per-character Y offsets until the animated mesh and rig cause are understood.

## 6. Facing is an asset transform contract, not a bone hack

Combat uses one canonical match-facing convention. Character assets may arrive with different authoring orientations, but correction belongs to an explicit **asset/model transform calibration layer**.

Do not add random fighter-specific bone rotations inside combat code.

Every model calibration must record:

- source model identity/path
- authoring forward axis
- canonical game forward axis
- applied Y rotation correction
- measured floor correction, if any
- calibration evidence/version

If facing is unknown, mark it `UNKNOWN`; do not silently assume PASS.

## 7. No metric theater

`UNKNOWN` is never `PASS`.

Do not report:

- animation PASS because a clip name resolved
- rig PASS because bones exist
- floor PASS because the bind pose touched Y=0
- facing PASS because a transform was assigned
- combat PASS because invisible hitboxes moved

A passing claim needs the visible/runtime measurement that proves it.

## 8. Debug instrumentation must inspect the same object the player sees

When diagnosing a fighter, inspect and log:

- rendered SkinnedMesh count
- skeleton identity and bone ownership
- active clip/action
- mixer time/timeScale
- clip duration
- current clip time
- current state/action
- world-space animated bounds
- floor contact measurement
- canonical facing transform
- bone hitbox positions

If a debug system observes a different clone, skeleton, or proxy from the rendered fighter, it is not authoritative.

## 9. Asset families must be tested as a family

Do not validate only Bannon and declare the roster healthy.

At minimum, runtime QA must include:

- canonical Bannon
- an alternate Bannon attire/body
- Maime
- one legacy/non-Bannon GLB
- Jager when its binary is present
- a multi-attire fighter
- a model with a different rig naming convention
- a model with no usable animation clips

The goal is to detect exactly the class of AI failure where one familiar model works while every imported model uses the wrong floor/facing/animation assumptions.

## 10. Source integration law

When integrating Bannon, Tekken research/recompiled assets, NightSkyEngine animation/Control Rig references, Schwarzerblitz, or Combat-RPG references:

- preserve the strongest verified implementation
- adapt through BF contracts rather than replacing working runtime ownership
- record provenance
- measure compatibility before promotion
- never import a reference architecture merely because its names look compatible

## 11. Regression law

Every discovered AI failure becomes a durable rule, test, or diagnostic.

Examples now permanently prohibited:

- plain clone of skinned animated fighters
- skeleton-only animation validation
- bind-pose-only floor validation
- hard-coded P1/P2 orientation being assumed correct for every source asset
- arbitrary per-character bone orientation patches
- state-name resolution being treated as frame-data correctness
- gameplay movement and root-motion movement both owning the same displacement
- declaring an asset playable without measured rig/skin/transform evidence

Future agents must fix the underlying invariant and add regression coverage rather than repeatedly patching symptoms.
