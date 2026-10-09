import type { FacePaintProfile } from './types';

/**
 * Per-character paint profiles. faceDir is the facing direction in the
 * character mesh's LOCAL space (bind pose), verified visually per character —
 * the decal builder selects face triangles with it and builds planar UVs.
 *
 * Shared-universe note: cipher / onyx / echo are the same canon characters
 * as the AshLanev2 suite's profiles (same models, same canon), repointed at
 * Brutal-Fist's public/models/ filenames. faceDir values carry over (mesh
 * local space) and are re-verified by the QC renders on this repo.
 */
export const FACE_PAINT_PROFILES: FacePaintProfile[] = [
  {
    characterId: 'cipher',
    label: 'Cipher',
    glb: 'models/CIPHER_rigged.glb',
    faceDir: [1, 0, 0],
    notes:
      'Bald. faceDir verified via Blender head renders (nose points +X in mesh local space). Canon paint: cipher-grin preset.',
  },
  {
    characterId: 'onyx',
    label: 'Onyx',
    glb: 'models/ONYX_street.glb',
    faceDir: [-1, 0, 0],
    notes:
      'Street attire. faceDir verified via Blender turntable (nose points -X). FULL white clown paint canon; dark skin under paint (skin-tone lock).',
  },
  {
    characterId: 'echo',
    label: 'Echo',
    glb: 'models/ECHO.glb',
    faceDir: [0.954, 0, 0.299],
    notes:
      'faceDir = head-bone X axis (horizontal), pending visual confirmation. Stitched/skull paint canon (echo-stitched preset).',
  },
];

export function getProfile(characterId: string): FacePaintProfile | undefined {
  return FACE_PAINT_PROFILES.find((p) => p.characterId === characterId);
}
