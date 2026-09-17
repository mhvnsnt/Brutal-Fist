/**
 * StageManager — Modular stage wipe/load system for Brutal Fist
 *
 * Architecture (Tekken / MK style in R3F):
 *  - Each stage is a data container (StageConfig) with its own meshes, lighting, audio, physics
 *  - When a stage loads, React unmounts the old component → flushes old GLB/lights/BGM
 *  - Fighter variables (HP, position, input state) are preserved in a persistent cache
 *  - New stage mounts with its own JSON config: lighting, BGM, boundaries, hazards
 *
 * Multi-tier floor breaks (Tekken / MK style):
 *  - Upper floor has a destructible HP threshold
 *  - Heavy slam exceeding threshold triggers Execute_Stage_Transition:
 *    Phase 1: Floor mesh swapped for fractured debris particles
 *    Phase 2: Collision plane disabled
 *    Phase 3: Both fighters forced into Transition_Fall state, camera detaches
 *    Phase 4: Land on Level 2 floor, victim takes landing damage, input restored
 *
 * Proximity ledge-throw overrides (Def Jam / WrestleMania XIX style):
 *  - Before executing a standard throw, check if attacker is within edgeZone
 *  - If inside edgeZone, override default throw → ledge_throw animation → Ring-Out KO
 *
 * Destructible wall breaks (Urban Reign / Def Jam style):
 *  - Walls can be designated as destructible with a knockback_force threshold
 *  - If force exceeds threshold: particle shatter, boundary clamp disabled, fighter flies through
 *
 * Crowd/fence hazard bounce (Def Jam / MK style):
 *  - Outer edge of arena is a Hazard_Trigger_Volume
 *  - Fighter knocked into it: 5% chip damage, hazard_bounce animation, shoved back to center
 *
 * Subway stage — MDickie-style independent RNG train:
 *  - Train runs on its own random schedule (10–25s), NOT triggered by falling in
 *  - Horn + light flicker warning 2s before crossing
 *  - trainCrossing boolean true for 1s as train animates across
 *  - If P1 or P2 is on tracks (Y = -1.5) during crossing → massive unblockable damage
 *  - Vault-up escape: player on tracks can input Up to vault back to platform (Y = 0)
 *  - After crossing, new random timer rolls and loop continues
 */

import { resolveStageConfig, type StageConfig, type StageId } from './StageConfig';

// ── Fighter persistent state cache (survives stage wipes) ─────────────────────
export interface FighterPersistentState {
  id: 'p1' | 'p2';
  health: number;
  maxHealth: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  /** Input controller state preserved across stage loads */
  inputEnabled: boolean;
  /** Current level index in multi-tier stage */
  levelIndex: number;
}

export function createFighterPersistentState(
  id: 'p1' | 'p2',
  maxHealth: number,
): FighterPersistentState {
  return {
    id,
    health: maxHealth,
    maxHealth,
    positionX: id === 'p1' ? -1.8 : 1.8,
    positionY: 0,
    positionZ: 0,
    inputEnabled: true,
    levelIndex: 0,
  };
}

// ── Stage transition state ────────────────────────────────────────────────────
export type StageTransitionPhase =
  | 'idle' |'floor_break_debris'   // Phase 1: debris particles, floor mesh swapped
  | 'floor_break_fall'     // Phase 2-3: collision disabled, fighters in Transition_Fall
  | 'floor_break_land'     // Phase 4: land on Level 2, apply landing damage
  | 'stage_wipe'           // Full stage swap in progress
  | 'stage_load';          // New stage loading

export interface FloorBreakState {
  phase: StageTransitionPhase;
  /** Which fighter triggered the break */
  triggerFighter: 'p1' | 'p2' | null;
  /** Target level index after break */
  targetLevelIndex: number;
  /** Frames remaining in current phase */
  phaseFrames: number;
  /** Landing damage to apply to victim */
  landingDamage: number;
  /** Camera detached from standard rig */
  cameraDetached: boolean;
  /** Debris particle positions (procedural) */
  debrisPositions: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number }>;
}

export function createFloorBreakState(): FloorBreakState {
  return {
    phase: 'idle',
    triggerFighter: null,
    targetLevelIndex: 0,
    phaseFrames: 0,
    landingDamage: 0,
    cameraDetached: false,
    debrisPositions: [],
  };
}

