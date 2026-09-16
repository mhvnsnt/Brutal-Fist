/**
 * DirectionalThrowSystem — Tekken-style directional grab mechanics
 *
 * Throw types:
 *  - Forward throw (1+3 / LP+LK): standard forward slam
 *  - Backward throw (2+4 / RP+RK): over-the-shoulder toss
 *  - Side throw (f+1+3 or f+2+4): side slam
 *
 * Throw break windows:
 *  - Throws have a THROW_BREAK_WINDOW_FRAMES window to escape
 *  - Breaking a throw requires pressing the matching button (1 breaks 1+3, 2 breaks 2+4)
 *  - Side throws can be broken with either 1 or 2
 *
 * Throw-whiff recovery:
 *  - If a throw attempt misses (out of range), the attacker enters THROW_WHIFF_RECOVERY_FRAMES
 *  - During whiff recovery, the attacker is fully vulnerable
 *
 * Bone-parented animation:
 *  - Throw animations are decoupled from normal attack hitboxes
 *  - Throw hit detection uses grab range check, not hitbox overlap
 *  - Once throw connects, the animation drives both fighters' positions
 *  - Throw-on-hit logic is separate from normal attack damage pipeline
 */

// ── Throw constants ───────────────────────────────────────────────────────────
export const THROW_BREAK_WINDOW_FRAMES = 12;    // frames to input throw break
export const THROW_WHIFF_RECOVERY_FRAMES = 38;  // recovery frames on missed throw
export const THROW_GRAB_RANGE = 1.2;            // max distance for throw to connect (world units)
export const THROW_FORWARD_DAMAGE = 180;        // forward throw damage
export const THROW_BACKWARD_DAMAGE = 200;       // backward throw damage (harder to break)
export const THROW_SIDE_DAMAGE = 190;           // side throw damage
export const THROW_STARTUP_FRAMES = 5;          // frames before throw grab window opens
export const THROW_ACTIVE_FRAMES = 6;           // frames the grab window is open

// ── Throw direction types ─────────────────────────────────────────────────────
export type ThrowDirection = 'forward' | 'backward' | 'side_left' | 'side_right';

// ── Throw break button ────────────────────────────────────────────────────────
export type ThrowBreakButton = '1' | '2' | 'either';

// ── Throw definition ──────────────────────────────────────────────────────────
export interface ThrowDefinition {
  id: string;
  name: string;
  direction: ThrowDirection;
  damage: number;
  startupFrames: number;
  activeFrames: number;
  /** Recovery frames for attacker after throw completes */
  attackerRecoveryFrames: number;
  /** Recovery frames for defender after being thrown */
  defenderRecoveryFrames: number;
  /** Which button breaks this throw */
  breakButton: ThrowBreakButton;
  /** Animation clip name for attacker */
  attackerAnimation: string;
  /** Animation clip name for defender */
  defenderAnimation: string;
  /** Whether this throw carries the opponent to the wall */
  wallCarry: boolean;
  /** Positional offset applied to defender after throw */
  defenderPositionOffset: { x: number; y: number; z: number };
}

