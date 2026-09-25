# Brutal Fist PS1 visual target

The intended profile is PS1 3D, not 8-bit/NES pixel art.

Target characteristics:

- recognizable polygonal 3D silhouettes
- low-poly geometry with visible triangles/faceting
- 256-class low-resolution character textures without reducing the whole scene to pixel art
- nearest texture sampling where appropriate
- controlled affine/vertex-precision wobble
- full 3D lighting, depth and perspective
- readable faces, limbs, clothing and silhouettes
- no whole-screen 160x120 pixel-art treatment in the default profile

Reference direction: late-1990s/early-2000s 3D fighters such as Tekken 3 and Evil Zone. These are visual references, not assets to copy.

Profiles:
- ps1: default intended look, 320x240 internal target, 256 texture target, subtle quantization.
- retro8: preserves the chunkier current look as an optional setting.
- native: future higher-resolution presentation.

The character conversion pipeline and the renderer must be independently tunable. A low-resolution texture does not imply a low-resolution screen buffer.
