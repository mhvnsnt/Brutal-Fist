/**
 * StageConfig — defines all combat-relevant properties for each arena.
 * Consumed by GameBattleArena to reset state on stage load and by
 * CombatStateTick to enforce boundary / ring-out / floor-break rules.
 */

export type StageId =
  | 'urban_night' |'training' |'dojo' |'wrestling_ring' |'mma_octagon' |'steel_cage' |'industrial' |'ghetto_streets' |'junkyard' |'sky_crane' |'spike_pit' |'acid_pit' |'grinder_pit' |'gang_brawl' |'subway' |'random';

/** Whether a stage has a destructible wall (glass, cage door, etc.) */
export type WallType = 'solid' | 'destructible' | 'none';

/** Hazard volume definition for crowd/fence bounce zones */
export interface HazardVolume {
  /** X distance from center where hazard volume begins */
  triggerX: number;
  /** Chip damage as fraction of max HP (0.05 = 5%) */
  chipDamage: number;
  /** Label for HUD */
  label: string;
}

export interface LevelZone {
  /** Y-world position of this floor */
  floorY: number;
  /** X boundary half-width (Infinity = no wall / ring-out enabled) */
  boundaryX: number;
  /** Z boundary half-depth */
  boundaryZ: number;
  /** Damage dealt per second when standing on hazard floor (0 = safe) */
  hazardDamagePerSec: number;
  /** Label shown in HUD when fighter is on this level */
  label: string;
}

export interface StageConfig {
  id: StageId;
  /** Display name */
  name: string;
  /** Subtitle / location flavour text */
  subtitle: string;
  /** Accent / theme colour (hex) */
  accentColor: string;
  /** Background fill colour for thumbnails */
  bgColor: string;

  // ── Boundary rules ────────────────────────────────────────────────────────
  /** If true, walking off the X boundary causes a ring-out KO */
  ringOutEnabled: boolean;
  /** Half-width of the main floor in world units (Infinity = open street) */
  boundaryX: number;
  /** Half-depth of the main floor in world units */
  boundaryZ: number;

  // ── Multi-level / breakable floor ─────────────────────────────────────────
  /** Ordered array of floor levels (index 0 = top/main, last = lowest pit) */
  levels: LevelZone[];
  /**
   * If true, a hard slam / ground-pound sends the opponent crashing through
   * the current floor to the next level down (Tekken-style stage transition).
   */
  breakableFloor: boolean;
  /**
   * Minimum damage of a single hit required to trigger a floor break.
   * 0 = any slam/knockdown can break through.
   */
  floorBreakThreshold: number;

  // ── Lighting preset ───────────────────────────────────────────────────────
  /** Ambient light intensity (0–1) */
  ambientIntensity: number;
  /** Ambient light colour */
  ambientColor: string;
  /** Primary directional light colour */
  primaryLightColor: string;
  /** Secondary fill light colour */
  fillLightColor: string;

  // ── Audio ─────────────────────────────────────────────────────────────────
  /** BGM track key (maps to public/audio/bgm/<bgmTrack>.mp3) */
  bgmTrack: string;

  // ── Hazard / environment ──────────────────────────────────────────────────
  /** Damage per second from environmental hazard (spikes, acid, grinder) */
  hazardDamagePerSec: number;
  /** Short description of the hazard shown in HUD */
  hazardLabel: string;

  // ── Wall-splat rules ──────────────────────────────────────────────────────
  /** If false (cage/ring), walls exist but no ring-out — wall splats still apply */
  hasWalls: boolean;

  // ── Destructible walls ────────────────────────────────────────────────────
  /** Whether stage walls can be broken through with high knockback force */
  hasDestructibleWalls: boolean;

  // ── Crowd / fence hazard volume ───────────────────────────────────────────
  /** If defined, fighters knocked near the edge get bounced back with chip damage */
  hazardVolume?: HazardVolume;