// ── Proximity ledge-throw state ───────────────────────────────────────────────
export interface LedgeThrowState {
  /** Whether a ledge-throw override is currently active */
  active: boolean;
  /** Which fighter is being thrown off the ledge */
  victim: 'p1' | 'p2' | null;
  /** Animation phase */
  phase: 'startup' | 'throw' | 'fall' | 'ko' | 'idle';
  /** Frames in current phase */
  phaseFrames: number;
}

export function createLedgeThrowState(): LedgeThrowState {
  return { active: false, victim: null, phase: 'idle', phaseFrames: 0 };
}

// ── Destructible wall state ───────────────────────────────────────────────────
export interface DestructibleWallState {
  /** Left wall intact */
  leftWallIntact: boolean;
  /** Right wall intact */
  rightWallIntact: boolean;
  /** Particle shatter active */
  leftShatterActive: boolean;
  rightShatterActive: boolean;
  /** Shatter particle frames remaining */
  leftShatterFrames: number;
  rightShatterFrames: number;
}

export function createDestructibleWallState(): DestructibleWallState {
  return {
    leftWallIntact: true,
    rightWallIntact: true,
    leftShatterActive: false,
    rightShatterActive: false,
    leftShatterFrames: 0,
    rightShatterFrames: 0,
  };
}

// ── Crowd/fence hazard bounce state ──────────────────────────────────────────
export interface HazardBounceState {
  /** Whether a hazard bounce is currently active for each fighter */
  p1BounceActive: boolean;
  p2BounceActive: boolean;
  /** Frames remaining in bounce animation */
  p1BounceFrames: number;
  p2BounceFrames: number;
  /** Target X to shove fighter back toward center */
  p1TargetX: number;
  p2TargetX: number;
}

export function createHazardBounceState(): HazardBounceState {
  return {
    p1BounceActive: false,
    p2BounceActive: false,
    p1BounceFrames: 0,
    p2BounceFrames: 0,
    p1TargetX: -1.8,
    p2TargetX: 1.8,
  };
}

// ── Subway / Train hazard state (MDickie-style independent RNG) ───────────────
export interface TrainHazardState {
  /** Whether this stage has a train hazard */
  enabled: boolean;
  /** Current timer in seconds until next train crossing */
  timerSeconds: number;
  /** Random interval for next crossing (10–25s) */
  nextCrossingInterval: number;
  /** Whether the 2-second warning is active */
  warningActive: boolean;
  /** Warning frames remaining */
  warningFrames: number;
  /** Whether the train is currently crossing (1-second window) */
  trainCrossing: boolean;
  /** Train crossing frames remaining */
  crossingFrames: number;
  /** Train X position during crossing (animates from -20 to +20) */
  trainX: number;
  /** Whether P1 is on the tracks (Y = -1.5) */
  p1OnTracks: boolean;
  /** Whether P2 is on the tracks (Y = -1.5) */
  p2OnTracks: boolean;
  /** Whether P1 can vault up (input Up while on tracks) */
  p1CanVault: boolean;
  /** Whether P2 can vault up */
  p2CanVault: boolean;
  /** P1 vault animation active */
  p1VaultActive: boolean;
  /** P2 vault animation active */
  p2VaultActive: boolean;
  /** Vault animation frames remaining */
  p1VaultFrames: number;
  p2VaultFrames: number;
  /** Lights flickering (warning visual) */
  lightsFlickering: boolean;
}

export const TRAIN_TRACK_Y = -1.5;       // Y position of the tracks
export const TRAIN_PLATFORM_Y = 0;       // Y position of the safe platform
export const TRAIN_WARNING_FRAMES = 120; // 2 seconds at 60fps
export const TRAIN_CROSSING_FRAMES = 60; // 1 second at 60fps
export const TRAIN_VAULT_FRAMES = 30;    // 0.5 seconds vault animation
export const TRAIN_HIT_DAMAGE = 0.40;   // 40% of max HP as unblockable damage
export const TRAIN_MIN_INTERVAL = 10;   // minimum seconds between trains
export const TRAIN_MAX_INTERVAL = 25;   // maximum seconds between trains

