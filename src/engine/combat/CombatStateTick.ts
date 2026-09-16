/**
 * CombatStateTick — Night Sky Engine-style decoupled combat state machine
 *
 * The game state (health, positions, active frames, hitboxes) runs on a
 * strict independent tick at 60fps. The R3F Canvas ONLY reads this state
 * and draws it — it never writes to it.
 *
 * This prevents frame drops on mobile from breaking the combat math.
 *
 * Architecture:
 *  - CombatState: pure data, no Three.js references
 *  - tickCombatState(): pure function, no side effects
 *  - R3F useFrame reads CombatState via ref — never calls tickCombatState
 *
 * Juggle Gravity:
 *  - Airborne characters have exponentially increasing fall speed
 *  - Y snaps back to 0 aggressively to keep combos grounded
 *
 * Block Stun vs Hit Stun (Frame Advantage):
 *  - Hit stun: attacker can act X frames before defender recovers
 *  - Block stun: defender recovers slightly before attacker (frame advantage)
 *
 * Z-axis Sidestep Whiff:
 *  - If P1 sidestepped and P2 throws a linear attack, the attack whiffs
 *  - Tracking attacks (homing) ignore Z-axis offset
 */

import type { KiChargeState } from './KiChargeSystem';
import { tickKiCharge, createKiChargeState } from './KiChargeSystem';

// ── Fighter position in 3D space ──────────────────────────────────────────────
export interface FighterPosition {
  x: number;
  y: number; // 0 = ground, >0 = airborne
  z: number;
}

// ── Airborne state for juggle gravity ────────────────────────────────────────
export interface AirborneState {
  isAirborne: boolean;
  velocityY: number;       // upward velocity (positive = up)
  launchHeight: number;    // peak height reached
  fallAcceleration: number; // exponential fall multiplier
}

// ── Stun state ────────────────────────────────────────────────────────────────
export interface StunState {
  isStunned: boolean;
  stunFramesRemaining: number;
  isBlockStun: boolean;
  isHitStun: boolean;
  isKnockdown: boolean;
}

// ── Per-fighter combat state ──────────────────────────────────────────────────
export interface FighterCombatState {
  id: 'p1' | 'p2';
  health: number;
  maxHealth: number;
  position: FighterPosition;
  airborne: AirborneState;
  stun: StunState;
  kiCharge: KiChargeState;
  /** Frames since last attack (for frame advantage calculation) */
  attackRecoveryFrames: number;
  /** Whether this fighter is currently in the active hitbox window */
  isAttacking: boolean;
  /** Current attack's frame advantage on block (negative = disadvantage) */
  frameAdvantageOnBlock: number;
  /** Whether this fighter is currently blocking */
  isBlocking: boolean;
  /** Z-axis sidestep offset (>0.5 = fully sidestepped) */
  sidestepZ: number;
  /** Whether fighter is in sidestep state (linear attacks whiff) */
  isSidestepping: boolean;
}

// ── Full match combat state ───────────────────────────────────────────────────
export interface CombatMatchState {
  p1: FighterCombatState;
  p2: FighterCombatState;
  roundTimer: number;
  roundNumber: number;
  matchPhase: 'intro' | 'fight' | 'ko' | 'timeup' | 'victory';
  hitStopFrames: number;
  frame: number;
}

// ── Physics constants ─────────────────────────────────────────────────────────
export const JUGGLE_GRAVITY_BASE = -0.015;         // base downward acceleration per frame
export const JUGGLE_GRAVITY_EXPONENT = 1.08;       // exponential multiplier each frame airborne
export const JUGGLE_LAUNCH_VELOCITY = 0.18;        // upward velocity on launch
export const JUGGLE_GROUND_SNAP_THRESHOLD = 0.02;  // snap to ground when Y < this
export const SIDESTEP_WHIFF_THRESHOLD = 0.6;       // Z offset required to whiff linear attacks
export const SIDESTEP_RETURN_SPEED = 0.04;         // how fast Z returns to 0 per frame

