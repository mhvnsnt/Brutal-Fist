# Grapple semantic mapping — MISSING_CLIP

**Verdict:** semantic `grapple` remains `MISSING_CLIP` in the preferred Bannon Euler bank.
Do **not** unlock FIGHT via MixamoFightingMotionBank procedural grapple (`PLACEHOLDER_TEST_CLIP` / TEST_ONLY).

**FIGHT gate impact:** `grapple` is **not** in `PREFERRED_REQUIRED_SEMANTIC_STATES`. Leaving it unmapped does **not** falsely unlock (or block) full-roster FIGHT; the gate only requires the existing preferred locomotion/strike/reaction set.

Constants: `GRAPPLE_SEMANTIC_VERDICT`, `GRAPPLE_REMEDIATION_CLIP_CANDIDATES`, `GRAPPLE_REJECTED_BANK_CLIPS` in `src/engine/retarget/BannonMotionBankPreferred.ts`.

## Why not mapped

| Bank clip | Why rejected |
|-----------|----------------|
| `DOUBLE_LEG_TAKEDOWN___VICTIM.json` (+ `__1_` + DELAYED/HARD/… variants) | Mixamo 52-bone authored FBX, but **victim** role — wrong for attacker clinch/initiate |
| `SUPLEX` / `CHOKESLAM` / `GERMANSUPLEX` / `HAMMERTHROW` / `DDT` / `DOUBLESUPLEX` / `HAMMERLOCKDDT` / `POPUPGERMANSUPLEX` / `FENCETHROW*` / `CRUCIFIXPIN` / … | Real authored wrestling FBX, but **J_*** multi-actor skeletons (498–1000 bones) — 0-track bind on `BANNON_rigged` Mixamo |
| `TZ_SCOOP_SLAM` / `TZ_TILT_WHIRL_SLAM` (+ `__RECV`) | MoMask / video-to-clip (14 bones) — not authored preferred Euler |
| `STANCE_CROUCH` | MoMask text_to_clip (“ready to grapple”) — TEST_ONLY |
| MixamoFightingMotionBank `grapple()` | Procedural `PLACEHOLDER_TEST_CLIP` — never preferred |

## Hunt log (2026-09-16 CT) — no usable attacker Mixamo clinch found

Searched every reachable mirror. **No** Mixamo ~52-bone attacker clinch/grab/initiate clip with convertible `keys[]` Euler tracks was found. Candidate filenames all **404** on CDN.

### 1. Local Brutal-Fist mirror
- `public/assets/moves/clips/` — preferred set only (`IDLE`, `GINGA_*`, `BODY_JAB_CROSS`, `COMBO_PUNCH`, `CENTER_BLOCK`, `HIT_REACTION`, `FALLING_FLAT_IMPACT`, `KIP_UP`, `CROUCH_TORCH_WALK_RIGHT` + `manifest.json`). **No** grapple/clinch/takedown attacker file.
- No local `index.json` under public mirror.

### 2. CDN / GitHub `mhvnsnt/Bannon` (authoritative bytes)
- Index: `https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/index.json` (202 keys, HTTP 200)
- Base: `https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/`
- Probed candidate URLs (all **HTTP 404**):
  - `GRAPPLE_CLINCH.json`, `CLINCH_INITIATE.json`, `GRAB_CLINCH.json`, `DOUBLE_LEG_TAKEDOWN.json` (attacker), `CLINCH.json`, `GRAPPLE.json`, `GRAPPLE_HOLD.json`, `bf_clinch.json`
- Index hits for grapple/throw/clinch/slam patterns: only the rejected set above (victim Mixamo + J_* throws + TZ_/MoMask).
- Among **92** Mixamo 52-bone bank clips, the only takedown/grapple-named entries are `DOUBLE_LEG_TAKEDOWN___VICTIM` and `DOUBLE_LEG_TAKEDOWN___VICTIM__1_`.
- `gh` recursive tree on `main`: no `GRAPPLE_CLINCH` / `CLINCH_INITIATE` / `GRAB_CLINCH` / bare `DOUBLE_LEG_TAKEDOWN.json`.
- Code search `repo:mhvnsnt/Bannon` for those candidate names under `assets/moves/clips`: **0 hits**.

### 3. BannonSource submodule (local checkout)
- `BannonSource/assets/moves/clips/index.json` — same 202-key inventory as CDN.
- Filesystem: only `DOUBLE_LEG_TAKEDOWN___VICTIM*` variants (16 files) for Mixamo takedown naming — **all victim**.
- `clips_available.json` (973 names): no `GRAPPLE_CLINCH` / `CLINCH_INITIATE` / `GRAB_CLINCH` / attacker `DOUBLE_LEG_TAKEDOWN`.
- `combat_clip_map.json` `"CLINCH KNEE"` → maps to strike clip `Illegal Knee` (not a clinch skeletal clip).
- `authored_clips.json` / `fbx_move_map.json`: grapple **categories** exist, but clips are victim Mixamo or J_* multi-actor FBX — not preferred-bindable attacker Mixamo.

### 4. Google Drive (public folder listings; no Drive MCP / no invented credentials)
From `BannonSource/src/pages/Workspace.tsx` + roster docs:
| Folder ID | Role | Grapple-relevant result |
|-----------|------|-------------------------|
| `19k_jmuiUYsAubZyx_bUL0m8svyYmevM5` | Models / misc FBX | Boxing/Capoeira/Idle-style FBX + roster GLBs — **no** Double Leg / Clinch / Grab attacker |
| `1chJYomdZW6E7jqUUHZTn1w9wLTakRfvG` | Move FBX library | Wrestling FBX (Suplex, Chokeslam, DDT, HammerThrow, …) — same J_* multi-actor set already rejected; **no** Mixamo “Double Leg Takedown” (attacker) or Clinch/Grab |

Other Drive IDs in repo (`1RKxHGkgoKe0hZf7a2kObqzKpgqKfkrhl`, portrait/attire overrides) are **GLB/portrait assets**, not motion clips.

### 5. `brutalfistgrokversioneight`
- `public/motion/` (+ Vercel static mirror): includes `DOUBLE_LEG_TAKEDOWN___VICTIM.json`, `SUPLEX.json`, `GERMANSUPLEX.json`, `CHOKESLAM.json`, `DDT.json` — same rejected roles/skeletons. **No** attacker Mixamo clinch.

## Remediation (exact) — still required before mapping

1. Author **one** Mixamo-compatible attacker clinch/grab clip:
   - Suggested filename: `GRAPPLE_CLINCH.json` (alts: `CLINCH_INITIATE.json`, `GRAB_CLINCH.json`, attacker `DOUBLE_LEG_TAKEDOWN.json` — **not** `___VICTIM`)
   - Format: `keys[]` Euler (`BANNON_EULER_RX_RY_RZ`), `mixamorig*` ~52 bones
2. Add to `mhvnsnt/Bannon` `assets/moves/clips/` + `index.json`
3. Map in `PREFERRED_SEMANTIC_CLIP_FILES` + append `grapple` to `PREFERRED_REQUIRED_SEMANTIC_STATES`
4. Mirror clip under `public/assets/moves/clips/`; re-run `npm run bannon:verify-motion` and `npm run bannon:measure-bind`

Until then: keep `GRAPPLE_SEMANTIC_VERDICT = 'MISSING_CLIP'`. Do **not** invent or proceduralize an authored grapple.
