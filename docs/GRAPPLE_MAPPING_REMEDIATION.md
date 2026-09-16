# Grapple semantic mapping — MISSING_CLIP

**Verdict:** semantic `grapple` remains `MISSING_CLIP` in the preferred Bannon Euler bank.
Do **not** unlock FIGHT via MixamoFightingMotionBank procedural grapple (`PLACEHOLDER_TEST_CLIP` / TEST_ONLY).

## Why not mapped

| Bank clip | Why rejected |
|-----------|----------------|
| `DOUBLE_LEG_TAKEDOWN___VICTIM.json` | Mixamo 52-bone authored FBX, but **victim** role — wrong for attacker clinch/initiate |
| `SUPLEX` / `CHOKESLAM` / `GERMANSUPLEX` / `HAMMERTHROW` / `DDT` / … | Real authored wrestling FBX, but **J_*** multi-actor skeletons (498–1000 bones) — 0-track bind on `BANNON_rigged` Mixamo |
| `STANCE_CROUCH` / `TZ_*_SLAM` | MoMask / video-to-clip — not authored preferred Euler |

Constants: `GRAPPLE_SEMANTIC_VERDICT`, `GRAPPLE_REMEDIATION_CLIP_CANDIDATES`, `GRAPPLE_REJECTED_BANK_CLIPS` in `src/engine/retarget/BannonMotionBankPreferred.ts`.

## Remediation (exact)

1. Author **one** Mixamo-compatible attacker clinch/grab clip:
   - Suggested filename: `GRAPPLE_CLINCH.json` (alts: `CLINCH_INITIATE.json`, `GRAB_CLINCH.json`, attacker `DOUBLE_LEG_TAKEDOWN.json` — **not** `___VICTIM`)
   - Format: `keys[]` Euler (`BANNON_EULER_RX_RY_RZ`), `mixamorig*` ~52 bones
2. Add to `mhvnsnt/Bannon` `assets/moves/clips/` + `index.json`
3. Map in `PREFERRED_SEMANTIC_CLIP_FILES` + append `grapple` to `PREFERRED_REQUIRED_SEMANTIC_STATES`
4. Mirror clip under `public/assets/moves/clips/`; re-run `npm run bannon:verify-motion` and `npm run bannon:measure-bind`
