# Brutal Fist — Cross-Repository Integration Matrix

This matrix keeps source repositories complementary instead of allowing AI agents to copy competing engines into BF.

| Source | What BF may integrate | Authority in BF | Required rule |
|---|---|---|---|
| `mhvnsnt/Bannon` | real fighter GLBs, canonical identities, attire inventory, combat/physics contracts, source animation data | Bannon asset/content source | `NO GLB = NO CHARACTER`; validate every asset before promotion |
| Tekken 3 research/recompiled repos | animation naming, frame/timing research, movement/combat architecture references, compatibility evidence | BF combat contracts + verified source evidence | never infer exact frame data from a similar-looking clip |
| `mhvnsnt/NightSkyEngine` | Unreal animation/Control Rig patterns, retargeting concepts, runtime rig diagnostics | BF runtime contracts | reference architecture only; do not import a second competing character runtime |
| `mhvnsnt/SchwarzerblitzEngine` | native fighting-game runtime semantics and engine/resource patterns | native runtime authority | browser/Three.js cockpit must not be represented as native Schwarzerblitz |
| `mhvnsnt/brutalfistgrokversion*` | historical BF implementation evidence and useful deltas | BF current contracts | compare versions and preserve stronger verified behavior |
| `mhvnsnt/Combat-RPG-prototype-*` | build/orchestration/reference systems | BF tooling only where compatible | no competing gameplay authority |

## Integration protocol

1. Inspect the current BF implementation first.
2. Inspect the source implementation/reference.
3. Identify the exact capability being imported.
4. Preserve BF ownership boundaries.
5. Add an adapter/contract rather than silently replacing a system.
6. Measure runtime compatibility.
7. Record provenance and validation evidence.
8. Add a regression law when the integration exposes a recurring AI failure mode.

## Animation-specific integration

The authoritative path is:

`source frame/move data → BF FrameData/FighterStateMachine → animation selection → visible SkinnedMesh → bone hitbox/impact timing`

The source animation clip is never the gameplay timing authority by itself. Conversely, gameplay frame data must not be allowed to trigger a clip that does not visibly deform the intended GLB.

## Transform-specific integration

Source assets are allowed to have different authoring conventions. BF must normalize them through measured asset-level calibration:

`source model → measured authoring transform → canonical BF transform → combat presentation`

No arbitrary per-bone orientation patches are permitted merely to make one screenshot look correct.
