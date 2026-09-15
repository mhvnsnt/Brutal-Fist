# Brutal Fist — Development Conversation Record

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

### Evidence captured from Bannon

Bannon's `tools/rigready/bank_map.json` explicitly records additional variants, including Pablo attires 1–3, Triple XXX attires 1–4, Edwin Kennedy attires 1 and 3, and Tyneshia attires 1–2. Therefore the BF roster must remain open-ended and exhaustive with respect to actual GLBs.

Bannon's model documentation/QA also establishes additional GLB-backed identities beyond the original core roster. The BF inventory must continue to be audited against Bannon's committed model tree, incoming/banked GLBs, canonical model documentation, rig bank map, and measured model QA.

### Repository enforcement

The hard rule is encoded in `docs/BANNON_GLB_CHARACTER_LAW.md` and the GLB inventory/roster files. Future agents must read those files before changing Character Select, roster data, attires, movesets, fighter stats/bios, match spawning, or native character conversion.

This record is intentionally explicit so a future agent reading the development history understands that the GLB-only boundary and unlimited-attire inventory requirement are user-directed requirements, not optional implementation preferences.
