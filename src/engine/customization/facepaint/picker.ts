import type { FacePaintLayer, FacePaintPattern, FacePaintPreset, FaceRegionId } from './types';
import { listPatterns } from './patterns';
import { listPresets, getPreset } from './presets';
import { listRegions } from './regions';

/**
 * Picker data API — everything the UI lane needs to build the face-paint menu.
 * Pure data + validation; no DOM, no three.js scene access. The UI lane owns
 * all menu wiring and imports only from facepaint/index.ts.
 */

export interface ColorSwatch {
  hex: string;
  label: string;
  canon?: boolean;
}

/** Canon paint colors first, then a general working palette. */
export const PAINT_COLORS: ColorSwatch[] = [
  { hex: '#f2ede2', label: 'Clown white', canon: true },
  { hex: '#161513', label: 'Paint black', canon: true },
  { hex: '#e7ddc8', label: 'Bone', canon: true },
  { hex: '#a31621', label: 'Blood red', canon: true },
  { hex: '#ffffff', label: 'Pure white' },
  { hex: '#c8c2b4', label: 'Ash grey' },
  { hex: '#5a5f6a', label: 'Slate' },
  { hex: '#0b0b0c', label: 'Void black' },
  { hex: '#7a1f1f', label: 'Dried blood' },
  { hex: '#d94848', label: 'Bright red' },
  { hex: '#e08a3c', label: 'Ember orange' },
  { hex: '#e8c33c', label: 'Gold' },
  { hex: '#3c6e3c', label: 'Moss green' },
  { hex: '#39d353', label: 'Toxic green' },
  { hex: '#2c4a7a', label: 'Deep blue' },
  { hex: '#4cc3e8', label: 'Ice blue' },
  { hex: '#6a3c8a', label: 'Purple' },
  { hex: '#c33c8a', label: 'Magenta' },
];

export interface FacePaintPickerData {
  regions: ReturnType<typeof listRegions>;
  patterns: ReturnType<typeof listPatterns>;
  colors: ColorSwatch[];
  presets: ReturnType<typeof listPresets>;
}

/** One call that gives the UI everything it needs to render the picker. */
export function getPickerData(): FacePaintPickerData {
  return {
    regions: listRegions(),
    patterns: listPatterns(),
    colors: PAINT_COLORS,
    presets: listPresets(),
  };
}

export function getPatternList(): FacePaintPattern[] {
  return listPatterns() as FacePaintPattern[];
}

export function getRegionList() {
  return listRegions();
}

export function getPresetList() {
  return listPresets();
}

export { getPreset };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const VALID_REGIONS: FaceRegionId[] = ['forehead', 'eyes', 'cheeks', 'nose', 'mouthChin', 'fullFace'];

/** Validate a user-built layer stack. Returns error strings (empty = valid). */
export function validateLayers(layers: FacePaintLayer[]): string[] {
  const errors: string[] = [];
  const knownPatterns = new Set(listPatterns().map((p) => p.id));
  layers.forEach((l, i) => {
    const tag = `layer ${i}`;
    if (!VALID_REGIONS.includes(l.region)) errors.push(`${tag}: unknown region "${l.region}"`);
    if (!knownPatterns.has(l.pattern)) errors.push(`${tag}: unknown pattern "${l.pattern}"`);
    if (!HEX_RE.test(l.color)) errors.push(`${tag}: color must be #rrggbb, got "${l.color}"`);
    if (!(l.opacity >= 0 && l.opacity <= 1)) errors.push(`${tag}: opacity must be 0..1`);
    if (l.blend && l.blend !== 'paint' && l.blend !== 'erase') errors.push(`${tag}: bad blend "${l.blend}"`);
  });
  return errors;
}

/** Serialize a layer stack for save slots / share codes. */
export function serializeLayers(layers: FacePaintLayer[]): string {
  return JSON.stringify(layers);
}

/** Parse a serialized layer stack (throws on invalid). */
export function parseLayers(s: string): FacePaintLayer[] {
  const layers = JSON.parse(s) as FacePaintLayer[];
  if (!Array.isArray(layers)) throw new Error('Face-paint data is not a layer array');
  const errors = validateLayers(layers);
  if (errors.length) throw new Error(`Invalid face-paint layers: ${errors.join('; ')}`);
  return layers;
}

/** Deep-clone a preset's layers so UI edits never mutate the canon preset. */
export function clonePresetLayers(preset: FacePaintPreset): FacePaintLayer[] {
  return JSON.parse(JSON.stringify(preset.layers)) as FacePaintLayer[];
}