// ── Frame advantage constants ─────────────────────────────────────────────────
export const FRAME_ADVANTAGE_LIGHT_ON_BLOCK = -2;  // light attack: -2 on block (slight disadvantage)
export const FRAME_ADVANTAGE_HEAVY_ON_BLOCK = -6;  // heavy attack: -6 on block (punishable)
export const FRAME_ADVANTAGE_LIGHT_ON_HIT = +4;    // light attack: +4 on hit (can continue combo)
export const FRAME_ADVANTAGE_HEAVY_ON_HIT = +8;    // heavy attack: +8 on hit (free combo)

export function createFighterCombatState(id: 'p1' | 'p2', maxHealth: number): FighterCombatState {
  return {
    id,
    health: maxHealth,
    maxHealth,
    position: { x: id === 'p1' ? -1.8 : 1.8, y: 0, z: 0 },
    airborne: {
      isAirborne: false,
      velocityY: 0,
      launchHeight: 0,
      fallAcceleration: 1.0,
    },
    stun: {
      isStunned: false,
      stunFramesRemaining: 0,
      isBlockStun: false,
      isHitStun: false,
      isKnockdown: false,
    },
    kiCharge: createKiChargeState(),
    attackRecoveryFrames: 0,
    isAttacking: false,
    frameAdvantageOnBlock: 0,
    isBlocking: false,
    sidestepZ: 0,
    isSidestepping: false,
  };
}

export function createCombatMatchState(p1MaxHp: number, p2MaxHp: number): CombatMatchState {
  return {
    p1: createFighterCombatState('p1', p1MaxHp),
    p2: createFighterCombatState('p2', p2MaxHp),
    roundTimer: 99,
    roundNumber: 1,
    matchPhase: 'intro',
    hitStopFrames: 0,
    frame: 0,
  };
}

// ── Juggle gravity tick ───────────────────────────────────────────────────────
export function tickAirborne(airborne: AirborneState, position: FighterPosition): {
  airborne: AirborneState;
  position: FighterPosition;
} {
  if (!airborne.isAirborne) return { airborne, position };

  // Exponential fall acceleration — each frame airborne, fall gets faster
  const newFallAcceleration = airborne.fallAcceleration * JUGGLE_GRAVITY_EXPONENT;
  const newVelocityY = airborne.velocityY + JUGGLE_GRAVITY_BASE * newFallAcceleration;
  const newY = position.y + newVelocityY;

  // Ground snap
  if (newY <= JUGGLE_GROUND_SNAP_THRESHOLD) {
    return {
      airborne: {
        isAirborne: false,
        velocityY: 0,
        launchHeight: airborne.launchHeight,
        fallAcceleration: 1.0,
      },
      position: { ...position, y: 0 },
    };
  }

  return {
    airborne: { ...airborne, velocityY: newVelocityY, fallAcceleration: newFallAcceleration },
    position: { ...position, y: newY },
  };
}

/**
 * Launch a fighter into the air (juggle start).
 * launchStrength: 0.0–1.0 (1.0 = full launch)
 */
export function launchFighter(fighter: FighterCombatState, launchStrength: number): FighterCombatState {
  const velocity = JUGGLE_LAUNCH_VELOCITY * launchStrength;
  return {
    ...fighter,
    airborne: {
      isAirborne: true,
      velocityY: velocity,
      launchHeight: velocity,
      fallAcceleration: 1.0,
    },
  };
}

// ── Z-axis sidestep whiff check ───────────────────────────────────────────────
/**
 * Returns true if the attack should whiff due to Z-axis sidestep.
 * Linear attacks (most normals) whiff if opponent has sidestepped.
 * Tracking attacks (homing moves) ignore sidestep.
 */
export function checkSidestepWhiff(
  attackerZ: number,
  defenderZ: number,
  isTrackingAttack: boolean,
): boolean {
  if (isTrackingAttack) return false;
  const zDiff = Math.abs(attackerZ - defenderZ);
  return zDiff >= SIDESTEP_WHIFF_THRESHOLD;
}

// ── Stun tick ─────────────────────────────────────────────────────────────────
export function tickStun(stun: StunState): StunState {
  if (!stun.isStunned) return stun;
  const remaining = stun.stunFramesRemaining - 1;
  if (remaining <= 0) {
    return {
      isStunned: false,
      stunFramesRemaining: 0,
      isBlockStun: false,
      isHitStun: false,
      isKnockdown: false,
    };
  }
  return { ...stun, stunFramesRemaining: remaining };
}

