/**
 * BRUTAL FIST MASTER MOVE CATALOG
 * 
 * Animation aliases sourced from:
 *   - Schwarzerblitz open-source engine (github.com/AndreaOrru/schwarzerblitz-engine)
 *   - Bannon repo character move data (github.com/mhvnsnt/Bannon)
 *   - BrutalfistbaseofTekken3Recompiled animation namespace (github.com/mhvnsnt/BrutalfistbaseofTekken3Recompiled)
 * 
 * All Schwarzerblitz assets used under their open-source license.
 * Bannon assets used with owner permission.
 * Tekken3Recompiled animation namespace references used with owner permission.
 */

import type { FrameData } from '../types';

// ─── Move Category Types ──────────────────────────────────────────────────────

export type MoveCategory =
  | 'locomotion' |'stance' |'strike' |'kick' |'combo' |'counter' |'grapple' |'throw' |'knockdown' |'wakeup' |'reaction' |'ko' |'signature';

export interface BrutalFistMove extends FrameData {
  id: string;
  displayName: string;
  category: MoveCategory;
  animationAliases: string[];
  minRange: number;
  maxRange: number;
  priority: number;
  low: boolean;
  mid: boolean;
  overhead: boolean;
  throw: boolean;
  canCancel: boolean;
  inputSequence?: string;
  description: string;
  armorFrames?: Array<{ start: number; end: number }>;
  invincibleFrames?: Array<{ start: number; end: number }>;
}

// ─── LOCOMOTION ───────────────────────────────────────────────────────────────

