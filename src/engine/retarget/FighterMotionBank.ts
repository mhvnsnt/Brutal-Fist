/**
 * Per-fighter motion-bank mapping pulled from mhvnsnt/Bannon roster
 * defaultMoveSet IDs → assets/moves/clips/*.json (the real Mixamo Euler bank).
 *
 * Data-driven: no if (name === 'Bannon'). Lookup is roster id → move IDs → clip files.
 */
import { BANNON_ROSTER, type CharacterMoveSet } from '../../data/bannonRoster';
import { inferSemanticFromMotionKey } from './BannonEulerMotionAdapter';

/** bf_* catalog IDs → Bannon motion-bank file stems (priority order). */
export const MOVE_ID_TO_BANK_CLIPS: Record<string, string[]> = {
  bf_idle: ['BOX_IDLE', 'STANCE_WIDE', 'IDLE', 'STANCE_BLADED'],
  bf_idle_wide: ['STANCE_WIDE', 'BOX_IDLE', 'IDLE'],
  bf_idle_bladed: ['STANCE_BLADED', 'BOX_IDLE', 'IDLE'],
  bf_idle_box: ['BOX_IDLE', 'STANCE_BLADED', 'IDLE'],
  bf_idle_prowl: ['LOCO_PROWL', 'STANCE_BLADED', 'IDLE'],
  bf_idle_drunk: ['DRUNK_IDLE_VARIATION', 'BOX_IDLE', 'IDLE'],
  bf_idle_break: ['BREAKDANCE_READY', 'STANCE_WIDE', 'IDLE'],
  bf_walk_fwd: ['DWARF_WALK', 'LOCO_STRUT', 'LOCO_LIGHT', 'GINGA_FORWARD'],
  bf_walk_lumber: ['LOCO_LUMBER', 'DWARF_WALK', 'LOCO_STRUT'],
  bf_walk_strut: ['LOCO_STRUT', 'LOCO_LIGHT', 'DWARF_WALK'],
  bf_walk_light: ['LOCO_LIGHT', 'LOCO_STRUT', 'GINGA_FORWARD'],
  bf_walk_prowl: ['LOCO_STALK', 'LOCO_PROWL', 'GINGA_FORWARD'],
  bf_walk_ginga: ['GINGA_FORWARD', 'LOCO_LIGHT', 'DWARF_WALK'],
  bf_walk_drunk: ['DRUNK_WALK', 'DRUNK_RUN_FORWARD', 'DWARF_WALK'],
  bf_walk_dwarf: ['DWARF_WALK', 'LOCO_LUMBER', 'LOCO_STRUT'],
  bf_walk_back: ['GINGA_BACKWARD', 'INJURED_RUN_BACKWARDS_RIGHT_TURN'],
  bf_walk_back_ginga: ['GINGA_BACKWARD', 'INJURED_RUN_BACKWARDS_RIGHT_TURN'],
  bf_walk_back_injured: ['INJURED_RUN_BACKWARDS_RIGHT_TURN', 'GINGA_BACKWARD'],
  bf_crouch: ['STANCE_CROUCH', 'CROUCH_IDLE_02_LOOKING_AROUND', 'CROUCH_WALK_FORWARD'],
  bf_guard: ['CENTER_BLOCK', 'GUARD_HIGH', 'GUARD_LOW', 'DEFENDER'],

  bf_jab: ['BOXING', 'BODY_JAB_CROSS', 'BOXING__1_'],
  bf_cross: ['COMBO_PUNCH', 'BOXING__2_', 'BOXING__5_'],
  bf_elbow: ['ILLEGAL_ELBOW_PUNCH', 'ILLEGAL_ELBOW_PUNCH__1_', 'BASEBALL_HIT'],
  bf_hook: ['BOXING__3_', 'BASEBALL_HIT', 'BIG_BODY_BLOW'],
  bf_chop: ['BASH', 'ILLEGAL_ELBOW_PUNCH', 'BOXING__4_'],
  bf_uppercut: ['BOXING__4_', 'BASEBALL_HIT', 'BOXING__3_'],
  bf_iron_palm: ['ILLEGAL_ELBOW_PUNCH', 'BASH', 'BIG_BODY_BLOW'],
  bf_discus_clothesline: ['BASH', 'BASEBALL_HIT', 'BIG_BODY_BLOW'],

  bf_low_kick: ['DROP_KICK', 'ILLEGAL_KNEE', 'TIGER_FEINT_KICK'],
  bf_high_kick: ['HURRICANE_KICK', 'AU', 'CAPOEIRA'],
  bf_mid_kick: ['TIGER_FEINT_KICK', 'DROP_KICK', 'ILLEGAL_KNEE'],
  bf_spin_kick: ['HURRICANE_KICK', 'AU', 'CAPOEIRA'],
  bf_spinning_kick: ['HURRICANE_KICK', 'CAPOEIRA', 'AU'],

  bf_jab_cross: ['COMBO_PUNCH', 'BODY_JAB_CROSS', 'BOXING__2_'],
  bf_jab_cross_hook: ['COMBO_PUNCH', 'BOXING__3_', 'BOXING__2_'],
  bf_rush_combo: ['COMBO_PUNCH', 'BOXING__2_', 'BODY_JAB_CROSS'],
  bf_kickbox_combo: ['COMBO_PUNCH', 'HURRICANE_KICK', 'BODY_JAB_CROSS'],

  bf_clinch: ['DOUBLE_LEG_TAKEDOWN___VICTIM', 'SUPLEX'],
  bf_powerbomb: ['CHOKESLAM', 'SUPLEX'],
  bf_running_powerbomb: ['CHOKESLAM', 'SUPLEX'],
  bf_body_slam: ['SUPLEX', 'CHOKESLAM'],
  bf_exploder: ['GERMANSUPLEX', 'SUPLEX'],
  bf_suplex: ['SUPLEX', 'GERMANSUPLEX'],
  bf_dvd: ['SUPLEX', 'GERMANSUPLEX'],
  bf_brainbuster: ['GERMANSUPLEX', 'DDT'],
  bf_maime_driver: ['DDT', 'GERMANSUPLEX'],
  bf_beast_mode: ['CHOKESLAM', 'BASH'],
  bf_onyx_crush: ['CHOKESLAM', 'SUPLEX'],
  bf_full_nelson: ['SUPLEX', 'GERMANSUPLEX'],
  bf_cobra_clutch: ['DOUBLE_LEG_TAKEDOWN___VICTIM', 'SUPLEX'],
  bf_shining_wizard: ['ILLEGAL_KNEE', 'DROP_KICK'],
  bf_dragon_screw: ['DROP_KICK', 'TIGER_FEINT_KICK'],
  bf_hurricanrana: ['HURRICANE_KICK', 'AU'],
  bf_leap_of_faith: ['BIG_JUMP', 'CROSS_JUMPS'],
  bf_armor_breaker: ['BIG_BODY_BLOW', 'BASH'],
  bf_cipher_strike: ['CAPOEIRA', 'AU', 'HURRICANE_KICK'],
  bf_reversal: ['CORKSCREW_EVADE', 'ESQUIVA_4'],
  bf_mars_counter: ['ESQUIVA_4', 'CORKSCREW_EVADE'],

  bf_knockdown: ['FALLING_FLAT_IMPACT', 'FALLING_FORWARD_DEATH', 'DEFEAT'],
  bf_hard_knockdown: ['FALLING_FORWARD_DEATH', 'FALLING_FLAT_IMPACT', 'DEFEAT'],
  bf_wakeup: ['KIP_UP', 'CORKSCREW_KIP_UP', 'ACTION_IDLE_TO_STANDING_IDLE'],
  bf_wakeup_kick: ['KIP_UP', 'CORKSCREW_KIP_UP', 'HURRICANE_KICK'],
  bf_hit_reaction: ['HIT_REACTION', 'HIT_TO_BODY', 'HIT_TO_HEAD'],
  bf_heavy_hit_reaction: ['HIT_TO_HEAD', 'BIG_RIB_HIT', 'HIT_ON_THE_BACK'],
  bf_ko: ['DYING_BACKWARDS', 'DEFEAT', 'FALLING_FORWARD_DEATH'],

  bf_final_verdict: ['CHOKESLAM', 'GERMANSUPLEX'],
  bf_echo_slam: ['SUPLEX', 'CHOKESLAM'],
  bf_cody_buster: ['DDT', 'GERMANSUPLEX'],
  bf_hall_nighter_driver: ['CHOKESLAM', 'DDT'],
  bf_static_shock: ['CAPOEIRA', 'AU'],
  bf_viper_strike: ['ILLEGAL_ELBOW_PUNCH', 'BASH'],
  bf_kobra_kai: ['HURRICANE_KICK', 'CAPOEIRA'],
  bf_ruben_lock: ['DOUBLE_LEG_TAKEDOWN___VICTIM', 'SUPLEX'],
  bf_hollow_point: ['DDT', 'BASH'],
  bf_corporate_takeover: ['CHOKESLAM', 'SUPLEX'],
  bf_bull_rush: ['BASH', 'CHOKESLAM'],
  bf_hall_street_justice: ['BASEBALL_HIT', 'BASH'],
  bf_triple_threat: ['COMBO_PUNCH', 'HURRICANE_KICK'],
  bf_golden_goring: ['CHOKESLAM', 'BASH'],
  bf_honey_trap: ['DDT', 'DOUBLE_LEG_TAKEDOWN___VICTIM'],
  bf_brutus_bomb: ['CHOKESLAM', 'SUPLEX'],
  bf_titan_fall: ['CHOKESLAM', 'GERMANSUPLEX'],
  bf_five_point_palm: ['ILLEGAL_ELBOW_PUNCH', 'ILLEGAL_ELBOW_PUNCH__1_'],
  bf_wreck_ball: ['BASH', 'CHOKESLAM'],
  bf_jager_hunt: ['DROP_KICK', 'HURRICANE_KICK'],
  bf_getbackk: ['COMBO_PUNCH', 'BASH'],
  bf_chainsnatcher: ['DOUBLE_LEG_TAKEDOWN___VICTIM', 'SUPLEX'],
  bf_jungle_bomb: ['CHOKESLAM', 'HURRICANE_KICK'],
};