export function createTrainHazardState(enabled: boolean): TrainHazardState {
  const interval = TRAIN_MIN_INTERVAL + Math.random() * (TRAIN_MAX_INTERVAL - TRAIN_MIN_INTERVAL);
  return {
    enabled,
    timerSeconds: interval,
    nextCrossingInterval: interval,
    warningActive: false,
    warningFrames: 0,
    trainCrossing: false,
    crossingFrames: 0,
    trainX: -20,
    p1OnTracks: false,
    p2OnTracks: false,
    p1CanVault: true,
    p2CanVault: true,
    p1VaultActive: false,
    p2VaultActive: false,
    p1VaultFrames: 0,
    p2VaultFrames: 0,
    lightsFlickering: false,
  };
}

/**
 * Tick the train hazard state — pure function, called every combat frame.
 * Returns updated state + events to fire.
 */
export interface TrainTickResult {
  state: TrainHazardState;
  /** Fire train horn + light flicker warning */
  fireWarning: boolean;
  /** Train is crossing — check fighter positions */
  fireCrossing: boolean;
  /** P1 was hit by train */
  p1TrainHit: boolean;
  /** P2 was hit by train */
  p2TrainHit: boolean;
  /** Crossing just ended — roll new timer */
  crossingEnded: boolean;
}

export function tickTrainHazard(
  state: TrainHazardState,
  dt: number,
  p1Y: number,
  p2Y: number,
  p1InputUp: boolean,
  p2InputUp: boolean,
): TrainTickResult {
  if (!state.enabled) {
    return {
      state,
      fireWarning: false,
      fireCrossing: false,
      p1TrainHit: false,
      p2TrainHit: false,
      crossingEnded: false,
    };
  }

  let next = { ...state };
  let fireWarning = false;
  let fireCrossing = false;
  let p1TrainHit = false;
  let p2TrainHit = false;
  let crossingEnded = false;

  // Track who is on the tracks
  next.p1OnTracks = p1Y <= TRAIN_TRACK_Y + 0.3;
  next.p2OnTracks = p2Y <= TRAIN_TRACK_Y + 0.3;

  // ── Vault escape logic ────────────────────────────────────────────────────
  if (next.p1OnTracks && p1InputUp && next.p1CanVault && !next.p1VaultActive) {
    next.p1VaultActive = true;
    next.p1VaultFrames = TRAIN_VAULT_FRAMES;
    next.p1CanVault = false; // cooldown until back on platform
  }
  if (next.p2OnTracks && p2InputUp && next.p2CanVault && !next.p2VaultActive) {
    next.p2VaultActive = true;
    next.p2VaultFrames = TRAIN_VAULT_FRAMES;
    next.p2CanVault = false;
  }

  // Tick vault animations
  if (next.p1VaultActive) {
    next.p1VaultFrames = Math.max(0, next.p1VaultFrames - 1);
    if (next.p1VaultFrames === 0) {
      next.p1VaultActive = false;
      next.p1OnTracks = false;
    }
  }
  if (next.p2VaultActive) {
    next.p2VaultFrames = Math.max(0, next.p2VaultFrames - 1);
    if (next.p2VaultFrames === 0) {
      next.p2VaultActive = false;
      next.p2OnTracks = false;
    }
  }

  // Reset vault cooldown when fighter is back on platform
  if (!next.p1OnTracks && !next.p1VaultActive) next.p1CanVault = true;
  if (!next.p2OnTracks && !next.p2VaultActive) next.p2CanVault = true;

  // ── Train schedule tick ───────────────────────────────────────────────────
  if (!next.warningActive && !next.trainCrossing) {
    next.timerSeconds -= dt;

    // 2 seconds before crossing: fire warning
    if (next.timerSeconds <= 2.0 && !next.warningActive) {
      next.warningActive = true;
      next.warningFrames = TRAIN_WARNING_FRAMES;
      next.lightsFlickering = true;
      fireWarning = true;
    }
  }

  // ── Warning phase ─────────────────────────────────────────────────────────
  if (next.warningActive) {
    next.warningFrames = Math.max(0, next.warningFrames - 1);
    // Flicker lights every 6 frames
    next.lightsFlickering = (next.warningFrames % 12) < 6;

    if (next.warningFrames === 0) {
      // Warning over — train starts crossing
      next.warningActive = false;
      next.trainCrossing = true;
      next.crossingFrames = TRAIN_CROSSING_FRAMES;
      next.trainX = -20; // start off-screen left
      next.lightsFlickering = false;
      fireCrossing = true;
    }
  }

  // ── Train crossing phase ──────────────────────────────────────────────────
  if (next.trainCrossing) {
    next.crossingFrames = Math.max(0, next.crossingFrames - 1);
    // Animate train across screen
    const progress = 1 - next.crossingFrames / TRAIN_CROSSING_FRAMES;
    next.trainX = -20 + progress * 40; // -20 to +20

    // Check fighter positions — if on tracks during crossing, they get hit
    if (next.p1OnTracks && !next.p1VaultActive) p1TrainHit = true;
    if (next.p2OnTracks && !next.p2VaultActive) p2TrainHit = true;

    if (next.crossingFrames === 0) {
      next.trainCrossing = false;
      next.trainX = 20;
      crossingEnded = true;

      // Roll new random interval
      const newInterval = TRAIN_MIN_INTERVAL + Math.random() * (TRAIN_MAX_INTERVAL - TRAIN_MIN_INTERVAL);
      next.timerSeconds = newInterval;
      next.nextCrossingInterval = newInterval;
    }
  }

  return { state: next, fireWarning, fireCrossing, p1TrainHit, p2TrainHit, crossingEnded };
}