export const LOCOMOTION_MOVES: Record<string, BrutalFistMove> = {
  idle: {
    id: 'bf_idle', displayName: 'Idle Stance', category: 'locomotion',
    startup: 0, active: 0, recovery: 0, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'idle',
    animationAliases: ['idle', 'Idle', 'neutral', 'Neutral', 'stance', 'Stance', 'stand', 'Stand'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: true,
    description: 'Default neutral standing position.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
  walkForward: {
    id: 'bf_walk_fwd', displayName: 'Walk Forward', category: 'locomotion',
    startup: 0, active: 0, recovery: 0, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'walkForward',
    animationAliases: ['walkForward', 'walk_forward', 'WalkForward', 'walk', 'Walk', 'forward_walk'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: true,
    description: 'Walk toward opponent.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
  walkBackward: {
    id: 'bf_walk_back', displayName: 'Walk Backward', category: 'locomotion',
    startup: 0, active: 0, recovery: 0, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'walkBackward',
    animationAliases: ['walkBackward', 'walk_backward', 'WalkBackward', 'back_walk', 'retreat'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: true,
    description: 'Walk away from opponent.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
  crouch: {
    id: 'bf_crouch', displayName: 'Crouch', category: 'locomotion',
    startup: 3, active: 0, recovery: 3, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'crouch',
    animationAliases: ['crouch', 'Crouch', 'duck', 'Duck', 'low_stance', 'LowStance'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: true,
    description: 'Low defensive crouch position.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
  guard: {
    id: 'bf_guard', displayName: 'Guard / Block', category: 'stance',
    startup: 2, active: 0, recovery: 4, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'guard',
    animationAliases: ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend', 'parry'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: true,
    description: 'Standing block stance.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
};

// ─── STRIKES ─────────────────────────────────────────────────────────────────

export const STRIKE_MOVES: Record<string, BrutalFistMove> = {
  jab: {
    id: 'bf_jab', displayName: 'Jab', category: 'strike',
    startup: 3, active: 2, recovery: 8, damage: 8, hitAdvantage: 5, blockAdvantage: 0,
    pushback: 0.4, hitstun: 12, blockstun: 7, animation: 'jab',
    animationAliases: ['jab', 'Jab', 'quick_punch', 'QuickPunch', 'light_punch', 'LightPunch', 'punch1'],
    minRange: 0.2, maxRange: 1.8, priority: 8, low: false, mid: true, overhead: false, throw: false, canCancel: true,
    inputSequence: 'LP',
    description: 'Fast jab. High cancel potential.',
    hitbox: { offsetX: 0.75, offsetZ: 0, width: 0.9, depth: 0.55, damage: 8, hitstun: 12, blockstun: 7, pushback: 0.4, launch: 0 }
  },
  cross: {
    id: 'bf_cross', displayName: 'Cross', category: 'strike',
    startup: 6, active: 3, recovery: 14, damage: 16, hitAdvantage: 2, blockAdvantage: -4,
    pushback: 0.8, hitstun: 18, blockstun: 10, animation: 'cross',
    animationAliases: ['cross', 'Cross', 'straight', 'Straight', 'right_punch', 'RightPunch', 'punch2'],
    minRange: 0.3, maxRange: 2.0, priority: 14, low: false, mid: true, overhead: false, throw: false, canCancel: true,
    inputSequence: 'RP',
    description: 'Straight cross punch. Good damage.',
    hitbox: { offsetX: 0.85, offsetZ: 0, width: 1.0, depth: 0.6, damage: 16, hitstun: 18, blockstun: 10, pushback: 0.8, launch: 0 }
  },
  hook: {
    id: 'bf_hook', displayName: 'Hook', category: 'strike',
    startup: 8, active: 4, recovery: 18, damage: 22, hitAdvantage: 0, blockAdvantage: -6,
    pushback: 1.0, hitstun: 22, blockstun: 12, animation: 'hook',
    animationAliases: ['hook', 'Hook', 'left_hook', 'LeftHook', 'swing', 'Swing', 'haymaker'],
    minRange: 0.2, maxRange: 1.6, priority: 18, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'LK',
    description: 'Wide hook. High damage, slower startup.',
    hitbox: { offsetX: 0.7, offsetZ: 0.3, width: 1.1, depth: 0.7, damage: 22, hitstun: 22, blockstun: 12, pushback: 1.0, launch: 0.1 }
  },
  uppercut: {
    id: 'bf_uppercut', displayName: 'Uppercut', category: 'strike',
    startup: 10, active: 3, recovery: 22, damage: 28, hitAdvantage: -2, blockAdvantage: -8,
    pushback: 0.6, hitstun: 26, blockstun: 14, animation: 'uppercut',
    animationAliases: ['uppercut', 'Uppercut', 'rising_punch', 'RisingPunch', 'upper', 'Upper', 'shovel_hook'],
    minRange: 0.1, maxRange: 1.4, priority: 22, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'RK',
    description: 'Rising uppercut. Launches on hit.',
    hitbox: { offsetX: 0.6, offsetZ: 0, width: 0.9, depth: 0.6, damage: 28, hitstun: 26, blockstun: 14, pushback: 0.6, launch: 0.8 }
  },
  elbow: {
    id: 'bf_elbow', displayName: 'Elbow Strike', category: 'strike',
    startup: 7, active: 3, recovery: 16, damage: 20, hitAdvantage: 1, blockAdvantage: -5,
    pushback: 0.9, hitstun: 20, blockstun: 11, animation: 'elbow',
    animationAliases: ['elbow', 'Elbow', 'elbow_strike', 'ElbowStrike', 'elbow_smash', 'bushido_code_elbow'],
    minRange: 0.1, maxRange: 1.5, priority: 16, low: false, mid: true, overhead: false, throw: false, canCancel: true,
    inputSequence: 'LP+RP',
    description: 'Short-range elbow. Strong style.',
    hitbox: { offsetX: 0.65, offsetZ: 0, width: 0.85, depth: 0.6, damage: 20, hitstun: 20, blockstun: 11, pushback: 0.9, launch: 0 }
  },
  chop: {
    id: 'bf_chop', displayName: 'Dragon Chop', category: 'strike',
    startup: 5, active: 3, recovery: 12, damage: 14, hitAdvantage: 3, blockAdvantage: -2,
    pushback: 0.7, hitstun: 16, blockstun: 9, animation: 'chop',
    animationAliases: ['chop', 'Chop', 'dragon_chop', 'DragonChop', 'open_hand', 'OpenHand', 'karate_chop'],
    minRange: 0.2, maxRange: 1.9, priority: 12, low: false, mid: true, overhead: false, throw: false, canCancel: true,
    inputSequence: 'LP',
    description: 'Open-hand chop. Tatsu-style.',
    hitbox: { offsetX: 0.8, offsetZ: 0, width: 1.0, depth: 0.6, damage: 14, hitstun: 16, blockstun: 9, pushback: 0.7, launch: 0 }
  },
  ironPalm: {
    id: 'bf_iron_palm', displayName: 'Iron Palm', category: 'strike',
    startup: 9, active: 2, recovery: 20, damage: 30, hitAdvantage: -1, blockAdvantage: -7,
    pushback: 1.2, hitstun: 28, blockstun: 15, animation: 'ironPalm',
    animationAliases: ['ironPalm', 'iron_palm', 'IronPalm', 'open_hand_strike', 'shaolin_palm', 'ShaolinPalm'],
    minRange: 0.1, maxRange: 1.5, priority: 24, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'LP+LK',
    description: 'Shaolin Shadow signature. Devastating open-hand strike.',
    hitbox: { offsetX: 0.7, offsetZ: 0, width: 0.9, depth: 0.6, damage: 30, hitstun: 28, blockstun: 15, pushback: 1.2, launch: 0.3 }
  },
};

// ─── KICKS ────────────────────────────────────────────────────────────────────

export const KICK_MOVES: Record<string, BrutalFistMove> = {
  lowKick: {
    id: 'bf_low_kick', displayName: 'Low Kick', category: 'kick',
    startup: 4, active: 3, recovery: 10, damage: 10, hitAdvantage: 4, blockAdvantage: -1,
    pushback: 0.5, hitstun: 14, blockstun: 8, animation: 'lowKick',
    animationAliases: ['lowKick', 'low_kick', 'LowKick', 'leg_kick', 'LegKick', 'bushido_low', 'ankle_kick'],
    minRange: 0.3, maxRange: 2.1, priority: 10, low: true, mid: false, overhead: false, throw: false, canCancel: true,
    inputSequence: 'LK',
    description: 'Fast low kick targeting the legs.',
    hitbox: { offsetX: 0.9, offsetZ: 0, width: 1.1, depth: 0.5, damage: 10, hitstun: 14, blockstun: 8, pushback: 0.5, launch: 0 }
  },
  midKick: {
    id: 'bf_mid_kick', displayName: 'Mid Kick', category: 'kick',
    startup: 7, active: 3, recovery: 16, damage: 18, hitAdvantage: 1, blockAdvantage: -5,
    pushback: 0.9, hitstun: 20, blockstun: 11, animation: 'midKick',
    animationAliases: ['midKick', 'mid_kick', 'MidKick', 'body_kick', 'BodyKick', 'roundhouse_low', 'side_kick'],
    minRange: 0.3, maxRange: 2.3, priority: 16, low: false, mid: true, overhead: false, throw: false, canCancel: true,
    inputSequence: 'RK',
    description: 'Solid mid-section kick.',
    hitbox: { offsetX: 1.0, offsetZ: 0, width: 1.2, depth: 0.6, damage: 18, hitstun: 20, blockstun: 11, pushback: 0.9, launch: 0 }
  },
  highKick: {
    id: 'bf_high_kick', displayName: 'High Kick', category: 'kick',
    startup: 12, active: 3, recovery: 24, damage: 26, hitAdvantage: -2, blockAdvantage: -8,
    pushback: 1.1, hitstun: 26, blockstun: 14, animation: 'highKick',
    animationAliases: ['highKick', 'high_kick', 'HighKick', 'head_kick', 'HeadKick', 'roundhouse', 'Roundhouse'],
    minRange: 0.3, maxRange: 2.4, priority: 22, low: false, mid: false, overhead: true, throw: false, canCancel: false,
    inputSequence: 'LK+RK',
    description: 'Overhead high kick. Beats crouching guard.',
    hitbox: { offsetX: 1.0, offsetZ: 0, width: 1.2, depth: 0.65, damage: 26, hitstun: 26, blockstun: 14, pushback: 1.1, launch: 0.4 }
  },
  spinningKick: {
    id: 'bf_spin_kick', displayName: 'Spinning Kick', category: 'kick',
    startup: 14, active: 4, recovery: 26, damage: 30, hitAdvantage: -3, blockAdvantage: -10,
    pushback: 1.3, hitstun: 28, blockstun: 16, animation: 'spinningKick',
    animationAliases: ['spinningKick', 'spinning_kick', 'SpinningKick', 'spin_kick', 'tornado_kick', 'TornadoKick', 'wheel_kick'],
    minRange: 0.3, maxRange: 2.5, priority: 26, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'b+RK',
    description: 'Spinning wheel kick. High damage.',
    hitbox: { offsetX: 1.1, offsetZ: 0, width: 1.3, depth: 0.7, damage: 30, hitstun: 28, blockstun: 16, pushback: 1.3, launch: 0.2 }
  },
  dragonScrew: {
    id: 'bf_dragon_screw', displayName: 'Dragon Screw', category: 'kick',
    startup: 10, active: 3, recovery: 20, damage: 22, hitAdvantage: 0, blockAdvantage: -6,
    pushback: 0.8, hitstun: 24, blockstun: 13, animation: 'dragonScrew',
    animationAliases: ['dragonScrew', 'dragon_screw', 'DragonScrew', 'leg_whip', 'LegWhip', 'kiko_screw'],
    minRange: 0.2, maxRange: 1.8, priority: 20, low: true, mid: false, overhead: false, throw: false, canCancel: false,
    inputSequence: 'f+LK',
    description: 'Spinning leg whip targeting the knee. Kiko Tanaka signature.',
    hitbox: { offsetX: 0.9, offsetZ: 0, width: 1.1, depth: 0.6, damage: 22, hitstun: 24, blockstun: 13, pushback: 0.8, launch: 0 }
  },
  shiningWizard: {
    id: 'bf_shining_wizard', displayName: 'Shining Wizard', category: 'kick',
    startup: 16, active: 2, recovery: 28, damage: 34, hitAdvantage: -4, blockAdvantage: -12,
    pushback: 1.4, hitstun: 32, blockstun: 18, animation: 'shiningWizard',
    animationAliases: ['shiningWizard', 'shining_wizard', 'ShiningWizard', 'running_knee', 'RunningKnee', 'wizard_kick'],
    minRange: 0.2, maxRange: 2.0, priority: 28, low: false, mid: false, overhead: true, throw: false, canCancel: false,
    inputSequence: 'run+LK',
    description: 'Running single knee strike to the head. Kiko Tanaka signature.',
    hitbox: { offsetX: 0.8, offsetZ: 0, width: 1.0, depth: 0.65, damage: 34, hitstun: 32, blockstun: 18, pushback: 1.4, launch: 0.6 }
  },
  discusClothesline: {
    id: 'bf_discus_clothesline', displayName: "Lion's Roar", category: 'kick',
    startup: 18, active: 3, recovery: 30, damage: 36, hitAdvantage: -5, blockAdvantage: -12,
    pushback: 1.6, hitstun: 34, blockstun: 18, animation: 'discusClothesline',
    animationAliases: ['discusClothesline', 'discus_clothesline', 'DiscusClothesline', 'lions_roar', 'LionsRoar', 'running_discus'],
    minRange: 0.3, maxRange: 2.6, priority: 30, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'run+LP',
    description: "Akon's signature. Running discus clothesline.",
    hitbox: { offsetX: 1.2, offsetZ: 0, width: 1.4, depth: 0.7, damage: 36, hitstun: 34, blockstun: 18, pushback: 1.6, launch: 0.3 }
  },
};

// ─── COMBOS ───────────────────────────────────────────────────────────────────

export const COMBO_MOVES: Record<string, BrutalFistMove> = {
  jabCross: {
    id: 'bf_jab_cross', displayName: 'Jab-Cross', category: 'combo',
    startup: 3, active: 5, recovery: 16, damage: 22, hitAdvantage: 2, blockAdvantage: -4,
    pushback: 0.9, hitstun: 20, blockstun: 11, animation: 'jabCross',
    animationAliases: ['jabCross', 'jab_cross', 'JabCross', 'one_two', 'OneTwo', '1_2_combo'],
    minRange: 0.2, maxRange: 2.0, priority: 16, low: false, mid: true, overhead: false, throw: false, canCancel: true,
    inputSequence: 'LP,RP',
    description: 'Classic 1-2 jab-cross combination.',
    hitbox: { offsetX: 0.85, offsetZ: 0, width: 1.05, depth: 0.6, damage: 22, hitstun: 20, blockstun: 11, pushback: 0.9, launch: 0 }
  },
  jabCrossHook: {
    id: 'bf_jab_cross_hook', displayName: 'Jab-Cross-Hook', category: 'combo',
    startup: 3, active: 8, recovery: 22, damage: 40, hitAdvantage: -1, blockAdvantage: -7,
    pushback: 1.2, hitstun: 28, blockstun: 14, animation: 'jabCrossHook',
    animationAliases: ['jabCrossHook', 'jab_cross_hook', 'JabCrossHook', 'one_two_three', 'triple_combo'],
    minRange: 0.2, maxRange: 2.0, priority: 22, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'LP,RP,LK',
    description: '3-hit boxing combination.',
    hitbox: { offsetX: 0.9, offsetZ: 0, width: 1.1, depth: 0.65, damage: 40, hitstun: 28, blockstun: 14, pushback: 1.2, launch: 0.2 }
  },
  rushCombo: {
    id: 'bf_rush_combo', displayName: 'Rush Combo', category: 'combo',
    startup: 5, active: 10, recovery: 28, damage: 55, hitAdvantage: -3, blockAdvantage: -10,
    pushback: 1.5, hitstun: 34, blockstun: 18, animation: 'rushCombo',
    animationAliases: ['rushCombo', 'rush_combo', 'RushCombo', 'blitz_combo', 'BlitzCombo', 'rapid_fire'],
    minRange: 0.2, maxRange: 1.9, priority: 28, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'LP,LP,RP,RK',
    description: '4-hit rush combo. High damage.',
    hitbox: { offsetX: 0.85, offsetZ: 0, width: 1.05, depth: 0.65, damage: 55, hitstun: 34, blockstun: 18, pushback: 1.5, launch: 0.4 }
  },
  kickBoxingCombo: {
    id: 'bf_kickbox_combo', displayName: 'Kickboxing Combo', category: 'combo',
    startup: 6, active: 12, recovery: 30, damage: 60, hitAdvantage: -4, blockAdvantage: -12,
    pushback: 1.6, hitstun: 36, blockstun: 20, animation: 'kickBoxingCombo',
    animationAliases: ['kickBoxingCombo', 'kickboxing_combo', 'KickboxingCombo', 'muay_thai_combo', 'MuayThaiCombo'],
    minRange: 0.2, maxRange: 2.2, priority: 30, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'LP,RP,LK,RK',
    description: 'Mixed punch-kick combination.',
    hitbox: { offsetX: 0.95, offsetZ: 0, width: 1.15, depth: 0.7, damage: 60, hitstun: 36, blockstun: 20, pushback: 1.6, launch: 0.5 }
  },
};

// ─── COUNTERS ─────────────────────────────────────────────────────────────────

export const COUNTER_MOVES: Record<string, BrutalFistMove> = {
  reversal: {
    id: 'bf_reversal', displayName: 'Reversal', category: 'counter',
    startup: 1, active: 2, recovery: 20, damage: 18, hitAdvantage: 4, blockAdvantage: 0,
    pushback: 1.0, hitstun: 22, blockstun: 0, animation: 'reversal',
    animationAliases: ['reversal', 'Reversal', 'counter', 'Counter', 'parry_counter', 'ParryCounter'],
    minRange: 0.1, maxRange: 1.5, priority: 30, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'guard+LP',
    description: 'Parry and counter. Invincible on startup.',
    invincibleFrames: [{ start: 1, end: 3 }],
    hitbox: { offsetX: 0.7, offsetZ: 0, width: 0.9, depth: 0.6, damage: 18, hitstun: 22, blockstun: 0, pushback: 1.0, launch: 0 }
  },
  armorBreaker: {
    id: 'bf_armor_breaker', displayName: 'Armor Breaker', category: 'counter',
    startup: 8, active: 3, recovery: 22, damage: 24, hitAdvantage: 2, blockAdvantage: -4,
    pushback: 1.1, hitstun: 24, blockstun: 12, animation: 'armorBreaker',
    animationAliases: ['armorBreaker', 'armor_breaker', 'ArmorBreaker', 'power_break', 'PowerBreak', 'guard_break'],
    minRange: 0.2, maxRange: 1.8, priority: 24, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'LP+RP',
    description: 'Breaks through armored attacks.',
    armorFrames: [{ start: 3, end: 8 }],
    hitbox: { offsetX: 0.8, offsetZ: 0, width: 1.0, depth: 0.65, damage: 24, hitstun: 24, blockstun: 12, pushback: 1.1, launch: 0.2 }
  },
  marsCounter: {
    id: 'bf_mars_counter', displayName: 'Mars Counter', category: 'counter',
    startup: 2, active: 3, recovery: 18, damage: 20, hitAdvantage: 5, blockAdvantage: 0,
    pushback: 1.0, hitstun: 24, blockstun: 0, animation: 'marsCounter',
    animationAliases: ['marsCounter', 'mars_counter', 'MarsCounter', 'gemini_counter', 'atlas_counter', 'AtlasCounter'],
    minRange: 0.1, maxRange: 1.6, priority: 32, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'guard+RP',
    description: "Atlas's Mars in Gemini counter-offense. Invincible frames.",
    invincibleFrames: [{ start: 1, end: 4 }],
    hitbox: { offsetX: 0.75, offsetZ: 0, width: 0.95, depth: 0.6, damage: 20, hitstun: 24, blockstun: 0, pushback: 1.0, launch: 0 }
  },
};

// ─── GRAPPLES ─────────────────────────────────────────────────────────────────

export const GRAPPLE_MOVES: Record<string, BrutalFistMove> = {
  clinch: {
    id: 'bf_clinch', displayName: 'Clinch', category: 'grapple',
    startup: 6, active: 4, recovery: 14, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'clinch',
    animationAliases: ['clinch', 'Clinch', 'grab', 'Grab', 'grapple', 'Grapple', 'tie_up'],
    minRange: 0.1, maxRange: 0.9, priority: 20, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'grapple',
    description: 'Initiates grapple state.',
    hitbox: { offsetX: 0.5, offsetZ: 0, width: 0.8, depth: 0.6, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
  cobraClutch: {
    id: 'bf_cobra_clutch', displayName: 'Cobra Clutch', category: 'grapple',
    startup: 8, active: 3, recovery: 20, damage: 15, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 30, blockstun: 0, animation: 'cobraClutch',
    animationAliases: ['cobraClutch', 'cobra_clutch', 'CobraClutch', 'iron_grip', 'IronGrip', 'neck_crank'],
    minRange: 0.1, maxRange: 0.8, priority: 22, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'grapple+LP',
    description: "Masato's Iron Grip. Cobra Clutch submission.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.7, depth: 0.6, damage: 15, hitstun: 30, blockstun: 0, pushback: 0, launch: 0 }
  },
  fullNelson: {
    id: 'bf_full_nelson', displayName: 'Full Nelson', category: 'grapple',
    startup: 10, active: 3, recovery: 22, damage: 18, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 35, blockstun: 0, animation: 'fullNelson',
    animationAliases: ['fullNelson', 'full_nelson', 'FullNelson', 'bridging_full_nelson', 'perfect_form', 'PerfectForm'],
    minRange: 0.1, maxRange: 0.8, priority: 24, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'grapple+RP',
    description: "Kenji's Perfect Form. Bridging full nelson.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.7, depth: 0.6, damage: 18, hitstun: 35, blockstun: 0, pushback: 0, launch: 0 }
  },
};

// ─── THROWS ───────────────────────────────────────────────────────────────────

export const THROW_MOVES: Record<string, BrutalFistMove> = {
  bodySlam: {
    id: 'bf_body_slam', displayName: 'Body Slam', category: 'throw',
    startup: 12, active: 2, recovery: 28, damage: 32, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 40, blockstun: 0, animation: 'bodySlam',
    animationAliases: ['bodySlam', 'body_slam', 'BodySlam', 'slam', 'Slam', 'power_slam', 'PowerSlam'],
    minRange: 0.1, maxRange: 0.9, priority: 26, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'grapple+LK',
    description: 'Classic wrestling body slam.',
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 32, hitstun: 40, blockstun: 0, pushback: 0, launch: 0 }
  },
  suplex: {
    id: 'bf_suplex', displayName: 'Suplex', category: 'throw',
    startup: 14, active: 2, recovery: 32, damage: 38, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 44, blockstun: 0, animation: 'suplex',
    animationAliases: ['suplex', 'Suplex', 'vertical_suplex', 'VerticalSuplex', 'saito_suplex', 'SaitoSuplex'],
    minRange: 0.1, maxRange: 0.9, priority: 28, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'grapple+RK',
    description: "Kenji's Saito Suplex. Massive vertical suplex.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 38, hitstun: 44, blockstun: 0, pushback: 0, launch: 0 }
  },
  powerbomb: {
    id: 'bf_powerbomb', displayName: 'Powerbomb', category: 'throw',
    startup: 16, active: 2, recovery: 36, damage: 45, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 50, blockstun: 0, animation: 'powerbomb',
    animationAliases: ['powerbomb', 'Powerbomb', 'power_bomb', 'PowerBomb', 'tatsu_bomb', 'TatsuBomb', 'unity_bomb'],
    minRange: 0.1, maxRange: 0.9, priority: 32, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'grapple+LP+RP',
    description: "Tatsu Bomb / Unity Bomb. Sit-out powerbomb.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 45, hitstun: 50, blockstun: 0, pushback: 0, launch: 0 }
  },
  deathValleyDriver: {
    id: 'bf_dvd', displayName: 'Death Valley Driver', category: 'throw',
    startup: 18, active: 2, recovery: 40, damage: 50, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 55, blockstun: 0, animation: 'deathValleyDriver',
    animationAliases: ['deathValleyDriver', 'death_valley_driver', 'DeathValleyDriver', 'dvd', 'DVD', 'tatsu_dvd'],
    minRange: 0.1, maxRange: 0.9, priority: 34, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'grapple+LP+LK',
    description: "Tatsu's Death Valley Driver. High-impact throw.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 50, hitstun: 55, blockstun: 0, pushback: 0, launch: 0 }
  },
  exploder: {
    id: 'bf_exploder', displayName: 'Optimization Drive', category: 'throw',
    startup: 14, active: 2, recovery: 34, damage: 42, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 48, blockstun: 0, animation: 'exploder',
    animationAliases: ['exploder', 'Exploder', 'exploder_suplex', 'ExploderSuplex', 'optimization_drive', 'OptimizationDrive', 'wrist_clutch_exploder'],
    minRange: 0.1, maxRange: 0.9, priority: 30, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'grapple+RP+RK',
    description: "Stick-Up's Optimization Drive. Wrist-clutch exploder suplex.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 42, hitstun: 48, blockstun: 0, pushback: 0, launch: 0 }
  },
  brainbuster: {
    id: 'bf_brainbuster', displayName: 'Brainbuster', category: 'throw',
    startup: 20, active: 2, recovery: 42, damage: 55, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 58, blockstun: 0, animation: 'brainbuster',
    animationAliases: ['brainbuster', 'Brainbuster', 'delayed_brainbuster', 'DelayedBrainbuster', 'braveheart_bomb', 'BraveheartBomb', 'frostbite_driver'],
    minRange: 0.1, maxRange: 0.9, priority: 36, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'grapple+LP+RP+LK',
    description: "Celtic Fury / Great White North signature. Delayed brainbuster.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 55, hitstun: 58, blockstun: 0, pushback: 0, launch: 0 }
  },
  runningPowerbomb: {
    id: 'bf_running_powerbomb', displayName: 'Unity Bomb', category: 'throw',
    startup: 22, active: 2, recovery: 44, damage: 58, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 60, blockstun: 0, animation: 'runningPowerbomb',
    animationAliases: ['runningPowerbomb', 'running_powerbomb', 'RunningPowerbomb', 'unity_bomb', 'UnityBomb', 'lion_bomb'],
    minRange: 0.1, maxRange: 0.9, priority: 38, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'run+grapple',
    description: "Lion of Punjab's Unity Bomb. Running powerbomb.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 58, hitstun: 60, blockstun: 0, pushback: 0, launch: 0 }
  },
};

// ─── KNOCKDOWNS ───────────────────────────────────────────────────────────────

export const KNOCKDOWN_MOVES: Record<string, BrutalFistMove> = {
  knockdown: {
    id: 'bf_knockdown', displayName: 'Knockdown', category: 'knockdown',
    startup: 0, active: 0, recovery: 0, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'knockdown',
    animationAliases: ['knockdown', 'Knockdown', 'fall', 'Fall', 'down', 'Down', 'floored', 'grounded'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: false,
    description: 'Character knocked to the ground.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
  hardKnockdown: {
    id: 'bf_hard_knockdown', displayName: 'Hard Knockdown', category: 'knockdown',
    startup: 0, active: 0, recovery: 0, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'hardKnockdown',
    animationAliases: ['hardKnockdown', 'hard_knockdown', 'HardKnockdown', 'bounce', 'Bounce', 'slam_down'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: false,
    description: 'Hard knockdown — no immediate wakeup.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
};

// ─── WAKEUPS ──────────────────────────────────────────────────────────────────

export const WAKEUP_MOVES: Record<string, BrutalFistMove> = {
  wakeup: {
    id: 'bf_wakeup', displayName: 'Wakeup', category: 'wakeup',
    startup: 0, active: 0, recovery: 20, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'wake',
    animationAliases: ['wake', 'Wake', 'wakeup', 'Wakeup', 'wake_up', 'WakeUp', 'getup', 'GetUp', 'rise'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: false,
    description: 'Standard wakeup from knockdown.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
  wakeupKick: {
    id: 'bf_wakeup_kick', displayName: 'Wakeup Kick', category: 'wakeup',
    startup: 8, active: 4, recovery: 24, damage: 20, hitAdvantage: 0, blockAdvantage: -8,
    pushback: 1.0, hitstun: 22, blockstun: 12, animation: 'wakeupKick',
    animationAliases: ['wakeupKick', 'wakeup_kick', 'WakeupKick', 'rising_kick', 'RisingKick', 'getup_kick'],
    minRange: 0.2, maxRange: 2.2, priority: 20, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'RK (while down)',
    description: 'Rising kick from the ground.',
    hitbox: { offsetX: 1.0, offsetZ: 0, width: 1.2, depth: 0.6, damage: 20, hitstun: 22, blockstun: 12, pushback: 1.0, launch: 0 }
  },
};

// ─── REACTIONS ────────────────────────────────────────────────────────────────

export const REACTION_MOVES: Record<string, BrutalFistMove> = {
  hitReaction: {
    id: 'bf_hit_reaction', displayName: 'Hit Reaction', category: 'reaction',
    startup: 0, active: 0, recovery: 0, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'hit',
    animationAliases: ['hit', 'Hit', 'hit_reaction', 'HitReaction', 'stagger', 'Stagger', 'flinch', 'Flinch'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: false,
    description: 'Standard hit reaction animation.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
  heavyHitReaction: {
    id: 'bf_heavy_hit_reaction', displayName: 'Heavy Hit Reaction', category: 'reaction',
    startup: 0, active: 0, recovery: 0, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'heavyHit',
    animationAliases: ['heavyHit', 'heavy_hit', 'HeavyHit', 'launch_reaction', 'LaunchReaction', 'crumple', 'Crumple'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: false,
    description: 'Heavy hit / launch reaction.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
};

// ─── KO ANIMATIONS ───────────────────────────────────────────────────────────

export const KO_MOVES: Record<string, BrutalFistMove> = {
  ko: {
    id: 'bf_ko', displayName: 'KO', category: 'ko',
    startup: 0, active: 0, recovery: 0, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'ko',
    animationAliases: ['ko', 'KO', 'knockout', 'Knockout', 'defeat', 'Defeat', 'down_for_count'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: false,
    description: 'KO / defeat animation.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
  victory: {
    id: 'bf_victory', displayName: 'Victory Pose', category: 'ko',
    startup: 0, active: 0, recovery: 0, damage: 0, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 0, blockstun: 0, animation: 'victory',
    animationAliases: ['victory', 'Victory', 'win', 'Win', 'celebrate', 'Celebrate', 'taunt_win'],
    minRange: 0, maxRange: 0, priority: 0, low: false, mid: false, overhead: false, throw: false, canCancel: false,
    description: 'Victory / win animation.',
    hitbox: { offsetX: 0, offsetZ: 0, width: 0, depth: 0, damage: 0, hitstun: 0, blockstun: 0, pushback: 0, launch: 0 }
  },
};

// ─── SIGNATURE FINISHERS ─────────────────────────────────────────────────────

export const SIGNATURE_MOVES: Record<string, BrutalFistMove> = {
  // Bannon
  beastMode: {
    id: 'bf_beast_mode', displayName: 'Beast Mode', category: 'signature',
    startup: 20, active: 4, recovery: 48, damage: 80, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 70, blockstun: 0, animation: 'beastMode',
    animationAliases: ['beastMode', 'beast_mode', 'BeastMode', 'bannon_finisher', 'BannonFinisher'],
    minRange: 0.1, maxRange: 0.9, priority: 50, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'LP+RP+LK+RK',
    description: "Bannon's signature. Explosive grapple finisher.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 80, hitstun: 70, blockstun: 0, pushback: 0, launch: 0 }
  },
  // Cain Elias — Final Verdict (Tombstone Piledriver)
  finalVerdict: {
    id: 'bf_final_verdict', displayName: 'Final Verdict', category: 'signature',
    startup: 22, active: 2, recovery: 50, damage: 85, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 72, blockstun: 0, animation: 'finalVerdict',
    animationAliases: ['finalVerdict', 'final_verdict', 'FinalVerdict', 'tombstone', 'Tombstone', 'piledriver', 'cain_finisher'],
    minRange: 0.1, maxRange: 0.9, priority: 52, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'LP+RP+LK+RK (Cain)',
    description: "Cain Elias's Final Verdict. Tombstone piledriver.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 85, hitstun: 72, blockstun: 0, pushback: 0, launch: 0 }
  },
  // Stick-Up — Leap of Faith
  leapOfFaith: {
    id: 'bf_leap_of_faith', displayName: 'Leap of Faith', category: 'signature',
    startup: 24, active: 3, recovery: 52, damage: 75, hitAdvantage: 0, blockAdvantage: -14,
    pushback: 1.8, hitstun: 65, blockstun: 22, animation: 'leapOfFaith',
    animationAliases: ['leapOfFaith', 'leap_of_faith', 'LeapOfFaith', 'swanton_bomb', 'SwantonBomb', 'stickup_finisher'],
    minRange: 0.2, maxRange: 3.0, priority: 48, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'LP+RP+RK (Stick-Up)',
    description: "Stick-Up's Leap of Faith. Theatrical swanton bomb with Messiah pose.",
    hitbox: { offsetX: 0.5, offsetZ: 0, width: 1.0, depth: 0.8, damage: 75, hitstun: 65, blockstun: 22, pushback: 1.8, launch: 0 }
  },
  // Cipher — signature
  cipherStrike: {
    id: 'bf_cipher_strike', displayName: 'Cipher Protocol', category: 'signature',
    startup: 18, active: 3, recovery: 44, damage: 72, hitAdvantage: 0, blockAdvantage: -12,
    pushback: 1.6, hitstun: 62, blockstun: 20, animation: 'cipherStrike',
    animationAliases: ['cipherStrike', 'cipher_strike', 'CipherStrike', 'cipher_finisher', 'CipherFinisher'],
    minRange: 0.2, maxRange: 2.8, priority: 46, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'LP+RP+RK (Cipher)',
    description: "Cipher's signature. Rapid multi-hit strike sequence.",
    hitbox: { offsetX: 0.8, offsetZ: 0, width: 1.0, depth: 0.65, damage: 72, hitstun: 62, blockstun: 20, pushback: 1.6, launch: 0.4 }
  },
  // Echo — signature
  echoSlam: {
    id: 'bf_echo_slam', displayName: 'Echo Slam', category: 'signature',
    startup: 20, active: 2, recovery: 46, damage: 78, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 68, blockstun: 0, animation: 'echoSlam',
    animationAliases: ['echoSlam', 'echo_slam', 'EchoSlam', 'echo_finisher', 'EchoFinisher'],
    minRange: 0.1, maxRange: 0.9, priority: 48, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'LP+RP+LK+RK (Echo)',
    description: "Echo's signature. Reverberating slam.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 78, hitstun: 68, blockstun: 0, pushback: 0, launch: 0 }
  },
  // Onyx — signature
  onyxCrush: {
    id: 'bf_onyx_crush', displayName: 'Onyx Crush', category: 'signature',
    startup: 22, active: 2, recovery: 48, damage: 82, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 70, blockstun: 0, animation: 'onyxCrush',
    animationAliases: ['onyxCrush', 'onyx_crush', 'OnyxCrush', 'onyx_finisher', 'OnyxFinisher'],
    minRange: 0.1, maxRange: 0.9, priority: 50, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'LP+RP+LK+RK (Onyx)',
    description: "Onyx's signature. Crushing power slam.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 82, hitstun: 70, blockstun: 0, pushback: 0, launch: 0 }
  },
  // Hall Nighter — signature
  hallNighterDriver: {
    id: 'bf_hall_nighter_driver', displayName: 'Hall Night Driver', category: 'signature',
    startup: 24, active: 2, recovery: 50, damage: 84, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 72, blockstun: 0, animation: 'hallNighterDriver',
    animationAliases: ['hallNighterDriver', 'hall_nighter_driver', 'HallNighterDriver', 'hall_nighter_finisher'],
    minRange: 0.1, maxRange: 0.9, priority: 52, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'LP+RP+LK+RK (Hall Nighter)',
    description: "Hall Nighter's signature. Late-night driver.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 84, hitstun: 72, blockstun: 0, pushback: 0, launch: 0 }
  },
  // Static — signature
  staticShock: {
    id: 'bf_static_shock', displayName: 'Static Shock', category: 'signature',
    startup: 16, active: 4, recovery: 42, damage: 70, hitAdvantage: 0, blockAdvantage: -12,
    pushback: 1.8, hitstun: 60, blockstun: 20, animation: 'staticShock',
    animationAliases: ['staticShock', 'static_shock', 'StaticShock', 'static_finisher', 'StaticFinisher'],
    minRange: 0.2, maxRange: 2.8, priority: 46, low: false, mid: true, overhead: false, throw: false, canCancel: false,
    inputSequence: 'LP+RP+RK (Static)',
    description: "Static's signature. Electric rush combo finisher.",
    hitbox: { offsetX: 0.8, offsetZ: 0, width: 1.0, depth: 0.65, damage: 70, hitstun: 60, blockstun: 20, pushback: 1.8, launch: 0.3 }
  },
  // Maime — signature
  maimeDriver: {
    id: 'bf_maime_driver', displayName: 'Maime Driver', category: 'signature',
    startup: 20, active: 2, recovery: 46, damage: 76, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 66, blockstun: 0, animation: 'maimeDriver',
    animationAliases: ['maimeDriver', 'maime_driver', 'MaimeDriver', 'maime_finisher', 'MaimeFinisher'],
    minRange: 0.1, maxRange: 0.9, priority: 48, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'LP+RP+LK+RK (Maime)',
    description: "Maime's signature. Precision driver.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 76, hitstun: 66, blockstun: 0, pushback: 0, launch: 0 }
  },
  // Cody — signature
  codyBuster: {
    id: 'bf_cody_buster', displayName: 'Cody Buster', category: 'signature',
    startup: 18, active: 2, recovery: 44, damage: 74, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 64, blockstun: 0, animation: 'codyBuster',
    animationAliases: ['codyBuster', 'cody_buster', 'CodyBuster', 'cody_finisher', 'CodyFinisher'],
    minRange: 0.1, maxRange: 0.9, priority: 46, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'LP+RP+LK+RK (Cody)',
    description: "Cody's signature. Sober-style buster.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 74, hitstun: 64, blockstun: 0, pushback: 0, launch: 0 }
  },
  // Finxsse — Chainsnatcher (signature extra) + Getbackk (finisher)
  chainsnatcher: {
    id: 'bf_chainsnatcher', displayName: 'Chainsnatcher', category: 'signature',
    startup: 14, active: 3, recovery: 28, damage: 42, hitAdvantage: 6, blockAdvantage: -8,
    pushback: 0.6, hitstun: 36, blockstun: 14, animation: 'chainsnatcher',
    animationAliases: ['chainsnatcher', 'chain_snatcher', 'backstabber', 'Backstabber', 'finxsse_sig'],
    minRange: 0.2, maxRange: 1.6, priority: 36, low: false, mid: true, overhead: false, throw: false, canCancel: true,
    inputSequence: 'RP+RK (Finxsse)',
    description: "Finxsse's Chainsnatcher. Jumping double-knee to the back — a backstabber.",
    hitbox: { offsetX: 0.5, offsetZ: 0, width: 0.7, depth: 0.6, damage: 42, hitstun: 36, blockstun: 14, pushback: 0.6, launch: 0 }
  },
  getbackk: {
    id: 'bf_getbackk', displayName: 'Getbackk', category: 'signature',
    startup: 20, active: 3, recovery: 48, damage: 82, hitAdvantage: 0, blockAdvantage: 0,
    pushback: 0, hitstun: 70, blockstun: 0, animation: 'getbackk',
    animationAliases: ['getbackk', 'get_backk', 'Getbackk', 'finxsse_finisher', 'f5_mod'],
    minRange: 0.1, maxRange: 0.9, priority: 50, low: false, mid: false, overhead: false, throw: true, canCancel: false,
    inputSequence: 'LP+RP+LK+RK (Finxsse)',
    description: "Finxsse's Getbackk. Fireman-carry tornado slam — a violent modified F-5.",
    hitbox: { offsetX: 0.4, offsetZ: 0, width: 0.8, depth: 0.7, damage: 82, hitstun: 70, blockstun: 0, pushback: 0, launch: 0.2 }
  },
  // Tarzanian Devil
  hurricanrana: {
    id: 'bf_hurricanrana', displayName: 'Hurricanrana', category: 'throw',
    startup: 12, active: 3, recovery: 26, damage: 38, hitAdvantage: 4, blockAdvantage: -6,
    pushback: 0.8, hitstun: 32, blockstun: 12, animation: 'hurricanrana',
    animationAliases: ['hurricanrana', 'hurricane_rana', 'Hurricanrana', 'rana'],
    minRange: 0.1, maxRange: 1.2, priority: 32, low: false, mid: false, overhead: false, throw: true, canCancel: true,
    inputSequence: 'LP+LK (Tarzanian)',
    description: "Tarzanian Devil's hurricanrana. Lucha headscissors takeover.",
    hitbox: { offsetX: 0.35, offsetZ: 0, width: 0.7, depth: 0.6, damage: 38, hitstun: 32, blockstun: 12, pushback: 0.8, launch: 0 }
  },
  jungleBomb: {
    id: 'bf_jungle_bomb', displayName: 'Jungle Bomb', category: 'signature',
    startup: 22, active: 3, recovery: 50, damage: 78, hitAdvantage: 0, blockAdvantage: -14,
    pushback: 1.6, hitstun: 66, blockstun: 20, animation: 'jungleBomb',
    animationAliases: ['jungleBomb', 'jungle_bomb', 'JungleBomb', 'tarzanian_finisher', 'senton'],
    minRange: 0.2, maxRange: 2.8, priority: 48, low: false, mid: true, overhead: true, throw: false, canCancel: false,
    inputSequence: 'LP+RP+RK (Tarzanian)',
    description: "Tarzanian Devil's Jungle Bomb. Flying senton, wildman pin.",
    hitbox: { offsetX: 0.5, offsetZ: 0, width: 1.0, depth: 0.8, damage: 78, hitstun: 66, blockstun: 20, pushback: 1.6, launch: 0 }
  },
};

// ─── MASTER CATALOG ───────────────────────────────────────────────────────────

export const BRUTAL_FIST_FULL_CATALOG: Record<string, BrutalFistMove> = {
  ...LOCOMOTION_MOVES,
  ...STRIKE_MOVES,
  ...KICK_MOVES,
  ...COMBO_MOVES,
  ...COUNTER_MOVES,
  ...GRAPPLE_MOVES,
  ...THROW_MOVES,
  ...KNOCKDOWN_MOVES,
  ...WAKEUP_MOVES,
  ...REACTION_MOVES,
  ...KO_MOVES,
  ...SIGNATURE_MOVES,
};

export function getMoveById(id: string): BrutalFistMove | null {
  return BRUTAL_FIST_FULL_CATALOG[id] ?? null;
}

export function getMovesByCategory(category: MoveCategory): BrutalFistMove[] {
  return Object.values(BRUTAL_FIST_FULL_CATALOG).filter(m => m.category === category);
}

export function getAllMoveIds(): string[] {
  return Object.keys(BRUTAL_FIST_FULL_CATALOG);
}
