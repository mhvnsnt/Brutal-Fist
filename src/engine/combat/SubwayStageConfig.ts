import type { StageConfig } from './StageConfig';
import { DEFAULT_SUBWAY_HAZARD } from './SubwayHazardSystem';

/**
 * Subway stage definition layered onto the existing StageConfig architecture.
 * The train hazard is independent from fighter actions; tracks are playable.
 */
export const SUBWAY_STAGE_RULES = {
  stageId: 'subway',
  mainFloorY: DEFAULT_SUBWAY_HAZARD.mainFloorY,
  trackFloorY: DEFAULT_SUBWAY_HAZARD.trackFloorY,
  trackHalfWidth: DEFAULT_SUBWAY_HAZARD.trackHalfWidth,
  ringOutFromPlatform: true,
  playableLowerTier: true,
  vaultEnabled: true,
  trainHazard: DEFAULT_SUBWAY_HAZARD,
} as const;

/** Adapter for systems that already consume StageConfig. */
export function createSubwayStageConfig(base: StageConfig): StageConfig {
  return {
    ...base,
    levels: [
      {
        floorY: SUBWAY_STAGE_RULES.mainFloorY,
        boundaryX: base.boundaryX,
        boundaryZ: base.boundaryZ,
        hazardDamagePerSec: 0,
        label: 'SUBWAY PLATFORM',
      },
      {
        floorY: SUBWAY_STAGE_RULES.trackFloorY,
        boundaryX: SUBWAY_STAGE_RULES.trackHalfWidth,
        boundaryZ: base.boundaryZ,
        hazardDamagePerSec: 0,
        label: 'TRACKS',
      },
    ],
    breakableFloor: false,
    floorBreakThreshold: 0,
    ringOutEnabled: true,
    hasWalls: false,
    hazardDamagePerSec: 0,
    hazardLabel: 'TRAIN HAZARD',
  };
}
