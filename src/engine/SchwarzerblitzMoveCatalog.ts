import type { FrameData } from '../types';

export interface SchwarzerblitzMoveDefinition extends FrameData {
  id: string;
  displayName: string;
  animationAliases: string[];
  minRange: number;
  maxRange: number;
  priority: number;
  low: boolean;
  mid: boolean;
  throw: boolean;
  canCancel: boolean;
  movementByFrame?: Array<{ frame: number; x: number; z: number }>;
  armorFrames?: Array<{ start: number; end: number }>;
  invincibleFrames?: Array<{ start: number; end: number }>;
}

export const BRUTAL_FIST_MOVE_CATALOG: Record<string, SchwarzerblitzMoveDefinition> = {
  light: {
    id: 'bf_light',
    displayName: 'Light',
    startup: 4,
    active: 3,
    recovery: 10,
    damage: 10,
    hitAdvantage: 4,
    blockAdvantage: -2,
    pushback: 0.6,
    hitstun: 15,
    blockstun: 9,
    animation: 'light',
    animationAliases: ['light', 'Light', 'punch', 'Punch', 'attack', 'Attack'],
    minRange: 0.2,
    maxRange: 1.95,
    priority: 10,
    low: false,
    mid: true,
    throw: false,
    canCancel: true,
    hitbox: { offsetX: 0.82, offsetZ: 0, width: 1.05, depth: 0.62, damage: 10, hitstun: 15, blockstun: 9, pushback: 0.6, launch: 0 }
  },
  heavy: {
    id: 'bf_heavy',
    displayName: 'Heavy',
    startup: 12,
    active: 4,
    recovery: 20,
    damage: 25,
    hitAdvantage: 2,
    blockAdvantage: -6,
    pushback: 1.1,
    hitstun: 24,
    blockstun: 13,
    animation: 'heavy',
    animationAliases: ['heavy', 'Heavy', 'strong', 'Strong', 'heavy_attack', 'HeavyAttack'],
    minRange: 0.35,
    maxRange: 2.35,
    priority: 20,
    low: false,
    mid: true,
    throw: false,
    canCancel: false,
    hitbox: { offsetX: 1.0, offsetZ: 0, width: 1.25, depth: 0.72, damage: 25, hitstun: 24, blockstun: 13, pushback: 1.1, launch: 0.2 }
  }
};

export function getMove(id: string) {
  return BRUTAL_FIST_MOVE_CATALOG[id];
}
