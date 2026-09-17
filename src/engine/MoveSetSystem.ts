import type { BannonFighterProfile } from '../data/bannonRoster';

export type MoveSource = 'bannon' | 'native-engine' | 'research-adapter' | 'verified-external';

export type MoveArchetype =
  | 'locomotion' | 'stance' | 'strike' | 'kick' | 'combo' | 'guard'
  | 'counter' | 'launcher' | 'knockdown' | 'wake-up' | 'grapple'
  | 'throw' | 'submission' | 'pin' | 'taunt' | 'reaction' | 'ko';

export interface MoveAnimationBinding {
  assetPath: string;
  source: MoveSource;
  clipName?: string;
  rigProfile?: string;
  verified: boolean;
}

export interface CustomMoveDefinition {
  id: string;
  displayName: string;
  archetype: MoveArchetype;
  tags: readonly string[];
  animation: MoveAnimationBinding;
  frameData?: {
    startup?: number;
    active?: number;
    recovery?: number;
    hitstun?: number;
    blockstun?: number;
    damage?: number;
  };
}

export interface FighterMoveSet {
  fighterId: string;
  slots: Readonly<Record<string, string>>;
  moveIds: readonly string[];
  lockedReason?: string;
}

export function buildMoveSet(
  fighter: BannonFighterProfile,
  availableMoves: readonly CustomMoveDefinition[],
  authoritativeTags: readonly string[] = []
): FighterMoveSet {
  const tags = new Set(authoritativeTags.map(x => x.toLowerCase()));
  const compatible = availableMoves.filter(move =>
    move.animation.verified &&
    (move.tags.length === 0 || move.tags.some(tag => tags.has(tag.toLowerCase())))
  );
  const moveIds = compatible.map(move => move.id);
  return {
    fighterId: fighter.id,
    slots: Object.fromEntries(compatible.map((move, index) => [`slot_${index}`, move.id])),
    moveIds,
    lockedReason: compatible.length === 0 ? 'NO_VERIFIED_ANIMATION_MATCH' : undefined
  };
}

export function canUseAnimation(binding: MoveAnimationBinding): boolean {
  return binding.verified && binding.assetPath.trim().length > 0;
}
