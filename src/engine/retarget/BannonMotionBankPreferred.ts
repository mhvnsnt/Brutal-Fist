/**
 * BannonMotionBankPreferred.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Preferred semantic-state → motion-bank clip file mapping.
 *
 * The live Bannon index.json is a dict keyed by raw clip ids (IDLE, HIT_REACTION,
 * …), not by semantic states. This table is the authoritative bridge from
 * FighterStateMachine / AnimationBridge semantic states to those files.
 *
 * Source of truth for bytes:
 *   https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/
 * Local mirror (optional):
 *   public/assets/moves/clips/
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const BANNON_CLIP_CDN_BASE =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips';

export const BANNON_CLIP_INDEX_URL = `${BANNON_CLIP_CDN_BASE}/index.json`;

/** Required semantic states for strict pre-combat. */
export const PREFERRED_REQUIRED_SEMANTIC_STATES = [
  'idle',
  'walk_forward',
  'walk_back',
  'strafe_left',
  'strafe_right',
  'attack_1',
  'attack_2',
  'block',
  'hit_reaction',
  'knockdown',
  'getup',
] as const;

export type PreferredSemanticState = (typeof PREFERRED_REQUIRED_SEMANTIC_STATES)[number];

/**
 * Preferred authored Euler motion-bank files per semantic state.
 * Files verified present on Bannon main assets/moves/clips/index.json.
 */
export const PREFERRED_SEMANTIC_CLIP_FILES: Record<PreferredSemanticState, string> = {
  idle: 'IDLE.json',
  walk_forward: 'GINGA_FORWARD.json',
  walk_back: 'GINGA_BACKWARD.json',
  strafe_left: 'GINGA_SIDEWAYS_2.json',
  strafe_right: 'CROUCH_TORCH_WALK_RIGHT.json',
  attack_1: 'BODY_JAB_CROSS.json',
  attack_2: 'COMBO_PUNCH.json',
  block: 'CENTER_BLOCK.json',
  hit_reaction: 'HIT_REACTION.json',
  knockdown: 'FALLING_FLAT_IMPACT.json',
  getup: 'KIP_UP.json',
};

export function preferredClipUrl(
  semanticState: PreferredSemanticState,
  base: string = BANNON_CLIP_CDN_BASE,
): string {
  const file = PREFERRED_SEMANTIC_CLIP_FILES[semanticState];
  return `${base.replace(/\/$/, '')}/${file}`;
}

export function preferredLocalPath(semanticState: PreferredSemanticState): string {
  return `/assets/moves/clips/${PREFERRED_SEMANTIC_CLIP_FILES[semanticState]}`;
}

export function preferredSemanticManifest(): {
  schema: number;
  policy: string;
  source: string;
  clips: Array<{ semanticState: string; file: string; provenance: string }>;
} {
  return {
    schema: 1,
    policy: 'PREFERRED_BANNON_EULER_MOTION_BANK',
    source: BANNON_CLIP_CDN_BASE,
    clips: PREFERRED_REQUIRED_SEMANTIC_STATES.map((semanticState) => ({
      semanticState,
      file: PREFERRED_SEMANTIC_CLIP_FILES[semanticState],
      provenance: `RETARGETED_AUTHORED_CLIP from Bannon motion bank ${PREFERRED_SEMANTIC_CLIP_FILES[semanticState]}`,
    })),
  };
}
