import type { MoveWindow, HitboxWindow } from './FighterStateMachine';

// ── Hitbox geometry ───────────────────────────────────────────────────────────
export interface HitboxGeometry {
  /** World-space X offset from fighter origin */
  offsetX: number;
  /** World-space Z offset from fighter origin */
  offsetZ: number;
  width: number;
  depth: number;
  damage: number;
  hitstun: number;
  blockstun: number;
  pushback: number;
  launch: number;
  isSpecial: boolean;
}

// ── Collision result ──────────────────────────────────────────────────────────
export interface CollisionResult {
  hit: boolean;
  damage: number;
  hitstun: number;
  blockstun: number;
  pushback: number;
  launch: number;
  isSpecial: boolean;
  /** Frame at which the hit occurred */
  hitFrame: number;
}

// ── Frame-data hitbox defaults per move type ──────────────────────────────────
const HITBOX_DEFAULTS: Record<string, Partial<HitboxGeometry>> = {
  lightAttack: {
    offsetX: 0.6,
    offsetZ: 0.0,
    width: 0.8,
    depth: 0.6,
    damage: 80,
    hitstun: 0.25,
    blockstun: 0.15,
    pushback: 0.3,
    launch: 0,
    isSpecial: false,
  },
  heavyAttack: {
    offsetX: 0.8,
    offsetZ: 0.0,
    width: 1.0,
    depth: 0.7,
    damage: 150,
    hitstun: 0.45,
    blockstun: 0.25,
    pushback: 0.6,
    launch: 0.2,
    isSpecial: false,
  },
};

const SPECIAL_HITBOX: Partial<HitboxGeometry> = {
  offsetX: 1.0,
  offsetZ: 0.0,
  width: 1.2,
  depth: 0.9,
  hitstun: 0.65,
  blockstun: 0.35,
  pushback: 1.0,
  launch: 0.5,
  isSpecial: true,
};

// ── Build hitbox geometry from a move window ──────────────────────────────────
export function buildHitboxFromMove(move: MoveWindow): HitboxGeometry {
  const base = HITBOX_DEFAULTS[move.animation] ?? HITBOX_DEFAULTS.lightAttack;
  const special = move.isSpecial ? SPECIAL_HITBOX : {};
  return {
    offsetX: 0.6,
    offsetZ: 0.0,
    width: 0.8,
    depth: 0.6,
    damage: move.damage ?? 80,
    hitstun: 0.25,
    blockstun: 0.15,
    pushback: 0.3,
    launch: 0,
    isSpecial: false,
    ...base,
    ...special,
    damage: move.damage ?? (base.damage ?? 80),
  };
}

// ── FrameDataHitboxSystem ─────────────────────────────────────────────────────
/**
 * Manages per-fighter hitbox state.
 * Call update() every frame with the current HitboxWindow from FighterStateMachine.
 * Call checkCollision() to test against an opponent's position.
 *
 * Hitbox only becomes active when the animation reaches the hitboxStartFrame marker.
 * Damage is only applied once per active window (no repeated hits per swing).
 */
export class FrameDataHitboxSystem {
  private hitboxGeometry: HitboxGeometry | null = null;
  private hitboxActive = false;
  private hitRegisteredThisSwing = false;
  private lastActiveFrame = -1;

  /** Current hitbox geometry (null when inactive) */
  get geometry(): HitboxGeometry | null {
    return this.hitboxActive ? this.hitboxGeometry : null;
  }

  get isActive(): boolean {
    return this.hitboxActive;
  }

  /**
   * Update hitbox state from the state machine's hitbox window.
   * Must be called every frame.
   */
  update(window: HitboxWindow): void {
    if (!window.active || !window.move) {
      // Window closed — reset for next swing
      if (this.hitboxActive) {
        this.hitboxActive = false;
        this.hitRegisteredThisSwing = false;
        this.lastActiveFrame = -1;
      }
      return;
    }

    // New swing started (frame reset)
    if (window.currentFrame < this.lastActiveFrame) {
      this.hitRegisteredThisSwing = false;
    }
    this.lastActiveFrame = window.currentFrame;

    // Spawn hitbox geometry on first active frame
    if (!this.hitboxActive) {
      this.hitboxGeometry = buildHitboxFromMove(window.move);
      this.hitboxActive = true;
    }
  }

  /**
   * Check collision between this fighter's hitbox and an opponent.
   *
   * @param attackerX - Attacker world X
   * @param attackerZ - Attacker world Z
   * @param facing    - Attacker facing direction (1 = right, -1 = left)
   * @param opponentX - Opponent world X
   * @param opponentZ - Opponent world Z
   * @param opponentIsBlocking - Whether opponent is in guard state
   * @param currentFrame - Current animation frame (for logging)
   */
  checkCollision(
    attackerX: number,
    attackerZ: number,
    facing: 1 | -1,
    opponentX: number,
    opponentZ: number,
    opponentIsBlocking: boolean,
    currentFrame: number,
  ): CollisionResult | null {
    if (!this.hitboxActive || !this.hitboxGeometry) return null;
    if (this.hitRegisteredThisSwing) return null;

    const hb = this.hitboxGeometry;
    // Hitbox center in world space (offset in attacker's facing direction)
    const hbCenterX = attackerX + hb.offsetX * facing;
    const hbCenterZ = attackerZ + hb.offsetZ;

    // AABB overlap test
    const dx = Math.abs(opponentX - hbCenterX);
    const dz = Math.abs(opponentZ - hbCenterZ);
    const halfW = (hb.width + 0.4) * 0.5; // 0.4 = opponent hurtbox half-width
    const halfD = (hb.depth + 0.4) * 0.5;

    if (dx > halfW || dz > halfD) return null;

    // Hit confirmed — mark so we don't double-apply
    this.hitRegisteredThisSwing = true;

    const damage = opponentIsBlocking
      ? Math.floor(hb.damage * 0.15) // chip damage on block
      : hb.damage;

    return {
      hit: true,
      damage,
      hitstun: opponentIsBlocking ? 0 : hb.hitstun,
      blockstun: opponentIsBlocking ? hb.blockstun : 0,
      pushback: hb.pushback,
      launch: opponentIsBlocking ? 0 : hb.launch,
      isSpecial: hb.isSpecial,
      hitFrame: currentFrame,
    };
  }

  /** Reset for a new round */
  reset(): void {
    this.hitboxGeometry = null;
    this.hitboxActive = false;
    this.hitRegisteredThisSwing = false;
    this.lastActiveFrame = -1;
  }
}
