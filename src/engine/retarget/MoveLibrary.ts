/**
 * MoveLibrary — loads and normalizes animations from Schwarzerblitz/Tekken research GLBs.
 * Maps each clip to frame-data metadata for the move library.
 *
 * Clip naming conventions supported:
 *   Schwarzerblitz: SBW_lightAttack, SBW_heavyAttack, SBW_walk_fwd, etc.
 *   Tekken-style:   T_jab, T_cross, T_low_kick, T_1, T_2, T_3, T_4, etc.
 *   Bannon native:  bf_jab, bf_cross, bf_walk_fwd, etc.
 *   Mixamo:         Jab, Cross, Hook, Uppercut, Walking, etc.
 *   Generic:        lightAttack, heavyAttack, idle, walkForward, etc.
 *
 * Sources:
 *   - github.com/AndreaOrru/schwarzerblitz-engine (open-source, MIT-compatible)
 *   - github.com/mhvnsnt/BrutalfistbaseofTekken3Recompiled (owner permission)
 *   - github.com/mhvnsnt/Bannon (owner permission)
 *   - Mixamo standard animation names (free, Adobe)
 */

import type { FighterMotionState } from '../retarget/AnimationController';

// ── Frame-data metadata per move ─────────────────────────────────────────────

export interface MoveFrameData {
  /** Canonical motion state key */
  motionState: FighterMotionState;
  /** Original clip name from the GLB */
  clipName: string;
  /** Source GLB identifier */
  source: 'schwarzerblitz' | 'tekken' | 'bannon' | 'mixamo' | 'generic';
  /** Startup frames (before hitbox activates) */
  startupFrames: number;
  /** Active frames (hitbox live) */
  activeFrames: number;
  /** Recovery frames (after hitbox deactivates) */
  recoveryFrames: number;
  /** Total animation frames */
  totalFrames: number;
  /** Frame at which hitbox becomes active */
  hitboxStartFrame: number;
  /** Frame at which hitbox deactivates */
  hitboxEndFrame: number;
  /** Base damage value */
  damage: number;
  /** Whether this is a special move */
  isSpecial: boolean;
  /** Animation duration in seconds (at 60fps) */
  durationSeconds: number;
  /** Whether this move launches the opponent */
  launches?: boolean;
  /** Whether this move is a low attack */
  isLow?: boolean;
  /** Whether this move is an overhead */
  isOverhead?: boolean;
  /** Whether this move is a throw */
  isThrow?: boolean;
}

// ── Clip name → motion state alias maps ──────────────────────────────────────

/** Schwarzerblitz clip name aliases */
const SBW_ALIASES: Record<string, FighterMotionState> = {
  'SBW_idle':              'idle',
  'SBW_stance':            'idle',
  'SBW_neutral':           'idle',
  'SBW_walk_fwd':          'walkForward',
  'SBW_walk_forward':      'walkForward',
  'SBW_walk_back':         'walkBackward',
  'SBW_walk_bwd':          'walkBackward',
  'SBW_strafe_left':       'strafeLeft',
  'SBW_strafe_right':      'strafeRight',
  'SBW_sidestep_left':     'sidestepLeft',
  'SBW_sidestep_right':    'sidestepRight',
  'SBW_backdash':          'Backdashing',
  'SBW_crouch':            'crouch',
  'SBW_crouching':         'crouch',
  'SBW_guard':             'guard',
  'SBW_block':             'guard',
  'SBW_guard_low':         'guardLow',
  'SBW_lightAttack':       'lightAttack',
  'SBW_jab':               'lightAttack',
  'SBW_punch_light':       'lightAttack',
  'SBW_lp':                'lightAttack',
  'SBW_heavyAttack':       'heavyAttack',
  'SBW_cross':             'heavyAttack',
  'SBW_punch_heavy':       'heavyAttack',
  'SBW_kick':              'heavyAttack',
  'SBW_high_kick':         'heavyAttack',
  'SBW_low_kick':          'crouchLightAttack',
  'SBW_crouch_punch':      'crouchLightAttack',
  'SBW_crouch_kick':       'crouchHeavyAttack',
  'SBW_throw':             'CommandThrow',
  'SBW_grab':              'CommandThrow',
  'SBW_hit':               'hit',
  'SBW_hit_reaction':      'hit',
  'SBW_hit_low':           'hitLow',
  'SBW_hit_high':          'hitHigh',
  'SBW_knockdown':         'knockdown',
  'SBW_wakeup':            'wake',
  'SBW_techroll':          'WakeupTechRoll',
  'SBW_backrise':          'WakeupBackrise',
  'SBW_quickstand':        'WakeupQuickStand',
  'SBW_victory':           'victory',
  'SBW_defeat':            'defeat',
  'SBW_taunt':             'taunt',
};

