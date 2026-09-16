# Animation Pipeline Truth Check

Date: 2026-09-16 (America/Chicago)

Branch under test: `grok/anim-euler-gate-wire` (from `rocket-update` @ `c217b443e1660acc53215eaa3a89b26dd2342bd9`)

## Honest status

| Claim | Reality |
| --- | --- |
| AnimationBridge exists | YES — `animation_bridge/retarget.ts` (not under `src/engine/retarget/`) |
| BannonEulerMotionAdapter | YES — converts Euler → quaternion tracks; normalizes live `keys[]` bank |
| Live motion bank format | `keys[]` + `bones[name]={rx,ry,rz}` (not `bones→frames`) |
| Preferred semantic clips | 11/11 convert offline (888.01 rad total travel) |
| Bind to `BANNON_rigged.glb` | 11/11 clips, **571/571 tracks bound, 0 unbound** |
| Measured bone travel (Node) | maxTravel≈0.984 m, maxRot≈177.6°, deformingBones=58/58 on attack_1 |
| Target skeleton bones | **116** (Mixamo `mixamorig*` names; 58 sampled in mixer) |
| Visible SkinnedMeshes | **1** on local `public/models/BANNON_rigged.glb` |
| BannonSource submodule | EMPTY on this clone |
| `BANNON_rigged_ready.glb` on CDN | historically 404; gate falls back to local `BANNON_rigged.glb` for id=bannon |
| Other roster GLBs | NOT mirrored under `public/models/` (only BANNON_rigged.glb) |
| Pre-combat gate | AUTHORITATIVE via `PreCombatRosterGate` (MeshoptDecoder enabled for measure) |
| Silent idle/first-clip fallback | Removed for unmatched combat states in `FighterMesh.resolveClipName` |
| CharacterPipeline preferred fill | Fills **missing** preferred semantic states from Bannon bank even when GLB has partial clips (does not replace existing GLB state clips) |
| FIGHT unlocked | **NO for full roster** — second fighter GLB missing locally → gate FAIL-CLOSE. Bannon-only path can measure PASS offline. |

## Acceptance chain

MobileControls → FighterController → FighterStateMachine → AnimationBridge → AnimationMixer → target skeleton → visible SkinnedMesh deformation.

Only `AUTHORED_CLIP` / `RETARGETED_AUTHORED_CLIP` can PASS. `MISSING_CLIP` stays `MISSING_CLIP`.

## Semantic coverage (preferred bank)

Resolves (RETARGETED_AUTHORED_CLIP): idle, walk_forward, walk_back, strafe_left, strafe_right, attack_1, attack_2, block, hit_reaction, knockdown, getup.

MISSING_CLIP (preferred set): none offline + local mirror.

Still MISSING_CLIP outside preferred set (honest): grapple (and any non-preferred combat verbs without bank mapping).

## How to re-measure

```bash
node scripts/verify-bannon-motion-bank.mjs
node scripts/measure-glb-bind.mjs
```
