# Brutal Fist — Bannon GLB Inventory

This is the current asset-level audit used by Brutal Fist. It is intentionally separate from Bannon's broader procedural/metadata roster.

## Rule
Only a Bannon character with an actual committed GLB model can become a Brutal Fist fighter. Procedural-only records never enter this catalog.

A committed GLB is necessary but not sufficient for match play: rig and measured skin-QA gates still apply. A GLB with `BLOCKED_QA` or `BLOCKED_RIG` remains excluded from normal Character Select until the gate passes.

## Directly identified GLB-backed identities

| Fighter | GLB / attire evidence | Current gate |
|---|---|---|
| Bannon | `BANNON.glb` | PASS |
| Bannon | `BANNON_muscular.glb` | BLOCKED_RIG |
| Maime | `MAIME.glb` | PASS |
| Maime | `MAIME_tattered.glb` | PASS |
| Onyx | `ONYX.glb` | BLOCKED_RIG |
| Onyx | `ONYX_corset.glb` | BLOCKED_RIG |
| Onyx | `ONYX_street.glb` | PASS |
| Onyx | `ONYX_straightjacket.glb` | PASS |
| Cain Elias | `CAIN_ELIAS_ring.glb` | BLOCKED_QA |
| Cain Elias | `CAIN_ELIAS_snakeskin.glb` | BLOCKED_QA |
| Cain Elias | `CAIN_ELIAS_gear.glb` | BLOCKED_QA |
| Cain Elias | `CAIN_ELIAS_godwithin.glb` | BLOCKED_QA |
| Stick-Up | `STICKUP.glb` | BLOCKED_QA |
| Cipher | `CIPHER.glb` | BLOCKED_QA |
| Cipher | `CIPHER_minion.glb` | PASS |
| Cipher | `CIPHER_feral.glb` | PASS |
| Echo | `ECHO.glb` | BLOCKED_QA |
| Cody | `CODY_sober.glb` | BLOCKED_QA |
| Cody | `CODY_stressed.glb` | BLOCKED_QA |
| Hall Nighter | `HALL_NIGHTER.glb` | BLOCKED_QA |
| Static | `STATIC.glb` | BLOCKED_QA |
| Static | `STATIC_alt.glb` | BLOCKED_QA |
| Viper | `VIPER.glb` | PASS |
| Kobra | `KOBRA.glb` | PASS |
| Aaron Ruben | `AARON_RUBEN.glb` | PASS |
| Hollow | `HOLLOW.glb` | BLOCKED_QA |
| Edwin Kennedy | `EDWIN_KENNEDY.glb` | BLOCKED_QA |
| Pablo | `PABLO.glb` | BLOCKED_QA |
| Tyneshia | `TYNESHIA.glb` | BLOCKED_QA |
| Triple XXX | `TRIPLE_XXX.glb` | BLOCKED_QA |
| El Toro de Oro | `EL_TORO_DE_ORO.glb` | BLOCKED_QA |
| Stan Combs | `STAN_COMBS_gear.glb` | BLOCKED_QA |
| Brutus | `BRUTUS.glb` | BLOCKED_QA |
| Titan | `TITAN.glb` | BLOCKED_QA |
| Master Sensei | `MASTER_SENSEI.glb` | BLOCKED_QA |
| Wreck Patterson | `WRECK_PATTERSON.glb` | BLOCKED_QA |

## Evidence
Bannon's `assets/models/CANON_MODELS.md` explicitly documents the core identities and many attire variants. Its measured `docs/MODEL_QA.md` roster also records GLB-backed identities including Viper, Kobra, Aaron Ruben, Hollow, Edwin, Pablo, Tyneshia, Triple XXX, El Toro, Stan, Brutus, Titan, Master Sensei and Wreck. The Bannon UniRig batch source maps additional committed model filenames including HOLLOW, HALL_NIGHTER, EDWIN_KENNEDY, PABLO, TYNESHIA, TRIPLE_XXX, EL_TORO_DE_ORO, STAN_COMBS_gear, BRUTUS, TITAN and MASTER_SENSEI.

## Important distinction
Multiple GLBs with the same fighter ID are attire/model variants, not additional fighters. Conversely, a model file that is explicitly an NPC asset is not automatically promoted to the playable roster merely because it is a GLB.

## Character Select contract
Character Select must consume `BANNON_GLB_PLAYABLE_MODELS` from `src/data/bannonGlbRoster.ts`, never Bannon's procedural roster or `roster.json` directly.

## No fake roster completion
If a fighter lacks an actual GLB, do not fill the slot with a procedural body, primitive, generated placeholder, or unrelated model. Leave the slot absent/locked and report the exact missing asset.

## Next audit
Any newly discovered committed Bannon GLB must be added to `bannonGlbRoster.ts` only after identifying its owner identity and whether it is a new fighter or an attire variant. Then it must pass the existing rig and skin-QA gates before becoming playable.