/** Tekken-style clip name aliases (Tekken 3 Recompiled + Tekken 8 naming) */
const TEKKEN_ALIASES: Record<string, FighterMotionState> = {
  // Locomotion
  'T_idle':                'idle',
  'T_stance':              'idle',
  'T_walk_fwd':            'walkForward',
  'T_walk_back':           'walkBackward',
  'T_sidestep_left':       'sidestepLeft',
  'T_sidestep_right':      'sidestepRight',
  'T_ssl':                 'sidestepLeft',
  'T_ssr':                 'sidestepRight',
  'T_backdash':            'Backdashing',
  'T_crouch':              'crouch',
  'T_crouching':           'crouch',
  'T_guard':               'guard',
  'T_block':               'guard',
  // 4-limb attacks (Tekken button notation)
  'T_1':                   'lightAttack',   // Left Punch
  'T_jab':                 'lightAttack',
  'T_lp':                  'lightAttack',
  'T_2':                   'heavyAttack',   // Right Punch
  'T_cross':               'heavyAttack',
  'T_rp':                  'heavyAttack',
  'T_3':                   'heavyAttack',   // Left Kick
  'T_low_kick':            'crouchLightAttack',
  'T_lk':                  'heavyAttack',
  'T_4':                   'heavyAttack',   // Right Kick
  'T_high_kick':           'heavyAttack',
  'T_rk':                  'heavyAttack',
  // Combination attacks
  'T_1_2':                 'lightAttack',   // Jab-Cross
  'T_2_3':                 'heatBurst',     // Heat Burst
  'T_1_3':                 'CommandThrow',  // Left Throw
  'T_2_4':                 'CommandThrow',  // Right Throw
  'T_df_1_2':              'rageArt',       // Rage Art
  // Hit reactions
  'T_hit':                 'hit',
  'T_hitstun':             'hit',
  'T_hit_low':             'hitLow',
  'T_hit_high':            'hitHigh',
  'T_knockdown':           'knockdown',
  'T_wakeup':              'wake',
  'T_techroll':            'WakeupTechRoll',
  'T_backrise':            'WakeupBackrise',
  'T_quickstand':          'WakeupQuickStand',
  // Post-match
  'T_victory':             'victory',
  'T_defeat':              'defeat',
  'T_taunt':               'taunt',
  'T_intro':               'intro',
};

/** Bannon native clip name aliases */
const BANNON_ALIASES: Record<string, FighterMotionState> = {
  'bf_idle':               'idle',
  'bf_stance':             'idle',
  'bf_walk_fwd':           'walkForward',
  'bf_walk_back':          'walkBackward',
  'bf_strafe_left':        'strafeLeft',
  'bf_strafe_right':       'strafeRight',
  'bf_backdash':           'Backdashing',
  'bf_crouch':             'crouch',
  'bf_guard':              'guard',
  'bf_block':              'guard',
  'bf_jab':                'lightAttack',
  'bf_chop':               'lightAttack',
  'bf_cross':              'heavyAttack',
  'bf_elbow':              'heavyAttack',
  'bf_uppercut':           'heavyAttack',
  'bf_low_kick':           'crouchLightAttack',
  'bf_mid_kick':           'heavyAttack',
  'bf_high_kick':          'heavyAttack',
  'bf_spinning_kick':      'heavyAttack',
  'bf_grab':               'CommandThrow',
  'bf_throw':              'CommandThrow',
  'bf_beastMode':          'CommandThrow',
  'bf_hit_reaction':       'hit',
  'bf_knockdown':          'knockdown',
  'bf_hard_knockdown':     'knockdown',
  'bf_wakeup':             'wake',
  'bf_wakeup_kick':        'wake',
  'bf_victory':            'victory',
  'bf_taunt':              'taunt',
};