const CORE_SLOT_TO_SEMANTIC: Partial<Record<keyof CharacterMoveSet, string>> = {
  idle: 'idle',
  walkForward: 'walk_forward',
  walkBackward: 'walk_back',
  crouch: 'crouch',
  guard: 'block',
  lightAttack: 'attack_1',
  heavyAttack: 'attack_rp',
  lowKick: 'attack_lk',
  highKick: 'attack_rk',
  grappleInitiate: 'grapple',
  primaryThrow: 'grapple',
  knockdown: 'knockdown',
  wakeup: 'getup',
  hitReaction: 'hit_reaction',
  ko: 'knockdown',
};

/**
 * BANNON_rigged.glb → bannon, CAIN_ELIAS_gear.glb → cain_elias, CIPHER_feral.glb → cipher.
 * Longest roster id wins so cain_elias is not truncated to cain.
 */
export function rosterIdFromModel(modelName: string): string {
  const stem = (modelName.split('/').pop() ?? modelName)
    .replace(/\.[^.]+$/, '')
    .toLowerCase();
  const sorted = [...BANNON_ROSTER].sort((a, b) => b.id.length - a.id.length);
  for (const fighter of sorted) {
    const id = fighter.id.toLowerCase();
    if (stem === id || stem.startsWith(`${id}_`)) return fighter.id;
    const modelStem = fighter.model.replace(/\.[^.]+$/, '').toLowerCase();
    if (stem === modelStem) return fighter.id;
  }
  return stem.split('_')[0];
}

