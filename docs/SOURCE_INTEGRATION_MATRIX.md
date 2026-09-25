# Brutal Fist Source Integration Matrix

Brutal Fist is now explicitly a synthesis of the user's existing game work, not a rebuild that ignores prior repositories.

## Sources to mine and integrate

| Source | Role in Brutal Fist | Pull into |
|---|---|---|
| `mhvnsnt/SchwarzerblitzEngine` | Native fighting-game engine, timing, resource semantics, renderer/input architecture | `vendor/SchwarzerblitzEngine`, native bridge, runtime contracts |
| `mhvnsnt/brutalfistgrokversionsix` | Latest Grok Brutal Fist generation; native source/QA, Bannon source manifests, browser-game guidance | roster/resource manifests, QA, native integration, web runtime |
| `mhvnsnt/brutalfistgrokversionfive` | Prior Grok generation and implementation deltas | feature/QA/native deltas not present in v6 |
| `mhvnsnt/brutalfistgrokversionfour` | Prior Grok generation, including explicit `BannonSource` linkage | asset/manifest/native deltas not present in later versions |
| `mhvnsnt/brutalfistgrokversionthree` | Earlier roster/native implementation | roster, combat, animation, conversion deltas |
| `mhvnsnt/brutalfistgrokversiontwo` | Earlier full App Builder game contract and execution/QA rules | game-loop, browser QA, mobile and controls doctrine |
| `mhvnsnt/brutalfistgrokversion` | Earlier Brutal Fist implementation baseline | unique systems/assets not duplicated elsewhere |
| `mhvnsnt/NightSkyEngine` | Unreal Engine project with Control Rig, Manny/Quinn animation infrastructure, input/gameplay configuration | Unreal-side animation/control-rig reference and compatible systems |
| `mhvnsnt/Combat-RPG-prototype-` | combat/game-agent infrastructure, Unreal builder workflow, GitHub connector | combat tooling, agent bridge, build orchestration ideas |
| `mhvnsnt/Bannon` | Authoritative user-owned fighter/content source and advanced combat/physics architecture | fighter roster, GLBs, animation, combat/physics contracts, QA |

## Integration rule

These repositories are **source material**. Do not blindly concatenate them.
For each subsystem, inspect all versions, identify the strongest/most complete implementation, preserve useful unique work from older versions, then integrate it into the canonical Brutal Fist contract.

The Grok versions are historical snapshots of the same project family. Version 6 is the newest snapshot observed here, but versions 2–5 remain mandatory historical inputs because a later export can omit or regress a feature that existed earlier.

## What must be pulled forward

### Native engine

Use Schwarzerblitz as the native authority. Preserve its BSD-3-Clause code license and its separate upstream asset restrictions. The engine README explicitly says the engine code is open source while bundled characters/stages/music are not redistributable. Therefore integrate the engine code/resource semantics, not restricted upstream game content.

### Bannon fighter/content layer

Use the user's Bannon repository as the authoritative content source. The Bannon architecture ledger defines native combat/animation concepts including bounded root motion, hit-stop, active-ragdoll blending, poise, localized damage, grapple/pin physics, ropes, camera response, telemetry and roster/DNA concepts. These become shared contracts and native integration targets rather than browser-only fake effects.

### Grok roster/native source

The Grok versions contain a `native/source/roster.json` and real GLB source files including BANNON variants plus idle/walking/running resources. These are valuable migration inputs. Do not duplicate the same roster as separate competing schemas: normalize it into the canonical Brutal Fist fighter manifest and record source provenance.

### Grok game-building/QA doctrine

The v6/v2 Grok game-building material requires a real fixed-step gameplay loop, correct 3D orientation, camera/movement agreement, mobile support, asset validation and browser verification. Those rules reinforce Brutal Fist's existing 60 Hz simulation and measured QA requirements.

### NightSkyEngine

Use the Unreal project as a reference/source for Control Rig, Manny/Quinn animation infrastructure, gameplay tags, input configuration and Unreal-side animation workflows. Do not import unrelated project identity or overwrite the Schwarzerblitz native architecture.

### Combat-RPG prototype

Use its combat-agent/build-orchestration concepts and its GitHub connector as implementation references for the AI/GitHub bridge. Do not copy a PAT-dependent connector into the game runtime; repository credentials belong to the external development bridge, not the shipped game.

## Priority order when sources disagree

1. User's explicit Brutal Fist requirements.
2. Canonical Brutal Fist shared contracts.
3. Bannon's real fighter/content data for Bannon-origin content.
4. Schwarzerblitz native behavior for native engine semantics.
5. Best verified implementation among Grok snapshots.
6. NightSky/Combat-RPG techniques where they solve an actual missing subsystem.

## No-loss rule

Before replacing an implementation, compare it against the older source snapshots. Preserve any unique useful combat, animation, roster, QA, native, tooling or asset work. A newer repository is not automatically a complete repository.

## Current known evidence

- `brutalfistgrokversionsix` contains a substantial `.grok/skills/building-games` playbook and `native/source` assets/roster.
- `brutalfistgrokversionfive` and `brutalfistgrokversionfour` share substantial App Builder/native structure with v6 and must be checked for historical deltas.
- `brutalfistgrokversionthree` also contains `native/source/roster.json`.
- `Combat-RPG-prototype-` contains an `app/applet` GitHub connector and an Unreal builder workflow.
- `NightSkyEngine` contains Unreal Control Rig/Mannequin animation assets plus gameplay/input configuration.
- `Bannon` contains a dedicated native combat/animation/physics architecture ledger and specialized combat/physics agent directives.
