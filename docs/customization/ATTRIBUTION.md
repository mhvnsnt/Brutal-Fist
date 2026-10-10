# Customization Suite — Attribution (Brutal-Fist port)

Phase 2 port of the AshLanev2 7-item suite. License posture carries over:

## Code provenance

- `src/engine/customization/facepaint/` (9 files) — ported from the
  AshLanev2 suite's `src/game3d/customization/facepaint/` (same universe,
  same canon, same team). No third-party code.
- `types.ts`, `eyeColors.ts`, `morphs.ts`, `persistence.ts`,
  `facepaintAdapter.ts`, `applyBuild.ts` — ported from the AshLanev2
  suite's customizer lane, adapted to Brutal-Fist's Mixamo-rigged cast and
  select-screen flow.
- `accessories.ts` — **new for this port**: PS1-budget procedural builders
  written for Brutal-Fist (no pulled meshes at all).
- `public/textures/facepaint/*.png` (12 pattern sprites) — copied from the
  AshLanev2 repo; lane-authored white-alpha sprites, no third-party rights.

## Open-source pulls (inherited from the AshLanev2 lane)

See AshLanev2 `docs/customization/ATTRIBUTION.md` for the full ledger. The
only open-source artifacts this port *uses* are the CC0 pattern PNGs above
(lane-authored, not pulled). Nothing AGPL/GPL anywhere near this code
(MB-Lab: reference only; MakeHuman code: never vendored).

## Canon sources

- Face-paint presets cipher-grin / onyx-clown / echo-stitched: owner-locked
  canon (Lio Rush 2026 Blackheart ref for Cipher; Onyx street clown w/ dark
  skin under paint per 2026-10-06/08 bindings; Shotzi Blackheart ref for
  Echo). Same canon as AshLanev2 — do not restyle.
- Pronouns: `src/data/canonPronouns.ts` (authoritative; Maime is he/him).
- No accessory is badged canon — none reproduce a canon likeness.
