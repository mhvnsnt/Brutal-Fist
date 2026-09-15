# Brutal Fist — Bannon GLB Inventory

This is the asset-level audit used by Brutal Fist. It is intentionally separate from Bannon's broader procedural/metadata roster.

## Hard rule

**NO GLB = NO CHARACTER.** Only a Bannon character with an actual character GLB can exist in BF's fighter-facing systems. No GLB means no Character Select entry, fighter data, stats/bio presentation, moveset, attire, match actor, or native character slot.

A GLB is necessary but not sufficient for match play: rig, rest-pose, skin, transform, animation and measured QA gates still apply. A GLB with `BLOCKED_QA` or `BLOCKED_RIG` remains excluded from normal Character Select until the gate passes.

There is **no four-attire maximum**. Every actual GLB must be inventoried and classified as a new fighter identity or an attire/model variant.

## GLB-backed fighters and variants currently identified

| Fighter | GLB / attire | Gate |
|---|---|---|
| Bannon | `BANNON.glb` | PASS |
| Bannon | `BANNON_muscular.glb` — Muscular alt | BLOCKED_RIG |
| Maime | `MAIME.glb` | PASS |
| Maime | `MAIME_tattered.glb` — Tattered | PASS |
| Onyx | `ONYX.glb` — Chola/Spiked | BLOCKED_RIG |
| Onyx | `ONYX_corset.glb` — Corset/Vamp | BLOCKED_RIG |
| Onyx | `ONYX_street.glb` — Street | PASS |
| Onyx | `ONYX_straightjacket.glb` — Straightjacket | PASS |
| Cain Elias | `CAIN_ELIAS_ring.glb` — Ring | BLOCKED_QA |
| Cain Elias | `CAIN_ELIAS_snakeskin.glb` — Snakeskin | BLOCKED_QA |
| Cain Elias | `CAIN_ELIAS_gear.glb` — Wrestling Gear | BLOCKED_QA |
| Cain Elias | `CAIN_ELIAS_godwithin.glb` — God Within | BLOCKED_QA |
| Stick-Up | `STICKUP.glb` | BLOCKED_QA |
| Cipher | `CIPHER.glb` | BLOCKED_QA |
| Cipher | `CIPHER_minion.glb` — Minion | PASS |
| Cipher | `CIPHER_feral.glb` — Feral | PASS |
| Echo | `ECHO.glb` | BLOCKED_QA |
| Cody | `CODY_sober.glb` — Sober | BLOCKED_QA |
| Cody | `CODY_stressed.glb` — Stressed | BLOCKED_QA |
| Hall Nighter | `HALL_NIGHTER.glb` | BLOCKED_QA |
| Static | `STATIC.glb` — Default | BLOCKED_QA |
| Static | `STATIC_alt.glb` — Alt | BLOCKED_QA |
| Viper | `VIPER.glb` | PASS |
| Kobra | `KOBRA.glb` | PASS |
| Aaron Ruben | `AARON_RUBEN.glb` | PASS |
| Hollow | `HOLLOW.glb` | BLOCKED_QA |
| Edwin Kennedy | `EDWIN_KENNEDY.glb` — Mustached Mogul / attire 1 | BLOCKED_QA |
| Edwin Kennedy | `EDWIN_KENNEDY_unchained.glb` — Unchained / attire 3 | BLOCKED_QA |
| Pablo | `PABLO.glb` — Minotaur Painted / attire 1 | BLOCKED_QA |
| Pablo | `PABLO_goldenbull.glb` — Golden Bull / attire 2 | BLOCKED_QA |
| Pablo | `PABLO_blackreign.glb` — Black Reign / attire 3 | BLOCKED_QA |
| Tyneshia | `TYNESHIA.glb` — Wrestling Gear / attire 1 | BLOCKED_QA |
| Tyneshia | `TYNESHIA_street.glb` — Hall Street/Casual/Manager / attire 2 | BLOCKED_QA |
| Triple XXX | `TRIPLE_XXX.glb` — attire 1 | BLOCKED_QA |
| Triple XXX | `TRIPLE_XXX_tights.glb` — Blue Tights / attire 2 | BLOCKED_QA |
| Triple XXX | `TRIPLE_XXX_trunks.glb` — Blue Trunks / attire 3 | BLOCKED_QA |
| Triple XXX | `TRIPLE_XXX_suit.glb` — Suit/Casual/Manager / attire 4 | BLOCKED_QA |
| El Toro de Oro | `EL_TORO_DE_ORO.glb` | BLOCKED_QA |
| Stan Combs | `STAN_COMBS_gear.glb` | BLOCKED_QA |
| Brutus | `BRUTUS.glb` | BLOCKED_QA |
| Titan | `TITAN.glb` | BLOCKED_QA |
| Master Sensei | `MASTER_SENSEI.glb` | BLOCKED_QA |
| Wreck Patterson | `WRECK_PATTERSON.glb` | BLOCKED_QA |

## Important audit note

Bannon's `tools/rigready/bank_map.json` explicitly proves additional multi-attire banked outputs: Edwin Kennedy attires 1 and 3; Pablo attires 1–3; Tyneshia attires 1–2; and Triple XXX attires 1–4. Therefore BF must not impose an arbitrary attire cap. fileciteturn425file0

Bannon's model QA establishes measured skin gates and additional GLB-backed identities; weak/failing models remain blocked until their gate passes. fileciteturn428file0

## What does NOT count

- procedural-only Bannon characters
- metadata-only roster entries
- generated primitives/placeholders/fallback actors
- unrelated GLBs
- GLBs explicitly classified as props/weapons
- NPC/manager GLBs unless and until the project explicitly classifies them as playable fighters and they pass all gates

## Character Select contract

Character Select must consume `BANNON_GLB_PLAYABLE_MODELS` from `src/data/bannonGlbRoster.ts`, never Bannon's procedural roster or `roster.json` directly.

## Data contract

Fighter data, moves, stats, bios, attires and match spawning must be downstream of the GLB-backed identity/variant manifest. Do not fabricate missing authoritative Bannon data. If a GLB exists but its QA or source data is incomplete, keep it blocked/pending rather than inventing values.

## Exhaustive audit requirement

The roster is not considered complete merely because the current table is populated. Future agents must continue auditing Bannon's committed model tree, `assets/models/incoming`, banked rig-ready outputs, `tools/rigready/bank_map.json`, `assets/models/CANON_MODELS.md`, and measured model QA. Newly discovered GLBs must be mapped before promotion.

The governing rule remains: **NO GLB = NO CHARACTER.**
