# BRUTAL FIST — DEFAULT VISUAL LAW

## HARD REQUIREMENT
The default playable character presentation is NOT 8-bit / NES pixel art.

The canonical default is PS1-era 3D polygonal fighting-game presentation.

Think:
- Tekken 3-era 3D character models
- Evil Zone-era 3D character presentation
- polygonal geometry with visible triangles/facets
- deliberately limited texture resolution and texture detail
- vertex snapping / controlled vertex wobble
- low-precision early-3D texture behavior where appropriate
- low-resolution render target/postprocess where appropriate
- authentic early-3D lighting/material behavior

Do NOT interpret retro, PS1, low-poly, low resolution, or pixelated as permission to turn fighters into 8-bit sprites.

## CHARACTER REQUIREMENT
The fighters shown in the actual match must be real 3D Bannon GLB fighters when a Bannon GLB exists and passes validation.

Never generate an 8-bit substitute character as the default.
Never replace a missing GLB with a pixel-art placeholder and call the fighter playable.
Never make the roster look like sprites unless a specific future graphics mode explicitly requests that.

## GRAPHICS PROFILES

### PS1_3D — DEFAULT
This is the launch/default profile.

Bannon GLB -> unified skinned mesh -> canonical skeleton -> validated rest pose -> animation retarget -> polygon/vertex treatment -> PS1-era materials/textures -> 3D renderer.

The model must remain visibly 3D.

### RETRO8 — OPTIONAL
The existing 8-bit/pixel treatment may remain available as an alternate experimental graphics mode.

It must never be selected by default.

### HIGH_RES — FUTURE
Reserved for a later higher-fidelity rendering/content profile.

## ACCEPTANCE TEST
A screenshot of the default match is a failure if a reasonable viewer would describe the fighters as NES characters, 8-bit sprites, 2D pixel-art characters, or flat sprite placeholders.

It should instead read immediately as:
LOW-POLY PS1 3D FIGHTING GAME.

## AI IMPLEMENTATION RULE
Before changing character rendering, read this file and docs/BRUTAL_FIST_MASTER_GAME_SPEC.md.

If an AI's generated UI/demo defaults to 8-bit characters, it is implementing the specification incorrectly. Correct the graphics profile and connect the renderer to real Bannon GLBs instead of polishing the 8-bit output.

Do not solve this by merely changing a label from 8-bit to PS1. The geometry, materials, camera and renderer must actually remain 3D.