/** Mixamo standard animation names */
const MIXAMO_ALIASES: Record<string, FighterMotionState> = {
  // Locomotion
  'Idle':                  'idle',
  'Standing Idle':         'idle',
  'Combat Idle':           'idle',
  'Walking':               'walkForward',
  'Walking Forward':       'walkForward',
  'Walking Backward':      'walkBackward',
  'Strafe Left':           'strafeLeft',
  'Strafe Right':          'strafeRight',
  'Running':               'run',
  'Sprint':                'run',
  'Crouching':             'crouch',
  'Crouch Idle':           'crouch',
  'Blocking':              'guard',
  // Attacks
  'Jab':                   'lightAttack',
  'Punching':              'lightAttack',
  'Punching Left':         'lightAttack',
  'Punching Right':        'lightAttack',
  'Jab Punch':             'lightAttack',
  'Cross':                 'heavyAttack',
  'Hook':                  'heavyAttack',
  'Uppercut':              'heavyAttack',
  'Kicking':               'heavyAttack',
  'Kicking Left':          'heavyAttack',
  'Kicking Right':         'heavyAttack',
  'Kicking Forward':       'heavyAttack',
  'Roundhouse Kick':       'heavyAttack',
  'Spinning Kick':         'heavyAttack',
  'Jump Attack':           'jumpAttack',
  'Air Attack':            'jumpAttack',
  // Hit reactions
  'Getting Hit':           'hit',
  'Hit Impact':            'hit',
  'Falling Back':          'knockdown',
  'Falling Forward':       'knockdown',
  'Knocked Down':          'knockdown',
  'Getting Up':            'wake',
  'Get Up From Ground':    'wake',
  // Post-match
  'Victory':               'victory',
  'Victory Pose':          'victory',
  'Defeat':                'defeat',
  'Taunt':                 'taunt',
};

/** Generic / fallback aliases */
const GENERIC_ALIASES: Record<string, FighterMotionState> = {
  'idle':                  'idle',
  'walk':                  'walkForward',
  'walkForward':           'walkForward',
  'walkBackward':          'walkBackward',
  'strafeLeft':            'strafeLeft',
  'strafeRight':           'strafeRight',
  'sidestepLeft':          'sidestepLeft',
  'sidestepRight':         'sidestepRight',
  'crouch':                'crouch',
  'guard':                 'guard',
  'block':                 'guard',
  'lightAttack':           'lightAttack',
  'light':                 'lightAttack',
  'punch':                 'lightAttack',
  'jab':                   'lightAttack',
  'heavyAttack':           'heavyAttack',
  'heavy':                 'heavyAttack',
  'kick':                  'heavyAttack',
  'cross':                 'heavyAttack',
  'hook':                  'heavyAttack',
  'uppercut':              'heavyAttack',
  'crouchLightAttack':     'crouchLightAttack',
  'crouchHeavyAttack':     'crouchHeavyAttack',
  'jumpAttack':            'jumpAttack',
  'runAttack':             'runAttack',
  'commandThrow':          'CommandThrow',
  'grab':                  'CommandThrow',
  'throw':                 'CommandThrow',
  'hit':                   'hit',
  'hitstun':               'hit',
  'hitLow':                'hitLow',
  'hitHigh':               'hitHigh',
  'knockdown':             'knockdown',
  'down':                  'knockdown',
  'wakeup':                'wake',
  'wake':                  'wake',
  'getup':                 'wake',
  'techRoll':              'WakeupTechRoll',
  'backrise':              'WakeupBackrise',
  'quickStand':            'WakeupQuickStand',
  'backdash':              'Backdashing',
  'victory':               'victory',
  'win':                   'victory',
  'defeat':                'defeat',
  'lose':                  'defeat',
  'taunt':                 'taunt',
  'intro':                 'intro',
  'heatBurst':             'heatBurst',
  'rageArt':               'rageArt',
  'powerCrush':            'powerCrush',
};

