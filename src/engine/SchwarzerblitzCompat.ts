import type { FighterState, InputBitmask } from '../types';

/**
 * Browser-side compatibility boundary for Brutal Fist.
 *
 * The authoritative native Schwarzerblitz engine remains in the
 * SchwarzerblitzEngine submodule. This boundary keeps the browser build's
 * fixed-tick game state independent from React so the same state contract can
 * be driven by a future native/WASM engine adapter without rewriting combat.
 */
export interface SchwarzerblitzFighterSnapshot {
  x: number;
  z: number;
  health: number;
  state: FighterState;
  stateFrameCounter: number;
}

export interface SchwarzerblitzMatchSnapshot {
  frame: number;
  p1: SchwarzerblitzFighterSnapshot;
  p2: SchwarzerblitzFighterSnapshot;
}

export interface SchwarzerblitzRuntime {
  tick(input: InputBitmask): SchwarzerblitzMatchSnapshot;
}

/**
 * Adapter contract shared by the browser runtime and the native engine port.
 * Keep engine-facing values in this module instead of leaking React state into
 * combat code.
 */
export const SCHWARZERBLITZ_ENGINE_CONTRACT = {
  tickRate: 60,
  coordinateSystem: 'x-fighting-lane/z-sidestep-lane',
  input: ['up', 'down', 'left', 'right', 'light', 'heavy', 'guard'] as const,
  browserRenderer: 'threejs',
  nativeRenderer: 'schwarzerlicht/irrlicht'
} as const;
