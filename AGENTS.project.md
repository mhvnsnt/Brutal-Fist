# Brutal Fist — project instructions

3D PS1-style fighting game. Roster, attires, and GLBs come from `mhvnsnt/Bannon`.
Continue work on `mhvnsnt/brutalfistgrokversioneight`. Keep a running log in `DEV_CONVERSATION.md`.

## Canon gender — do not assume

Never infer a fighter's gender from the model, hair, clothes, voice, or a generated portrait.
Look up canon in `mhvnsnt/Bannon` (cast docs, books, `canon/*.md`) and `src/data/canonPronouns.ts`.

- **Maime is male** (he/him). Maime is Marquis Whitacre / Bannon's alter — three facets of one man.
  Do not write Maime as she/her. Book 5: "Maime drew his machete. He looked at Iida."
- If pronouns are not in `canonPronouns.ts` or the roster `pronouns` field, use the character's name only — no he/she.

## Skeletal animation law

Torn / hovering / "hit by a truck" = **skeletal animation pipeline** (bind pose + weights + inverse bind matrices).

- `SkeletonUtils.clone` only. Mixer on the clone. `frustumCulled = false`.
- Never absolute Euler banks (`MixamoFightingMotionBank`). They replace Mixamo rest and twist spines.
- Never Mixamo `pose.pelvis` as hip position (hover). Never toe-bone floor snap (lifts the mesh).
- `sanitizeMotionClip`: hip height is a delta from the first key (never absolute Mixamo pelvis). Constant hip yaw is zeroed so the instance owns facing. A clip that actually spins (hurricane kick, hip yaw travel) keeps that yaw as a delta from frame 0 — t=0 still faces the opponent, the turn plays. Never toe-bone floor snap.
- Mixamo bank only on single-skin ≥40-joint rigs. Plugin skins (Maime: 15 primitives) get **bind-relative** clips (`q_bind * q_delta`), not Mixamo.

Cipher **feral only** (`CIPHER_feral.glb`) is hunched — height scale **0.75**. Default `CIPHER.glb` and `CIPHER_minion.glb` use normal roster height.

## ORIENTATION LOCKED — do not change until the user says otherwise

Select and combat scale/yaw/Y from 2026-09-16 screenshots are **final**:

- Select Mixamo: P1 **+π/4**, P2 **−π/4**. Maime: P1 **−π/4**, P2 **−3π/4**.
- Combat: P1 yaw **0**, P2 yaw **π**, `COMBAT_FIGHTER_Y = 0`, `plantFeetOnFloor`.
- Cipher **feral only** height **0.75**. Default/minion = roster 1.85.
- Hit FX worldY **1.05**, screenY **250**.

Combat motion: Mixamo/Euler bank is converted to **bind-relative** (`q_bind * q_src(0)^-1 * q_src(t)`). t=0 stays on the planted pose. Procedural fill only for missing states. Never write absolute Euler banks onto bones.

## Do not change unrequested things

If the user asks to fix facing, do **not** change Y, select, FX, bloom, card art, or combat (and the reverse).
Never add extra Y stacks (`FOOT_PLANT_SINK` on top of Box3, then another plant after yaw).
Fighter Y is **clone plantFeetOnFloor only** (`COMBAT_FIGHTER_Y = 0`). Do not add Mixamo-hip group lifts — that stacks origin-centered fallbacks into the floor. Hit FX: worldY **1.05**, screenY **250**.

## Presentation — select and combat are decoupled

Schwarzerblitz / Tekken: **X = fighting lane**, Z = sidestep, camera at +Z.
**Never invent yaws from ±90 vector math.** Rest pose looks **+X at yaw 0**.
Locked table (image-tested `MAIME_skinned.glb` 2026-09-16, same rest as Mixamo):

| yaw | what you see |
|-----|----------------|
| **+45 / +90 / +135** | BACK (away from camera) |
| **−90** | FACE straight at camera |
| **−45** | FACE 3/4 toward camera and P2 (right) |
| **−135** | FACE 3/4 toward camera and P1 (left) |
| **0** | FACE profile toward P2 (right) — **combat P1** |
| **180** | FACE profile toward P1 (left) — **combat P2** |

- **Select Mixamo**: P1 **+π/4**, P2 **−π/4**.
- **Select Maime**: P1 **−π/4**, P2 **−3π/4**. Never +45 on Maime.
- **Combat (LOCKED):** P1 yaw **0**, P2 yaw **π**, clone feet planted at Y=0, group Y **0**. Hit FX worldY **1.05**, screenY **250**.

## Graphics quality

`ps1` (default) / `retro8` / `native`. Prefer `*_dec` / `*_skinned` on PS1.

## Card art

Likeness = GLB bust. Concept = high-res painted key art **traced from that likeness** (same face, hair, clothes). Maime is male: short magenta dreads, his own corpse face-paint — not Bannon's mask, not a woman's long hair. Bannon wears a mask + tribal face paint; they must not share a face. Old AI plates stay only as fallback. Pixel = 8-bit.