// ── Default frame-data per motion state ──────────────────────────────────────

const DEFAULT_FRAME_DATA: Record<FighterMotionState, Omit<MoveFrameData, 'motionState' | 'clipName' | 'source'>> = {
  idle:               { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 60, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 1.0 },
  walkForward:        { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 30, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.5 },
  walkBackward:       { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 30, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.5 },
  strafeLeft:         { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 20, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.33 },
  strafeRight:        { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 20, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.33 },
  sidestepLeft:       { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 15, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.25 },
  sidestepRight:      { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 15, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.25 },
  crouch:             { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 15, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.25 },
  crouchWalk:         { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 20, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.33 },
  guard:              { startupFrames: 3, activeFrames: 0, recoveryFrames: 5, totalFrames: 20, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.33 },
  guardLow:           { startupFrames: 3, activeFrames: 0, recoveryFrames: 5, totalFrames: 20, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.33 },
  lightAttack:        { startupFrames: 8, activeFrames: 6, recoveryFrames: 12, totalFrames: 26, hitboxStartFrame: 8, hitboxEndFrame: 14, damage: 80, isSpecial: false, durationSeconds: 0.43 },
  heavyAttack:        { startupFrames: 12, activeFrames: 8, recoveryFrames: 23, totalFrames: 43, hitboxStartFrame: 12, hitboxEndFrame: 20, damage: 150, isSpecial: false, durationSeconds: 0.72 },
  crouchLightAttack:  { startupFrames: 6, activeFrames: 4, recoveryFrames: 10, totalFrames: 20, hitboxStartFrame: 6, hitboxEndFrame: 10, damage: 60, isSpecial: false, durationSeconds: 0.33, isLow: true },
  crouchHeavyAttack:  { startupFrames: 10, activeFrames: 6, recoveryFrames: 18, totalFrames: 34, hitboxStartFrame: 10, hitboxEndFrame: 16, damage: 120, isSpecial: false, durationSeconds: 0.57, isLow: true },
  jumpAttack:         { startupFrames: 10, activeFrames: 8, recoveryFrames: 15, totalFrames: 33, hitboxStartFrame: 10, hitboxEndFrame: 18, damage: 130, isSpecial: false, durationSeconds: 0.55 },
  runAttack:          { startupFrames: 8, activeFrames: 6, recoveryFrames: 20, totalFrames: 34, hitboxStartFrame: 8, hitboxEndFrame: 14, damage: 140, isSpecial: false, durationSeconds: 0.57 },
  hit:                { startupFrames: 0, activeFrames: 0, recoveryFrames: 15, totalFrames: 15, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.25 },
  hitLow:             { startupFrames: 0, activeFrames: 0, recoveryFrames: 12, totalFrames: 12, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.20 },
  hitHigh:            { startupFrames: 0, activeFrames: 0, recoveryFrames: 18, totalFrames: 18, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.30 },
  knockdown:          { startupFrames: 0, activeFrames: 0, recoveryFrames: 60, totalFrames: 60, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 1.0 },
  wake:               { startupFrames: 0, activeFrames: 0, recoveryFrames: 30, totalFrames: 30, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.5 },
  walk:               { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 30, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.5 },
  run:                { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 20, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.33 },
  dash:               { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 15, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.25 },
  dashForward:        { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 15, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.25 },
  Walking:            { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 30, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.5 },
  Backdashing:        { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 17, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.28 },
  Guard:              { startupFrames: 3, activeFrames: 0, recoveryFrames: 5, totalFrames: 20, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.33 },
  Knockdown:          { startupFrames: 0, activeFrames: 0, recoveryFrames: 60, totalFrames: 60, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 1.0 },
  WakeupTechRoll:     { startupFrames: 0, activeFrames: 0, recoveryFrames: 27, totalFrames: 27, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.45 },
  WakeupBackrise:     { startupFrames: 0, activeFrames: 0, recoveryFrames: 33, totalFrames: 33, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.55 },
  WakeupQuickStand:   { startupFrames: 0, activeFrames: 0, recoveryFrames: 18, totalFrames: 18, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.30 },
  HitStun:            { startupFrames: 0, activeFrames: 0, recoveryFrames: 15, totalFrames: 15, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.25 },
  Stunned:            { startupFrames: 0, activeFrames: 0, recoveryFrames: 20, totalFrames: 20, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.33 },
  Crumple:            { startupFrames: 0, activeFrames: 0, recoveryFrames: 60, totalFrames: 60, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 1.0 },
  CommandThrow:       { startupFrames: 6, activeFrames: 4, recoveryFrames: 33, totalFrames: 43, hitboxStartFrame: 6, hitboxEndFrame: 10, damage: 220, isSpecial: false, durationSeconds: 0.72, isThrow: true },
  ThrowWhiff:         { startupFrames: 0, activeFrames: 0, recoveryFrames: 30, totalFrames: 30, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.5 },
  Startup:            { startupFrames: 8, activeFrames: 6, recoveryFrames: 12, totalFrames: 26, hitboxStartFrame: 8, hitboxEndFrame: 14, damage: 80, isSpecial: false, durationSeconds: 0.43 },
  Active:             { startupFrames: 8, activeFrames: 6, recoveryFrames: 12, totalFrames: 26, hitboxStartFrame: 8, hitboxEndFrame: 14, damage: 80, isSpecial: false, durationSeconds: 0.43 },
  Blockstun:          { startupFrames: 0, activeFrames: 0, recoveryFrames: 10, totalFrames: 10, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.17 },
  Hitstun:            { startupFrames: 0, activeFrames: 0, recoveryFrames: 15, totalFrames: 15, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.25 },
  heatBurst:          { startupFrames: 9, activeFrames: 12, recoveryFrames: 24, totalFrames: 45, hitboxStartFrame: 9, hitboxEndFrame: 21, damage: 120, isSpecial: true, durationSeconds: 0.75 },
  rageArt:            { startupFrames: 15, activeFrames: 18, recoveryFrames: 36, totalFrames: 69, hitboxStartFrame: 15, hitboxEndFrame: 33, damage: 350, isSpecial: true, durationSeconds: 1.15 },
  powerCrush:         { startupFrames: 12, activeFrames: 10, recoveryFrames: 28, totalFrames: 50, hitboxStartFrame: 12, hitboxEndFrame: 22, damage: 180, isSpecial: true, durationSeconds: 0.83 },
  victory:            { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 120, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 2.0 },
  defeat:             { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 120, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 2.0 },
  taunt:              { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 90, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 1.5 },
  intro:              { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 90, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 1.5 },
};

