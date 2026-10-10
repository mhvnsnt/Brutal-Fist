/**
 * Face-paint system — shared types.
 *
 * Architecture: paint lives on a DECAL mesh (a subset of the character's own
 * face triangles, offset 1.5mm along normals, with planar-projected UVs).
 * Layers are painted onto a canvas in decal-UV space and uploaded as the
 * decal's texture. The character's base skin texture/material is NEVER
 * touched — the skin-tone likeness lock is structural.
 * See docs/customization/face-paint.md.
 */

/** Paintable face regions, in normalized decal-UV space (0..1). */
export type FaceRegionId =
  | 'forehead'
  | 'eyes'
  | 'cheeks'
  | 'nose'
  | 'mouthChin'
  | 'fullFace';

/** One shape inside a region definition. Coordinates are 0..1 in face space:
 *  x: 0 = viewer's left, 1 = viewer's right (symmetric regions are mirror-safe)
 *  y: 0 = top of forehead, 1 = bottom of chin. */
export interface FaceRegionShape {
  kind: 'ellipse' | 'rect';
  /** center x, center y, x-radius, y-radius (rect: cx,cy = center, rx,ry = half-size) */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** edge softness 0..1 (fraction of radius feathered) */
  feather?: number;
}

export interface FaceRegionDef {
  id: FaceRegionId;
  label: string;
  hint: string;
  shapes: FaceRegionShape[];
}

/** How a paint layer blends onto the stack. */
export type FacePaintBlend = 'paint' | 'erase';

export interface FacePaintLayer {
  region: FaceRegionId;
  /** pattern id from the pattern registry */
  pattern: string;
  /** paint color as #rrggbb */
  color: string;
  /** 0..1 */
  opacity: number;
  blend?: FacePaintBlend;
  /** optional pattern transform inside the region */
  scale?: number;
  rotation?: number; // radians
  dx?: number; // 0..1 region-space offset
  dy?: number;
}

export interface FacePaintPreset {
  id: string;
  label: string;
  /** roster character this preset is canon for (undefined = generic) */
  characterId?: string;
  description: string;
  /** canon-locked presets must reproduce the owner's approved look exactly */
  canonLocked: boolean;
  layers: FacePaintLayer[];
}

export interface FacePaintPattern {
  id: string;
  label: string;
  /** path under public/, e.g. "textures/facepaint/grin.png" */
  file: string;
  hint: string;
}

/**
 * Per-character paint profile. faceDir is the facing direction in the
 * character mesh's LOCAL space (bind pose), verified visually per character.
 * The decal builder uses it to select face triangles + build planar UVs.
 */
export interface FacePaintProfile {
  characterId: string;
  label: string;
  /** glb path under public/, e.g. "models/cast/CIPHER_rigged.glb" */
  glb: string;
  /** unit vector in mesh local space pointing out of the face */
  faceDir: [number, number, number];
  /** up hint for the planar projection (defaults to +Y) */
  upHint?: [number, number, number];
  notes?: string;
}

/** Result of the skin-tone likeness-lock proof. */
export interface SkinLockProof {
  pass: boolean;
  /** the base texture/material was never written (structural guarantee) */
  baseUntouched: boolean;
  /** max |RGB delta| outside the decal between paint-on and paint-off renders */
  maxDeltaOutsideDecal: number;
  detail: string;
}