// ── Floor break tick ──────────────────────────────────────────────────────────
export const FLOOR_BREAK_DEBRIS_FRAMES = 20;  // Phase 1: debris explosion
export const FLOOR_BREAK_FALL_FRAMES = 90;    // Phase 2-3: camera tracks fall
export const FLOOR_BREAK_LAND_FRAMES = 30;    // Phase 4: landing impact
export const FLOOR_BREAK_LANDING_DAMAGE = 30; // flat damage on landing

/**
 * Trigger a floor break transition.
 * Called when a slam exceeds the floor's HP threshold.
 */
export function triggerFloorBreak(
  victim: 'p1' | 'p2',
  targetLevelIndex: number,
  slamDamage: number,
): FloorBreakState {
  // Generate procedural debris positions
  const debris = Array.from({ length: 12 }, (_, i) => ({
    x: (Math.random() - 0.5) * 4,
    y: 0,
    z: (Math.random() - 0.5) * 3,
    vx: (Math.random() - 0.5) * 0.15,
    vy: 0.08 + Math.random() * 0.12,
    vz: (Math.random() - 0.5) * 0.1,
  }));

  return {
    phase: 'floor_break_debris',
    triggerFighter: victim,
    targetLevelIndex,
    phaseFrames: FLOOR_BREAK_DEBRIS_FRAMES,
    landingDamage: FLOOR_BREAK_LANDING_DAMAGE,
    cameraDetached: false,
    debrisPositions: debris,
  };
}

/**
 * Tick floor break state — pure function.
 * Returns updated state + events.
 */
export interface FloorBreakTickResult {
  state: FloorBreakState;
  /** Phase just changed */
  phaseChanged: boolean;
  /** Landing damage to apply */
  applyLandingDamage: boolean;
  /** Transition complete — restore input */
  transitionComplete: boolean;
}

export function tickFloorBreak(prev: FloorBreakState, dt: number): FloorBreakTickResult {
  if (prev.phase === 'idle') {
    return { state: prev, phaseChanged: false, applyLandingDamage: false, transitionComplete: false };
  }

  let next = { ...prev };
  let phaseChanged = false;
  let applyLandingDamage = false;
  let transitionComplete = false;

  next.phaseFrames = Math.max(0, next.phaseFrames - 1);

  // Tick debris physics
  next.debrisPositions = next.debrisPositions.map(d => ({
    ...d,
    x: d.x + d.vx,
    y: Math.max(-0.5, d.y + d.vy - 0.006),
    z: d.z + d.vz,
    vy: d.vy - 0.006, // gravity
  }));

  if (next.phaseFrames === 0) {
    phaseChanged = true;
    if (next.phase === 'floor_break_debris') {
      // Phase 1 → Phase 2-3: disable collision, start fall
      next.phase = 'floor_break_fall';
      next.phaseFrames = FLOOR_BREAK_FALL_FRAMES;
      next.cameraDetached = true;
    } else if (next.phase === 'floor_break_fall') {
      // Phase 3 → Phase 4: land on Level 2
      next.phase = 'floor_break_land';
      next.phaseFrames = FLOOR_BREAK_LAND_FRAMES;
      next.cameraDetached = false;
      applyLandingDamage = true;
    } else if (next.phase === 'floor_break_land') {
      // Phase 4 complete — restore input
      next.phase = 'idle';
      next.cameraDetached = false;
      transitionComplete = true;
    }
  }

  return { state: next, phaseChanged, applyLandingDamage, transitionComplete };
}

