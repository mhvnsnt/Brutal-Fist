# Brutal Fist — PS1_3D Render Contract

DEFAULT GRAPHICS PROFILE: PS1_3D

This is a hard implementation contract. A build agent must not choose 8-bit pixel-art fighters as the default.

## Required character pipeline
Bannon GLB -> unified skinned mesh -> canonical skeleton -> rest-pose validation -> animation retarget -> controlled polygon reduction -> PS1-era texture/material treatment -> vertex quantization/wobble -> 3D camera/render.

The fighter remains a real 3D mesh throughout the pipeline.

## Visual target
The result should read as an early-3D console fighting game: polygonal silhouettes, visible facets/triangles, low-detail textures, restrained texture resolution, vertex snapping/wobble and low-precision presentation. It should NOT read as NES, Game Boy, 8-bit sprite art, or a flat 2D game.

## Profile constants
PS1_3D is the default launch profile.
RETRO8 is optional and must be opt-in.
HIGH_RES is reserved for a future profile.

Persist the selected profile in the graphics settings, but initialize new installs/saves to PS1_3D.

## Renderer acceptance gate
A default match fails QA if either fighter is represented by a sprite, pixel-art placeholder, flat card, procedural primitive, or 8-bit substitute when a validated Bannon GLB is available.

A default match passes the visual gate only when both fighters are visibly 3D polygonal characters rendered through the PS1_3D path.

## Important distinction
Low resolution != 8-bit.
Low-poly != sprite.
PS1 != NES.
Pixelated texture artifacts != pixel-art characters.

Do not satisfy this contract by renaming an 8-bit renderer. The geometry, material pipeline and camera must actually render the 3D Bannon model.

## AI implementation rule
If an agent currently has a default 8-bit character demo, stop polishing it. Replace the character source with the validated Bannon GLB pipeline and make PS1_3D the initial graphics profile. Keep the old 8-bit implementation only behind RETRO8 so previous work is preserved rather than discarded.

## Engine boundary
Schwarzerblitz is the native foundation. Its published repository describes the engine source as BSD 3-Clause but separately states that original game assets are not covered by that license. Therefore use the engine code/architecture under its applicable license and replace restricted original game content with Brutal Fist/Bannon content.
