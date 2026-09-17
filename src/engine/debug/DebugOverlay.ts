/**
 * DebugOverlay — frame-data visualization types and utilities.
 * Used in practice mode only to verify hitbox/frame-data accuracy.
 */

export interface DebugOverlaySettings {
  enabled: boolean;
  showP1: boolean;
  showP2: boolean;
  showFrameWindows: boolean;
  showAABB: boolean;
  showImpactMarkers: boolean;
  /** Show GLB rigging state: active clip, frame number, playback speed */
  showRigState: boolean;
  /** Show per-region hurtbox overlay (head, torso, limbs) */
  showHurtboxRegions: boolean;
}

export const DEFAULT_DEBUG_SETTINGS: DebugOverlaySettings = {
  enabled: false,
  showP1: true,
  showP2: true,
  showFrameWindows: true,
  showAABB: true,
  showImpactMarkers: true,
  showRigState: true,
  showHurtboxRegions: true,
};

/** Frame phase for color coding */
export type FramePhase = 'startup' | 'active' | 'recovery' | 'idle';

export interface FrameWindowData {
  phase: FramePhase;
  currentFrame: number;
  totalFrames: number;
  startupFrames: number;
  activeFrames: number;
  recoveryFrames: number;
  /** 0–1 progress through current phase */
  phaseProgress: number;
}

export interface AABBData {
  /** World-space center X */
  centerX: number;
  /** World-space center Z */
  centerZ: number;
  width: number;
  depth: number;
  isActive: boolean;
}

export interface ImpactMarker {
  id: number;
  x: number;
  y: number;
  frame: number;
  timestamp: number;
  damage: number;
  isBlocked: boolean;
}

/** GLB rig state for verifying animation clip and timing */
export interface RigStateData {
  /** Active animation clip name (e.g. "idle", "lightAttack") */
  activeClip: string;
  /** Current frame within the clip (0-based) */
  clipFrame: number;
  /** Total frames in the clip */
  clipTotalFrames: number;
  /** Playback speed multiplier (1.0 = normal) */
  playbackSpeed: number;
  /** Whether the clip is currently crossfading */
  isCrossfading: boolean;
  /** Crossfade progress 0–1 */
  crossfadeProgress: number;
  fromClip?: string;
  toClip?: string;
}

/** Per-region hurtbox data for collision visualization */
export interface HurtboxRegion {
  region: 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
  /** Screen-space Y offset from fighter center (0=center, negative=up) */
  yOffset: number;
  /** Screen-space height as % of fighter height */
  height: number;
  /** Whether this region was hit this frame */
  wasHit: boolean;
  /** Damage multiplier for hits to this region */
  damageMultiplier: number;
}

export const DEFAULT_HURTBOX_REGIONS: HurtboxRegion[] = [
  { region: 'head',     yOffset: -0.75, height: 0.18, wasHit: false, damageMultiplier: 1.5 },
  { region: 'torso',    yOffset: -0.30, height: 0.35, wasHit: false, damageMultiplier: 1.0 },
  { region: 'leftArm',  yOffset: -0.25, height: 0.30, wasHit: false, damageMultiplier: 0.8 },
  { region: 'rightArm', yOffset: -0.25, height: 0.30, wasHit: false, damageMultiplier: 0.8 },
  { region: 'leftLeg',  yOffset:  0.25, height: 0.35, wasHit: false, damageMultiplier: 0.7 },
  { region: 'rightLeg', yOffset:  0.25, height: 0.35, wasHit: false, damageMultiplier: 0.7 },
];

export interface FighterDebugData {
  player: 'p1' | 'p2';
  frameWindow: FrameWindowData | null;
  aabb: AABBData | null;
  impactMarkers: ImpactMarker[];
  actionState: string;
  /** GLB rig state for animation verification */
  rigState?: RigStateData;
  /** Per-region hurtbox state */
  hurtboxRegions?: HurtboxRegion[];
}

/** Compute frame window data from state machine hitbox window */
export function computeFrameWindowData(
  hitboxWindow: {
    active: boolean;
    currentFrame: number;
    move: {
      startup: number;
      active: number;
      recovery: number;
      hitboxStartFrame?: number;
      hitboxEndFrame?: number;
      totalFrames?: number;
    } | null;
  },
  actionState: string,
): FrameWindowData | null {
  if (!hitboxWindow.move) return null;

  const FPS = 60;
  const move = hitboxWindow.move;
  const totalFrames = move.totalFrames ?? Math.round((move.startup + move.active + move.recovery) * FPS);
  const startupFrames = Math.round(move.startup * FPS);
  const activeFrames = Math.round(move.active * FPS);
  const recoveryFrames = totalFrames - startupFrames - activeFrames;
  const currentFrame = hitboxWindow.currentFrame;

  let phase: FramePhase = 'idle';
  let phaseProgress = 0;

  if (actionState === 'Attacking' || actionState === 'Startup' || actionState === 'Active') {
    if (currentFrame < startupFrames) {
      phase = 'startup';
      phaseProgress = currentFrame / Math.max(1, startupFrames);
    } else if (currentFrame < startupFrames + activeFrames) {
      phase = 'active';
      phaseProgress = (currentFrame - startupFrames) / Math.max(1, activeFrames);
    } else {
      phase = 'recovery';
      phaseProgress = (currentFrame - startupFrames - activeFrames) / Math.max(1, recoveryFrames);
    }
  }

  return {
    phase,
    currentFrame,
    totalFrames,
    startupFrames,
    activeFrames,
    recoveryFrames,
    phaseProgress: Math.min(1, Math.max(0, phaseProgress)),
  };
}

/** Build rig state data from animation clip name and elapsed time */
export function computeRigState(
  activeClip: string,
  elapsedSeconds: number,
  totalDurationSeconds: number,
  playbackSpeed = 1.0,
  isCrossfading = false,
  crossfadeProgress = 0,
): RigStateData {
  const FPS = 60;
  const clipTotalFrames = Math.max(1, Math.round(totalDurationSeconds * FPS));
  const clipFrame = Math.min(clipTotalFrames - 1, Math.round(elapsedSeconds * FPS * playbackSpeed));
  return {
    activeClip,
    clipFrame,
    clipTotalFrames,
    playbackSpeed,
    isCrossfading,
    crossfadeProgress: Math.min(1, Math.max(0, crossfadeProgress)),
  };
}

/** Get CSS color for frame phase */
export function getPhaseColor(phase: FramePhase): string {
  switch (phase) {
    case 'startup':  return '#facc15'; // yellow
    case 'active':   return '#22c55e'; // green — hitbox live
    case 'recovery': return '#ef4444'; // red — vulnerable
    case 'idle':     return '#52525b'; // gray
  }
}

/** Get CSS color label for phase */
export function getPhaseName(phase: FramePhase): string {
  switch (phase) {
    case 'startup':  return 'STARTUP';
    case 'active':   return 'ACTIVE';
    case 'recovery': return 'RECOVERY';
    case 'idle':     return 'IDLE';
  }
}

/** Get color for hurtbox region */
export function getRegionColor(region: HurtboxRegion['region'], wasHit: boolean): string {
  if (wasHit) return '#ef4444';
  switch (region) {
    case 'head':     return '#a78bfa';
    case 'torso':    return '#60a5fa';
    case 'leftArm': case'rightArm': return '#34d399';
    case 'leftLeg': case'rightLeg': return '#fbbf24';
  }
}