// ── Proximity ledge-throw check ───────────────────────────────────────────────
export const LEDGE_THROW_PROXIMITY = 1.5; // units from edge to trigger ledge-throw override

/**
 * Check if a throw should be overridden with a ledge-throw.
 * Returns true if attacker is within LEDGE_THROW_PROXIMITY of the ring-out boundary.
 */
export function checkLedgeThrowOverride(
  attackerX: number,
  defenderX: number,
  stageBoundaryX: number,
  ringOutEnabled: boolean,
): boolean {
  if (!ringOutEnabled || !isFinite(stageBoundaryX)) return false;
  // Check if attacker is near the edge and defender is between attacker and edge
  const attackerNearEdge = Math.abs(attackerX) > stageBoundaryX - LEDGE_THROW_PROXIMITY;
  const defenderNearEdge = Math.abs(defenderX) > stageBoundaryX - LEDGE_THROW_PROXIMITY;
  return attackerNearEdge || defenderNearEdge;
}

/**
 * Execute a ledge-throw override.
 * Returns the initial LedgeThrowState.
 */
export function executeLedgeThrow(victim: 'p1' | 'p2'): LedgeThrowState {
  return {
    active: true,
    victim,
    phase: 'startup',
    phaseFrames: 20,
  };
}

export const LEDGE_THROW_STARTUP_FRAMES = 20;
export const LEDGE_THROW_THROW_FRAMES = 30;
export const LEDGE_THROW_FALL_FRAMES = 60;

export function tickLedgeThrow(prev: LedgeThrowState): { state: LedgeThrowState; koVictim: 'p1' | 'p2' | null } {
  if (!prev.active) return { state: prev, koVictim: null };

  let next = { ...prev };
  let koVictim: 'p1' | 'p2' | null = null;

  next.phaseFrames = Math.max(0, next.phaseFrames - 1);
  if (next.phaseFrames === 0) {
    if (next.phase === 'startup') {
      next.phase = 'throw';
      next.phaseFrames = LEDGE_THROW_THROW_FRAMES;
    } else if (next.phase === 'throw') {
      next.phase = 'fall';
      next.phaseFrames = LEDGE_THROW_FALL_FRAMES;
    } else if (next.phase === 'fall') {
      next.phase = 'ko';
      next.phaseFrames = 30;
      koVictim = next.victim;
    } else if (next.phase === 'ko') {
      next.active = false;
      next.phase = 'idle';
      next.victim = null;
    }
  }

  return { state: next, koVictim };
}

// ── Destructible wall break ───────────────────────────────────────────────────
export const WALL_BREAK_FORCE_THRESHOLD = 180; // knockback force needed to break a wall
export const WALL_SHATTER_FRAMES = 45;          // particle shatter duration

/**
 * Check if a wall should break based on knockback force.
 */
export function checkWallBreak(
  knockbackForce: number,
  wall: 'left' | 'right',
  wallState: DestructibleWallState,
  stageHasDestructibleWalls: boolean,
): boolean {
  if (!stageHasDestructibleWalls) return false;
  if (wall === 'left' && !wallState.leftWallIntact) return false;
  if (wall === 'right' && !wallState.rightWallIntact) return false;
  return knockbackForce >= WALL_BREAK_FORCE_THRESHOLD;
}

/**
 * Apply wall break — disable boundary clamp, trigger particle shatter.
 */
export function applyWallBreak(
  wallState: DestructibleWallState,
  wall: 'left' | 'right',
): DestructibleWallState {
  if (wall === 'left') {
    return {
      ...wallState,
      leftWallIntact: false,
      leftShatterActive: true,
      leftShatterFrames: WALL_SHATTER_FRAMES,
    };
  }
  return {
    ...wallState,
    rightWallIntact: false,
    rightShatterActive: true,
    rightShatterFrames: WALL_SHATTER_FRAMES,
  };
}

export function tickDestructibleWalls(prev: DestructibleWallState): DestructibleWallState {
  return {
    ...prev,
    leftShatterFrames: Math.max(0, prev.leftShatterFrames - 1),
    rightShatterFrames: Math.max(0, prev.rightShatterFrames - 1),
    leftShatterActive: prev.leftShatterFrames > 1,
    rightShatterActive: prev.rightShatterFrames > 1,
  };
}