export const THROW_CATALOG: Record<string, ThrowDefinition> = {
  forward_throw: {
    id: 'forward_throw',
    name: 'Forward Throw',
    direction: 'forward',
    damage: THROW_FORWARD_DAMAGE,
    startupFrames: THROW_STARTUP_FRAMES,
    activeFrames: THROW_ACTIVE_FRAMES,
    attackerRecoveryFrames: 28,
    defenderRecoveryFrames: 45,
    breakButton: '1',
    attackerAnimation: 'heavyAttack',
    defenderAnimation: 'knockdown',
    wallCarry: false,
    defenderPositionOffset: { x: 1.5, y: 0, z: 0 },
  },
  backward_throw: {
    id: 'backward_throw',
    name: 'Backward Throw',
    direction: 'backward',
    damage: THROW_BACKWARD_DAMAGE,
    startupFrames: THROW_STARTUP_FRAMES,
    activeFrames: THROW_ACTIVE_FRAMES,
    attackerRecoveryFrames: 32,
    defenderRecoveryFrames: 55,
    breakButton: '2',
    attackerAnimation: 'heavyAttack',
    defenderAnimation: 'knockdown',
    wallCarry: false,
    defenderPositionOffset: { x: -1.8, y: 0, z: 0 },
  },
  side_throw_left: {
    id: 'side_throw_left',
    name: 'Side Throw Left',
    direction: 'side_left',
    damage: THROW_SIDE_DAMAGE,
    startupFrames: THROW_STARTUP_FRAMES,
    activeFrames: THROW_ACTIVE_FRAMES,
    attackerRecoveryFrames: 30,
    defenderRecoveryFrames: 50,
    breakButton: 'either',
    attackerAnimation: 'heavyAttack',
    defenderAnimation: 'knockdown',
    wallCarry: true,
    defenderPositionOffset: { x: 0, y: 0, z: 1.5 },
  },
  side_throw_right: {
    id: 'side_throw_right',
    name: 'Side Throw Right',
    direction: 'side_right',
    damage: THROW_SIDE_DAMAGE,
    startupFrames: THROW_STARTUP_FRAMES,
    activeFrames: THROW_ACTIVE_FRAMES,
    attackerRecoveryFrames: 30,
    defenderRecoveryFrames: 50,
    breakButton: 'either',
    attackerAnimation: 'heavyAttack',
    defenderAnimation: 'knockdown',
    wallCarry: true,
    defenderPositionOffset: { x: 0, y: 0, z: -1.5 },
  },
};

// ── Throw state ───────────────────────────────────────────────────────────────
export interface ThrowState {
  /** Current phase of the throw */
  phase: 'none' | 'startup' | 'active' | 'connected' | 'whiff' | 'broken' | 'recovery';
  /** Which throw is being attempted */
  throwId: string | null;
  /** Throw definition */
  throwDef: ThrowDefinition | null;
  /** Frames remaining in current phase */
  framesRemaining: number;
  /** Whether the defender has a break opportunity */
  breakWindowOpen: boolean;
  /** Frames remaining in break window */
  breakWindowFrames: number;
  /** Whether the throw was successfully broken */
  broken: boolean;
  /** Whether the throw connected */
  connected: boolean;
  /** Whether the throw whiffed */
  whiffed: boolean;
}

export function createThrowState(): ThrowState {
  return {
    phase: 'none',
    throwId: null,
    throwDef: null,
    framesRemaining: 0,
    breakWindowOpen: false,
    breakWindowFrames: 0,
    broken: false,
    connected: false,
    whiffed: false,
  };
}

// ── Throw initiation ──────────────────────────────────────────────────────────
/**
 * Initiate a throw attempt.
 * @param throwId - ID from THROW_CATALOG
 */
export function initiateThrow(throwId: string): ThrowState {
  const throwDef = THROW_CATALOG[throwId];
  if (!throwDef) return createThrowState();
  return {
    phase: 'startup',
    throwId,
    throwDef,
    framesRemaining: throwDef.startupFrames,
    breakWindowOpen: false,
    breakWindowFrames: 0,
    broken: false,
    connected: false,
    whiffed: false,
  };
}

// ── Throw range check ─────────────────────────────────────────────────────────
/**
 * Check if a throw attempt is in range to connect.
 * Uses simple distance check — decoupled from normal hitbox system.
 */
export function checkThrowRange(
  attackerX: number,
  attackerZ: number,
  defenderX: number,
  defenderZ: number,
): boolean {
  const dx = defenderX - attackerX;
  const dz = defenderZ - attackerZ;
  const dist = Math.sqrt(dx * dx + dz * dz);
  return dist <= THROW_GRAB_RANGE;
}

// ── Throw connection ──────────────────────────────────────────────────────────
/**
 * Attempt to connect a throw. Returns updated state.
 * If in range: throw connects, break window opens.
 * If out of range: throw whiffs, attacker enters whiff recovery.
 */
export function resolveThrowAttempt(
  throwState: ThrowState,
  inRange: boolean,
  defenderIsBlocking: boolean,
): ThrowState {
  if (throwState.phase !== 'active') return throwState;

  if (!inRange) {
    // Throw whiffed — attacker enters whiff recovery
    return {
      ...throwState,
      phase: 'whiff',
      framesRemaining: THROW_WHIFF_RECOVERY_FRAMES,
      whiffed: true,
    };
  }

  // Throws bypass blocking — connect regardless
  return {
    ...throwState,
    phase: 'connected',
    framesRemaining: throwState.throwDef?.attackerRecoveryFrames ?? 30,
    breakWindowOpen: true,
    breakWindowFrames: THROW_BREAK_WINDOW_FRAMES,
    connected: true,
  };
}

