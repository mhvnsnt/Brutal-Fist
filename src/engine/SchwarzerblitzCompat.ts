import type { FighterAnimation, FighterState, FrameData, InputBitmask } from '../types';
import { SCHWARZERBLITZ_RUNTIME_MANIFEST } from './SchwarzerblitzRuntimeManifest';
import { BANNON_COMBAT_CONTRACT } from './BannonCombatContract';
import { GrappleSystem } from './GrappleSystem';

export interface SchwarzerblitzFighterSnapshot {
  x: number;
  z: number;
  health: number;
  facing: 1 | -1;
  state: FighterState;
  stateFrameCounter: number;
  animation: FighterAnimation;
  move: FrameData | null;
}

export interface SchwarzerblitzMatchSnapshot {
  frame: number;
  p1: SchwarzerblitzFighterSnapshot;
  p2: SchwarzerblitzFighterSnapshot;
}

export interface SchwarzerblitzRuntime {
  tick(input: InputBitmask): SchwarzerblitzMatchSnapshot;
  getSnapshot(): SchwarzerblitzMatchSnapshot;
}

/**
 * Explicit browser/native boundary.
 * React remains presentation-only; shared combat contracts are data/system
 * boundaries that can be implemented by the native Schwarzerblitz runtime.
 */
export const SCHWARZERBLITZ_ENGINE_CONTRACT = {
  ...SCHWARZERBLITZ_RUNTIME_MANIFEST,
  coordinateSystem: 'x-fighting-lane/z-sidestep-lane',
  browserRenderer: 'threejs',
  nativeRenderer: 'schwarzerlicht/irrlicht',
  simulationAuthority: 'fixed-60hz',
  reactRole: 'presentation-only',
  combat: BANNON_COMBAT_CONTRACT,
  grapple: {
    implementation: GrappleSystem.name,
    pinVerification: 'physical-shoulder-distance-and-ring-mat-contact'
  }
} as const;
