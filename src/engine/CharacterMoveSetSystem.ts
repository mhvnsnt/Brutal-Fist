/**
 * CHARACTER MOVE SET CUSTOMIZATION SYSTEM
 * 
 * Allows per-character move set customization. Each character has a default
 * move set derived from their Bannon bio and personality. Players can swap
 * individual move slots with any compatible move from the full catalog.
 * 
 * Move pool sourced from:
 *   - Schwarzerblitz open-source animations
 *   - Bannon repo character move data
 *   - BrutalfistbaseofTekken3Recompiled animation namespace
 */

import type { CharacterMoveSet } from '../data/bannonRoster';
import { getBannonFighter, getAllBannonFighters } from '../data/bannonRoster';
import { getMoveById, getMovesByCategory, type MoveCategory, type BrutalFistMove } from './BrutalFistMoveCatalog';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoveSlot = keyof CharacterMoveSet;

export interface MoveSlotConfig {
  slot: MoveSlot;
  label: string;
  category: MoveCategory;
  required: boolean;
}

export interface CustomizedMoveSet extends CharacterMoveSet {
  characterId: string;
  isCustomized: boolean;
  customizedSlots: MoveSlot[];
}

// ─── Move Slot Definitions ────────────────────────────────────────────────────

export const MOVE_SLOT_CONFIG: MoveSlotConfig[] = [
  { slot: 'idle',            label: 'Idle Stance',      category: 'locomotion', required: true },
  { slot: 'walkForward',     label: 'Walk Forward',     category: 'locomotion', required: true },
  { slot: 'walkBackward',    label: 'Walk Backward',    category: 'locomotion', required: true },
  { slot: 'crouch',          label: 'Crouch',           category: 'locomotion', required: true },
  { slot: 'guard',           label: 'Guard / Block',    category: 'stance',     required: true },
  { slot: 'lightAttack',     label: 'Light Attack',     category: 'strike',     required: true },
  { slot: 'heavyAttack',     label: 'Heavy Attack',     category: 'strike',     required: true },
  { slot: 'lowKick',         label: 'Low Kick',         category: 'kick',       required: true },
  { slot: 'highKick',        label: 'High Kick',        category: 'kick',       required: true },
  { slot: 'primaryCombo',    label: 'Primary Combo',    category: 'combo',      required: true },
  { slot: 'counter',         label: 'Counter Move',     category: 'counter',    required: true },
  { slot: 'grappleInitiate', label: 'Grapple',          category: 'grapple',    required: true },
  { slot: 'primaryThrow',    label: 'Primary Throw',    category: 'throw',      required: true },
  { slot: 'knockdown',       label: 'Knockdown',        category: 'knockdown',  required: true },
  { slot: 'wakeup',          label: 'Wakeup',           category: 'wakeup',     required: true },
  { slot: 'hitReaction',     label: 'Hit Reaction',     category: 'reaction',   required: true },
  { slot: 'ko',              label: 'KO Animation',     category: 'ko',         required: true },
  { slot: 'signature',       label: 'Signature / Finisher', category: 'signature', required: true },
  { slot: 'extraMove1',      label: 'Extra Move 1',     category: 'strike',     required: false },
  { slot: 'extraMove2',      label: 'Extra Move 2',     category: 'throw',      required: false },
];

// ─── In-Memory Store ──────────────────────────────────────────────────────────

const customizedMoveSets = new Map<string, CustomizedMoveSet>();

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Get the current move set for a character (custom or default).
 */
export function getCharacterMoveSet(characterId: string): CustomizedMoveSet | null {
  if (customizedMoveSets.has(characterId)) {
    return customizedMoveSets.get(characterId)!;
  }
  const fighter = getBannonFighter(characterId);
  if (!fighter) return null;
  return {
    ...fighter.defaultMoveSet,
    characterId,
    isCustomized: false,
    customizedSlots: [],
  };
}

/**
 * Assign a specific move to a slot for a character.
 * Returns the updated move set or null if the move is incompatible.
 */
export function assignMoveToSlot(
  characterId: string,
  slot: MoveSlot,
  moveId: string
): CustomizedMoveSet | null {
  const move = getMoveById(moveId);
  if (!move) return null;

  const slotConfig = MOVE_SLOT_CONFIG.find(c => c.slot === slot);
  if (!slotConfig) return null;

  // Validate category compatibility (locomotion/reaction/ko slots are strict)
  const strictSlots: MoveSlot[] = ['idle', 'walkForward', 'walkBackward', 'crouch', 'guard', 'knockdown', 'wakeup', 'hitReaction', 'ko'];
  if (strictSlots.includes(slot) && move.category !== slotConfig.category) {
    return null;
  }

  const current = getCharacterMoveSet(characterId);
  if (!current) return null;

  const updated: CustomizedMoveSet = {
    ...current,
    [slot]: moveId,
    isCustomized: true,
    customizedSlots: Array.from(new Set([...current.customizedSlots, slot])),
  };

  customizedMoveSets.set(characterId, updated);
  return updated;
}

