export const AppScreen = {
  Boot: 'Boot',
  Title: 'Title',
  MainMenu: 'MainMenu',
  Options: 'Options',
  Select: 'Select',
  VS: 'VS',
  Combat: 'Combat',
  PostMatch: 'PostMatch'
} as const;
export type AppScreen = typeof AppScreen[keyof typeof AppScreen];

export const FighterState = {
  Neutral: 'Neutral',
  Startup: 'Startup',
  Active: 'Active',
  Recovery: 'Recovery',
  Hitstun: 'Hitstun',
  Blockstun: 'Blockstun',
  Grappled: 'Grappled',
  Pinned: 'Pinned',
  KO: 'KO'
} as const;
export type FighterState = typeof FighterState[keyof typeof FighterState];

export type FighterAnimation =
  | 'idle' | 'walk' | 'light' | 'heavy' | 'guard' | 'hit' | 'block' |'grapple' | 'throw' | 'pin' | 'ko';

export interface InputBitmask {
  up: boolean; down: boolean; left: boolean; right: boolean;
  light: boolean; heavy: boolean; guard: boolean;
  grapple?: boolean;
  escape?: boolean;
  pin?: boolean;
}

export interface Hitbox {
  offsetX: number; offsetZ: number; width: number; depth: number;
  damage: number; hitstun: number; blockstun: number; pushback: number; launch: number;
}

export interface Hurtbox { offsetX: number; offsetZ: number; width: number; depth: number; }

export interface FrameData {
  startup: number; active: number; recovery: number; damage: number;
  hitAdvantage: number; blockAdvantage: number; pushback: number;
  hitstun?: number; blockstun?: number; hitbox?: Hitbox; hurtbox?: Hurtbox;
  animation?: FighterAnimation;
}

export interface FighterSnapshot {
  health: number; x: number; z: number; facing: 1 | -1;
  state: FighterState; stateFrame: number; animation: FighterAnimation;
  move: FrameData | null;
  grapplePhase?: string;
  grappleEscapeMeter?: number;
}
