/**
 * SemanticStateAliases.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Canonical semantic state alias tables shared between CharacterPipeline,
 * AnimationBridge, and FighterMesh.
 *
 * Extracted here to avoid circular imports between:
 *   animation_bridge/retarget.ts ↔ src/engine/pipeline/CharacterPipeline.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Maps semantic animation state names to actual clip names from various sources.
 * Used by AnimationBridge to find the best clip for each semantic state.
 */
export const SEMANTIC_STATE_ALIASES: Record<string, string[]> = {
  idle:           ['idle', 'Idle', 'IDLE', 'BOX_IDLE', 'STANCE_BLADED', 'STANCE_WIDE', 'neutral', 'Neutral', 'standing', 'Standing', 'stance', 'Stance', 'combatIdle', 'CombatIdle', 'idle_procedural_placeholder'],
  walk_forward:   ['walk', 'Walk', 'DWARF_WALK', 'DRUNK_WALK', 'GINGA_FORWARD', 'LOCO_STRUT', 'LOCO_LIGHT', 'walkForward', 'WalkForward', 'walking', 'Walking', 'walk_fwd', 'SBW_walk_fwd', 'walk_forward_procedural_placeholder'],
  walk_back:      ['walkBack', 'WalkBack', 'GINGA_BACKWARD', 'walkBackward', 'WalkBackward', 'walk_back', 'walk_bwd', 'SBW_walk_back', 'walk_back_procedural_placeholder'],
  strafe_left:    ['strafeLeft', 'StrafeLeft', 'GINGA_SIDEWAYS_2', 'sidestepLeft', 'SidestepLeft', 'SBW_strafe_left'],
  strafe_right:   ['strafeRight', 'StrafeRight', 'CROUCH_TORCH_WALK_RIGHT', 'sidestepRight', 'SidestepRight', 'SBW_strafe_right'],
  attack_1:       ['lightAttack', 'LightAttack', 'BOXING', 'BODY_JAB_CROSS', 'COMBO_PUNCH', 'BOXING__1_', 'BOXING__2_', 'CROTCHCHOP', 'knifeEdgeChop', 'bf_knife_edge_chop', 'punch', 'Punch', 'jab', 'Jab', 'attack', 'Attack', 'LP', 'T_1', 'bf_jab', 'attack_1_procedural_placeholder'],
  attack_2:       ['heavyAttack', 'HeavyAttack', 'HURRICANE_KICK', 'DROP_KICK', 'ILLEGAL_KNEE', 'TIGER_FEINT_KICK', 'BASH', 'CROSS_JUMPS', 'tarzanScale', 'bf_tarzan_scale', 'kick', 'Kick', 'cross', 'Cross', 'RP', 'T_2', 'bf_cross', 'attack_2_procedural_placeholder'],
  block:          ['guard', 'Guard', 'CENTER_BLOCK', 'GUARD_HIGH', 'GUARD_LOW', 'DEFENDER', 'block', 'Block', 'defend', 'Defend', 'SBW_guard', 'T_guard', 'block_procedural_placeholder'],
  hit_reaction:   ['hit', 'Hit', 'HIT_REACTION', 'HIT_TO_BODY', 'HIT_TO_HEAD', 'BIG_RIB_HIT', 'hurt', 'Hurt', 'flinch', 'Flinch', 'hitstun', 'Hitstun', 'SBW_hit', 'T_hit', 'hit_reaction_procedural_placeholder'],
  knockdown:      ['knockdown', 'Knockdown', 'FALLING_FLAT_IMPACT', 'FALLING_FORWARD_DEATH', 'DEFEAT', 'DYING_BACKWARDS', 'ko', 'KO', 'fall', 'Fall', 'SBW_knockdown', 'T_knockdown', 'knockdown_procedural_placeholder'],
  getup:          ['getUp', 'GetUp', 'KIP_UP', 'CORKSCREW_KIP_UP', 'quickStand', 'QuickStand', 'gettingUp', 'GettingUp', 'T_quickstand', 'getup_procedural_placeholder'],
  grapple:        ['grab', 'Grab', 'SUPLEX', 'GERMANSUPLEX', 'DDT', 'HAMMERLOCKDDT', 'TZ_TILT_WHIRL_SLAM', 'HAMMERTHROW', 'HURRICANERANA', 'CRUCIFIXPIN', 'CHOKESLAM', 'jungleJuice', 'invertedFacelockToss', 'throw', 'Throw', 'grapple', 'Grapple', 'SBW_throw', 'T_1_3'],
  crouch:         ['crouch', 'Crouch', 'STANCE_CROUCH', 'CROUCH_IDLE_02_LOOKING_AROUND', 'CROUCH_WALK_FORWARD', 'duck', 'Duck', 'SBW_crouch', 'T_crouch'],
  run:            ['run', 'Run', 'DRUNK_RUN_FORWARD', 'running', 'Running', 'sprint', 'Sprint'],
  dash_forward:   ['dashForward', 'DashForward', 'dash', 'Dash', 'run', 'Run'],
  backdash:       ['backdash', 'Backdash', 'backDash', 'BackDash', 'SBW_backdash', 'T_backdash'],
  victory:        ['victory', 'Victory', 'win', 'Win', 'victoryPose', 'VictoryPose'],
  defeat:         ['defeat', 'Defeat', 'DEFEAT', 'lose', 'Lose', 'knockdown', 'Knockdown'],
  taunt:          ['taunt', 'Taunt', 'TAUNT', 'TAUNT_CALLOUT', 'idle', 'Idle'],
};

