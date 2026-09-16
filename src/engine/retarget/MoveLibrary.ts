/**
 * MoveLibrary — loads and normalizes animations from Schwarzerblitz/Tekken research GLBs.
 * Maps each clip to frame-data metadata for the move library.
 *
 * Clip naming conventions supported:
 *   Schwarzerblitz: SBW_lightAttack, SBW_heavyAttack, SBW_walk_fwd, etc.
 *   Tekken-style:   T_jab, T_cross, T_low_kick, etc.
 *   Bannon native:  bf_jab, bf_cross, bf_walk_fwd, etc.
 *   Generic:        lightAttack, heavyAttack, idle, walkForward, etc.
 */

import type { FighterMotionState } from '../retarget/AnimationController';

// ── Frame-data metadata per move ─────────────────────────────────────────────

export interface MoveFrameData {
  /** Canonical motion state key */
  motionState: FighterMotionState;
  /** Original clip name from the GLB */
  clipName: string;
  /** Source GLB identifier */
  source: 'schwarzerblitz' | 'tekken' | 'bannon' | 'generic';
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
}

// ── Clip name → motion state alias maps ──────────────────────────────────────

/** Schwarzerblitz clip name aliases */
const SBW_ALIASES: Record<string, FighterMotionState> = {
  'SBW_idle':           'idle',
  'SBW_walk_fwd':       'walkForward',
  'SBW_walk_back':      'walkBackward',
  'SBW_strafe_left':    'strafeLeft',
  'SBW_strafe_right':   'strafeRight',
  'SBW_crouch':         'crouch',
  'SBW_guard':          'guard',
  'SBW_lightAttack':    'lightAttack',
  'SBW_jab':            'lightAttack',
  'SBW_punch_light':    'lightAttack',
  'SBW_heavyAttack':    'heavyAttack',
  'SBW_cross':          'heavyAttack',
  'SBW_punch_heavy':    'heavyAttack',
  'SBW_hit':            'hit',
  'SBW_hit_reaction':   'hit',
  'SBW_knockdown':      'knockdown',
  'SBW_wakeup':         'wake',
};

/** Tekken-style clip name aliases */
const TEKKEN_ALIASES: Record<string, FighterMotionState> = {
  'T_idle':             'idle',
  'T_walk_fwd':         'walkForward',
  'T_walk_back':        'walkBackward',
  'T_crouch':           'crouch',
  'T_guard':            'guard',
  'T_jab':              'lightAttack',
  'T_1':                'lightAttack',
  'T_cross':            'heavyAttack',
  'T_2':                'heavyAttack',
  'T_low_kick':         'lightAttack',
  'T_3':                'lightAttack',
  'T_high_kick':        'heavyAttack',
  'T_4':                'heavyAttack',
  'T_hit':              'hit',
  'T_knockdown':        'knockdown',
  'T_wakeup':           'wake',
};

/** Bannon native clip name aliases */
const BANNON_ALIASES: Record<string, FighterMotionState> = {
  'bf_idle':            'idle',
  'bf_walk_fwd':        'walkForward',
  'bf_walk_back':       'walkBackward',
  'bf_crouch':          'crouch',
  'bf_guard':           'guard',
  'bf_jab':             'lightAttack',
  'bf_cross':           'heavyAttack',
  'bf_elbow':           'heavyAttack',
  'bf_chop':            'lightAttack',
  'bf_uppercut':        'heavyAttack',
  'bf_low_kick':        'lightAttack',
  'bf_mid_kick':        'heavyAttack',
  'bf_high_kick':       'heavyAttack',
  'bf_spinning_kick':   'heavyAttack',
  'bf_hit_reaction':    'hit',
  'bf_knockdown':       'knockdown',
  'bf_hard_knockdown':  'knockdown',
  'bf_wakeup':          'wake',
  'bf_wakeup_kick':     'wake',
};

/** Generic / fallback aliases */
const GENERIC_ALIASES: Record<string, FighterMotionState> = {
  'idle':               'idle',
  'walk':               'walkForward',
  'walkForward':        'walkForward',
  'walkBackward':       'walkBackward',
  'strafeLeft':         'strafeLeft',
  'strafeRight':        'strafeRight',
  'crouch':             'crouch',
  'guard':              'guard',
  'block':              'guard',
  'lightAttack':        'lightAttack',
  'light':              'lightAttack',
  'punch':              'lightAttack',
  'heavyAttack':        'heavyAttack',
  'heavy':              'heavyAttack',
  'kick':               'heavyAttack',
  'hit':                'hit',
  'hitstun':            'hit',
  'knockdown':          'knockdown',
  'down':               'knockdown',
  'wakeup':             'wake',
  'wake':               'wake',
  'getup':              'wake',
};

