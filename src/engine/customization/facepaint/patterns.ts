import type { FacePaintPattern } from './types';

/**
 * Pattern registry. Patterns are white-alpha PNGs authored in FACE space
 * (0..1 across the whole face plate, y 0 = forehead). The compositor tints
 * them per layer and clips them to the layer's region, so one pattern works
 * with any region/color. Files live in public/textures/facepaint/.
 */
export const FACE_PATTERNS: FacePaintPattern[] = [
  { id: 'base-soft', label: 'Full base', file: 'textures/facepaint/base-soft.png', hint: 'Solid paint base with a hand-painted mottle' },
  { id: 'grin', label: 'Grin', file: 'textures/facepaint/grin.png', hint: 'Wide clown grin with hooked ends' },
  { id: 'eye-sockets', label: 'Eye sockets', file: 'textures/facepaint/eye-sockets.png', hint: 'Hollow dark eye sockets' },
  { id: 'eye-band', label: 'Eye band', file: 'textures/facepaint/eye-band.png', hint: 'Straight band across the eyes (chola style)' },
  { id: 'stitches', label: 'Stitches', file: 'textures/facepaint/stitches.png', hint: 'Sutured X stitches — mouth column + cheek accents' },
  { id: 'skull-nose', label: 'Skull nose', file: 'textures/facepaint/skull-nose.png', hint: 'Inverted-triangle skull nose' },
  { id: 'cracks', label: 'Paint cracks', file: 'textures/facepaint/cracks.png', hint: 'Cracked-paint lines — pair with erase blend to chip paint down to skin' },
  { id: 'teardrop', label: 'Teardrop', file: 'textures/facepaint/teardrop.png', hint: 'Single teardrop under the left eye' },
  { id: 'stripes', label: 'War stripes', file: 'textures/facepaint/stripes.png', hint: 'Three vertical war-paint stripes' },
  { id: 'brow-slash', label: 'Brow slash', file: 'textures/facepaint/brow-slash.png', hint: 'Diagonal slash across the forehead' },
  { id: 'jaw-shade', label: 'Jaw shade', file: 'textures/facepaint/jaw-shade.png', hint: 'Soft shading over jaw and chin' },
  { id: 'dots', label: 'Dot row', file: 'textures/facepaint/dots.png', hint: 'Row of dots across the forehead' },
];

export function getPattern(id: string): FacePaintPattern {
  const p = FACE_PATTERNS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown face-paint pattern: ${id}`);
  return p;
}

/** Picker-friendly list: id + label + hint (+ file for thumbnails). */
export function listPatterns(): Array<Pick<FacePaintPattern, 'id' | 'label' | 'hint' | 'file'>> {
  return FACE_PATTERNS.map(({ id, label, hint, file }) => ({ id, label, hint, file }));
}
