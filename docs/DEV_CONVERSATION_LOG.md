# Brutal Fist — Development Conversation Record

## 2026-09-15 — Grok v7 architecture integration directive

User directive: `mhvnsnt/brutalfistgrokversionseven` has a strong architecture and should be pulled into Brutal Fist **additively**, alongside the existing systems and all other approved source repositories. Do not replace working BF/Bannon/Schwarzerblitz systems with a separate v7 application.

### V7 architecture adopted as shared doctrine

- fixed-timestep gameplay simulation
- frame-rate-independent presentation
- explicit three.js/world orientation conventions
- separate movement and camera bases
- collision/physics architecture
- ECS-oriented organization where it improves scale
- audio lifecycle discipline
- save/persistence with versioning/migrations
- performance/resource disposal discipline
- game-feel presentation separated from simulation
- mobile/touch considerations
- game flow state model: boot/title/menu/options/select/details/stage/versus/combat/result/arcade-end
- game modes: arcade/versus/training
- fighter state model and frame-data move schema
- grapple state model and physical-contact measurements

### BF-specific adaptation

`src/engine/BrutalFistV7Architecture.ts` is the shared adapter. It does not become a competing engine. Existing Schwarzerblitz native runtime remains authoritative and Bannon remains the authoritative character/content source.

V7's useful light/heavy frame-data model is preserved as shared combat data. V7's grapple/pin machinery is retained as an **optional rules layer**, not default match behavior.

### Default match rules — user decision

Default Brutal Fist is KO-only. Pins are OFF by default. Submissions are OFF by default. Wrestling rules are OFF by default. Match Options may enable pins, submissions, wrestling rules, configurable rounds, and time limits including infinity. The default must remain a direct arcade fighting-game ruleset.

### Orientation decision

Current presentation correction remains: P1/P2 use opposite match-facing bases with the measured ±45-degree root presentation rotation. This is a reusable presentation-layer correction, not a per-character bone hack. V7's explicit +Z mesh-forward / -Z camera-forward convention is adopted as the orientation reference for future rig/import work.

### Integration priority

Do not blindly concatenate v7 with v1-v6, Bannon, NightSky, Combat-RPG, or Schwarzerblitz. Select the strongest verified implementation for each subsystem and reconcile it behind one BF contract. Native engine semantics remain authoritative wherever native implementation exists.

### Immediate next integration sequence

1. Reconcile v7 state/move contracts with BF `GameEngine`.
2. Bring the strongest v7 animation/state/physics logic behind BF shared contracts.
3. Exhaustively sweep v7/Bannon source for additional real GLBs and attire variants.
4. Map every real Bannon GLB, then gate by rig/skin/rest-pose/animation/transform evidence.
5. Push verified fighters into canonical animation/move data and native Schwarzerblitz character slots.
6. Continue stages/audio/menu/arcade/versus/training/result/save implementation.
7. Preserve KO-only default; keep pins/submissions/wrestling rules opt-in.

## 2026-09-15 — Bannon GLB roster/attire hard boundary

User directive: make the Bannon GLB rules known in the Brutal Fist repository and development conversation record so future agents cannot regress the roster. The user's explicit rule is:

> **NO GLB = NO CHARACTER.**

The user also explicitly corrected that Bannon characters can have more alternate attires than four. Future roster work must search for additional GLB-backed characters and additional GLB attire variants instead of assuming a fixed cap.

### Required interpretation

- Only Bannon characters with actual character GLB assets may have fighter data in Brutal Fist.
- No GLB means no Character Select, no fighter data, no stats/bio presentation, no moveset, no attire, no match-ready actor, and no native character slot.
- Procedural-only Bannon records, metadata-only records, generated primitives, placeholders, fallback actors, and unrelated GLBs must never be promoted into fighters.
- A GLB is necessary but not sufficient: rig/skin-QA/rest-pose/animation/transform gates still apply. `UNKNOWN` is never PASS.
- Multiple GLBs for one identity are attire/model variants. There is no four-attire maximum.
- Newly discovered GLBs must be inventoried, mapped to the correct owner, classified as fighter vs attire variant vs NPC/manager/prop, then gated before promotion.
- Character Select and all fighter-facing systems must consume the validated GLB-backed catalog rather than Bannon's broad procedural roster.
- Do not fabricate stats, bios, moves, or other character facts when authoritative Bannon data is missing; mark them unknown/pending.
- Prop GLBs and NPC/manager GLBs do not automatically become playable fighters.

