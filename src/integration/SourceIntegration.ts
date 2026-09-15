export type BrutalFistSourceId =
  | 'schwarzerblitz-engine' |'grok-v6' |'grok-v5' |'grok-v4' |'grok-v3' |'grok-v2' |'grok-v1' |'night-sky-engine' |'combat-rpg' |'bannon';

export interface SourceProvenance {
  source: BrutalFistSourceId;
  path: string;
  purpose: 'engine' | 'fighter' | 'animation' | 'combat' | 'physics' | 'qa' | 'tooling' | 'build';
  status: 'candidate' | 'validated' | 'integrated' | 'rejected';
  reason?: string;
}

export interface BannonPhysicsContract {
  /** Bannon ledger values; native implementation remains authoritative. */
  maxBodyVelocityMps: 3.8;
  damageScale: 8;
  maxHitStopFrames: 5;
  pinShoulderToleranceM: 0.15;
}

export interface FighterIntegrationContract {
  fighterId: string;
  source: SourceProvenance;
  model?: {
    glbPath: string;
    canonicalSkeleton: string;
    validated: boolean;
  };
  animation?: {
    aliases: string[];
    requiredStates: string[];
    retargetValidated: boolean;
  };
  combat?: {
    poise: number;
    maxHp: number;
    speed: number;
    strength: number;
    physicsScale: number;
  };
}

/**
 * Canonical source-routing policy. This intentionally contains no runtime
 * fetches: game builds consume checked-in manifests and validated assets.
 */
export const BRUTAL_FIST_SOURCE_POLICY = {
  nativeAuthority: 'schwarzerblitz-engine',
  fighterAuthority: 'bannon',
  historicalSnapshots: ['grok-v6', 'grok-v5', 'grok-v4', 'grok-v3', 'grok-v2', 'grok-v1'],
  unrealReferences: ['night-sky-engine'],
  toolingReferences: ['combat-rpg'],
  defaultGraphicsProfile: 'PS1_3D',
  fixedSimulationHz: 60,
  invalidFighterPolicy: 'exclude-never-fallback',
  transformPolicy: 'no-character-specific-180-degree-fixes'
} as const;

export const REQUIRED_CROSS_REPO_AUDIT: ReadonlyArray<SourceProvenance> = [
  { source: 'schwarzerblitz-engine', path: 'schwarzerblitz_engine', purpose: 'engine', status: 'integrated' },
  { source: 'grok-v6', path: 'native/source/roster.json', purpose: 'fighter', status: 'candidate' },
  { source: 'grok-v6', path: 'native/source/*.glb', purpose: 'fighter', status: 'candidate' },
  { source: 'grok-v5', path: 'native', purpose: 'engine', status: 'candidate' },
  { source: 'grok-v4', path: 'BannonSource', purpose: 'fighter', status: 'candidate' },
  { source: 'grok-v3', path: 'native/source/roster.json', purpose: 'fighter', status: 'candidate' },
  { source: 'grok-v2', path: '.grok/skills/building-games', purpose: 'qa', status: 'candidate' },
  { source: 'grok-v1', path: 'native', purpose: 'engine', status: 'candidate' },
  { source: 'night-sky-engine', path: 'Content/ControlRig/Characters/Mannequins/Animations', purpose: 'animation', status: 'candidate' },
  { source: 'combat-rpg', path: 'app/applet/src/connector/github.ts', purpose: 'tooling', status: 'candidate' },
  { source: 'bannon', path: 'BANNON_CONTEXT.md', purpose: 'physics', status: 'validated' },
  { source: 'bannon', path: '.claude/agents/combat_subagent.md', purpose: 'combat', status: 'validated' },
  { source: 'bannon', path: '.claude/agents/physics_subagent.md', purpose: 'physics', status: 'validated' }
];
