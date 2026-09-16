/**
 * Bannon motion-bank → Brutal Fist move library.
 *
 * Every clip in mhvnsnt/Bannon assets/moves/clips becomes an assignable
 * catalog entry so unused mocap can be slotted in the WWE/Tekken-style
 * moveset editor. Authored catalog moves keep their IDs; bank clips use
 * bf_bank_<key>.
 *
 * Taxonomy (src/data/bannonClipTaxonomy.ts) labels:
 *   mixamo52        — single-person Mixamo, bind to BANNON_rigged now
 *   canonical17     — reduced skeleton (ZONE / TZ / Jungle Juice pairs)
 *   combined_multi  — 200–1000 bones: attacker+victim (or tag) in ONE FBX
 *                     Do not treat as a solo wrestler clip until split.
 */

import { BANNON_BANK_CLIP_KEYS } from '../data/bannonBankClipKeys';
import { getClipTaxon, type ClipFamily } from '../data/bannonClipTaxonomy';
import type { BrutalFistMove, MoveCategory } from './BrutalFistMoveCatalog';

function humanizeClipKey(key: string): string {
  return key
    .replace(/__\d+_/g, ' ')
    .replace(/___/g, ' ')
    .replace(/__/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const FAMILY_TO_CATEGORY: Record<ClipFamily, MoveCategory> = {
  locomotion: 'locomotion',
  stance: 'stance',
  taunt: 'stance',
  strike: 'strike',
  kick: 'kick',
  throw: 'throw',
  reaction: 'reaction',
  knockdown: 'knockdown',
  wakeup: 'wakeup',
  zone: 'locomotion',
  weapon: 'strike',
  cinematic: 'signature',
  unused_rig: 'signature',
  signature: 'signature',
};

function inferBankCategory(key: string): MoveCategory {
  const taxon = getClipTaxon(key);
  if (taxon) return FAMILY_TO_CATEGORY[taxon.family];
  return 'signature';
}

function bankMoveId(key: string): string {
  return `bf_bank_${key.toLowerCase()}`;
}

function descriptionFor(key: string): string {
  const taxon = getClipTaxon(key);
  if (!taxon) return `Bannon motion-bank clip "${key}".`;
  const bits = [`${taxon.family} / ${taxon.cast}`, `${taxon.bones} bones`, taxon.skeleton];
  if (taxon.pair) bits.push(`pairs with ${taxon.pair}`);
  if (taxon.skeleton === 'combined_multi') {
    bits.push('COMBINED FBX — attacker and opponent (or tag partners) live in one clip. Split before binding to a Mixamo solo fighter.');
  } else if (taxon.skeleton === 'mixamo52') {
    bits.push('Solo Mixamo — assignable to any roster fighter now.');
  } else {
    bits.push('Canonical/reduced skeleton — retarget to Mixamo before fight use.');
  }
  if (taxon.notes) bits.push(taxon.notes);
  return bits.join(' · ');
}

export function buildBankLibraryMoves(): Record<string, BrutalFistMove> {
  const out: Record<string, BrutalFistMove> = {};
  for (const key of BANNON_BANK_CLIP_KEYS) {
    const taxon = getClipTaxon(key);
    const category = inferBankCategory(key);
    const id = bankMoveId(key);
    const isThrow = category === 'throw' || taxon?.cast === 'attacker' || taxon?.cast === 'victim';
    const isKick = category === 'kick';
    const zeroDmg = category === 'locomotion' || category === 'stance' || category === 'reaction' || taxon?.family === 'taunt' || taxon?.family === 'unused_rig';
    out[id] = {
      id,
      displayName: humanizeClipKey(key) + (taxon?.cast === 'victim' ? ' (RECV)' : taxon?.cast === 'tag' ? ' (TAG)' : ''),
      category,
      startup: isThrow ? 14 : 8,
      active: 3,
      recovery: isThrow ? 28 : 16,
      damage: zeroDmg ? 0 : isThrow ? 40 : 18,
      hitAdvantage: 0,
      blockAdvantage: -4,
      pushback: isThrow ? 0 : 0.8,
      hitstun: isThrow ? 36 : 16,
      blockstun: isThrow ? 0 : 10,
      animation: key,
      animationAliases: [key, key.toLowerCase(), humanizeClipKey(key).replace(/ /g, '')],
      minRange: 0.1,
      maxRange: isThrow ? 1.0 : isKick ? 2.4 : 2.0,
      priority: 12,
      low: false,
      mid: !isThrow,
      overhead: /DIVE|SENTON|DROP|CROSS_JUMP/.test(key.toUpperCase()),
      throw: isThrow,
      canCancel: category === 'strike' || category === 'kick',
      inputSequence: `BANK:${key}`,
      description: descriptionFor(key),
      hitbox: {
        offsetX: 0.6, offsetZ: 0, width: 0.9, depth: 0.65,
        damage: zeroDmg ? 0 : isThrow ? 40 : 18, hitstun: isThrow ? 36 : 16,
        blockstun: isThrow ? 0 : 10, pushback: isThrow ? 0 : 0.8, launch: 0,
      },
    };
  }
  return out;
}

export const BANK_LIBRARY_MOVES = buildBankLibraryMoves();

export function getBankMoveIdForClip(key: string): string {
  return bankMoveId(key);
}