/**
 * Reset a single slot back to the character's default.
 */
export function resetMoveSlot(characterId: string, slot: MoveSlot): CustomizedMoveSet | null {
  const fighter = getBannonFighter(characterId);
  if (!fighter) return null;

  const current = getCharacterMoveSet(characterId);
  if (!current) return null;

  const defaultValue = fighter.defaultMoveSet[slot];
  const updated: CustomizedMoveSet = {
    ...current,
    [slot]: defaultValue,
    customizedSlots: current.customizedSlots.filter(s => s !== slot),
  };
  updated.isCustomized = updated.customizedSlots.length > 0;

  customizedMoveSets.set(characterId, updated);
  return updated;
}

/**
 * Reset all slots to default for a character.
 */
export function resetAllMoveSlots(characterId: string): CustomizedMoveSet | null {
  const fighter = getBannonFighter(characterId);
  if (!fighter) return null;

  const reset: CustomizedMoveSet = {
    ...fighter.defaultMoveSet,
    characterId,
    isCustomized: false,
    customizedSlots: [],
  };
  customizedMoveSets.set(characterId, reset);
  return reset;
}

/**
 * Get all available moves for a given slot (filtered by compatible category).
 */
export function getAvailableMovesForSlot(slot: MoveSlot): BrutalFistMove[] {
  const slotConfig = MOVE_SLOT_CONFIG.find(c => c.slot === slot);
  if (!slotConfig) return [];

  // Strict slots only show their exact category
  const strictSlots: MoveSlot[] = ['idle', 'walkForward', 'walkBackward', 'crouch', 'guard', 'knockdown', 'wakeup', 'hitReaction', 'ko'];
  if (strictSlots.includes(slot)) {
    return getMovesByCategory(slotConfig.category);
  }

  // Attack/combo/throw/grapple slots show broader options
  const attackSlots: MoveSlot[] = ['lightAttack', 'heavyAttack', 'extraMove1', 'extraMove2'];
  if (attackSlots.includes(slot)) {
    return [
      ...getMovesByCategory('strike'),
      ...getMovesByCategory('kick'),
    ];
  }

  if (slot === 'primaryCombo') return getMovesByCategory('combo');
  if (slot === 'counter') return getMovesByCategory('counter');
  if (slot === 'grappleInitiate') return getMovesByCategory('grapple');
  if (slot === 'primaryThrow') return getMovesByCategory('throw');
  if (slot === 'signature') return getMovesByCategory('signature');
  if (slot === 'lowKick') return getMovesByCategory('kick');
  if (slot === 'highKick') return getMovesByCategory('kick');

  return getMovesByCategory(slotConfig.category);
}

/**
 * Get a summary of all characters and their customization status.
 */
export function getRosterCustomizationSummary(): Array<{
  id: string;
  name: string;
  isCustomized: boolean;
  customizedSlotCount: number;
}> {
  return getAllBannonFighters().map(fighter => {
    const moveSet = getCharacterMoveSet(fighter.id);
    return {
      id: fighter.id,
      name: fighter.name,
      isCustomized: moveSet?.isCustomized ?? false,
      customizedSlotCount: moveSet?.customizedSlots.length ?? 0,
    };
  });
}

/**
 * Export a character's move set as a serializable config.
 */
export function exportMoveSetConfig(characterId: string): Record<string, string> | null {
  const moveSet = getCharacterMoveSet(characterId);
  if (!moveSet) return null;
  const { characterId: _id, isCustomized: _c, customizedSlots: _s, ...moves } = moveSet;
  return moves as Record<string, string>;
}

/**
 * Import a move set config for a character (validates all move IDs).
 */
export function importMoveSetConfig(
  characterId: string,
  config: Record<string, string>
): CustomizedMoveSet | null {
  const fighter = getBannonFighter(characterId);
  if (!fighter) return null;

  const customizedSlots: MoveSlot[] = [];
  const merged = { ...fighter.defaultMoveSet } as CharacterMoveSet;

  for (const [slot, moveId] of Object.entries(config)) {
    const move = getMoveById(moveId);
    if (!move) continue;
    (merged as Record<string, string>)[slot] = moveId;
    if (fighter.defaultMoveSet[slot as MoveSlot] !== moveId) {
      customizedSlots.push(slot as MoveSlot);
    }
  }

  const result: CustomizedMoveSet = {
    ...merged,
    characterId,
    isCustomized: customizedSlots.length > 0,
    customizedSlots,
  };

  customizedMoveSets.set(characterId, result);
  return result;
}