// ── Crowd / fence hazard bounce ───────────────────────────────────────────────
export const HAZARD_BOUNCE_CHIP_DAMAGE = 0.05; // 5% of max HP
export const HAZARD_BOUNCE_FRAMES = 20;         // bounce animation duration
export const HAZARD_VOLUME_THRESHOLD = 0.3;     // how close to boundary triggers hazard

/**
 * Check if a fighter is inside the hazard volume (near stage edge, in knockback).
 */
export function checkHazardVolume(
  fighterX: number,
  stageBoundaryX: number,
  isInKnockback: boolean,
): boolean {
  if (!isInKnockback) return false;
  return Math.abs(fighterX) > stageBoundaryX - HAZARD_VOLUME_THRESHOLD;
}

/**
 * Apply hazard bounce — freeze controls, apply chip damage, shove back to center.
 */
export function applyHazardBounce(
  bounceState: HazardBounceState,
  fighter: 'p1' | 'p2',
  currentX: number,
): HazardBounceState {
  const targetX = fighter === 'p1' ? -1.8 : 1.8;
  if (fighter === 'p1') {
    return {
      ...bounceState,
      p1BounceActive: true,
      p1BounceFrames: HAZARD_BOUNCE_FRAMES,
      p1TargetX: targetX,
    };
  }
  return {
    ...bounceState,
    p2BounceActive: true,
    p2BounceFrames: HAZARD_BOUNCE_FRAMES,
    p2TargetX: targetX,
  };
}

export function tickHazardBounce(prev: HazardBounceState): HazardBounceState {
  return {
    ...prev,
    p1BounceFrames: Math.max(0, prev.p1BounceFrames - 1),
    p2BounceFrames: Math.max(0, prev.p2BounceFrames - 1),
    p1BounceActive: prev.p1BounceFrames > 1,
    p2BounceActive: prev.p2BounceFrames > 1,
  };
}

// ── Full stage manager state ──────────────────────────────────────────────────
export interface StageManagerState {
  stageId: StageId;
  config: StageConfig;
  p1: FighterPersistentState;
  p2: FighterPersistentState;
  floorBreak: FloorBreakState;
  ledgeThrow: LedgeThrowState;
  destructibleWalls: DestructibleWallState;
  hazardBounce: HazardBounceState;
  trainHazard: TrainHazardState;
  /** Whether the stage is currently loading (wipe in progress) */
  isLoading: boolean;
}

const SUBWAY_STAGE_IDS: StageId[] = ['subway']; // extend as needed

export function createStageManagerState(
  stageId: StageId,
  p1MaxHp: number,
  p2MaxHp: number,
): StageManagerState {
  const config = resolveStageConfig(stageId);
  const isSubway = (stageId as string) === 'subway';
  return {
    stageId,
    config,
    p1: createFighterPersistentState('p1', p1MaxHp),
    p2: createFighterPersistentState('p2', p2MaxHp),
    floorBreak: createFloorBreakState(),
    ledgeThrow: createLedgeThrowState(),
    destructibleWalls: createDestructibleWallState(),
    hazardBounce: createHazardBounceState(),
    trainHazard: createTrainHazardState(isSubway),
    isLoading: false,
  };
}

/**
 * Wipe and reload stage — preserves fighter HP and input state.
 * Called when stage ID changes (React unmounts old stage component).
 */
export function wipeAndLoadStage(
  prev: StageManagerState,
  newStageId: StageId,
): StageManagerState {
  const config = resolveStageConfig(newStageId);
  const isSubway = (newStageId as string) === 'subway';

  // Preserve fighter HP and input state — wipe everything else
  return {
    stageId: newStageId,
    config,
    p1: {
      ...prev.p1,
      // Reset position to new stage spawn points
      positionX: -1.8,
      positionY: config.levels[0]?.floorY ?? 0,
      positionZ: 0,
      levelIndex: 0,
      inputEnabled: true,
    },
    p2: {
      ...prev.p2,
      positionX: 1.8,
      positionY: config.levels[0]?.floorY ?? 0,
      positionZ: 0,
      levelIndex: 0,
      inputEnabled: true,
    },
    // Wipe all stage-specific state
    floorBreak: createFloorBreakState(),
    ledgeThrow: createLedgeThrowState(),
    destructibleWalls: createDestructibleWallState(),
    hazardBounce: createHazardBounceState(),
    trainHazard: createTrainHazardState(isSubway),
    isLoading: false,
  };
}