// ── Clip name resolution ──────────────────────────────────────────────────────

export type ClipSource = 'schwarzerblitz' | 'tekken' | 'bannon' | 'mixamo' | 'generic';

export function resolveClipAlias(clipName: string): { motionState: FighterMotionState; source: ClipSource } | null {
  // Try each alias map in priority order
  if (SBW_ALIASES[clipName]) return { motionState: SBW_ALIASES[clipName], source: 'schwarzerblitz' };
  if (TEKKEN_ALIASES[clipName]) return { motionState: TEKKEN_ALIASES[clipName], source: 'tekken' };
  if (BANNON_ALIASES[clipName]) return { motionState: BANNON_ALIASES[clipName], source: 'bannon' };
  if (MIXAMO_ALIASES[clipName]) return { motionState: MIXAMO_ALIASES[clipName], source: 'mixamo' };
  if (GENERIC_ALIASES[clipName]) return { motionState: GENERIC_ALIASES[clipName], source: 'generic' };

  // Fuzzy match: check if clip name contains a known keyword
  const lower = clipName.toLowerCase();
  if (lower.includes('idle') || lower.includes('stance') || lower.includes('neutral')) return { motionState: 'idle', source: 'generic' };
  if (lower.includes('walk') && (lower.includes('fwd') || lower.includes('forward'))) return { motionState: 'walkForward', source: 'generic' };
  if (lower.includes('walk') && (lower.includes('back') || lower.includes('bwd'))) return { motionState: 'walkBackward', source: 'generic' };
  if (lower.includes('strafe') && lower.includes('left')) return { motionState: 'strafeLeft', source: 'generic' };
  if (lower.includes('strafe') && lower.includes('right')) return { motionState: 'strafeRight', source: 'generic' };
  if (lower.includes('sidestep') && lower.includes('left')) return { motionState: 'sidestepLeft', source: 'generic' };
  if (lower.includes('sidestep') && lower.includes('right')) return { motionState: 'sidestepRight', source: 'generic' };
  if (lower.includes('backdash') || lower.includes('backstep')) return { motionState: 'Backdashing', source: 'generic' };
  if (lower.includes('crouch') || lower.includes('duck')) return { motionState: 'crouch', source: 'generic' };
  if (lower.includes('guard') || lower.includes('block')) return { motionState: 'guard', source: 'generic' };
  if (lower.includes('crouch') && (lower.includes('punch') || lower.includes('jab'))) return { motionState: 'crouchLightAttack', source: 'generic' };
  if (lower.includes('crouch') && (lower.includes('kick'))) return { motionState: 'crouchHeavyAttack', source: 'generic' };
  if (lower.includes('jump') && lower.includes('attack')) return { motionState: 'jumpAttack', source: 'generic' };
  if (lower.includes('run') && lower.includes('attack')) return { motionState: 'runAttack', source: 'generic' };
  if (lower.includes('light') || lower.includes('jab') || lower.includes('punch')) return { motionState: 'lightAttack', source: 'generic' };
  if (lower.includes('heavy') || lower.includes('cross') || lower.includes('kick') || lower.includes('hook') || lower.includes('uppercut')) return { motionState: 'heavyAttack', source: 'generic' };
  if (lower.includes('heat') && lower.includes('burst')) return { motionState: 'heatBurst', source: 'generic' };
  if (lower.includes('rage') && lower.includes('art')) return { motionState: 'rageArt', source: 'generic' };
  if (lower.includes('power') && lower.includes('crush')) return { motionState: 'powerCrush', source: 'generic' };
  if (lower.includes('throw') || lower.includes('grab') || lower.includes('grapple')) return { motionState: 'CommandThrow', source: 'generic' };
  if (lower.includes('hit') || lower.includes('stun') || lower.includes('flinch')) return { motionState: 'hit', source: 'generic' };
  if (lower.includes('knock') || lower.includes('down') || lower.includes('fall')) return { motionState: 'knockdown', source: 'generic' };
  if (lower.includes('wake') || lower.includes('getup') || lower.includes('rise')) return { motionState: 'wake', source: 'generic' };
  if (lower.includes('techroll') || lower.includes('tech_roll')) return { motionState: 'WakeupTechRoll', source: 'generic' };
  if (lower.includes('backrise') || lower.includes('back_rise')) return { motionState: 'WakeupBackrise', source: 'generic' };
  if (lower.includes('quickstand') || lower.includes('quick_stand')) return { motionState: 'WakeupQuickStand', source: 'generic' };
  if (lower.includes('victory') || lower.includes('win')) return { motionState: 'victory', source: 'generic' };
  if (lower.includes('defeat') || lower.includes('lose')) return { motionState: 'defeat', source: 'generic' };
  if (lower.includes('taunt')) return { motionState: 'taunt', source: 'generic' };
  if (lower.includes('intro') || lower.includes('entrance')) return { motionState: 'intro', source: 'generic' };

  return null;
}

