# Brutal-Fist 3D Combat Runtime Laws

These are additive laws for every future agent working on fighter animation, rigging, movement, hit reactions, and stage hazards.

## 1. A visible mesh is the authority

A passing animation test must prove that the **rendered GLB geometry** deforms. Moving a skeleton that is not bound to the visible mesh is not animation success.

For bone-less static meshes, the fallback must convert them to a real `THREE.SkinnedMesh`, attach real skin-index/weight attributes, bind the generated skeleton, and then validate the visible mesh references that skeleton.

## 2. Authored rigs beat synthetic rigs

Order of authority:

1. authored GLB skeleton + authored clips;
2. authored GLB skeleton + compatible retargeted clips;
3. synthetic runtime skeleton + procedural fallback clips;
4. AABB hitboxes only as a last-resort combat fallback.

Never replace a good authored rig with a synthetic one merely because automatic rigging exists.

## 3. Synthetic rigging must actually deform

Creating `THREE.Bone` objects or storing `__syntheticSkeleton` metadata on a `Mesh` does not constitute rigging. A static `Mesh` cannot respond to bone transforms unless its geometry has skin indices/weights and it is rendered as a `SkinnedMesh` bound to the skeleton.

`SyntheticSkinningRuntime.attachSyntheticSkinning()` exists for this purpose.

## 4. Animation timing is clip-driven

For authored clips, use the real `AnimationClip.duration` and mixer `finished` events. Do not use arbitrary `setTimeout()` values to end attacks, hit reactions, knockdowns, or wakeups.

Procedural fallback clips have explicit durations and must follow the same event-driven transition rules.

## 5. Movement and animation are separate authorities

Programmatic locomotion owns fighter root movement during walking/backdash/sidestep. Animation owns visible limb/body motion.

Attack root motion is the exception: only one system may own displacement for an attack at a time. Never let programmatic locomotion and baked root motion both move the same root in the same frame.

## 6. Combat state must map to real clips

Every combat state must resolve to one of:

- a measured authored GLB clip;
- a measured retargeted clip;
- a procedural fallback clip on a real skeleton.

A state label by itself is not an animation.

## 7. Open-source integration is source-aware

Use the strongest compatible material from the authorized project sources without replacing working Brutal-Fist systems:

- `mhvnsnt/BrutalfistbaseofTekken3Recompiled` — Tekken 3 move/animation naming and frame-data research;
- `mhvnsnt/Bannon` / BannonSource — GLB assets, combat research, instrumentation, and model validation;
- Schwarzerblitz research/engine sources — fighter-state, hitbox, locomotion, and animation architecture references;
- NightSky Engine sources — reusable engine/runtime patterns where compatible with the web stack.

Native/C++ implementations are reference material only. Brutal-Fist remains a Next.js + React Three Fiber + Three.js mobile/browser game.

## 8. Model validation is per asset

Do not infer that all characters work because Bannon and Maime work. Every imported GLB must be checked for:

- visible mesh floor contact;
- forward direction;
- skeleton presence;
- skinned-mesh binding;
- critical hand/foot/head/hips bones;
- animation clips;
- clip-to-bone binding;
- actual visible deformation;
- combat hitbox attachment.

`UNKNOWN` never becomes `PASS` by assumption.

## 9. Environmental mechanics stay deterministic and cheap

Stage hazards use coordinate/trigger math in the R3F frame loop rather than heavyweight desktop physics. Stage-specific rules are data-driven and must not fork the fighter locomotion architecture.

## 10. Subway train law

The subway train is an independent environmental event. Falling to the tracks **never starts a countdown**.

The tracks remain a playable lower tier. The train rolls an independent random interval, gives a short warning, crosses, checks fighters on the tracks, then rolls a new interval. The event does not care who caused the fighter to enter the tracks.

This is intentionally the chaotic environmental-hazard model requested for Brutal-Fist, not a scripted quick-time event.

## 11. Rocket alignment law still governs this document

Before integrating any of these utilities into Rocket-owned systems, inspect Rocket's latest implementation and layer the capability into it. Do not replace `FighterMesh`, `GameBattleArena`, `FighterStateMachine`, or `LocomotionSystem` with a competing implementation.
