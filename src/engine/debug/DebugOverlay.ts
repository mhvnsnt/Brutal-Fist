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
}

export const DEFAULT_DEBUG_SETTINGS: DebugOverlaySettings = {
  enabled: false,
  showP1: true,
  showP2: true,
  showFrameWindows: true,
  showAABB: true,
  showImpactMarkers: true,
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

export interface FighterDebugData {
  player: 'p1' | 'p2';
  frameWindow: FrameWindowData | null;
  aabb: AABBData | null;
  impactMarkers: ImpactMarker[];
  actionState: string;
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
