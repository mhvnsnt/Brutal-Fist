# Brutal Fist — Bannon GLB Character Law

**Status: HARD / FAIL-CLOSED**

This document is an agent-facing source-of-truth contract. Future AI agents, developers, build systems, roster tooling, Character Select, combat data, attire systems, and QA must obey it.

## 1. GLB is the existence gate

A Brutal Fist fighter exists as a character only when Bannon has an actual character GLB asset for that identity/variant.

**NO GLB = NO CHARACTER.**

A name, bio, stats record, moveset, procedural body, DNA record, screenshot, generated primitive, placeholder, or metadata entry does not create a fighter.

If there is no qualifying GLB, the character must not receive:
- Character Select entry
- fighter data
- stats
- bio/profile presentation
- moveset assignment
- attire entry
- match-ready runtime actor
- native character slot
- generated fallback model

The correct state is absent/locked/missing-asset, with the missing asset reported.

## 2. GLB is necessary, not automatically playable

A real GLB is required before a fighter can exist in the BF content catalog, but it must still pass the existing rig, skin, rest-pose, transform, animation, and QA gates before normal match play.

Use explicit states such as:
- `GLB_PLAYABLE`
- `GLB_BLOCKED_RIG`
- `GLB_BLOCKED_QA`
- `NPC_GLB`
- `MANAGER_GLB`
- `PROCEDURAL_ONLY`
- `MISSING_ASSET`

Never convert `BLOCKED_*` into playable status by assumption. `UNKNOWN` is never PASS.

## 3. Attires are exhaustive, not capped

Do **not** assume a four-attire maximum. A fighter may have one, two, four, or many actual GLB variants.

Every qualifying Bannon GLB must be inventoried and classified as either:
1. a new fighter identity, or
2. an attire/model variant belonging to an existing fighter.

Examples already evidenced in Bannon include multiple variants for Pablo, Triple XXX, Edwin Kennedy, Tyneshia, Bannon, Onyx, Cain Elias, Cipher, Static and others. Bannon's bank map explicitly records Pablo attires 1–3, Triple XXX attires 1–4, Edwin Kennedy attires 1 and 3, and Tyneshia attires 1–2.

Do not discard an additional GLB because an identity already has an entry.

## 4. Character data must follow the GLB manifest

All fighter-facing systems must derive membership from the validated GLB catalog, not from Bannon's broad procedural roster.

Character Select, Fighter Details, attire selection, moveset routing, stats/bios, match spawning, native conversion, and save/selection data must be downstream of the GLB-backed manifest.

No duplicate manually maintained roster is allowed to silently introduce non-GLB characters.

## 5. Data integrity

Do not invent fighter facts to fill missing Bannon data. When authoritative Bannon data is unavailable, mark it unknown/pending rather than fabricate it.

The authoritative evidence chain is:
1. actual Bannon GLB asset/path
2. Bannon canonical model documentation
3. Bannon measured model/skin QA
4. Bannon rig/bank manifests
5. authoritative Bannon character/moves/stats metadata
6. only then BF presentation/runtime wiring

## 6. Props are not fighters

A GLB under Bannon's prop/weapons mapping is not a character. For example, bank-map entries explicitly marked `prop: true` must remain props and never enter Character Select.

Likewise, an NPC/manager asset does not become a playable fighter merely because it is a GLB.

## 7. Fail closed

If an agent discovers a character record without a qualifying GLB, it must remove/block that record from fighter-facing systems rather than creating a substitute.

If a new GLB is discovered, inventory it first, identify ownership/attire status, run the required gates, then promote it only when evidence supports promotion.

## 8. Visual contract remains unchanged

The default Brutal Fist presentation is real early-3D polygonal fighting-game graphics (`PS1_3D`), anchored by Tekken 3 / Evil Zone / early Schwarzerblitz. This law does not authorize 8-bit sprites, pixel-art fighter substitutes, flat cards, primitives, or other fallbacks when a valid Bannon GLB exists.

## 9. Agent handoff rule

Before changing roster, Character Select, attires, fighter data, or combat routing, an agent must read this law and `docs/BANNON_GLB_INVENTORY.md`.

The development conversation record must preserve this requirement so future agents do not regress to metadata-only or procedural-only fighters.