// ── Default frame-data per motion state ──────────────────────────────────────

const DEFAULT_FRAME_DATA: Record<FighterMotionState, Omit<MoveFrameData, 'motionState' | 'clipName' | 'source'>> = {
  idle:         { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 60, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 1.0 },
  walkForward:  { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 30, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.5 },
  walkBackward: { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 30, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.5 },
  strafeLeft:   { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 20, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.33 },
  strafeRight:  { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 20, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.33 },
  crouch:       { startupFrames: 0, activeFrames: 0, recoveryFrames: 0, totalFrames: 15, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.25 },
  guard:        { startupFrames: 3, activeFrames: 0, recoveryFrames: 5, totalFrames: 20, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.33 },
  lightAttack:  { startupFrames: 8, activeFrames: 6, recoveryFrames: 12, totalFrames: 26, hitboxStartFrame: 8, hitboxEndFrame: 14, damage: 80, isSpecial: false, durationSeconds: 0.43 },
  heavyAttack:  { startupFrames: 12, activeFrames: 8, recoveryFrames: 23, totalFrames: 43, hitboxStartFrame: 12, hitboxEndFrame: 20, damage: 150, isSpecial: false, durationSeconds: 0.72 },
  hit:          { startupFrames: 0, activeFrames: 0, recoveryFrames: 15, totalFrames: 15, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.25 },
  knockdown:    { startupFrames: 0, activeFrames: 0, recoveryFrames: 60, totalFrames: 60, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 1.0 },
  wake:         { startupFrames: 0, activeFrames: 0, recoveryFrames: 30, totalFrames: 30, hitboxStartFrame: 0, hitboxEndFrame: 0, damage: 0, isSpecial: false, durationSeconds: 0.5 },
};

// ── Clip name resolution ──────────────────────────────────────────────────────

export type ClipSource = 'schwarzerblitz' | 'tekken' | 'bannon' | 'generic';

export function resolveClipAlias(clipName: string): { motionState: FighterMotionState; source: ClipSource } | null {
  // Try each alias map in priority order
  if (SBW_ALIASES[clipName]) return { motionState: SBW_ALIASES[clipName], source: 'schwarzerblitz' };
  if (TEKKEN_ALIASES[clipName]) return { motionState: TEKKEN_ALIASES[clipName], source: 'tekken' };
  if (BANNON_ALIASES[clipName]) return { motionState: BANNON_ALIASES[clipName], source: 'bannon' };
  if (GENERIC_ALIASES[clipName]) return { motionState: GENERIC_ALIASES[clipName], source: 'generic' };

  // Fuzzy match: check if clip name contains a known keyword
  const lower = clipName.toLowerCase();
  if (lower.includes('idle')) return { motionState: 'idle', source: 'generic' };
  if (lower.includes('walk') && (lower.includes('fwd') || lower.includes('forward'))) return { motionState: 'walkForward', source: 'generic' };
  if (lower.includes('walk') && (lower.includes('back') || lower.includes('bwd'))) return { motionState: 'walkBackward', source: 'generic' };
  if (lower.includes('guard') || lower.includes('block')) return { motionState: 'guard', source: 'generic' };
  if (lower.includes('light') || lower.includes('jab') || lower.includes('punch')) return { motionState: 'lightAttack', source: 'generic' };
  if (lower.includes('heavy') || lower.includes('cross') || lower.includes('kick')) return { motionState: 'heavyAttack', source: 'generic' };
  if (lower.includes('hit') || lower.includes('stun')) return { motionState: 'hit', source: 'generic' };
  if (lower.includes('knock') || lower.includes('down') || lower.includes('fall')) return { motionState: 'knockdown', source: 'generic' };
  if (lower.includes('wake') || lower.includes('getup') || lower.includes('rise')) return { motionState: 'wake', source: 'generic' };

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

  return { entries, totalClips, loadedClips, errors: globalErrors };
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
