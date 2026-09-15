# Grok v7 Architecture Integration

`mhvnsnt/brutalfistgrokversionseven` is an architectural source for Brutal Fist. Its game-building skill establishes fixed-timestep simulation, delta-scaled presentation, explicit 3D orientation conventions, dedicated movement/camera bases, asset discipline, audio/save/performance requirements, and finish criteria. Its engine code also provides a useful frame-data/move catalog, fighter state model, match phases, and grapple contract.

## Integration law

V7 is additive. Do not replace the existing Brutal Fist native Schwarzerblitz architecture or Bannon content contracts with a second competing engine. Reuse the strongest verified V7 ideas and implementations behind the existing shared contracts.

Priority remains:
1. User/BF requirements
2. Brutal Fist shared contracts
3. Bannon authoritative content
4. Schwarzerblitz native semantics
5. verified Grok v1-v7 systems
6. other owned repositories where the implementation is demonstrably stronger

## Integrated now

`src/engine/BrutalFistV7Architecture.ts` provides a shared adapter for V7's:
- application/game-mode state model
- graphics profiles
- match rules
- frame-data/move-definition schema
- verified light/heavy baseline move definitions
- grapple phases and physical-contact measurements
- optional pin/submission gates
- finite/infinite match timer conversion

## Rules

Default Brutal Fist rules are **KO only**. Pins and submissions are disabled by default and may only become active through explicit Match Options. Wrestling rules, round count, time limits including infinity, and related match settings belong in the match-rules layer rather than being hard-wired into default combat.

## Orientation

The V7 3D guidance is adopted as a correctness reference: character mesh forward is +Z, cameras look down -Z, and movement/camera vectors must not share mutable aliases. Brutal Fist's current match presentation additionally applies its measured ±45° root presentation correction for the current P1/P2 authored basis. This is a presentation-layer correction, not a fighter-specific bone hack.

## Next deep integration

1. Reconcile V7 engine/state contracts with `src/engine/GameEngine`.
2. Import V7 move/frame semantics into the existing combat catalog without duplicate authorities.
3. Map Bannon GLB animation clips to canonical fighter states and move animation aliases.
4. Gate each fighter on rig/skin/rest-pose/finite-transform/animation coverage.
5. Convert verified Bannon fighters into native Schwarzerblitz character resources.
6. Add stages, camera, audio, arcade/versus/training/result flow and save state through shared contracts.
7. Keep optional pins/submissions behind match rules; default remains KO.

No V7 asset or metadata is considered a playable Bannon fighter merely because it exists in the V7 repository. Actual Bannon GLB ownership and the full BF validation gates remain authoritative.