## 2026-09-16 — Skeletal animation pipeline, Maime poly budget, graphics modes

User: combat models face away, twist, and tear apart (torso floating, limbs detached). That discipline is the **skeletal animation pipeline / character deformation**. Specific bugs:

- floating/separated limbs → **skeleton desync / bind matrix corruption** (clone without SkeletonUtils, or runtime re-rig fighting the GLB)
- twisted limbs → **transform space mismatch / retarget error**
- spikes/tears → **weight painting / >4 bone influences**
- missing body parts → **frustum culling**

AAA (Tekken / Schwarzerblitz / Night Sky): immutable bind pose, dumb mesh glued to bones, mixer talks only to the master skeleton. Never re-rig in the game engine.

### Measured triangle counts (public/models)

| File | tris | skins | images |
|---|---|---|---|
| MAIME.glb (painted named-part) | ~18,108 | 0 | 1 |
| MAIME_skinned.glb | ~18,108 | 1 (22 joints) | 0 — **texture was stripped; restoring from MAIME.glb** |
| BANNON.glb (named-part) | ~17,984 | 0 | 1 |
| BANNON_rigged.glb | ~17,998 | 1 (58 Mixamo) | 1 |
| BANNON_muscular_skinned.glb | ~17,995 | 1 (58) | 1 |

Default look is **Maime's ~18k PS1 budget**, not 8-bit sprites. Bannon is already ~18k tris; the shredded combat look is bind/desync, not poly count.

### Graphics modes (menu GRAPHICS, stored `bf-graphics-quality`)

1. **PS1 3D (default)** — Maime-style, nearest, vertex snap, ~18k
2. **8-BIT** — optional crunchier profile (`retro8`)
3. **HIGH RES** — native, no PSX snap, linear filters

### Code laws locked this session

- Clone with `SkeletonUtils.clone` only. No AutoRig generation. No `normalizeSkinWeights` at runtime.
- Do not zero cloned root rotation (fights bind pose).
- Clone materials before PSX snap so P1/P2 do not share mutated shaders.
- Combat slot facing: P1 `+π/2` (toward +X / P2), P2 `−π/2` (toward −X / P1).
- Frustum: `frustumCulled = false` on SkinnedMesh.

Open-source already in stack: `three-stdlib` (SkeletonUtils), `@gltf-transform/*`, `howler`, `@use-gesture/react`. Do not invent a second rigging path.

## 2026-09-16 — Stop guessing gender; Bannon books are canon

User correction: do not assume who is male/female. Bannon is not a "her". Use mhvnsnt/Bannon books, txt, canon/, and conversations in that repo.

Locked from Book 1 (`canon/01_book1_life_in_limbo.md`):

- Marquis Deshaun Whitacre = the man. he/him.
- Bannon = his masked heel. he/him.
- Maime = his psychotic alter-ego (Verbal Leakage). Same man, he/him. Not a technical-striker woman.
- Tyneshia (Tye) Hall = she/her (book).

Roster Maime bio was fabricated she/her. Replaced with book canon. Agents: `docs/CANON_SOURCE.md` + AGENTS.md CANON / PRONOUN LAW.

## 2026-09-16 — Card art + name of the tearing bug

The tearing/twisting/missing-limb problem is the **skeletal animation pipeline** (bind pose + vertex weighting). Full glossary: `docs/SKELETAL_ANIMATION_PIPELINE.md`.

2D select portraits did not look like the GLBs. Old 128px drawings archived to `public/concept-art/portraits-v1/`. New HQ likeness cards (from CANON_MODELS tells: Bannon steel mask + jaw plate + dreads + vale tudo; Maime man, white skull paint, jeans/chains) live in `public/portraits/likeness/`. Select mid-strip **CARD** cycles LIKENESS / CONCEPT / PIXEL per fighter (Tekken card-art swap). Default is likeness when it exists.



