/**
 * Bannon motion-bank → Brutal Fist move library.
 *
 * Every clip in mhvnsnt/Bannon assets/moves/clips becomes an assignable
 * catalog entry so unused mocap can be slotted in the WWE/Tekken-style
 * moveset editor. Authored catalog moves keep their IDs; bank clips use
 * bf_bank_<key>.
 */

import { BANNON_BANK_CLIP_KEYS } from '../data/bannonBankClipKeys';
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

function inferBankCategory(key: string): MoveCategory {
  const k = key.toUpperCase();
  if (/IDLE|STANCE|GINGA|LOCO|WALK|RUN|CROUCH_WALK|STRUT|PROWL|STALK/.test(k) && !/HIT|FALL|KO/.test(k)) {
    if (/CROUCH/.test(k)) return 'locomotion';
    return 'locomotion';
  }
  if (/GUARD|BLOCK|DEFENDER/.test(k)) return 'stance';
  if (/HIT|HURT|INJURED|FALL|DEFEAT|DYING|DEATH|KNOCK|KO/.test(k) && !/KICK/.test(k)) {
    if (/FALL|DEFEAT|DYING|DEATH|KNOCK/.test(k)) return 'knockdown';
    return 'reaction';
  }
  if (/KIP_UP|WAKE|GETUP/.test(k)) return 'wakeup';
  if (/SUPLEX|DDT|SLAM|THROW|CHOKE|BOMB|BUSTER|PIN|RANA|TOMBSTONE|DRIVER|CLINCH|GOOZLE/.test(k)) return 'throw';
  if (/KICK|KNEE/.test(k)) return 'kick';
  if (/TAUNT|DANCE|BREAKDANCE/.test(k)) return 'stance';
  if (/ZONE_|CLIMB|ROPE|VAULT|SLIDE/.test(k)) return 'locomotion';
  if (/CHOP|PUNCH|JAB|CROSS|BOXING|BASH|ELBOW|SWING/.test(k)) return 'strike';
  return 'signature';
}

function bankMoveId(key: string): string {
  return `bf_bank_${key.toLowerCase()}`;
}

export function buildBankLibraryMoves(): Record<string, BrutalFistMove> {
  const out: Record<string, BrutalFistMove> = {};
  for (const key of BANNON_BANK_CLIP_KEYS) {
    const category = inferBankCategory(key);
    const id = bankMoveId(key);
    const isThrow = category === 'throw';
    const isKick = category === 'kick';
    out[id] = {
      id,
      displayName: humanizeClipKey(key),
      category,
      startup: isThrow ? 14 : 8,
      active: 3,
      recovery: isThrow ? 28 : 16,
      damage: isThrow ? 40 : category === 'locomotion' || category === 'stance' || category === 'reaction' ? 0 : 18,
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
      description: `Bannon motion-bank clip "${key}". Unused by the default roster unless assigned in the moveset editor.`,
      hitbox: {
        offsetX: 0.6, offsetZ: 0, width: 0.9, depth: 0.65,
        damage: isThrow ? 40 : 18, hitstun: isThrow ? 36 : 16,
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