/**
 * Apply hit stun to a fighter.
 * hitstunFrames: number of frames the fighter cannot act.
 */
export function applyHitStun(fighter: FighterCombatState, hitstunFrames: number): FighterCombatState {
  return {
    ...fighter,
    stun: {
      isStunned: true,
      stunFramesRemaining: hitstunFrames,
      isBlockStun: false,
      isHitStun: true,
      isKnockdown: false,
    },
  };
}

/**
 * Apply block stun to a fighter.
 * Block stun is shorter than hit stun — defender recovers before attacker on most moves.
 */
export function applyBlockStun(fighter: FighterCombatState, blockstunFrames: number): FighterCombatState {
  return {
    ...fighter,
    stun: {
      isStunned: true,
      stunFramesRemaining: blockstunFrames,
      isBlockStun: true,
      isHitStun: false,
      isKnockdown: false,
    },
  };
}

// ── Main combat tick (decoupled from R3F render loop) ─────────────────────────
/**
 * Pure function — no side effects, no Three.js references.
 * Called at fixed 60fps tick, completely independent of render frame rate.
 *
 * @param state   Current match state
 * @param p1Input P1 input this frame
 * @param p2Input P2 input this frame
 * @param dt      Delta time in seconds
 */
export function tickCombatState(
  state: CombatMatchState,
  p1Input: { lp?: boolean; rp?: boolean; lk?: boolean; rk?: boolean; attackLanded?: boolean },
  p2Input: { lp?: boolean; rp?: boolean; lk?: boolean; rk?: boolean; attackLanded?: boolean },
  dt: number,
): CombatMatchState {
  if (state.matchPhase !== 'fight') return state;

  // ── Hit stop: freeze all combat math ─────────────────────────────────────
  if (state.hitStopFrames > 0) {
    return { ...state, hitStopFrames: state.hitStopFrames - 1 };
  }

  // ── Tick stun states ──────────────────────────────────────────────────────
  const p1Stun = tickStun(state.p1.stun);
  const p2Stun = tickStun(state.p2.stun);

  // ── Tick airborne / juggle gravity ────────────────────────────────────────
  const { airborne: p1Airborne, position: p1Pos } = tickAirborne(state.p1.airborne, state.p1.position);
  const { airborne: p2Airborne, position: p2Pos } = tickAirborne(state.p2.airborne, state.p2.position);

  // ── Tick Ki Charge ────────────────────────────────────────────────────────
  const p1KiCharge = tickKiCharge(state.p1.kiCharge, p1Input, p1Input.attackLanded ?? false, dt);
  const p2KiCharge = tickKiCharge(state.p2.kiCharge, p2Input, p2Input.attackLanded ?? false, dt);

  // ── Sidestep Z return ─────────────────────────────────────────────────────
  const p1SidestepZ = state.p1.sidestepZ * (1 - SIDESTEP_RETURN_SPEED * 60 * dt);
  const p2SidestepZ = state.p2.sidestepZ * (1 - SIDESTEP_RETURN_SPEED * 60 * dt);

  return {
    ...state,
    frame: state.frame + 1,
    p1: {
      ...state.p1,
      stun: p1Stun,
      airborne: p1Airborne,
      position: { ...p1Pos, z: p1SidestepZ },
      kiCharge: p1KiCharge,
      isBlocking: !p1KiCharge.blockingDisabled && state.p1.isBlocking,
      sidestepZ: p1SidestepZ,
      isSidestepping: Math.abs(p1SidestepZ) >= SIDESTEP_WHIFF_THRESHOLD * 0.5,
    },
    p2: {
      ...state.p2,
      stun: p2Stun,
      airborne: p2Airborne,
      position: { ...p2Pos, z: p2SidestepZ },
      kiCharge: p2KiCharge,
      isBlocking: !p2KiCharge.blockingDisabled && state.p2.isBlocking,
      sidestepZ: p2SidestepZ,
      isSidestepping: Math.abs(p2SidestepZ) >= SIDESTEP_WHIFF_THRESHOLD * 0.5,
    },
  };
}
