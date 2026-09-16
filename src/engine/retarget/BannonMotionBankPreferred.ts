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

/**
 * Grapple / throw semantic mapping — FAIL-CLOSED.
 *
 * Inventory of Bannon motion bank (index.json) for grapple/throw/clinch/hold/slam:
 *   - Mixamo 52-bone authored FBX: ONLY DOUBLE_LEG_TAKEDOWN___VICTIM(.json) (+ __1_)
 *     → VICTIM role, NOT attacker clinch/initiate. Do NOT map as semantic `grapple`.
 *   - Authored wrestling FBX with incompatible J_* / multi-actor skeletons
 *     (SUPLEX 607, CHOKESLAM 521, GERMANSUPLEX 498, HAMMERTHROW 499, DDT 712, …)
 *     → real authored clips, but bone names do not bind to BANNON_rigged Mixamo
 *       (mixamorig*). Mapping them would claim RETARGETED_AUTHORED_CLIP while
 *       CharacterPipeline bind yields 0 tracks — dishonest PASS.
 *   - MoMask / video-to-clip (STANCE_CROUCH "ready to grapple", TZ_*_SLAM, …)
 *     → NOT authored Euler bank; never unlock FIGHT / never preferred.
 *   - MixamoFightingMotionBank.grapple() → PLACEHOLDER_TEST_CLIP / TEST_ONLY.
 *
 * Verdict: semantic `grapple` stays MISSING_CLIP (not in PREFERRED map).
 *
 * Remediation (author/add ONE Mixamo-compatible attacker clip, then map it):
 *   Suggested file: GRAPPLE_CLINCH.json  (or CLINCH_INITIATE.json / GRAB_CLINCH.json)
 *   Required: keys[] Euler BANNON_EULER_RX_RY_RZ, mixamorig* 52-bone skeleton,
 *             attacker clinch/grab initiate (not victim, not MoMask).
 *   Alternate acceptable bank names if authored on Mixamo: DOUBLE_LEG_TAKEDOWN
 *             (attacker, not ___VICTIM), CLINCH, GRAPPLE_HOLD.
 *   After adding to Bannon assets/moves/clips/ + index.json, set:
 *     PREFERRED_SEMANTIC_CLIP_FILES.grapple = '<that file>'
 *     and append 'grapple' to PREFERRED_REQUIRED_SEMANTIC_STATES.
 */
export const GRAPPLE_SEMANTIC_VERDICT = 'MISSING_CLIP' as const;
export const GRAPPLE_REMEDIATION_CLIP_CANDIDATES = [
  'GRAPPLE_CLINCH.json',
  'CLINCH_INITIATE.json',
  'GRAB_CLINCH.json',
  'DOUBLE_LEG_TAKEDOWN.json', // attacker Mixamo — NOT ___VICTIM
] as const;

/** Rejected bank clips that look like grapple but must NOT be preferred-mapped. */
export const GRAPPLE_REJECTED_BANK_CLIPS = {
  DOUBLE_LEG_TAKEDOWN___VICTIM: 'Mixamo 52-bone but VICTIM role — wrong semantic for initiate',
  SUPLEX: 'Authored FBX but J_* 607-bone — 0-track bind on BANNON_rigged Mixamo',
  CHOKESLAM: 'Authored FBX but J_* 521-bone — incompatible with Mixamo roster GLBs',
  GERMANSUPLEX: 'Authored FBX but J_* 498-bone — incompatible',
  HAMMERTHROW: 'Authored FBX but J_* 499-bone — incompatible',
  STANCE_CROUCH: 'MoMask text_to_clip — not authored; TEST_ONLY',
} as const;
