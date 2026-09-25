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
