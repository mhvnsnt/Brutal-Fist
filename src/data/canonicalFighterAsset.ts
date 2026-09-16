/**
 * Canonical fighter asset contract.
 *
 * Character Select, PreCombatValidation, AnimationTestArena, and CombatArena3D
 * MUST resolve fighters through this module. Do not let one screen load
 * BANNON.glb (named-part) while another loads a skinned file.
 *
 * Logical names (what UI / validation display):
 *   BANNON → BANNON_rigged_ready.glb
 *   MAIME  → MAIME_rigged_ready.glb
 *
 * Physical files (what actually exists in public/models / Bannon GitHub):
 *   BANNON_rigged_ready.glb → BANNON_rigged.glb (58 Mixamo joints)
 *   MAIME_rigged_ready.glb  → MAIME_skinned.glb
 *
 * Named-part BANNON.glb / MAIME.glb are never returned for playable loads.
 */

import { getGlbEntryForFighter, type BannonGlbRosterEntry } from './bannonGlbRoster';
import { resolveGlbUrl } from './bannonGlbUrl';

export const CANONICAL_LOGICAL_GLB: Record<string, string> = {
  bannon: 'BANNON_rigged_ready.glb',
  maime: 'MAIME_rigged_ready.glb',
};

/** Logical request → file that must be fetched. */
export const CANONICAL_PHYSICAL_GLB: Record<string, string> = {
  'BANNON_rigged_ready.glb': 'BANNON_rigged.glb',
  'BANNON_rigged.glb': 'BANNON_rigged.glb',
  'BANNON.glb': 'BANNON_rigged.glb',
  'bannon.glb': 'BANNON_rigged.glb',
  'MAIME_rigged_ready.glb': 'MAIME_skinned.glb',
  'MAIME_skinned.glb': 'MAIME_skinned.glb',
  'MAIME.glb': 'MAIME_skinned.glb',
  'maime.glb': 'MAIME_skinned.glb',
};

export interface CanonicalFighterAsset {
  fighterId: string;
  logicalName: string;
  physicalFile: string;
  url: string;
  entry?: BannonGlbRosterEntry;
}

export function physicalGlbFile(model: string): string {
  return CANONICAL_PHYSICAL_GLB[model] ?? model;
}

export function resolveCanonicalFighterAsset(fighterId: string, model?: string): CanonicalFighterAsset {
  const entry = getGlbEntryForFighter(fighterId, model);
  const logicalName =
    model
    ?? entry?.model
    ?? CANONICAL_LOGICAL_GLB[fighterId]
    ?? `${fighterId.toUpperCase()}.glb`;
  const physicalFile = physicalGlbFile(entry?.model ?? logicalName);
  const url = resolveGlbUrl(physicalFile, entry?.overrideUrl);
  return { fighterId, logicalName: entry?.model ?? logicalName, physicalFile, url, entry };
}

export function canonicalFighterUrl(fighterId: string, model?: string): string {
  return resolveCanonicalFighterAsset(fighterId, model).url;
}
