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
  idle:           ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'stance', 'Stance', 'combatIdle', 'CombatIdle', 'idle_procedural_placeholder'],
  walk_forward:   ['walk', 'Walk', 'walkForward', 'WalkForward', 'walking', 'Walking', 'walk_fwd', 'SBW_walk_fwd', 'walk_forward_procedural_placeholder'],
  walk_back:      ['walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk_back', 'walk_bwd', 'SBW_walk_back', 'walk_back_procedural_placeholder'],
  strafe_left:    ['strafeLeft', 'StrafeLeft', 'sidestepLeft', 'SidestepLeft', 'SBW_strafe_left'],
  strafe_right:   ['strafeRight', 'StrafeRight', 'sidestepRight', 'SidestepRight', 'SBW_strafe_right'],
  attack_1:       ['lightAttack', 'LightAttack', 'punch', 'Punch', 'jab', 'Jab', 'attack', 'Attack', 'LP', 'T_1', 'bf_jab', 'attack_1_procedural_placeholder'],
  attack_2:       ['heavyAttack', 'HeavyAttack', 'kick', 'Kick', 'cross', 'Cross', 'RP', 'T_2', 'bf_cross', 'attack_2_procedural_placeholder'],
  block:          ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend', 'SBW_guard', 'T_guard', 'block_procedural_placeholder'],
  hit_reaction:   ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'hitstun', 'Hitstun', 'SBW_hit', 'T_hit', 'hit_reaction_procedural_placeholder'],
  knockdown:      ['knockdown', 'Knockdown', 'ko', 'KO', 'fall', 'Fall', 'SBW_knockdown', 'T_knockdown', 'knockdown_procedural_placeholder'],
  getup:          ['getUp', 'GetUp', 'quickStand', 'QuickStand', 'gettingUp', 'GettingUp', 'T_quickstand', 'getup_procedural_placeholder'],
  // Prefer Mixamo-compatible attacker clinch only. Do NOT alias DOUBLE_LEG_TAKEDOWN___VICTIM
  // (victim role) or MoMask STANCE_CROUCH as authored grapple — those stay MISSING_CLIP in preferred bank.
  grapple:        ['grab', 'Grab', 'throw', 'Throw', 'grapple', 'Grapple', 'clinch', 'Clinch', 'suplex', 'Suplex', 'chokeslam', 'Chokeslam', 'SBW_throw', 'T_1_3', 'bf_clinch', 'bf_grab'],
  crouch:         ['crouch', 'Crouch', 'duck', 'Duck', 'SBW_crouch', 'T_crouch'],
  run:            ['run', 'Run', 'running', 'Running', 'sprint', 'Sprint'],
  dash_forward:   ['dashForward', 'DashForward', 'dash', 'Dash', 'run', 'Run'],
  backdash:       ['backdash', 'Backdash', 'backDash', 'BackDash', 'SBW_backdash', 'T_backdash'],
  victory:        ['victory', 'Victory', 'win', 'Win', 'victoryPose', 'VictoryPose'],
  defeat:         ['defeat', 'Defeat', 'lose', 'Lose', 'knockdown', 'Knockdown'],
  taunt:          ['taunt', 'Taunt', 'idle', 'Idle'],
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

/**
 * Infer a semantic state from a clip name via SEMANTIC_STATE_ALIASES.
 * Returns null when no alias matches — never invents idle.
 */
export function inferSemanticStateFromClipName(clipName: string): string | null {
  const lower = clipName.toLowerCase();
  for (const [semanticState, aliases] of Object.entries(SEMANTIC_STATE_ALIASES)) {
    if (aliases.some((a) => a.toLowerCase() === lower || lower === semanticState.toLowerCase())) {
      return semanticState;
    }
  }
  return null;
}
