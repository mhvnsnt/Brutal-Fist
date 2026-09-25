# Brutal Fist PSX fighter pipeline

This pipeline is derived from the proven Bannon model-processing workflow and is deliberately separate from the canonical master model.

Input:
- BannonSource/assets/models/BANNON_rigged.glb

Output:
- public/models/bannon_psx.glb

Default target is 18,000 triangles and 256x256 texture maps. These are Brutal Fist starter targets, not claims about an upstream Schwarzerblitz requirement.

Stages:
1. preserve the canonical skinned GLB
2. weld/simplify while preserving skin, UVs and joints
3. resize/compress textures
4. optionally apply a PSX-style vertex-precision pass at render time
5. QA the resulting GLB before promotion

The source Bannon repo's documented rig QA and decimation workflow remains authoritative for Bannon-specific deformation checks.