  // ── Train hazard (Subway stage) ───────────────────────────────────────────
  /** Whether this stage has an independent RNG train hazard */
  hasTrainHazard: boolean;

  // ── Edge zone for proximity ledge-throw overrides ─────────────────────────
  /** Distance from boundary where ledge-throw override activates */
  edgeZoneDistance: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stage catalogue
// ─────────────────────────────────────────────────────────────────────────────

export const STAGE_CONFIGS: Record<Exclude<StageId, 'random'>, StageConfig> = {
  urban_night: {
    id: 'urban_night',
    name: 'URBAN NIGHT',
    subtitle: 'UNDERGROUND DISTRICT',
    accentColor: '#a855f7',
    bgColor: '#0d0014',
    ringOutEnabled: false,
    boundaryX: 4.5,
    boundaryZ: 3.0,
    levels: [{ floorY: 0, boundaryX: 4.5, boundaryZ: 3.0, hazardDamagePerSec: 0, label: 'STREET' }],
    breakableFloor: false,
    floorBreakThreshold: 0,
    ambientIntensity: 0.25,
    ambientColor: '#1a0030',
    primaryLightColor: '#c084fc',
    fillLightColor: '#3b0764',
    bgmTrack: 'urban_night',
    hazardDamagePerSec: 0,
    hazardLabel: '',
    hasWalls: true,
    hasDestructibleWalls: false,
    hazardVolume: undefined,
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  training: {
    id: 'training',
    name: 'TRAINING GRID',
    subtitle: 'VOID ARENA',
    accentColor: '#22d3ee',
    bgColor: '#001418',
    ringOutEnabled: false,
    boundaryX: 4.5,
    boundaryZ: 3.0,
    levels: [{ floorY: 0, boundaryX: 4.5, boundaryZ: 3.0, hazardDamagePerSec: 0, label: 'GRID' }],
    breakableFloor: false,
    floorBreakThreshold: 0,
    ambientIntensity: 0.35,
    ambientColor: '#c8d0e0',
    primaryLightColor: '#fff8f0',
    fillLightColor: '#a0b8ff',
    bgmTrack: 'training',
    hazardDamagePerSec: 0,
    hazardLabel: '',
    hasWalls: true,
    hasDestructibleWalls: false,
    hazardVolume: undefined,
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  dojo: {
    id: 'dojo',
    name: 'DOJO',
    subtitle: 'ANCIENT TRAINING HALL',
    accentColor: '#f97316',
    bgColor: '#1a0800',
    ringOutEnabled: false,
    boundaryX: 4.0,
    boundaryZ: 3.0,
    levels: [
      { floorY: 0, boundaryX: 4.0, boundaryZ: 3.0, hazardDamagePerSec: 0, label: 'DOJO FLOOR' },
      { floorY: -3.5, boundaryX: 5.0, boundaryZ: 4.0, hazardDamagePerSec: 0, label: 'LOWER DOJO' },
    ],
    breakableFloor: true,
    floorBreakThreshold: 60,
    ambientIntensity: 0.3,
    ambientColor: '#3d1a00',
    primaryLightColor: '#fbbf24',
    fillLightColor: '#7c2d12',
    bgmTrack: 'dojo',
    hazardDamagePerSec: 0,
    hazardLabel: '',
    hasWalls: true,
    hasDestructibleWalls: true,
    hazardVolume: undefined,
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  wrestling_ring: {
    id: 'wrestling_ring',
    name: 'WRESTLING RING',
    subtitle: 'THE SQUARED CIRCLE',
    accentColor: '#ef4444',
    bgColor: '#1a0000',
    ringOutEnabled: true,
    boundaryX: 3.8,
    boundaryZ: 3.8,
    levels: [{ floorY: 0, boundaryX: 3.8, boundaryZ: 3.8, hazardDamagePerSec: 0, label: 'RING' }],
    breakableFloor: false,
    floorBreakThreshold: 0,
    ambientIntensity: 0.2,
    ambientColor: '#1a0000',
    primaryLightColor: '#ffffff',
    fillLightColor: '#fca5a5',
    bgmTrack: 'wrestling_ring',
    hazardDamagePerSec: 0,
    hazardLabel: '',
    hasWalls: false,
    hasDestructibleWalls: false,
    hazardVolume: { triggerX: 3.5, chipDamage: 0.05, label: 'CROWD SHOVE' },
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  mma_octagon: {
    id: 'mma_octagon',
    name: 'MMA OCTAGON',
    subtitle: 'THE CAGE',
    accentColor: '#facc15',
    bgColor: '#0f0f00',
    ringOutEnabled: false,
    boundaryX: 4.2,
    boundaryZ: 4.2,
    levels: [{ floorY: 0, boundaryX: 4.2, boundaryZ: 4.2, hazardDamagePerSec: 0, label: 'OCTAGON' }],
    breakableFloor: false,
    floorBreakThreshold: 0,
    ambientIntensity: 0.3,
    ambientColor: '#1a1a00',
    primaryLightColor: '#fef08a',
    fillLightColor: '#713f12',
    bgmTrack: 'mma_octagon',
    hazardDamagePerSec: 0,
    hazardLabel: '',
    hasWalls: true,
    hasDestructibleWalls: false,
    hazardVolume: undefined,
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  steel_cage: {
    id: 'steel_cage',
    name: 'STEEL CAGE',
    subtitle: 'NO ESCAPE',
    accentColor: '#94a3b8',
    bgColor: '#0a0a0a',
    ringOutEnabled: false,
    boundaryX: 4.0,
    boundaryZ: 4.0,
    levels: [{ floorY: 0, boundaryX: 4.0, boundaryZ: 4.0, hazardDamagePerSec: 0, label: 'CAGE' }],
    breakableFloor: false,
    floorBreakThreshold: 0,
    ambientIntensity: 0.15,
    ambientColor: '#0f172a',
    primaryLightColor: '#cbd5e1',
    fillLightColor: '#334155',
    bgmTrack: 'steel_cage',
    hazardDamagePerSec: 0,
    hazardLabel: '',
    hasWalls: true,
    hasDestructibleWalls: false,
    hazardVolume: undefined,
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  industrial: {
    id: 'industrial',
    name: 'INDUSTRIAL',
    subtitle: 'FACTORY FLOOR',
    accentColor: '#f59e0b',
    bgColor: '#0f0800',
    ringOutEnabled: false,
    boundaryX: 5.0,
    boundaryZ: 3.5,
    levels: [
      { floorY: 0, boundaryX: 5.0, boundaryZ: 3.5, hazardDamagePerSec: 0, label: 'UPPER PLATFORM' },
      { floorY: -4.0, boundaryX: 6.0, boundaryZ: 4.5, hazardDamagePerSec: 5, label: 'FACTORY FLOOR' },
    ],
    breakableFloor: true,
    floorBreakThreshold: 50,
    ambientIntensity: 0.2,
    ambientColor: '#1c0f00',
    primaryLightColor: '#fbbf24',
    fillLightColor: '#92400e',
    bgmTrack: 'industrial',
    hazardDamagePerSec: 5,
    hazardLabel: 'MOLTEN METAL',
    hasWalls: true,
    hasDestructibleWalls: true,
    hazardVolume: undefined,
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  ghetto_streets: {
    id: 'ghetto_streets',
    name: 'GHETTO STREETS',
    subtitle: 'BACK ALLEY BRAWL',
    accentColor: '#84cc16',
    bgColor: '#0a0f00',
    ringOutEnabled: true,
    boundaryX: Infinity,
    boundaryZ: Infinity,
    levels: [{ floorY: 0, boundaryX: Infinity, boundaryZ: Infinity, hazardDamagePerSec: 0, label: 'STREETS' }],
    breakableFloor: false,
    floorBreakThreshold: 0,
    ambientIntensity: 0.2,
    ambientColor: '#0f1a00',
    primaryLightColor: '#bef264',
    fillLightColor: '#365314',
    bgmTrack: 'ghetto_streets',
    hazardDamagePerSec: 0,
    hazardLabel: '',
    hasWalls: false,
    hasDestructibleWalls: false,
    hazardVolume: { triggerX: 8.0, chipDamage: 0.05, label: 'CROWD SHOVE' },
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  junkyard: {
    id: 'junkyard',
    name: 'JUNKYARD',
    subtitle: 'SCRAP METAL GRAVEYARD',
    accentColor: '#78716c',
    bgColor: '#0c0a08',
    ringOutEnabled: true,
    boundaryX: Infinity,
    boundaryZ: Infinity,
    levels: [
      { floorY: 0, boundaryX: Infinity, boundaryZ: Infinity, hazardDamagePerSec: 0, label: 'JUNK PILE' },
      { floorY: -3.0, boundaryX: Infinity, boundaryZ: Infinity, hazardDamagePerSec: 0, label: 'LOWER YARD' },
    ],
    breakableFloor: true,
    floorBreakThreshold: 55,
    ambientIntensity: 0.15,
    ambientColor: '#1c1a18',
    primaryLightColor: '#d6d3d1',
    fillLightColor: '#44403c',
    bgmTrack: 'junkyard',
    hazardDamagePerSec: 0,
    hazardLabel: '',
    hasWalls: false,
    hasDestructibleWalls: false,
    hazardVolume: undefined,
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  sky_crane: {
    id: 'sky_crane',
    name: 'SKY CRANE',
    subtitle: 'HIGH ALTITUDE PLATFORM',
    accentColor: '#38bdf8',
    bgColor: '#00080f',
    ringOutEnabled: true,
    boundaryX: 3.0,
    boundaryZ: 2.5,
    levels: [
      { floorY: 0, boundaryX: 3.0, boundaryZ: 2.5, hazardDamagePerSec: 0, label: 'CRANE TOP' },
      { floorY: -6.0, boundaryX: 4.0, boundaryZ: 3.5, hazardDamagePerSec: 0, label: 'LOWER PLATFORM' },
    ],
    breakableFloor: true,
    floorBreakThreshold: 45,
    ambientIntensity: 0.4,
    ambientColor: '#082f49',
    primaryLightColor: '#7dd3fc',
    fillLightColor: '#0c4a6e',
    bgmTrack: 'sky_crane',
    hazardDamagePerSec: 0,
    hazardLabel: '',
    hasWalls: false,
    hasDestructibleWalls: false,
    hazardVolume: undefined,
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  spike_pit: {
    id: 'spike_pit',
    name: 'SPIKE PIT',
    subtitle: 'MORTAL HAZARD',
    accentColor: '#dc2626',
    bgColor: '#0f0000',
    ringOutEnabled: false,
    boundaryX: 4.5,
    boundaryZ: 3.0,
    levels: [
      { floorY: 0, boundaryX: 4.5, boundaryZ: 3.0, hazardDamagePerSec: 0, label: 'UPPER LEDGE' },
      { floorY: -4.0, boundaryX: 4.5, boundaryZ: 3.0, hazardDamagePerSec: 30, label: 'SPIKE PIT' },
    ],
    breakableFloor: true,
    floorBreakThreshold: 40,
    ambientIntensity: 0.1,
    ambientColor: '#1a0000',
    primaryLightColor: '#ef4444',
    fillLightColor: '#7f1d1d',
    bgmTrack: 'spike_pit',
    hazardDamagePerSec: 30,
    hazardLabel: '⚠ SPIKE PIT',
    hasWalls: true,
    hasDestructibleWalls: false,
    hazardVolume: undefined,
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  acid_pit: {
    id: 'acid_pit',
    name: 'ACID PIT',
    subtitle: 'CORROSIVE DEPTHS',
    accentColor: '#a3e635',
    bgColor: '#030f00',
    ringOutEnabled: false,
    boundaryX: 4.5,
    boundaryZ: 3.0,
    levels: [
      { floorY: 0, boundaryX: 4.5, boundaryZ: 3.0, hazardDamagePerSec: 0, label: 'BRIDGE' },
      { floorY: -3.5, boundaryX: 4.5, boundaryZ: 3.0, hazardDamagePerSec: 25, label: 'ACID POOL' },
    ],
    breakableFloor: true,
    floorBreakThreshold: 40,
    ambientIntensity: 0.15,
    ambientColor: '#052e16',
    primaryLightColor: '#86efac',
    fillLightColor: '#14532d',
    bgmTrack: 'acid_pit',
    hazardDamagePerSec: 25,
    hazardLabel: '☣ ACID PIT',
    hasWalls: true,
    hasDestructibleWalls: false,
    hazardVolume: undefined,
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  grinder_pit: {
    id: 'grinder_pit',
    name: 'GRINDER PIT',
    subtitle: 'INDUSTRIAL DEATH TRAP',
    accentColor: '#f97316',
    bgColor: '#0f0500',
    ringOutEnabled: false,
    boundaryX: 4.5,
    boundaryZ: 3.0,
    levels: [
      { floorY: 0, boundaryX: 4.5, boundaryZ: 3.0, hazardDamagePerSec: 0, label: 'CATWALK' },
      { floorY: -4.5, boundaryX: 4.5, boundaryZ: 3.0, hazardDamagePerSec: 40, label: 'GRINDER' },
    ],
    breakableFloor: true,
    floorBreakThreshold: 35,
    ambientIntensity: 0.1,
    ambientColor: '#1c0a00',
    primaryLightColor: '#fb923c',
    fillLightColor: '#7c2d12',
    bgmTrack: 'grinder_pit',
    hazardDamagePerSec: 40,
    hazardLabel: '⚙ GRINDER',
    hasWalls: true,
    hasDestructibleWalls: false,
    hazardVolume: undefined,
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  gang_brawl: {
    id: 'gang_brawl',
    name: 'GANG BRAWL',
    subtitle: 'NO RULES — NO WALLS',
    accentColor: '#e879f9',
    bgColor: '#0f0014',
    ringOutEnabled: true,
    boundaryX: Infinity,
    boundaryZ: Infinity,
    levels: [
      { floorY: 0, boundaryX: Infinity, boundaryZ: Infinity, hazardDamagePerSec: 0, label: 'STREET LEVEL' },
      { floorY: -3.0, boundaryX: Infinity, boundaryZ: Infinity, hazardDamagePerSec: 0, label: 'LOWER ALLEY' },
    ],
    breakableFloor: true,
    floorBreakThreshold: 50,
    ambientIntensity: 0.2,
    ambientColor: '#1a0020',
    primaryLightColor: '#e879f9',
    fillLightColor: '#701a75',
    bgmTrack: 'gang_brawl',
    hazardDamagePerSec: 0,
    hazardLabel: '',
    hasWalls: false,
    hasDestructibleWalls: false,
    hazardVolume: { triggerX: 8.0, chipDamage: 0.05, label: 'CROWD SHOVE' },
    hasTrainHazard: false,
    edgeZoneDistance: 1.5,
  },

  subway: {
    id: 'subway' as StageId,
    name: 'SUBWAY',
    subtitle: 'UNDERGROUND TRANSIT — WATCH THE TRACKS',
    accentColor: '#f59e0b',
    bgColor: '#0a0800',
    ringOutEnabled: false,
    boundaryX: 4.5,
    boundaryZ: 3.0,
    levels: [
      { floorY: 0, boundaryX: 4.5, boundaryZ: 3.0, hazardDamagePerSec: 0, label: 'PLATFORM' },
      { floorY: -1.5, boundaryX: 4.5, boundaryZ: 3.0, hazardDamagePerSec: 0, label: 'TRACKS' },
    ],
    breakableFloor: false,
    floorBreakThreshold: 0,
    ambientIntensity: 0.15,
    ambientColor: '#1a1200',
    primaryLightColor: '#fbbf24',
    fillLightColor: '#78350f',
    bgmTrack: 'subway',
    hazardDamagePerSec: 0,
    hazardLabel: '🚇 TRAIN INCOMING',
    hasWalls: true,
    hasDestructibleWalls: false,
    hazardVolume: undefined,
    hasTrainHazard: true,
    edgeZoneDistance: 1.5,
  },
};

/** Resolve a StageId (including 'random') to a concrete StageConfig */
export function resolveStageConfig(id: StageId): StageConfig {
  if (id === 'random') {
    const real = Object.keys(STAGE_CONFIGS).filter(k => k !== 'random') as Exclude<StageId, 'random'>[];
    const pick = real[Math.floor(Math.random() * real.length)];
    return STAGE_CONFIGS[pick];
  }
  return STAGE_CONFIGS[id] ?? STAGE_CONFIGS['urban_night'];
}

// ── Arena combat state (reset on every stage load) ────────────────────────────

export interface ArenaCombatState {
  stageId: StageId;
  config: StageConfig;
  /** Current level index for each fighter (0 = top floor) */
  p1LevelIndex: number;
  p2LevelIndex: number;
  /** Whether each fighter is currently in a hazard zone */
  p1InHazard: boolean;
  p2InHazard: boolean;
  /** Ring-out KO flags */
  p1RingOut: boolean;
  p2RingOut: boolean;
  /** Floor-break animation pending */
  p1FloorBreakPending: boolean;
  p2FloorBreakPending: boolean;
}

export function createArenaCombatState(stageId: StageId): ArenaCombatState {
  const config = resolveStageConfig(stageId);
  return {
    stageId,
    config,
    p1LevelIndex: 0,
    p2LevelIndex: 0,
    p1InHazard: false,
    p2InHazard: false,
    p1RingOut: false,
    p2RingOut: false,
    p1FloorBreakPending: false,
    p2FloorBreakPending: false,
  };
}

/**
 * Tick arena state — call once per combat frame.
 * Returns updated state (pure function, no mutation).
 */
export function tickArenaState(
  prev: ArenaCombatState,
  p1X: number,
  p2X: number,
  p1HitDamage: number,
  p2HitDamage: number,
  p1Slammed: boolean,
  p2Slammed: boolean,
): ArenaCombatState {
  const cfg = prev.config;
  let next = { ...prev };

  // ── Ring-out detection ────────────────────────────────────────────────────
  if (cfg.ringOutEnabled && isFinite(cfg.boundaryX)) {
    if (!next.p1RingOut && Math.abs(p1X) > cfg.boundaryX) next.p1RingOut = true;
    if (!next.p2RingOut && Math.abs(p2X) > cfg.boundaryX) next.p2RingOut = true;
  }

  // ── Floor-break detection ─────────────────────────────────────────────────
  if (cfg.breakableFloor) {
    const maxLevel = cfg.levels.length - 1;

    if (p1Slammed && p1HitDamage >= cfg.floorBreakThreshold && next.p1LevelIndex < maxLevel) {
      next.p1FloorBreakPending = true;
      next.p1LevelIndex = next.p1LevelIndex + 1;
    }
    if (p2Slammed && p2HitDamage >= cfg.floorBreakThreshold && next.p2LevelIndex < maxLevel) {
      next.p2FloorBreakPending = true;
      next.p2LevelIndex = next.p2LevelIndex + 1;
    }
  }

  // ── Hazard detection ──────────────────────────────────────────────────────
  const p1Level = cfg.levels[next.p1LevelIndex];
  const p2Level = cfg.levels[next.p2LevelIndex];
  next.p1InHazard = (p1Level?.hazardDamagePerSec ?? 0) > 0;
  next.p2InHazard = (p2Level?.hazardDamagePerSec ?? 0) > 0;

  return next;
}