// ── Throw break attempt ───────────────────────────────────────────────────────
/**
 * Attempt to break a throw.
 * @param pressedButton - '1', '2', or 'either'
 * Returns true if break was successful.
 */
export function attemptThrowBreak(
  throwState: ThrowState,
  pressedButton: '1' | '2',
): { success: boolean; newState: ThrowState } {
  if (!throwState.breakWindowOpen || !throwState.throwDef) {
    return { success: false, newState: throwState };
  }

  const breakButton = throwState.throwDef.breakButton;
  const canBreak =
    breakButton === 'either' ||
    breakButton === pressedButton;

  if (canBreak) {
    return {
      success: true,
      newState: {
        ...throwState,
        phase: 'broken',
        broken: true,
        breakWindowOpen: false,
        framesRemaining: 15, // brief recovery for both after break
      },
    };
  }

  return { success: false, newState: throwState };
}

// ── Throw tick ────────────────────────────────────────────────────────────────
/**
 * Tick throw state each frame.
 */
export function tickThrow(throwState: ThrowState): ThrowState {
  if (throwState.phase === 'none') return throwState;

  // Tick break window
  const newBreakFrames = Math.max(0, throwState.breakWindowFrames - 1);
  const breakWindowOpen = newBreakFrames > 0;

  const newFrames = Math.max(0, throwState.framesRemaining - 1);

  if (newFrames === 0) {
    // Phase transition
    switch (throwState.phase) {
      case 'startup':
        return {
          ...throwState,
          phase: 'active',
          framesRemaining: throwState.throwDef?.activeFrames ?? THROW_ACTIVE_FRAMES,
          breakWindowFrames: newBreakFrames,
          breakWindowOpen,
        };
      case 'active':
        // Missed the grab window — whiff
        return {
          ...throwState,
          phase: 'whiff',
          framesRemaining: THROW_WHIFF_RECOVERY_FRAMES,
          whiffed: true,
          breakWindowFrames: 0,
          breakWindowOpen: false,
        };
      case 'connected': case'whiff': case'broken': case'recovery':
        return createThrowState(); // reset to none
      default:
        return createThrowState();
    }
  }

  return {
    ...throwState,
    framesRemaining: newFrames,
    breakWindowFrames: newBreakFrames,
    breakWindowOpen,
  };
}

// ── Throw input detection ─────────────────────────────────────────────────────
export interface ThrowInputState {
  lp: boolean; // 1
  rp: boolean; // 2
  lk: boolean; // 3
  rk: boolean; // 4
  forward: boolean;
  backward: boolean;
}

/**
 * Detect which throw type to initiate based on input.
 * Returns throw ID or null if no throw input detected.
 */
export function detectThrowInput(input: ThrowInputState): string | null {
  const { lp, rp, lk, rk, forward, backward } = input;

  // Side throws: forward + 1+3 or forward + 2+4
  if (forward && lp && lk) return 'side_throw_right';
  if (forward && rp && rk) return 'side_throw_left';

  // Backward throw: 2+4 (RP+RK)
  if (rp && rk && !lp && !lk) return 'backward_throw';

  // Forward throw: 1+3 (LP+LK)
  if (lp && lk && !rp && !rk) return 'forward_throw';

  return null;
}

/**
 * Get the throw animation for a given throw ID and role.
 */
export function getThrowAnimation(throwId: string, role: 'attacker' | 'defender'): string {
  const throwDef = THROW_CATALOG[throwId];
  if (!throwDef) return role === 'attacker' ? 'heavyAttack' : 'knockdown';
  return role === 'attacker' ? throwDef.attackerAnimation : throwDef.defenderAnimation;
}

/**
 * Get the damage for a throw, accounting for whether it was broken.
 */
export function getThrowDamage(throwId: string, broken: boolean): number {
  if (broken) return 0;
  return THROW_CATALOG[throwId]?.damage ?? THROW_FORWARD_DAMAGE;
}