/**
 * Maps FighterStateMachine combat states to semantic animation states.
 * Used by FighterMesh and AnimationBridge to resolve the correct clip
 * for each combat state transition.
 */
export const COMBAT_STATE_TO_SEMANTIC: Record<string, string> = {
  // Idle / neutral
  idle:              'idle',
  Neutral:           'idle',
  standing:          'idle',
  // Locomotion
  walk:              'walk_forward',
  walkForward:       'walk_forward',
  Walking:           'walk_forward',
  walkBackward:      'walk_back',
  strafeLeft:        'strafe_left',
  strafeRight:       'strafe_right',
  sidestepLeft:      'strafe_left',
  sidestepRight:     'strafe_right',
  Backdashing:       'backdash',
  run:               'walk_forward',
  dash:              'walk_forward',
  dashForward:       'walk_forward',
  crouch:            'crouch',
  crouchWalk:        'walk_forward',
  // Attacks
  lightAttack:       'attack_1',
  light:             'attack_1',
  Startup:           'attack_1',
  Active:            'attack_1',
  heavyAttack:       'attack_2',
  heavy:             'attack_2',
  heatBurst:         'attack_2',
  rageArt:           'attack_2',
  powerCrush:        'attack_2',
  crouchLightAttack: 'attack_1',
  crouchHeavyAttack: 'attack_2',
  jumpAttack:        'attack_2',
  runAttack:         'attack_2',
  CommandThrow:      'grapple',
  ThrowWhiff:        'idle',
  // Guard / block
  guard:             'block',
  Guard:             'block',
  block:             'block',
  Blockstun:         'block',
  guardLow:          'block',
  // Hit reactions
  hit:               'hit_reaction',
  Hitstun:           'hit_reaction',
  HitStun:           'hit_reaction',
  Stunned:           'hit_reaction',
  hitLow:            'hit_reaction',
  hitHigh:           'hit_reaction',
  // Knockdown / wakeup
  knockdown:         'knockdown',
  Knockdown:         'knockdown',
  ko:                'knockdown',
  KO:                'knockdown',
  Crumple:           'knockdown',
  WakeupTechRoll:    'getup',
  WakeupBackrise:    'getup',
  WakeupQuickStand:  'getup',
  wake:              'getup',
  // Post-match
  victory:           'victory',
  defeat:            'knockdown',
  taunt:             'taunt',
  intro:             'idle',
};

/** Map a clip name onto a semantic state via alias tables. Returns null if unmatched. */
export function inferSemanticStateFromClipName(clipName: string): string | null {
  const lower = clipName.toLowerCase();
  for (const [semanticState, aliases] of Object.entries(SEMANTIC_STATE_ALIASES)) {
    if (aliases.some((a) => a.toLowerCase() === lower || lower === semanticState.toLowerCase())) {
      return semanticState;
    }
  }
  return null;
}