/** Priority bank file stems per semantic for this fighter's defaultMoveSet. */
export function preferredBankKeysForFighter(rosterId: string): Map<string, string[]> {
  const fighter = BANNON_ROSTER.find((f) => f.id === rosterId);
  const out = new Map<string, string[]>();
  if (!fighter) return out;
  const moveSet = fighter.defaultMoveSet;

  const push = (semantic: string, keys: string[]) => {
    const existing = out.get(semantic) ?? [];
    for (const key of keys) {
      if (!existing.includes(key)) existing.push(key);
    }
    out.set(semantic, existing);
  };

  for (const [slot, semantic] of Object.entries(CORE_SLOT_TO_SEMANTIC) as Array<[keyof CharacterMoveSet, string]>) {
    const moveId = moveSet[slot];
    if (typeof moveId !== 'string') continue;
    const keys = MOVE_ID_TO_BANK_CLIPS[moveId];
    if (keys?.length) push(semantic, keys);
  }

  const signature = moveSet.signature;
  if (typeof signature === 'string') {
    const keys = MOVE_ID_TO_BANK_CLIPS[signature];
    if (keys?.length) {
      const inferred = inferSemanticFromMotionKey(keys[0]);
      const semantic = inferred === 'grapple' || inferred === 'knockdown' ? 'grapple' : 'attack_rk';
      push(semantic, keys);
    }
  }

  for (const extra of [moveSet.extraMove1, moveSet.extraMove2]) {
    if (typeof extra !== 'string') continue;
    const keys = MOVE_ID_TO_BANK_CLIPS[extra];
    if (!keys?.length) continue;
    push(inferSemanticFromMotionKey(keys[0]), keys);
  }

  return out;
}

