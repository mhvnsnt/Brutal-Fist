/**
 * Shared combat architecture boundary.
 *
 * This is intentionally a contract layer: source implementations can be
 * reconciled here without creating a second game engine. Native
 * Schwarzerblitz owns runtime semantics; Bannon owns fighter content.
 */
import { DEFAULT_MATCH_RULES, MatchRules, rulesAllowPin, rulesAllowSubmission, timerFramesForRules } from './BrutalFistV7Architecture';
import { BannonCombatContract } from './BannonCombatContract';
import { BRUTAL_FIST_MOVE_CATALOG, SchwarzerblitzMoveDefinition } from './SchwarzerblitzMoveCatalog';

export type CombatArchitectureSource = 'schwarzerblitz-native' | 'bannon-content' | 'grok-v7' | 'tekken3-recompiled' | 'tekken-ue4-research' | 'tekken-hy352' | 'tek3ex';

export interface CombatArchitectureManifest {
  tickRateHz: number;
  fixedStep: true;
  nativeRuntimeAuthority: 'Schwarzerblitz';
  contentAuthority: 'Bannon';
  sources: CombatArchitectureSource[];
  defaultRules: MatchRules;
  moveIds: string[];
  optionalMechanics: {
    pins: boolean;
    submissions: boolean;
    wrestlingRules: boolean;
  };
}

export const COMBAT_ARCHITECTURE_MANIFEST: CombatArchitectureManifest = {
  tickRateHz: BannonCombatContract.tickRate,
  fixedStep: true,
  nativeRuntimeAuthority: 'Schwarzerblitz',
  contentAuthority: 'Bannon',
  sources: [
    'schwarzerblitz-native',
    'bannon-content',
    'grok-v7',
    'tekken3-recompiled',
    'tekken-ue4-research',
    'tekken-hy352',
    'tek3ex',
  ],
  defaultRules: DEFAULT_MATCH_RULES,
  moveIds: Object.keys(BRUTAL_FIST_MOVE_CATALOG),
  optionalMechanics: {
    pins: rulesAllowPin(DEFAULT_MATCH_RULES),
    submissions: rulesAllowSubmission(DEFAULT_MATCH_RULES),
    wrestlingRules: DEFAULT_MATCH_RULES.wrestlingRules,
  },
};

/** Canonical rules normalization used by web/native adapters. */
export function normalizeMatchRules(input?: Partial<MatchRules>): MatchRules {
  const rules = { ...DEFAULT_MATCH_RULES, ...(input ?? {}) };
  return {
    pinning: rules.pinning === true,
    submissions: rules.submissions === true,
    wrestlingRules: rules.wrestlingRules === true,
    roundsToWin: Math.max(1, Math.floor(Number(rules.roundsToWin) || DEFAULT_MATCH_RULES.roundsToWin)),
    timeLimitSeconds: rules.timeLimitSeconds == null ? null : Math.max(0, Number(rules.timeLimitSeconds) || 0),
  };
}

/**
 * V7/Hy352-style frame-data surface over the existing Schwarzerblitz catalog.
 * No duplicate move authority is introduced.
 */
export function getCanonicalMove(id: string): SchwarzerblitzMoveDefinition | undefined {
  return BRUTAL_FIST_MOVE_CATALOG[id];
}

export function canonicalTimerFrames(rules?: Partial<MatchRules>): number {
  return timerFramesForRules(normalizeMatchRules(rules));
}
