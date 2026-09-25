import type { MoveWindow, HitboxWindow } from './FighterStateMachine';
import type { HurtboxRegion } from '../debug/DebugOverlay';
import { DEFAULT_HURTBOX_REGIONS } from '../debug/DebugOverlay';
import { judgeContact, type ContactKind, type DefenderRead } from './HitJudge';

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
  /**
   * Which body region this hitbox targets.
   * Determines which hurtbox region is checked for collision.
   * 'high' → head, 'mid' → torso/arms, 'low' → legs
   */
  attackLevel: 'high' | 'mid' | 'low';
}

// ── Per-region hurtbox geometry ───────────────────────────────────────────────
export interface HurtboxRegionGeometry {
  region: HurtboxRegion['region'];
  /** Y-axis height range: [min, max] normalized 0–1 (0=feet, 1=top of head) */
  yMin: number;
  yMax: number;
  /** X half-width relative to fighter center */
  xHalfWidth: number;
  /** Damage multiplier when this region is hit */
  damageMultiplier: number;
}

/** Per-fighter body region hurtboxes (normalized 0–1 height) */
export const FIGHTER_HURTBOX_REGIONS: HurtboxRegionGeometry[] = [
  { region: 'head',     yMin: 0.78, yMax: 1.00, xHalfWidth: 0.20, damageMultiplier: 1.5 },
  { region: 'torso',    yMin: 0.45, yMax: 0.78, xHalfWidth: 0.28, damageMultiplier: 1.0 },
  { region: 'leftArm',  yMin: 0.42, yMax: 0.72, xHalfWidth: 0.40, damageMultiplier: 0.8 },
  { region: 'rightArm', yMin: 0.42, yMax: 0.72, xHalfWidth: 0.40, damageMultiplier: 0.8 },
  { region: 'leftLeg',  yMin: 0.00, yMax: 0.45, xHalfWidth: 0.22, damageMultiplier: 0.7 },
  { region: 'rightLeg', yMin: 0.00, yMax: 0.45, xHalfWidth: 0.22, damageMultiplier: 0.7 },
];

/** Map attack level to primary hurtbox regions it can hit */
const ATTACK_LEVEL_REGIONS: Record<'high' | 'mid' | 'low', HurtboxRegion['region'][]> = {
  high: ['head', 'torso'],
  mid:  ['torso', 'leftArm', 'rightArm'],
  low:  ['leftLeg', 'rightLeg'],
};

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
  /** Which body region was hit */
  hitRegion: HurtboxRegion['region'] | null;
  /** Damage multiplier applied from the hit region */
  regionMultiplier: number;
  /** How the read resolved. Absent on older callers means a raw overlap. */
  contact?: ContactKind;
  screw?: boolean;
  /** Juggle limit — this hit knocks down now. */
  drop?: boolean;
}