/** Roster move IDs that should alias a mixer action for this semantic. */
export function moveIdsForSemantic(rosterId: string, semantic: string): string[] {
  const fighter = BANNON_ROSTER.find((f) => f.id === rosterId);
  if (!fighter) return [];
  const ids: string[] = [];
  const slotFor: Partial<Record<string, Array<keyof CharacterMoveSet>>> = {
    idle: ['idle'],
    walk_forward: ['walkForward'],
    walk_back: ['walkBackward'],
    crouch: ['crouch'],
    block: ['guard'],
    attack_1: ['lightAttack', 'counter', 'primaryCombo'],
    attack_rp: ['heavyAttack', 'primaryCombo'],
    attack_lk: ['lowKick'],
    attack_rk: ['highKick', 'signature', 'extraMove1'],
    grapple: ['grappleInitiate', 'primaryThrow', 'signature', 'extraMove2'],
    knockdown: ['knockdown', 'ko'],
    getup: ['wakeup'],
    hit_reaction: ['hitReaction'],
  };
  for (const slot of slotFor[semantic] ?? []) {
    const id = fighter.defaultMoveSet[slot];
    if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rotated(list: string[], salt: number, id: string): string[] {
  if (!list.length) return [];
  const i = (hashId(id || 'fighter') >>> salt) % list.length;
  return [...list.slice(i), ...list.slice(0, i)];
}

/**
 * Per-fighter locomotion kits from clips that actually live in /public/motion.
 * Claude's stance picker (CharacterStances) is the model: style/id picks a
 * signature clip, the rest of the pool is the fallback if that file isn't
 * bound. Schwarzerblitz stance names that are not in this bank are omitted
 * so a missing clip can never blank a working idle.
 */
const LOCO_KITS = {
  idle: ['DRUNK_IDLE_VARIATION', 'BREAKDANCE_READY', 'LOCO_PROWL', 'BOX_IDLE', 'STANCE_BLADED', 'STANCE_WIDE'],
  walk: ['LOCO_LUMBER', 'LOCO_STRUT', 'LOCO_LIGHT', 'LOCO_STALK', 'GINGA_FORWARD', 'DWARF_WALK', 'DRUNK_WALK', 'LOCO_PROWL'],
  walkBack: ['GINGA_BACKWARD', 'INJURED_RUN_BACKWARDS_RIGHT_TURN', 'DRUNK_WALK'],
  crouch: ['STANCE_CROUCH', 'CROUCH_IDLE_02_LOOKING_AROUND', 'CROUCH_WALK_FORWARD'],
  guard: ['CENTER_BLOCK', 'GUARD_LOW', 'GUARD_HIGH', 'DEFENDER'],
  sidestep: ['GINGA_SIDEWAYS_2', 'ESQUIVA_4', 'CORKSCREW_EVADE', 'CROUCH_TORCH_WALK_RIGHT'],
};

export function reactionPreferences(state: string): string[] {
  switch (state) {
    case 'hitHigh':
      return ['HIT_TO_HEAD', 'HIT_ON_SIDE_OF_HEAD', 'SBW_hit_high', 'T_hit_high', 'hitHigh'];
    case 'hitLow':
      return ['HIT_TO_BODY', 'BIG_RIB_HIT', 'BIG_BODY_BLOW', 'SBW_hit_low', 'T_hit_low', 'hitLow'];
    case 'hit':
    case 'Hitstun':
    case 'HitStun':
    case 'Stunned':
      return ['HIT_REACTION', 'HIT_TO_BODY', 'BIG_BODY_BLOW', 'SBW_hit', 'T_hit', 'hit'];
    default:
      return [];
  }
}

export function locomotionPreferences(fighterId: string, state: string): string[] {
  const id = fighterId || 'fighter';
  switch (state) {
    case 'idle':
    case 'Idle':
    case 'Neutral':
    case 'neutral':
      return rotated(LOCO_KITS.idle, 0, id);
    case 'walkForward':
    case 'walk':
    case 'Walking':
    case 'run':
    case 'dash':
    case 'dashForward':
      return rotated(LOCO_KITS.walk, 3, id);
    case 'walkBackward':
    case 'Backdashing':
      return rotated(LOCO_KITS.walkBack, 5, id);
    case 'crouch':
    case 'crouchWalk':
      return rotated(LOCO_KITS.crouch, 7, id);
    case 'guard':
    case 'Guard':
    case 'block':
    case 'Blockstun':
      return ['GUARD_HIGH', 'CENTER_BLOCK', 'DEFENDER', 'GUARD_LOW'];
    case 'guardLow':
      return ['GUARD_LOW', 'CENTER_BLOCK', 'DEFENDER', 'GUARD_HIGH'];
    case 'strafeLeft':
    case 'sidestepLeft':
      return rotated(LOCO_KITS.sidestep, 13, id);
    case 'strafeRight':
    case 'sidestepRight':
      return rotated(LOCO_KITS.sidestep, 17, id);
    default:
      return [];
  }
}

const DIRECTION_POOLS: Record<string, Record<string, string[]>> = {
  lightAttack: {
    neutral: ['BOXING', 'BOXING__1_', 'BODY_JAB_CROSS', 'BOXING__2_'],
    forward: ['BODY_JAB_CROSS', 'BOXING__2_', 'COMBO_PUNCH', 'BOXING'],
    back: ['BOXING__4_', 'ILLEGAL_ELBOW_PUNCH', 'BASH'],
    crouch: ['BOXING__5_', 'BODY_JAB_CROSS', 'ILLEGAL_KNEE'],
    air: ['CROSS_JUMPS', 'DROP_KICK', 'BIG_JUMP'],
  },
  heavyAttack: {
    neutral: ['COMBO_PUNCH', 'BOXING__3_', 'BIG_BODY_BLOW', 'BASH'],
    forward: ['BIG_BODY_BLOW', 'BASH', 'BASEBALL_HIT', 'COMBO_PUNCH'],
    back: ['ILLEGAL_ELBOW_PUNCH', 'BASH', 'BOXING__4_'],
    crouch: ['BASH', 'ILLEGAL_KNEE', 'BIG_BODY_BLOW'],
    air: ['CROSS_JUMPS', 'BIG_JUMP', 'DROP_KICK'],
  },
  lightKick: {
    neutral: ['ILLEGAL_KNEE', 'TIGER_FEINT_KICK', 'DROP_KICK'],
    forward: ['TIGER_FEINT_KICK', 'ILLEGAL_KNEE', 'DROP_KICK'],
    back: ['ILLEGAL_KNEE', 'ESQUIVA_4', 'TIGER_FEINT_KICK'],
    crouch: ['ILLEGAL_KNEE', 'DROP_KICK', 'TIGER_FEINT_KICK'],
    air: ['DROP_KICK', 'TIGER_FEINT_KICK', 'CROSS_JUMPS'],
  },
  heavyKick: {
    // Neutral 4 is a fast kick. Forward+4 is the hurricane and plays long.
    neutral: ['AU', 'TIGER_FEINT_KICK', 'CAPOEIRA'],
    forward: ['HURRICANE_KICK'],
    back: ['AU', 'CAPOEIRA'],
    crouch: ['DROP_KICK', 'ILLEGAL_KNEE'],
    air: ['HURRICANE_KICK'],
  },
  CommandThrow: {
    neutral: ['SUPLEX', 'GERMANSUPLEX', 'CHOKESLAM', 'DDT'],
    forward: ['CHOKESLAM', 'SUPLEX', 'GERMANSUPLEX'],
    back: ['DDT', 'GERMANSUPLEX', 'SUPLEX'],
    crouch: ['DOUBLE_LEG_TAKEDOWN___VICTIM', 'SUPLEX', 'DDT'],
    air: ['HURRICANE_KICK', 'CHOKESLAM', 'SUPLEX'],
  },
};

/**
 * Claude's attackClip split: the combat state stays lightAttack/heavyKick
 * (lock, hitbox, timeScale) and the clip is chosen from direction + fighter.
 * Same button is not the same swing for every character.
 */
export function directionalAttackClip(
  fighterId: string,
  motion: string,
  input: { forward: number; crouch: boolean; airborne?: boolean },
  variant = 0,
): string | null {
  const family = DIRECTION_POOLS[motion];
  if (!family) return null;
  const dir = input.airborne
    ? 'air'
    : input.crouch
      ? 'crouch'
      : input.forward > 0.2
        ? 'forward'
        : input.forward < -0.2
          ? 'back'
          : 'neutral';
  const pool = family[dir] ?? family.neutral;
  if (!pool.length) return null;
  const i = Math.abs((hashId(fighterId || 'fighter') + variant) % pool.length);
  return pool[i];
}

export function bankClipForMoveId(moveId: string | undefined): string | null {
  if (!moveId) return null;
  return MOVE_ID_TO_BANK_CLIPS[moveId]?.[0] ?? null;
}
