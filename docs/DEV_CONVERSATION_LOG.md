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

## 2026-09-15 — Enforcement implementation pass

The GLB boundary was moved from documentation-only intent into runtime-facing enforcement:

- `src/App.tsx` sources Character Select from `BANNON_GLB_PLAYABLE_MODELS`, not the broad `BANNON_ROSTER`.
- Character Select exposes only entries whose GLB catalog gate is `PASS`.
- A zero-entry validated roster renders a locked state instead of inventing a fighter.
- The old fallback-actor path was removed. A failed fighter asset load stays locked on the VS screen rather than silently transitioning to combat.
- `tools/bannon/verify-and-build-roster.mjs` emits fighter data only for GLB-backed records; excluded/no-GLB records contain only identity + `MISSING_ASSET` status and carry no fighter data.
- The verifier records `noGlbNoCharacter`, `excludedRowsCarryNoFighterData`, and `attireCountUnbounded` in its generated policy.
- `docs/AI_MASTER_HANDOFF.md` makes the GLB boundary a first-class agent rule and implementation sequence requirement.

## 2026-09-15 — User escalation: prototype must become an actual game runtime

User relayed the external assessment that Brutal Fist was still only a thin prototype and directed: **fix that**. The response is to stop treating the web cockpit as the game itself and make the existing runtime path materially use the real Bannon assets selected by the player.

### Runtime hardening completed

- `src/hooks/useDriveModel.ts` now accepts the manifest-selected GLB filename and loads that exact Bannon asset rather than one hard-coded generic Drive model.
- Drive remains only an unbound development override when no fighter model is supplied; a selected fighter always resolves from its manifest model filename.
- `src/App.tsx` now creates separate asset loads for P1 and P2, keyed by their exact selected GLBs.
- Combat cannot begin until both selected fighter GLBs have actually loaded; any load failure fails closed.
- `src/components/PSXCanvas.tsx` now receives separate P1/P2 model URLs and renders the actual selected models independently. The old architecture rendered the same generic model for both fighters, which was a prototype limitation.
- `server.ts` now exposes the checked-out `BannonSource` tree for runtime GLB delivery and marks GLBs as immutable cached binary assets. The route does not create or substitute actors.

### Non-negotiable meaning of this pass

Character Select → exact Bannon GLB → two independent fighter instances → fixed-rate combat simulation → real rendered fighters is now the intended vertical slice. A missing/failed asset blocks the match rather than producing a fake body. The next work must deepen this into the full Schwarzerblitz-native game flow and systems: native character slots, real animation/move data, grapples/throws/pins/escapes, hit reactions/poise/ragdoll, stages, audio, menus/options, arcade progression, training, versus, save/state, and measured QA.

### Evidence captured from Bannon

Bannon's `tools/rigready/bank_map.json` explicitly records additional variants, including Pablo attires 1–3, Triple XXX attires 1–4, Edwin Kennedy attires 1 and 3, Tyneshia attires 1–2, and Cipher's God Within/minion output. The map also explicitly marks weapon/prop GLBs as `prop:true`, so those must never become fighters.

The current 2026-09-15 Bannon Drive-sync manifest contains incoming GLBs including multiple Bannon variants (`BANNON_alt_rigready (1)`, `BANNON_masked_rigready`, `BANNON_v1_clean`, `BANNON_v1_rigready`, `BANNON_v2_split`, `BANNON_v3_split`) and a truncated `BANNON_alt_rigready` upload that is not promotable. It also contains additional incoming/variant uploads that still require identity and QA mapping before promotion. These remain evidence until validated.

### Repository enforcement

The hard rule is encoded in `docs/BANNON_GLB_CHARACTER_LAW.md`, `docs/BANNON_GLB_INVENTORY.md`, `src/data/bannonGlbRoster.ts`, and `tools/bannon/verify-and-build-roster.mjs`. `src/data/bannonGlbSourceInventory.ts` is the evidence ledger for newly discovered Drive-sync GLBs and separates props/truncated assets from fighter evidence.

`npm run bannon:verify` is the runnable GLB roster gate. Dependency versions remain unchanged.

This record is intentionally explicit so future agents understand that the GLB-only boundary, unlimited-attire inventory requirement, and move from generic prototype rendering to exact selected Bannon fighter instances are user-directed requirements, not optional implementation preferences.
