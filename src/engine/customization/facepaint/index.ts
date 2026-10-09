/**
 * Face-paint system — public import surface for the UI lane.
 *
 * Architecture: paint lives on a DECAL mesh built from the character's own
 * face triangles (planar UVs, bound to the character skeleton). The base
 * skin texture/material is never touched (skin-tone likeness lock).
 *
 *   import {
 *     getPickerData, listPatterns, listPresets, listRegions,
 *     PAINT_COLORS, validateLayers, serializeLayers, parseLayers, clonePresetLayers,
 *     getPreset, FACE_PATTERNS, CANON_PRESETS, FACE_REGIONS,
 *     FacePaintPainter, FacePaintDecal, FACE_PAINT_PROFILES, getProfile,
 *   } from '@/engine/customization/facepaint';
 *
 * UI lane contract (see docs/customization/face-paint.md):
 *  1. getPickerData() -> everything the menu needs (regions, patterns, colors, presets).
 *  2. User builds FacePaintLayer[] (or clonePresetLayers(getPreset(id))).
 *  3. validateLayers(layers) before applying.
 *  4. Game-side applier (owns the character): 
 *       const decal = FacePaintDecal.build(skinnedMesh, getProfile('cipher')!);
 *       await decal.painter.paint(layers, FACE_PATTERNS);
 *       decal.texture.needsUpdate = true;
 *     Paint off: decal.setVisible(false) or decal.clearPaint().
 *  5. FacePaintDecal.proveSkinLock(skinnedMesh, baseTexture) for QC.
 */

// Types
export type {
  FaceRegionId,
  FaceRegionShape,
  FaceRegionDef,
  FacePaintBlend,
  FacePaintLayer,
  FacePaintPreset,
  FacePaintPattern,
  FacePaintProfile,
  SkinLockProof,
} from './types';

// Regions
export { FACE_REGIONS, getRegion, listRegions } from './regions';
// Patterns
export { FACE_PATTERNS, getPattern, listPatterns } from './patterns';
// Canon presets
export { CANON_PRESETS, getPreset, listPresets } from './presets';
// Picker data API (primary UI-lane entry point)
export {
  PAINT_COLORS,
  getPickerData,
  getPatternList,
  getRegionList,
  getPresetList,
  validateLayers,
  serializeLayers,
  parseLayers,
  clonePresetLayers,
} from './picker';
export type { ColorSwatch, FacePaintPickerData } from './picker';
// Runtime engine: painter (layers -> canvas) + decal (overlay mesh)
export { FacePaintPainter } from './painter';
export { FacePaintDecal } from './decal';
export type { FaceDecal } from './decal';
// Character profiles
export { FACE_PAINT_PROFILES, getProfile } from './profiles';
