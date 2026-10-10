import type { FacePaintPreset } from './types';

/**
 * Canon presets — owner-locked looks. These reproduce the approved likeness
 * for each character EXACTLY; do not restyle them. Custom user paint is built
 * from the same layers via the picker API, never by editing these.
 *
 * Canon sources:
 * - Cipher: bald muscular Black man, black/white grinning face paint (Lio Rush 2026 Blackheart ref)
 * - Onyx: Black woman, FULL white clown face paint w/ black eye/mouth markings; dark skin
 *   visible at paint cracks / thinner areas (owner binding 2026-10-06/08)
 * - Echo: long green hair, stitched/skull face paint (Shotzi Blackheart ref)
 */

const CLOWN_WHITE = '#f2ede2';
const PAINT_BLACK = '#161513';
const BONE = '#e7ddc8';
const BLOOD = '#a31621';

export const CANON_PRESETS: FacePaintPreset[] = [
  {
    id: 'cipher-grin',
    label: "Cipher — Grinning paint",
    characterId: 'cipher',
    canonLocked: true,
    description:
      'Canon Cipher: white base, hollow black eye sockets, black skull nose, wide black grin. Lio Rush 2026 Blackheart reference.',
    layers: [
      { region: 'fullFace', pattern: 'base-soft', color: CLOWN_WHITE, opacity: 0.96 },
      { region: 'eyes', pattern: 'eye-sockets', color: PAINT_BLACK, opacity: 0.92 },
      { region: 'nose', pattern: 'skull-nose', color: PAINT_BLACK, opacity: 0.88 },
      { region: 'mouthChin', pattern: 'grin', color: PAINT_BLACK, opacity: 0.95 },
    ],
  },
  {
    id: 'onyx-clown',
    label: 'Onyx — Street clown paint',
    characterId: 'onyx',
    canonLocked: true,
    description:
      'Canon Onyx street look: FULL white clown base with black chola eye band, black grin, cracked to show dark skin beneath. Skin-tone lock: base texture untouched.',
    layers: [
      { region: 'fullFace', pattern: 'base-soft', color: CLOWN_WHITE, opacity: 0.97 },
      { region: 'eyes', pattern: 'eye-band', color: PAINT_BLACK, opacity: 0.9 },
      { region: 'eyes', pattern: 'eye-sockets', color: PAINT_BLACK, opacity: 0.85 },
      { region: 'nose', pattern: 'skull-nose', color: PAINT_BLACK, opacity: 0.8 },
      { region: 'mouthChin', pattern: 'grin', color: PAINT_BLACK, opacity: 0.92 },
      // paint cracks chip through to the dark skin beneath (canon: skin visible at cracks)
      { region: 'cheeks', pattern: 'cracks', color: '#000000', opacity: 0.55, blend: 'erase' },
      { region: 'forehead', pattern: 'cracks', color: '#000000', opacity: 0.35, blend: 'erase' },
    ],
  },
  {
    id: 'echo-stitched',
    label: 'Echo — Stitched skull paint',
    characterId: 'echo',
    canonLocked: true,
    description:
      'Canon Echo: bone-white base, hollow black sockets, skull nose, sutured stitched mouth + cheek stitches. Shotzi Blackheart reference.',
    layers: [
      { region: 'fullFace', pattern: 'base-soft', color: BONE, opacity: 0.92 },
      { region: 'eyes', pattern: 'eye-sockets', color: PAINT_BLACK, opacity: 0.95 },
      { region: 'nose', pattern: 'skull-nose', color: PAINT_BLACK, opacity: 0.9 },
      { region: 'mouthChin', pattern: 'stitches', color: PAINT_BLACK, opacity: 0.95 },
      { region: 'cheeks', pattern: 'stitches', color: BLOOD, opacity: 0.65 },
    ],
  },
];

export function getPreset(id: string): FacePaintPreset {
  const p = CANON_PRESETS.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown face-paint preset: ${id}`);
  return p;
}

/** Picker-friendly preset list. */
export function listPresets(): Array<Pick<FacePaintPreset, 'id' | 'label' | 'characterId' | 'description' | 'canonLocked'>> {
  return CANON_PRESETS.map(({ id, label, characterId, description, canonLocked }) => ({
    id, label, characterId, description, canonLocked,
  }));
}
