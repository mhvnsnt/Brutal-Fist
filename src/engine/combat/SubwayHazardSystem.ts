/**
 * SubwayHazardSystem
 *
 * MDickie-style environmental hazard: the train runs independently of the
 * fighters. Falling to the tracks does NOT start a countdown and does NOT
 * create a QTE. The track area remains a playable lower tier.
 */

export interface SubwayHazardConfig {
  minIntervalSec: number;
  maxIntervalSec: number;
  warningSec: number;
  crossingSec: number;
  trackFloorY: number;
  mainFloorY: number;
  trackHalfWidth: number;
  trainDamage: number;
}

export interface FighterHazardPosition {
  x: number;
  y: number;
  z: number;
}

export type SubwayPhase = 'idle' | 'warning' | 'crossing';

export interface SubwayHazardState {
  phase: SubwayPhase;
  elapsed: number;
  nextTriggerSec: number;
  cycle: number;
}

export const DEFAULT_SUBWAY_HAZARD: SubwayHazardConfig = {
  minIntervalSec: 10,
  maxIntervalSec: 25,
  warningSec: 2,
  crossingSec: 1,
  trackFloorY: -1.5,
  mainFloorY: 0,
  trackHalfWidth: 4.5,
  trainDamage: 40,
};

function randomInterval(config: SubwayHazardConfig, rng: () => number): number {
  return config.minIntervalSec + (config.maxIntervalSec - config.minIntervalSec) * rng();
}

export function createSubwayHazardState(
  config: SubwayHazardConfig = DEFAULT_SUBWAY_HAZARD,
  rng: () => number = Math.random,
): SubwayHazardState {
  return {
    phase: 'idle',
    elapsed: 0,
    nextTriggerSec: randomInterval(config, rng),
    cycle: 0,
  };
}

export function isOnTracks(
  fighter: FighterHazardPosition,
  config: SubwayHazardConfig = DEFAULT_SUBWAY_HAZARD,
): boolean {
  return fighter.y <= config.trackFloorY + 0.45 && Math.abs(fighter.x) <= config.trackHalfWidth;
}

/**
 * Advance the independent train schedule. Player state is deliberately not an
 * input: the train timing cannot be manipulated by falling onto the tracks.
 */
export function tickSubwayHazard(
  state: SubwayHazardState,
  dt: number,
  config: SubwayHazardConfig = DEFAULT_SUBWAY_HAZARD,
  rng: () => number = Math.random,
): SubwayHazardState {
  let next = { ...state, elapsed: state.elapsed + Math.max(0, dt) };

  if (state.phase === 'idle' && next.elapsed >= state.nextTriggerSec - config.warningSec) {
    next.phase = 'warning';
  }

  if (state.phase === 'warning' && next.elapsed >= state.nextTriggerSec) {
    next.phase = 'crossing';
  }

  if (state.phase === 'crossing' && next.elapsed >= state.nextTriggerSec + config.crossingSec) {
    next = {
      phase: 'idle',
      elapsed: 0,
      nextTriggerSec: randomInterval(config, rng),
      cycle: state.cycle + 1,
    };
  }

  return next;
}

export function trainCanHit(fighter: FighterHazardPosition, state: SubwayHazardState, config: SubwayHazardConfig = DEFAULT_SUBWAY_HAZARD): boolean {
  return state.phase === 'crossing' && isOnTracks(fighter, config);
}

export function vaultFromTracks(
  fighter: FighterHazardPosition,
  config: SubwayHazardConfig = DEFAULT_SUBWAY_HAZARD,
): FighterHazardPosition {
  if (!isOnTracks(fighter, config)) return fighter;
  return { ...fighter, y: config.mainFloorY };
}
