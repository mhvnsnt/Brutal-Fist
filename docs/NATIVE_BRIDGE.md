# Native Schwarzerblitz to Bannon bridge

The upstream Schwarzerblitz engine accepts skeletal characters as DirectX .x resources and is Windows/Visual Studio based. The engine README documents that constraint.

The bridge therefore has two distinct stages:

1. Bannon validation/source stage
   - discover only real GLB fighter assets;
   - reject procedural-only fighters;
   - validate unified skin/canonical skeleton;
   - retarget verified animation clips;
   - generate a deterministic fighter manifest.

2. Native engine conversion stage
   - convert validated Bannon source to the engine's .x resource representation using an explicit exporter/tool;
   - preserve skeleton hierarchy and animation clips;
   - attach Brutal Fist roster identity/bio/stats;
   - load the resulting resource through the native character slot.

The web/PWA renderer is not treated as the native game. It remains a preview client.

The upstream engine is BSD-3-Clause code, but its bundled game assets are explicitly excluded from redistribution; Brutal Fist therefore replaces those assets rather than copying them.
