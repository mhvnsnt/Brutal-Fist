import type { FaceRegionDef, FaceRegionId } from './types';
import regionData from './data/regions.json';

const ORDER: FaceRegionId[] = ['forehead', 'eyes', 'cheeks', 'nose', 'mouthChin', 'fullFace'];

/** All paintable face regions, in canonical order. Geometry comes from data/regions.json. */
export const FACE_REGIONS: FaceRegionDef[] = ORDER.map(
  (id) => regionData.regions.find((r) => r.id === id) as FaceRegionDef,
);

export function getRegion(id: FaceRegionId): FaceRegionDef {
  const r = FACE_REGIONS.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown face region: ${id}`);
  return r;
}

/** Picker-friendly list: id + label + hint. */
export function listRegions(): Array<Pick<FaceRegionDef, 'id' | 'label' | 'hint'>> {
  return FACE_REGIONS.map(({ id, label, hint }) => ({ id, label, hint }));
}
