export enum AppScreen {
  Boot = 'Boot',
  Title = 'Title',
  MainMenu = 'MainMenu',
  Options = 'Options',
  Select = 'Select',
  VS = 'VS',
  Combat = 'Combat',
  PostMatch = 'PostMatch'
}

export enum FighterState {
  Neutral = 'Neutral',
  Startup = 'Startup',
  Active = 'Active',
  Recovery = 'Recovery'
}

export interface InputBitmask {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  light: boolean;
  heavy: boolean;
  guard: boolean;
}

export interface FrameData {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  hitAdvantage: number;
  blockAdvantage: number;
  pushback: number;
}