// ── Move library entry ────────────────────────────────────────────────────────

export interface MoveLibraryEntry {
  fighterId: string;
  frameData: MoveFrameData;
  /** Whether this clip was successfully loaded from a GLB */
  loaded: boolean;
  /** Any load/retarget errors */
  errors: string[];
}

export interface MoveLibrary {
  entries: Map<string, MoveLibraryEntry[]>; // keyed by fighterId
  totalClips: number;
  loadedClips: number;
  errors: string[];
}

/**
 * Build a move library entry from a clip name and fighter ID.
 * Normalizes the clip to a FighterMotionState and attaches frame-data metadata.
 */
export function buildMoveLibraryEntry(
  fighterId: string,
  clipName: string,
  loaded: boolean,
  errors: string[] = [],
): MoveLibraryEntry {
  const resolved = resolveClipAlias(clipName);
  const motionState: FighterMotionState = resolved?.motionState ?? 'idle';
  const source: ClipSource = resolved?.source ?? 'generic';
  const defaults = DEFAULT_FRAME_DATA[motionState];

  const frameData: MoveFrameData = {
    motionState,
    clipName,
    source,
    ...defaults,
  };

  return { fighterId, frameData, loaded, errors };
}

/**
 * Build a complete move library for all roster fighters.
 * Pass in the clip names discovered from each fighter's GLB.
 */
