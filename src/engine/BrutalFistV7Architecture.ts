/**
 * Grok v7 architecture adapter.
 *
 * This deliberately imports the architecture, not a second competing engine.
 * Schwarzerblitz remains the native authority; these contracts define the
 * deterministic shared simulation surface used by the web cockpit and native
 * bridge.
 */

export type AppScreen =
  | "boot" | "title" | "menu" | "options" | "select" | "details"
  | "stage" | "versus" | "combat" | "result" | "arcade-end";

export type GameMode = "arcade" | "versus" | "training";
export type GraphicsProfile = "PS1_3D" | "RETRO8" | "HIGH_RES";
export type DummyBehavior = "stand" | "guard" | "attack";

export interface MatchRules {
  /** Default is the user's requested KO-only ruleset. */
  pinning: boolean;
  submissions: boolean;
  wrestlingRules: boolean;
  roundsToWin: number;
  timeLimitSeconds: number | null;
}

export const DEFAULT_MATCH_RULES: MatchRules = {
  pinning: false,
  submissions: false,
  wrestlingRules: false,
  roundsToWin: 2,
  timeLimitSeconds: 99,
};

export interface V7FrameData {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  hitAdvantage: number;
  blockAdvantage: number;
  pushback: number;
  hitstun?: number;
  blockstun?: number;
  animation?: string;
}

export interface V7Hitbox {
  offsetX: number;
  offsetZ: number;
  width: number;
  depth: number;
  damage: number;
  hitstun: number;
  blockstun: number;
  pushback: number;
  launch: number;
}

export interface V7MoveDefinition extends V7FrameData {
  id: string;
  displayName: string;
  animationAliases: string[];
  minRange: number;
  maxRange: number;
  priority: number;
  low: boolean;
  mid: boolean;
  throw: boolean;
  canCancel: boolean;
  hitbox?: V7Hitbox;
}

/** V7's verified baseline moves, retained as shared data rather than copied into UI code. */
export const V7_BASE_MOVES: Record<string, V7MoveDefinition> = {
  light: {
    id: "bf_light", displayName: "Light", startup: 4, active: 3, recovery: 10,
    damage: 70, hitAdvantage: 4, blockAdvantage: -2, pushback: 0.55,
    hitstun: 14, blockstun: 9, animation: "light", animationAliases: ["light", "punch", "attack"],
    minRange: 0.15, maxRange: 2.05, priority: 10, low: false, mid: true, throw: false, canCancel: true,
    hitbox: { offsetX: 0.82, offsetZ: 0, width: 1.05, depth: 0.62, damage: 70, hitstun: 14, blockstun: 9, pushback: 0.55, launch: 0 },
  },
  heavy: {
    id: "bf_heavy", displayName: "Heavy", startup: 12, active: 4, recovery: 20,
    damage: 155, hitAdvantage: 2, blockAdvantage: -6, pushback: 1.05,
    hitstun: 24, blockstun: 13, animation: "heavy", animationAliases: ["heavy", "strong", "heavy_attack"],
    minRange: 0.25, maxRange: 2.4, priority: 20, low: false, mid: true, throw: false, canCancel: false,
    hitbox: { offsetX: 1.0, offsetZ: 0, width: 1.25, depth: 0.72, damage: 155, hitstun: 24, blockstun: 13, pushback: 1.05, launch: 0.22 },
  },
};

export type GrapplePhase = "none" | "engaged" | "control" | "throw" | "pin-attempt" | "pinned" | "escaped";

export interface PinMeasurement {
  leftShoulderDistanceM: number;
  rightShoulderDistanceM: number;
  ringMatContact: boolean;
}

export const V7_GRAPPLE_CONTRACT = {
  engageMinDistanceM: 0.2,
  engageMaxDistanceM: 0.95,
  pinShoulderToleranceM: 0.15,
  escapeMeterMax: 100,
} as const;

/** Gate optional wrestling mechanics without contaminating the default KO ruleset. */
export function rulesAllowPin(rules: MatchRules) {
  return rules.pinning === true;
}

export function rulesAllowSubmission(rules: MatchRules) {
  return rules.submissions === true;
}

export function timerFramesForRules(rules: MatchRules) {
  return rules.timeLimitSeconds == null ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor(rules.timeLimitSeconds * 60));
}
