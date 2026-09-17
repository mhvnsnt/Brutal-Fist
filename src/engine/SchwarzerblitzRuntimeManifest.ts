import type { FrameData } from '../types';

/**
 * Browser/native parity manifest.
 *
 * This is deliberately data-only: React never owns fighter rules.
 * The native Schwarzerblitz source remains the reference implementation;
 * the browser runtime consumes the same concepts through this contract.
 */
export const SCHWARZERBLITZ_RUNTIME_MANIFEST = {
  engine: 'Schwarzerblitz',
  tickRate: 60,
  fighterModel: 'GLTF/GLB browser asset; native asset adapter remains separate',
  rendererBrowser: 'Three.js',
  rendererNative: 'Schwarzerlicht/Irrlicht',
  match: {
    rounds: 3,
    roundTimerFrames: 60 * 60,
    startingHealth: 250,
    arenaX: 5.5,
    arenaZ: 2.25
  },
  states: [
    'Neutral',
    'Startup',
    'Active',
    'Recovery',
    'Hitstun',
    'Blockstun',
    'KO'
  ],
  animationChannels: ['idle', 'walk', 'light', 'heavy', 'guard', 'hit', 'block', 'ko'],
  inputChannels: ['up', 'down', 'left', 'right', 'light', 'heavy', 'guard'],
  nativeReference: {
    repository: 'AndreaJens/SchwarzerblitzEngine',
    sourceRoot: 'schwarzerblitz_engine/SchwarzerblitzEngine',
    aiManager: 'FK_AIManager.cpp',
    effects: 'EffectHandler.cpp',
    shaderSystem: 'CShaderPre.cpp'
  }
} as const;

export const BRUTAL_FIST_STARTER_MOVES: Record<'light' | 'heavy', FrameData> = {
  light: {
    startup: 4,
    active: 3,
    recovery: 10,
    damage: 10,
    hitAdvantage: 4,
    blockAdvantage: -2,
    pushback: 0.6,
    hitstun: 15,
    blockstun: 9,
    animation: 'light'
  },
  heavy: {
    startup: 12,
    active: 4,
    recovery: 20,
    damage: 25,
    hitAdvantage: 2,
    blockAdvantage: -6,
    pushback: 1.1,
    hitstun: 24,
    blockstun: 13,
    animation: 'heavy'
  }
};
