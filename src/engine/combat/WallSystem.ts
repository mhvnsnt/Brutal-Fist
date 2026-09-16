/**
 * WallSystem — Stage boundary detection, wall-splat knockback, and combo extension frames
 *
 * Architecture (Night Sky Engine pattern):
 *  - Pure data / pure functions — no Three.js, no side effects
 *  - Wall collision is checked in the decoupled combat tick
 *  - Wall-splat gives attacker BONUS frames to chain a combo
 *  - If attacker does NOT chain within the bonus window, defender recovers normally
 *
 * Tekken wall mechanics:
 *  - Stage has left/right X boundaries (WALL_LEFT_X, WALL_RIGHT_X)
 *  - When a fighter is knocked into the wall, they "splat" — brief stagger
 *  - During wall-splat, attacker gets WALL_SPLAT_BONUS_FRAMES extra frames to continue combo
 *  - If attacker chains correctly (hits during bonus window), combo continues
 *  - If attacker misses the window, defender recovers with WALL_RECOVERY_FRAMES
 *  - Wall-hit knockback pushes the fighter slightly away from the wall
 */

// ── Stage boundary constants ──────────────────────────────────────────────────
export const WALL_LEFT_X = -4.5;   // left stage boundary
export const WALL_RIGHT_X = 4.5;   // right stage boundary
export const WALL_PUSH_DISTANCE = 0.15; // how far fighter bounces off wall
export const WALL_SPLAT_BONUS_FRAMES = 18; // extra frames attacker gets to chain combo
export const WALL_RECOVERY_FRAMES = 22;   // frames defender takes to recover from wall-splat
export const WALL_KNOCKBACK_VELOCITY = 0.08; // velocity applied away from wall on splat

// ── Wall-splat state ──────────────────────────────────────────────────────────
export interface WallSplatState {
  /** Whether this fighter is currently in wall-splat stagger */
  isSplatted: boolean;
  /** Which wall they hit */
  wall: 'left' | 'right' | null;
  /** Frames remaining in wall-splat stagger */
  splatFramesRemaining: number;
  /** Whether the attacker has bonus combo extension frames active */
  comboExtensionActive: boolean;
  /** Bonus combo extension frames remaining for the attacker */
  comboExtensionFrames: number;
  /** Whether the attacker successfully chained during the bonus window */
  chainedDuringWindow: boolean;
  /** Total wall splats this combo (for scaling) */
  splatCount: number;
}

export function createWallSplatState(): WallSplatState {
  return {
    isSplatted: false,
    wall: null,
    splatFramesRemaining: 0,
    comboExtensionActive: false,
    comboExtensionFrames: 0,
    chainedDuringWindow: false,
    splatCount: 0,
  };
}

// ── Wall collision result ─────────────────────────────────────────────────────
export interface WallCollisionResult {
  /** Whether a wall was hit this frame */
  hitWall: boolean;
  /** Which wall */
  wall: 'left' | 'right' | null;
  /** Clamped X position after collision */
  clampedX: number;
  /** Knockback velocity away from wall */
  knockbackVelocityX: number;
}

/**
 * Check if a fighter's X position has crossed a stage boundary.
 * Returns collision result with clamped position and knockback.
 */
export function checkWallCollision(x: number, velocityX: number): WallCollisionResult {
  if (x <= WALL_LEFT_X) {
    return {
      hitWall: true,
      wall: 'left',
      clampedX: WALL_LEFT_X + WALL_PUSH_DISTANCE,
      knockbackVelocityX: WALL_KNOCKBACK_VELOCITY, // push right (away from left wall)
    };
  }
  if (x >= WALL_RIGHT_X) {
    return {
      hitWall: true,
      wall: 'right',
      clampedX: WALL_RIGHT_X - WALL_PUSH_DISTANCE,
      knockbackVelocityX: -WALL_KNOCKBACK_VELOCITY, // push left (away from right wall)
    };
  }
  return { hitWall: false, wall: null, clampedX: x, knockbackVelocityX: velocityX };
}

/**
 * Apply wall-splat to a fighter.
 * Called when a fighter in hit-stun collides with a wall.
 * Returns updated WallSplatState for the defender and triggers combo extension for attacker.
 */
export function applyWallSplat(
  defenderSplat: WallSplatState,
  wall: 'left' | 'right',
): WallSplatState {
  return {
    isSplatted: true,
    wall,
    splatFramesRemaining: WALL_RECOVERY_FRAMES,
    comboExtensionActive: true,
    comboExtensionFrames: WALL_SPLAT_BONUS_FRAMES,
    chainedDuringWindow: false,
    splatCount: defenderSplat.splatCount + 1,
  };
}

/**
 * Tick the wall-splat state each frame.
 * Decrements stagger and bonus window counters.
 */
export function tickWallSplat(splat: WallSplatState): WallSplatState {
  if (!splat.isSplatted && !splat.comboExtensionActive) return splat;

  const newSplatFrames = Math.max(0, splat.splatFramesRemaining - 1);
  const newExtFrames = Math.max(0, splat.comboExtensionFrames - 1);

  return {
    ...splat,
    splatFramesRemaining: newSplatFrames,
    comboExtensionFrames: newExtFrames,
    isSplatted: newSplatFrames > 0,
    comboExtensionActive: newExtFrames > 0,
  };
}

/**
 * Mark that the attacker successfully chained during the wall-splat bonus window.
 * This resets the extension window and allows the combo to continue.
 */
export function consumeWallComboExtension(splat: WallSplatState): WallSplatState {
  if (!splat.comboExtensionActive) return splat;
  return {
    ...splat,
    chainedDuringWindow: true,
    comboExtensionActive: false,
    comboExtensionFrames: 0,
    // Defender stays splatted for full recovery frames
  };
}

/**
 * Check if the attacker can still chain a combo after wall-splat.
 * Returns true if the bonus window is still open.
 */
export function canChainWallCombo(splat: WallSplatState): boolean {
  return splat.comboExtensionActive && splat.comboExtensionFrames > 0;
}

/**
 * Get the wall-splat damage scaling factor.
 * Each successive wall-splat in a combo deals slightly less damage (diminishing returns).
 */
export function getWallSplatDamageScale(splatCount: number): number {
  // First splat: 100%, second: 85%, third+: 70%
  if (splatCount <= 1) return 1.0;
  if (splatCount === 2) return 0.85;
  return 0.70;
}

// ── Wall-splat animation state name ──────────────────────────────────────────
/** Returns the animation state name for wall-splat based on which wall was hit */
export function getWallSplatAnimation(wall: 'left' | 'right' | null): string {
  if (wall === 'left') return 'wallSplatLeft';
  if (wall === 'right') return 'wallSplatRight';
  return 'knockdown';
}

/** Returns the wall-splat recovery animation */
export function getWallRecoveryAnimation(): string {
  return 'wallRecovery';
}