// ── Frame-data hitbox defaults per move type ──────────────────────────────────
const HITBOX_DEFAULTS: Record<string, Partial<HitboxGeometry>> = {
  lightAttack: {
    offsetX: 1.15,
    offsetZ: 0.0,
    width: 1.8,
    depth: 1.1,
    damage: 80,
    hitstun: 0.25,
    blockstun: 0.15,
    pushback: 0.3,
    launch: 0,
    isSpecial: false,
    attackLevel: 'mid',
  },
  heavyAttack: {
    offsetX: 1.35,
    offsetZ: 0.0,
    width: 2.1,
    depth: 1.2,
    damage: 150,
    hitstun: 0.45,
    blockstun: 0.25,
    pushback: 0.6,
    launch: 0.2,
    isSpecial: false,
    attackLevel: 'high',
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
  attackLevel: 'mid',
};

// ── Build hitbox geometry from a move window ──────────────────────────────────
export function buildHitboxFromMove(move: MoveWindow): HitboxGeometry {
  const base = HITBOX_DEFAULTS[move.animation] ?? HITBOX_DEFAULTS.lightAttack;
  const special = move.isSpecial ? SPECIAL_HITBOX : {};
  const built: HitboxGeometry = {
    offsetX: 0.6,
    offsetZ: 0.0,
    width: 0.8,
    depth: 0.6,
    hitstun: 0.25,
    blockstun: 0.15,
    pushback: 0.3,
    launch: 0,
    isSpecial: false,
    attackLevel: 'mid' as const,
    ...base,
    ...special,
    damage: move.damage ?? (base as { damage?: number }).damage ?? 80,
  };
  if (move.attackLevel) built.attackLevel = move.attackLevel;
  if (move.hitstun != null) built.hitstun = move.hitstun;
  if (move.blockstun != null) built.blockstun = move.blockstun;
  if (move.launchPower != null) built.launch = move.launchPower;
  if (move.pushback != null) built.pushback = move.pushback;
  if (move.reach != null) {
    built.offsetX = move.reach;
    built.width = move.width ?? move.reach;
    built.depth = move.depth ?? 0.5;
  }
  return built;
}

// ── Resolve which hurtbox region was hit ──────────────────────────────────────
/**
 * Given an attack level, determine which body region was hit.
 * Returns the region with the highest damage multiplier that the attack can reach.
 */
export function resolveHitRegion(
  attackLevel: 'high' | 'mid' | 'low',
): { region: HurtboxRegion['region']; multiplier: number } {
  const candidates = ATTACK_LEVEL_REGIONS[attackLevel];
  // Pick the primary region (first in list = highest priority)
  const primaryRegion = candidates[0];
  const regionDef = FIGHTER_HURTBOX_REGIONS.find(r => r.region === primaryRegion);
  return {
    region: primaryRegion,
    multiplier: regionDef?.damageMultiplier ?? 1.0,
  };
}

/**
 * Build hurtbox region state for debug overlay.
 * Marks the hit region as wasHit=true.
 */
export function buildHurtboxRegionState(hitRegion: HurtboxRegion['region'] | null): HurtboxRegion[] {
  return DEFAULT_HURTBOX_REGIONS.map(r => ({
    ...r,
    wasHit: r.region === hitRegion,
  }));
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

  /** Last hit region for debug overlay */
  private lastHitRegion: HurtboxRegion['region'] | null = null;
  /** Hurtbox region state (updated on each hit) */
  private hurtboxRegionState: HurtboxRegion[] = DEFAULT_HURTBOX_REGIONS.map(r => ({ ...r }));
  /** Timestamp of last hit for region flash decay */
  private lastHitTimestamp = 0;
  private readonly REGION_HIT_FLASH_MS = 400;

  /** Current hitbox geometry (null when inactive) */
  get geometry(): HitboxGeometry | null {
    return this.hitboxActive ? this.hitboxGeometry : null;
  }

  get isActive(): boolean {
    return this.hitboxActive;
  }

  /** Get current hurtbox region state for debug overlay */
  getHurtboxRegions(): HurtboxRegion[] {
    // Decay hit flash after REGION_HIT_FLASH_MS
    const now = performance.now();
    if (this.lastHitRegion && now - this.lastHitTimestamp > this.REGION_HIT_FLASH_MS) {
      this.lastHitRegion = null;
      this.hurtboxRegionState = DEFAULT_HURTBOX_REGIONS.map(r => ({ ...r, wasHit: false }));
    }
    return this.hurtboxRegionState;
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
   * Resolves which body region was hit and applies the damage multiplier.
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
    defender?: DefenderRead,
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
    const halfW = (hb.width + 1.1) * 0.5;
    const halfD = (hb.depth + 1.0) * 0.5;

    if (dx > halfW || dz > halfD) return null;

    const attackLevel = hb.attackLevel ?? 'mid';
    const read = defender ?? {
      crouching: false,
      guarding: opponentIsBlocking,
      airborne: false,
      inStartup: false,
      juggleHits: 0,
    };
    const judged = judgeContact(attackLevel, read, hb.launch);

    // Swing resolved — a crushed high does not hit again later in the same active.
    this.hitRegisteredThisSwing = true;

    if (judged.kind === 'whiff') {
      return {
        hit: false,
        damage: 0,
        hitstun: 0,
        blockstun: 0,
        pushback: 0,
        launch: 0,
        isSpecial: hb.isSpecial,
        hitFrame: currentFrame,
        hitRegion: null,
        regionMultiplier: 1,
        contact: 'whiff',
        screw: false,
        drop: false,
      };
    }

    const { region: hitRegion, multiplier: regionMultiplier } = resolveHitRegion(attackLevel);
    this.lastHitRegion = hitRegion;
    this.lastHitTimestamp = performance.now();
    this.hurtboxRegionState = buildHurtboxRegionState(hitRegion);

    const blocked = judged.kind === 'block';
    const damage = Math.max(1, Math.round(hb.damage * regionMultiplier * judged.damageScale));

    return {
      hit: true,
      damage,
      hitstun: blocked ? 0 : hb.hitstun * judged.hitstunScale,
      blockstun: blocked ? hb.blockstun : 0,
      pushback: blocked ? hb.pushback * 0.65 : hb.pushback,
      launch: blocked ? 0 : judged.launch,
      isSpecial: hb.isSpecial,
      hitFrame: currentFrame,
      hitRegion,
      regionMultiplier: blocked ? 1 : regionMultiplier,
      contact: judged.kind,
      screw: judged.screw,
      drop: judged.drop,
    };
  }

  /** Reset for a new round */
  reset(): void {
    this.hitboxGeometry = null;
    this.hitboxActive = false;
    this.hitRegisteredThisSwing = false;
    this.lastActiveFrame = -1;
    this.lastHitRegion = null;
    this.hurtboxRegionState = DEFAULT_HURTBOX_REGIONS.map(r => ({ ...r, wasHit: false }));
  }
}
