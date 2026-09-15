# Engine ownership migration

Brutal Fist is built on the architecture of the chosen open-source Schwarzerblitz engine, but upstream code/content must remain distinguishable from original Brutal Fist work until its license and provenance are verified.

## Migration rule

Do not attempt to make upstream code "non-proprietary" merely by renaming or modifying it. Copyright and license status do not disappear through modification.

Instead:

1. Vendor only upstream code that the applicable license permits.
2. Preserve required license/notice files and source attribution.
3. Record the upstream commit used as the baseline.
4. Isolate upstream code under a clearly marked engine boundary.
5. Replace upstream character meshes, textures, portraits, sounds, stages, scripts and other game-specific content with Brutal Fist/Bannon content as each subsystem is migrated.
6. Add new Brutal Fist systems outside the upstream boundary where practical.
7. When a subsystem is replaced, document the replacement and its tests.
8. Never copy proprietary or unlicensed assets simply because they are present in a public repository.

## Baseline objective

The native baseline should reach a complete playable fighting loop using the engine architecture:

boot → title → menu → character select → versus/load → match → round → win/KO → rematch/menu.

The content layer is then progressively replaced with Bannon/Brutal Fist assets.

## Bannon rule

Only Bannon assets with a verified real GLB are eligible for fighter promotion. Procedural-only characters are excluded.

Real Bannon animation sources are preferred over invented substitutes.

## Parallel PWA

The PWA is a preview/testing client. It mirrors the same fighter state/resource contracts but does not claim to be the native engine itself.
