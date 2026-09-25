import { converter, parse, type Oklch } from 'culori';

/**
 * Paint slots measured from the Bannon GLBs (gltf-transform, 2026-09-24).
 * Maime's skinned meshes are named parts (pelvis, chest, head, arms, boots).
 * Every other playable fighter is one atlas on one mesh — cloth vs metal is a
 * luma/saturation split of that texture, not a second costume.
 */
export type PaintSlot = 'cloth' | 'metal' | 'legs' | 'torso' | 'head' | 'arms' | 'boots';

export type PartPaint = Partial<Record<PaintSlot, string>>;

export type GearAddon = 'none' | 'visor' | 'mouthplate' | 'wristtape';

export const PAINT_SWATCHES = [
  '#1d4ed8',
  '#b91c1c',
  '#15803d',
  '#ca8a04',
  '#7c3aed',
  '#db2777',
  '#d4d4d8',
  '#27272a',
  '#0e7490',
] as const;

export const SLOT_LABEL: Record<PaintSlot, string> = {
  cloth: 'CLOTH',
  metal: 'METAL',
  legs: 'LEGS',
  torso: 'TORSO',
  head: 'HEAD',
  arms: 'ARMS',
  boots: 'BOOTS',
};

const SPLIT_SLOTS: PaintSlot[] = ['head', 'torso', 'arms', 'legs', 'boots'];
const ATLAS_SLOTS: PaintSlot[] = ['cloth', 'metal'];

export function paintSlotsForFighter(fighterId: string): PaintSlot[] {
  return fighterId === 'maime' ? SPLIT_SLOTS : ATLAS_SLOTS;
}

/** Named-part mesh → slot. Null means the mesh is a single atlas. */
export function regionForMesh(name: string): PaintSlot | null {
  const n = name.replace(/^mixamorig:?/i, '').toLowerCase();
  if (/^(ft|ftl|ftr|foot|boot)/.test(n)) return 'boots';
  if (/^(hip|kn|pelvis|leg)/.test(n)) return 'legs';
  if (/^(sh|el|ha|arm|hand)/.test(n)) return 'arms';
  if (/head|face|hair/.test(n)) return 'head';
  if (/chest|torso|spine/.test(n)) return 'torso';
  return null;
}

const toOklch = converter('oklch');
const toRgb = converter('rgb');

/**
 * Turn a picked hex into a multiply color. culori lifts OKLCH lightness so a
 * dark swatch tints the albedo instead of crushing it to black.
 */
export function paintMultiply(hex: string): { r: number; g: number; b: number } {
  const parsed = parse(hex);
  const lch = parsed ? toOklch(parsed) : null;
  if (!lch || lch.l == null) return { r: 1, g: 1, b: 1 };
  const lifted: Oklch = {
    mode: 'oklch',
    l: Math.min(0.84, Math.max(0.5, lch.l)),
    c: lch.c ?? 0,
    h: lch.h ?? 0,
  };
  const rgb = toRgb(lifted);
  if (!rgb || rgb.r == null || rgb.g == null || rgb.b == null) return { r: 1, g: 1, b: 1 };
  return { r: rgb.r, g: rgb.g, b: rgb.b };
}