export function buildMoveLibrary(
  rosterClips: Array<{ fighterId: string; clipNames: string[]; loadErrors: string[] }>
): MoveLibrary {
  const entries = new Map<string, MoveLibraryEntry[]>();
  let totalClips = 0;
  let loadedClips = 0;
  const globalErrors: string[] = [];

  for (const { fighterId, clipNames, loadErrors } of rosterClips) {
    const fighterEntries: MoveLibraryEntry[] = [];

    for (const clipName of clipNames) {
      const entry = buildMoveLibraryEntry(fighterId, clipName, true);
      fighterEntries.push(entry);
      totalClips++;
      loadedClips++;
    }

    // Add error entries for failed loads
    for (const err of loadErrors) {
      globalErrors.push(`[${fighterId}] ${err}`);
    }

    entries.set(fighterId, fighterEntries);
  }

  return {
    entries,
    totalClips,
    loadedClips,
    errors: globalErrors,
  };
}

/**
 * Get all move library entries for a specific fighter.
 */
export function getFighterMoves(library: MoveLibrary, fighterId: string): MoveLibraryEntry[] {
  return library.entries.get(fighterId) ?? [];
}

/**
 * Get a specific move by motion state for a fighter.
 */
export function getFighterMoveByState(
  library: MoveLibrary,
  fighterId: string,
  motionState: FighterMotionState,
): MoveLibraryEntry | null {
  const moves = getFighterMoves(library, fighterId);
  return moves.find(m => m.frameData.motionState === motionState) ?? null;
}

// ── Roster clip manifest (normalized from Schwarzerblitz/Tekken/Bannon sources) ──

/** Standard clip set expected for every roster fighter */
export const STANDARD_CLIP_SET: string[] = [
  'bf_idle', 'bf_walk_fwd', 'bf_walk_back', 'bf_crouch', 'bf_guard',
  'bf_jab', 'bf_cross', 'bf_low_kick', 'bf_high_kick',
  'bf_hit_reaction', 'bf_knockdown', 'bf_wakeup', 'bf_ko',
];

/** Schwarzerblitz research clip set */
export const SBW_CLIP_SET: string[] = [
  'SBW_idle', 'SBW_walk_fwd', 'SBW_walk_back', 'SBW_crouch', 'SBW_guard',
  'SBW_jab', 'SBW_cross', 'SBW_hit_reaction', 'SBW_knockdown', 'SBW_wakeup',
];

/** Tekken research clip set */
export const TEKKEN_CLIP_SET: string[] = [
  'T_idle', 'T_walk_fwd', 'T_walk_back', 'T_crouch', 'T_guard',
  'T_jab', 'T_cross', 'T_low_kick', 'T_high_kick',
  'T_hit', 'T_knockdown', 'T_wakeup',
];
