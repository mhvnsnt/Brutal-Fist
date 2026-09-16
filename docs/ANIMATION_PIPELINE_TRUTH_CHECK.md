# Animation Pipeline Truth Check

Date: 2026-09-16 (America/Chicago)

Branch under test: `grok/anim-euler-gate-wire` (from `rocket-update` @ `c217b443e1660acc53215eaa3a89b26dd2342bd9`)

## Honest status

| Claim | Reality |
| --- | --- |
| AnimationBridge exists | YES — `animation_bridge/retarget.ts` (not under `src/engine/retarget/`) |
| BannonEulerMotionAdapter | YES — converts Euler → quaternion tracks |
| Live motion bank format | `keys[]` + `bones[name]={rx,ry,rz}` (not `bones→frames`) |
| Preferred semantic clips | 11/11 convert offline (888.01 rad total travel) |
| BannonSource submodule | EMPTY on this clone |
| `BANNON_rigged_ready.glb` on CDN | 404 |
| `BANNON_rigged.glb` | Available (58 joints, 1 SkinnedMesh, 0 embedded clips) |
| Pre-combat gate | AUTHORITATIVE via `PreCombatRosterGate` (no longer AnimationTestArena proxy WARN) |
| FIGHT unlocked | NO — live browser mixer deformation must PASS; conversion PASS ≠ FIGHT PASS |
| Silent idle/first-clip fallback | Removed for unmatched states in `FighterMesh.resolveClipName` |

## Acceptance chain

MobileControls → FighterController → FighterStateMachine → AnimationBridge → AnimationMixer → target skeleton → visible SkinnedMesh deformation.

Only `AUTHORED_CLIP` / `RETARGETED_AUTHORED_CLIP` can PASS. `MISSING_CLIP` stays `MISSING_CLIP`.
