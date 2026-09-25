'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { BoneHitboxSystem } from '../engine/locomotion/BoneHitboxSystem';
import { AutoRigDetector, type RigDiagnosticReport } from '../engine/locomotion/AutoRigDetector';
import { ATTACK_ROOT_MOTION_PROFILES } from '../engine/locomotion/LocomotionSystem';
import {
  runDeformationIntegrityTest,
  type DeformationIntegrityInput,
} from '../engine/debug/DeformationIntegrityLogger';
import {
  runCharacterPipeline,
} from '../engine/pipeline/CharacterPipeline';
import {
  runAnimationIntegrityGate,
  type AnimationIntegrityReport,
} from '../engine/combat/AnimationIntegrityGate';
import { COMBAT_STATE_TO_SEMANTIC, SEMANTIC_STATE_ALIASES, inferSemanticStateFromClipName } from '../engine/retarget/SemanticStateAliases';
import { AnimationBridge } from '../../animation_bridge/retarget';
import { locomotionPreferences, reactionPreferences } from '../engine/retarget/FighterMotionBank';
import { evaluateLoadedRig } from '../engine/retarget/evaluateLoadedRig';
import {
  computeVisualPlaybackLock,
  computeStrikePlayback,
  isOneshotCombatState,
  isOneshotInterrupt,
  shouldHoldOneshot,
  isOneshotFinished,
  type OneshotHold,
} from '../engine/combat/ClipPlaybackGate';
import { applyFighterLook } from '../engine/render/applyPartPaint';
import type { GearAddon, PartPaint } from '../engine/render/paintMath';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
export interface FighterMeshProps {
  /** FighterStateMachine motion state key — drives animation playback */
  state: string;
  /** Optional explicit animation override (takes priority over state) */
  animation?: string;
  /** GLB URL — null renders nothing */
  modelUrl: string | null;
  /** World-space position — set by parent screen, never hardcoded here */
  position: [number, number, number];
  /** Facing direction — used only for hitbox offset math, NOT for rotation */
  facing: 1 | -1;
  /**
   * World-space Y rotation — set by parent screen.
   * CharacterSelect: 0 for both (face camera)
   * CombatArena3D:   P1=0, P2=Math.PI
   * FighterMesh itself is COMPLETELY DUMB about rotation — it just applies what it receives.
   */
  rotationY?: number;
  /** Faction color from the arena. Not applied — a single atlas would dye skin. */
  tint?: string;
  paint?: PartPaint;
  addon?: GearAddon;
  showHitbox?: boolean;
  hitboxGeometry?: { offsetX: number; offsetZ: number; width: number; depth: number } | null;
  /**
   * Monotonically-increasing counter — forces re-trigger even when animation key
   * string hasn't changed (e.g. two consecutive lightAttacks).
   */
  animationTrigger?: number;
  /**
   * Bank clip for the committed attack. The combat state stays lightAttack /
   * heavyKick (lock + hitbox). This is the swing that actually plays.
   */
  attackClip?: string | null;
  /** Roster id — picks this fighter's walk, stance, and sidestep clip. */
  characterId?: string;
  /**
   * Current locomotion velocity from FighterStateMachine.getWalkVelocity().
   * Used for velocity-weighted blend gating to prevent jitter on micro-inputs.
   */
  locomotionVelocity?: { forward: number; strafe: number };
  /**
   * Arena writes this every frame. useFrame copies it so walking
   * does not re-render the skinned mesh.
   */
  poseSlot?: { current: { x: number; y: number; z: number; yaw: number } };
  /**
   * Hit-stop freeze: when true, the animation mixer is paused.
   * Set by GameBattleArena when a heavy attack lands.
   */
  hitStopActive?: boolean;
  /**
   * Callback fired once the rig diagnostic report is ready.
   * Used by DebugOverlayHUD to show rig quality.
   */
  onRigDiagnostic?: (report: RigDiagnosticReport) => void;
  /**
   * Callback fired each frame with the bone hitbox system reference.
   * Used by GameBattleArena for bone-parented collision checks.
   */
  onBoneHitboxReady?: (system: BoneHitboxSystem) => void;
  /**
   * AGENT LAW: Callback fired when the 14-point deformation integrity test
   * returns BLOCKED on combat entry. The caller (CombatArena3D / GameBattleArena)
   * MUST freeze combat when this fires.
   *
   * @param characterName - The character whose deformation test failed
   * @param failingChecks - The IDs of the failing checks
   */
  onDeformationBlocked?: (characterName: string, failingChecks: string[]) => void;
  /**
   * Callback fired with the animation integrity gate report on first combat entry.
   * Reports PASS/BLOCKED/UNKNOWN with bone travel measurement, clip count,
   * resolved/unresolved track counts, and mixer root validation.
   * Use this to display the per-fighter animation status in DebugOverlayHUD.
   */
  onAnimationIntegrityReport?: (report: AnimationIntegrityReport) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation alias table — maps FighterStateMachine states → GLB clip names
// Sources: Schwarzerblitz engine, mhvnsnt/BrutalfistbaseofTekken3Recompiled,
//          mhvnsnt/Bannon, Mixamo standard names, Blender defaults
// ─────────────────────────────────────────────────────────────────────────────
const ANIMATION_ALIASES: Record<string, string[]> = {
  // ── Idle / Neutral ──────────────────────────────────────────────────────────
  idle:              ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'stance', 'Stance', 'bind', 'T-pose', 'TPose', 'tpose', 'rest', 'Rest', 'combatIdle', 'CombatIdle', 'fightingStance', 'FightingStance', 'readyStance', 'ReadyStance', 'BOX_IDLE', 'STANCE_WIDE', 'STANCE_BLADED', 'LOCO_PROWL', 'BREAKDANCE_READY', 'DRUNK_IDLE_VARIATION'],
  Neutral:           ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'stance', 'Stance'],
  // ── Walk Forward ────────────────────────────────────────────────────────────
  walk:              ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run', 'walkForward', 'WalkForward', 'walk_fwd', 'SBW_walk_fwd', 'T_walk_fwd', 'bf_walk_fwd'],
  Walking:           ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run', 'walkForward', 'WalkForward'],
  walkForward:       ['walkForward', 'WalkForward', 'walk', 'Walk', 'walking', 'Walking', 'forward', 'Forward', 'run', 'Run', 'walk_fwd', 'walk_forward', 'SBW_walk_fwd', 'T_walk_fwd', 'bf_walk_fwd', 'advance', 'approach', 'movingForward', 'LOCO_LUMBER', 'LOCO_STRUT', 'LOCO_LIGHT', 'LOCO_STALK', 'GINGA_FORWARD', 'DWARF_WALK', 'DRUNK_WALK'],
  // ── Walk Backward ───────────────────────────────────────────────────────────
  walkBackward:      ['walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk', 'backward', 'Backward', 'retreat', 'Retreat', 'walk_back', 'walk_bwd', 'SBW_walk_back', 'T_walk_back', 'bf_walk_back', 'movingBackward'],
  // ── Strafe ──────────────────────────────────────────────────────────────────
  strafeLeft:        ['GINGA_SIDEWAYS_2', 'ESQUIVA_4', 'CORKSCREW_EVADE', 'CROUCH_TORCH_WALK_RIGHT', 'strafeLeft', 'StrafeLeft', 'sidestepLeft', 'SidestepLeft', 'SBW_strafe_left', 'T_sidestep_left'],
  strafeRight:       ['GINGA_SIDEWAYS_2', 'ESQUIVA_4', 'CORKSCREW_EVADE', 'CROUCH_TORCH_WALK_RIGHT', 'strafeRight', 'StrafeRight', 'sidestepRight', 'SidestepRight', 'SBW_strafe_right', 'T_sidestep_right'],
  sidestepLeft:      ['GINGA_SIDEWAYS_2', 'ESQUIVA_4', 'CORKSCREW_EVADE', 'sidestepLeft', 'SidestepLeft', 'strafeLeft', 'StrafeLeft', 'T_sidestep_left', 'T_ssl'],
  sidestepRight:     ['GINGA_SIDEWAYS_2', 'ESQUIVA_4', 'CROUCH_TORCH_WALK_RIGHT', 'sidestepRight', 'SidestepRight', 'strafeRight', 'StrafeRight', 'T_sidestep_right', 'T_ssr'],
  // ── Backdash ────────────────────────────────────────────────────────────────
  Backdashing:       ['backdash', 'Backdash', 'backDash', 'BackDash', 'walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk', 'backstep', 'Backstep', 'quickRetreat', 'QuickRetreat', 'SBW_backdash', 'T_backdash'],
  // ── Crouch ──────────────────────────────────────────────────────────────────
  crouch:            ['crouch', 'Crouch', 'duck', 'Duck', 'lowStance', 'LowStance', 'crouching', 'Crouching', 'crouchStance', 'CrouchStance', 'lowGuard', 'LowGuard', 'SBW_crouch', 'T_crouch', 'bf_crouch'],
  crouchWalk:        ['crouchWalk', 'CrouchWalk', 'crouchForward', 'CrouchForward', 'crouch', 'Crouch'],
  // ── Guard / Block ───────────────────────────────────────────────────────────
  guard:             ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend', 'parry', 'Parry', 'blocking', 'Blocking', 'highBlock', 'HighBlock', 'standingBlock', 'StandingBlock', 'SBW_guard', 'T_guard', 'bf_guard'],
  Guard:             ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend'],
  Blockstun:         ['block', 'Block', 'guard', 'Guard', 'blockstun', 'Blockstun'],
  guardLow:          ['guardLow', 'GuardLow', 'lowBlock', 'LowBlock', 'crouchBlock', 'CrouchBlock', 'guard', 'Guard', 'block', 'Block'],
  // ── Light Attack ────────────────────────────────────────────────────────────
  light:             ['light', 'Light', 'punch', 'Punch', 'attack', 'Attack', 'jab', 'Jab', 'lightAttack', 'LightAttack', 'LP', 'lp'],
  lightAttack:       ['lightAttack', 'LightAttack', 'light', 'Light', 'punch', 'Punch', 'jab', 'Jab', 'attack', 'Attack', 'hit', 'Hit', 'strike', 'Strike', 'quickPunch', 'QuickPunch', 'punch1', 'Punch1', 'LP', 'lp', 'SBW_lightAttack', 'SBW_jab', 'T_jab', 'T_1', 'bf_jab', 'bf_chop', 'punchingLeft', 'punchingRight', 'attack_1', 'BOXING', 'BOXING__1_', 'BODY_JAB_CROSS'],
  Startup:           ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'jab', 'Jab', 'attack_1', 'BOXING'],
  Active:            ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'kick', 'Kick'],
  crouchLightAttack: ['crouchLightAttack', 'CrouchLightAttack', 'crouchPunch', 'CrouchPunch', 'lowPunch', 'LowPunch', 'lightAttack', 'LightAttack', 'jab', 'Jab'],
  // ── Heavy Attack / kicks ────────────────────────────────────────────────────
  heavy:             ['heavy', 'Heavy', 'strong', 'Strong', 'heavyAttack', 'HeavyAttack', 'cross', 'Cross'],
  heavyAttack:       ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'strong', 'Strong', 'cross', 'Cross', 'attack_rp', 'COMBO_PUNCH', 'BOXING__2_', 'BOXING__3_', 'ILLEGAL_ELBOW_PUNCH', 'BASH', 'BIG_BODY_BLOW', 'RP', 'rp', 'SBW_heavyAttack', 'SBW_cross', 'T_cross', 'T_2', 'bf_cross', 'bf_elbow', 'bf_uppercut'],
  lightKick:         ['lightKick', 'LightKick', 'attack_lk', 'DROP_KICK', 'ILLEGAL_KNEE', 'TIGER_FEINT_KICK', 'LK', 'lk', 'T_3', 'kick', 'Kick', 'kickingLeft'],
  heavyKick:         ['heavyKick', 'HeavyKick', 'attack_rk', 'HURRICANE_KICK', 'AU', 'CAPOEIRA', 'BASH', 'RK', 'rk', 'T_4', 'kickingRight', 'kickingForward'],
  crouchHeavyAttack: ['crouchHeavyAttack', 'CrouchHeavyAttack', 'crouchKick', 'CrouchKick', 'lowKick', 'LowKick', 'heavyAttack', 'HeavyAttack', 'kick', 'Kick'],
  jumpAttack:        ['jumpAttack', 'JumpAttack', 'airAttack', 'AirAttack', 'jumpingPunch', 'JumpingPunch', 'heavyAttack', 'HeavyAttack'],
  runAttack:         ['runAttack', 'RunAttack', 'dashAttack', 'DashAttack', 'runningAttack', 'RunningAttack', 'heavyAttack', 'HeavyAttack'],
  // ── Tekken Specials ─────────────────────────────────────────────────────────
  heatBurst:         ['heatBurst', 'HeatBurst', 'heat_burst', 'Heat_Burst', 'heavyAttack', 'HeavyAttack', 'special', 'Special'],
  rageArt:           ['rageArt', 'RageArt', 'rage_art', 'Rage_Art', 'finisher', 'Finisher', 'heavyAttack', 'HeavyAttack'],
  powerCrush:        ['powerCrush', 'PowerCrush', 'power_crush', 'armorMove', 'ArmorMove', 'heavyAttack', 'HeavyAttack'],
  // ── Command Throw ───────────────────────────────────────────────────────────
  CommandThrow:      ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'grab', 'Grab', 'throw', 'Throw', 'grapple', 'Grapple', 'suplex', 'Suplex', 'slam', 'Slam', 'SBW_throw', 'T_1_3', 'T_2_4', 'bf_grab', 'bf_beastMode', 'bf_powerbomb', 'bf_suplex', 'bf_exploder', 'bf_maime_driver', 'SUPLEX', 'GERMANSUPLEX', 'DDT', 'CHOKESLAM'],
  ThrowWhiff:        ['idle', 'Idle', 'neutral', 'Neutral'],
  // ── Hit Reactions ───────────────────────────────────────────────────────────
  hit:               ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'hitstun', 'Hitstun', 'damage', 'Damage', 'react', 'React', 'stagger', 'Stagger', 'recoil', 'Recoil', 'SBW_hit', 'T_hit', 'bf_hit_reaction', 'gettingHit', 'hitImpact'],
  Hitstun:           ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage', 'hitstun', 'Hitstun'],
  HitStun:           ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  Stunned:           ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'damage', 'Damage'],
  hitLow:            ['hitLow', 'HitLow', 'lowHit', 'LowHit', 'hit', 'Hit', 'hurt', 'Hurt'],
  hitHigh:           ['hitHigh', 'HitHigh', 'highHit', 'HighHit', 'hit', 'Hit', 'hurt', 'Hurt'],
  // ── Knockdown ───────────────────────────────────────────────────────────────
  knockdown:         ['knockdown', 'Knockdown', 'ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'down', 'Down', 'fallingBack', 'FallingBack', 'fallingForward', 'FallingForward', 'knockedDown', 'KnockedDown', 'SBW_knockdown', 'T_knockdown', 'bf_knockdown', 'bf_hard_knockdown'],
  Knockdown:         ['knockdown', 'Knockdown', 'ko', 'KO', 'fall', 'Fall', 'down', 'Down'],
  ko:                ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
  KO:                ['ko', 'KO', 'knockout', 'Knockout', 'death', 'Death', 'fall', 'Fall', 'knockdown', 'Knockdown'],
  Crumple:           ['ko', 'KO', 'knockdown', 'Knockdown', 'fall', 'Fall', 'death', 'Death', 'crumple', 'Crumple'],
  // ── Wakeup ──────────────────────────────────────────────────────────────────
  WakeupTechRoll:    ['techRoll', 'TechRoll', 'roll', 'Roll', 'rollForward', 'RollForward', 'forwardRoll', 'ForwardRoll', 'walkForward', 'WalkForward', 'walk', 'Walk', 'SBW_techroll', 'T_techroll'],
  WakeupBackrise:    ['backrise', 'Backrise', 'getUp', 'GetUp', 'rollBack', 'RollBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk', 'T_backrise'],
  WakeupQuickStand:  ['quickStand', 'QuickStand', 'getUp', 'GetUp', 'gettingUp', 'GettingUp', 'idle', 'Idle', 'standing', 'Standing', 'T_quickstand'],
  // ── Post-match ──────────────────────────────────────────────────────────────
  victory:           ['victory', 'Victory', 'win', 'Win', 'celebrate', 'Celebrate', 'taunt_win', 'TauntWin', 'victoryPose', 'VictoryPose', 'winPose', 'WinPose'],
  defeat:            ['defeat', 'Defeat', 'lose', 'Lose', 'knockdown', 'Knockdown', 'ko', 'KO', 'fall', 'Fall'],
  taunt:             ['taunt', 'Taunt', 'idle', 'Idle', 'victory', 'Victory'],
  intro:             ['intro', 'Intro', 'entrance', 'Entrance', 'idle', 'Idle'],
  // ── Run / Dash ──────────────────────────────────────────────────────────────
  run:               ['run', 'Run', 'running', 'Running', 'sprint', 'Sprint', 'dash', 'Dash', 'walkForward', 'WalkForward', 'walk', 'Walk', 'DRUNK_RUN_FORWARD'],
  dash:              ['dash', 'Dash', 'dashForward', 'DashForward', 'run', 'Run', 'walkForward', 'WalkForward', 'dash_forward'],
  dashForward:       ['dashForward', 'DashForward', 'dash', 'Dash', 'run', 'Run', 'walkForward', 'WalkForward', 'dash_forward'],
  jump:              ['jump', 'Jump', 'CROSS_JUMPS', 'BIG_JUMP', 'jumpForward', 'jumpBack'],
  jumpForward:       ['jumpForward', 'JumpForward', 'jump', 'Jump', 'CROSS_JUMPS', 'BIG_JUMP'],
  jumpBack:          ['jumpBack', 'JumpBack', 'jump', 'Jump', 'CROSS_JUMPS', 'BIG_JUMP'],
  Jumping:           ['jump', 'Jump', 'CROSS_JUMPS', 'BIG_JUMP'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Crossfade durations per state key (in seconds)
// Frame counts at 60fps: 6f=0.100s, 4f=0.067s, 3f=0.050s, 2f=0.033s
// ─────────────────────────────────────────────────────────────────────────────
const FADE_DURATIONS: Record<string, number> = {
  // Locomotion — gentle blends
  idle:              0.100,  // 6 frames
  Neutral:           0.100,
  walk:              0.100,
  walkForward:       0.100,
  walkBackward:      0.100,
  Walking:           0.100,
  strafeLeft:        0.100,
  strafeRight:       0.100,
  run:               0.060,
  dash:              0.050,
  dashForward:       0.050,
  jump:              0.040,
  jumpForward:       0.040,
  jumpBack:          0.040,
  Jumping:           0.040,
  crouch:            0.070,
  light:             0.02,
  lightAttack:       0.02,
  Startup:           0.02,
  Active:            0.02,
  heavy:             0.03,
  heavyAttack:       0.03,
  lightKick:         0.02,
  heavyKick:         0.03,
  CommandThrow:      0.04,
  hit:               0.02,
  hitLow:            0.02,
  hitHigh:           0.02,
  // Backdash — slightly faster snap (4 frames)
  Backdashing:       0.067,
  // Wakeup
  WakeupTechRoll:    0.05,
  WakeupBackrise:    0.05,
  WakeupQuickStand:  0.04,
  Hitstun:           0.02,
  HitStun:           0.02,
  Stunned:           0.033,
  // Knockdown
  knockdown:         0.067,
  Knockdown:         0.067,
  ko:                0.067,
  KO:                0.067,
  Crumple:           0.067,
  // Guard
  guard:             0.083,
  Guard:             0.083,
  block:             0.083,
  Blockstun:         0.083,
  // Throw whiff
  ThrowWhiff:        0.083,
};
const DEFAULT_FADE = 0.083;

// ─────────────────────────────────────────────────────────────────────────────
// States that loop continuously
// ─────────────────────────────────────────────────────────────────────────────
const LOOP_STATES = new Set([
  'idle', 'Neutral', 'walk', 'walkForward', 'walkBackward', 'Walking',
  'strafeLeft', 'strafeRight', 'sidestepLeft', 'sidestepRight',
  'guard', 'Guard', 'block', 'Blockstun',
  'run', 'dash', 'dashForward', 'crouch',
  'Knockdown', 'WakeupTechRoll', 'WakeupBackrise', 'WakeupQuickStand',
  'Backdashing',
]);

const ATTACK_STATES = new Set([
  'lightAttack', 'heavyAttack', 'lightKick', 'heavyKick',
  'light', 'heavy', 'Startup', 'Active', 'CommandThrow',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Velocity threshold — below this magnitude, don't trigger walk animation
// Prevents jitter from micro-inputs that don't reach full walk speed
// ─────────────────────────────────────────────────────────────────────────────
const VELOCITY_ANIM_THRESHOLD = 0.12;

/**
 * Minimum time (seconds) a crossfade must be held before another can begin.
 * Prevents rapid state oscillation (walk→idle→walk in <3 frames) from
 * stacking crossfades and causing visual jitter.
 */
const MIN_CROSSFADE_HOLD_S = 0.05; // 3 frames at 60fps

// ─────────────────────────────────────────────────────────────────────────────
// FORWARD DIRECTION NOTE
// ─────────────────────────────────────────────────────────────────────────────
// Forward direction detection is handled by CharacterPipeline.determineForwardCorrection().
// It uses GEOMETRY CENTROID ONLY — no bone position inference (head Z vs hips Z).
// The pose-based heuristic was removed because a fighting stance can put the
// head forward without the character's actual forward axis being +Z.
// See src/engine/pipeline/CharacterPipeline.ts for the authoritative implementation.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Resolve the best matching clip name from available actions
// ─────────────────────────────────────────────────────────────────────────────
function buildClipsByState(actions: Record<string, THREE.AnimationAction>): Map<string, THREE.AnimationClip> {
  const clipsByState = new Map<string, THREE.AnimationClip>();
  for (const [name, action] of Object.entries(actions)) {
    const clip = action.getClip();
    const semantic = (clip as any).userData?.semanticState
      ?? inferSemanticStateFromClipName(clip.name || name)
      ?? inferSemanticStateFromClipName(name);
    if (semantic && !clipsByState.has(semantic)) {
      clipsByState.set(semantic, clip);
    }
  }
  return clipsByState;
}

function findActionName(actions: Record<string, THREE.AnimationAction>, name: string): string | null {
  if (actions[name]) return name;
  const lower = name.toLowerCase();
  const keys = Object.keys(actions);
  const exact = keys.find((k) => k.toLowerCase() === lower);
  if (exact) return exact;
  const needle = '|' + lower;
  return keys.find((k) => k.toLowerCase().endsWith(needle)) ?? null;
}

function resolveClipName(
  key: string,
  actions: Record<string, THREE.AnimationAction>,
  preferred: string[] = [],
): string | null {
  for (const name of preferred) {
    const hit = findActionName(actions, name);
    if (hit) return hit;
  }

  const availableClips = Object.keys(actions);
  const clipsByState = buildClipsByState(actions);

  const bridged = AnimationBridge.getClipForCombatState(key, clipsByState);
  if (bridged) {
    const clipName = Object.keys(actions).find((n) => actions[n].getClip() === bridged) ?? bridged.name;
    if (actions[clipName]) return clipName;
  }

  const semanticState = COMBAT_STATE_TO_SEMANTIC[key];
  if (semanticState) {
    if (actions[semanticState]) return semanticState;
    const aliases = SEMANTIC_STATE_ALIASES[semanticState] ?? [semanticState];
    const semanticFound = availableClips.find((c) =>
      aliases.some((a) => c.toLowerCase() === a.toLowerCase()),
    );
    if (semanticFound) return semanticFound;
  }

  const aliases = ANIMATION_ALIASES[key] ?? [key];
  let found = availableClips.find((c) =>
    aliases.some((a) => c.toLowerCase() === a.toLowerCase()),
  );
  if (found) return found;

  if (key === 'idle' || key === 'Neutral') {
    found = availableClips.find((c) => c.toLowerCase().includes('idle'));
    if (found) return found;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalized scene result
// ─────────────────────────────────────────────────────────────────────────────
interface NormalizedResult {
  scene: THREE.Group;
  /** Y rotation to apply to the inner scene to correct forward direction */
  forwardCorrectionY: number;
  /** AnimationMixer bound to the normalized scene's actual bones */
  mixer: THREE.AnimationMixer;
  /** Actions map: clip name → AnimationAction */
  actions: Record<string, THREE.AnimationAction>;
  /** SkeletonHelper for visual bone display (null if no bones) */
  skeletonHelper: THREE.SkeletonHelper | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT LAW: Universal GLB normalization
//
// Delegates to the shared CharacterPipeline (src/engine/pipeline/CharacterPipeline.ts).
// Both Character Select and Combat use the same pipeline — no divergence.
//
// Pipeline:
//   SkeletonUtils.clone() → frustum culling disabled → skin weights normalized
//   → Box3 floor normalization (instance, not bones) → geometry-centroid forward detection
//   → AnimationMixer on cloned scene → name-based clip binding
//
// AUTHORED SKELETON LAW:
//   - NO synthetic rig generation for bone-less models
//   - NO character-specific corrections
//   - Characters that fail validation return null (BLOCKED)
//   - The caller (FighterMeshInner) must handle null as BLOCKED
//
// NEVER use per-character manual Y offsets.
// NEVER hardcode rotation corrections per character.
// NEVER bind the mixer to the outer group — it must target the cloned scene.
// ─────────────────────────────────────────────────────────────────────────────
async function normalizeGLB(
  scene: THREE.Group,
  animations: THREE.AnimationClip[],
  gltfUrl: string,
  _report: RigDiagnosticReport,
): Promise<NormalizedResult | null> {
  // Delegate to the universal CharacterPipeline.
  // applyPSXShader=true for combat renderer.
  const result = await runCharacterPipeline(scene, animations, gltfUrl, true);

  if (!result) {
    // BLOCKED — asset failed pre-clone validation.
    // DO NOT secretly re-rig. DO NOT generate synthetic bones.
    // The caller must handle null as BLOCKED — ASSET DEFORMATION INTEGRITY FAILURE.
    console.error(
      `[FighterMesh] 🚫 BLOCKED — "${gltfUrl.split('/').pop()}" failed CharacterPipeline validation. ` +
      `Combat entry blocked. Fix the source GLB asset.`
    );
    return null;
  }

  // Map PipelineResult to NormalizedResult (same shape, just aliased)
  return {
    scene: result.scene,
    forwardCorrectionY: result.forwardCorrectionY,
    mixer: result.mixer,
    actions: result.actions,
    skeletonHelper: result.skeletonHelper,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inner component — loaded inside Suspense, receives the GLTF scene + animations
// ─────────────────────────────────────────────────────────────────────────────
function FighterMeshInner({
  gltfUrl,
  state,
  animation,
  position,
  facing,
  rotationY = 0,
  showHitbox = false,
  hitboxGeometry = null,
  animationTrigger = 0,
  attackClip = null,
  paint,
  addon,
  characterId,
  poseSlot,
  hitStopActive = false,
  onRigDiagnostic,
  onBoneHitboxReady,
  onDeformationBlocked,
  onAnimationIntegrityReport,
}: {
  gltfUrl: string;
  state: string;
  animation?: string;
  position: [number, number, number];
  facing: 1 | -1;
  rotationY?: number;
  tint?: string;
  showHitbox?: boolean;
  hitboxGeometry?: FighterMeshProps['hitboxGeometry'];
  animationTrigger?: number;
  attackClip?: string | null;
  paint?: PartPaint;
  addon?: GearAddon;
  characterId?: string;
  locomotionVelocity?: { forward: number; strafe: number };
  poseSlot?: { current: { x: number; y: number; z: number; yaw: number } };
  hitStopActive?: boolean;
  onRigDiagnostic?: (report: RigDiagnosticReport) => void;
  onBoneHitboxReady?: (system: BoneHitboxSystem) => void;
  onDeformationBlocked?: (characterName: string, failingChecks: string[]) => void;
  onAnimationIntegrityReport?: (report: AnimationIntegrityReport) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [normalized, setNormalized] = useState<NormalizedResult | null>(null);
  const paintKey = JSON.stringify(paint ?? {});

  useEffect(() => {
    if (!normalized) return;
    applyFighterLook(normalized.scene, paint, addon);
  }, [normalized, paintKey, addon]);

  // ── Jitter-prevention refs ────────────────────────────────────────────────
  /** The clip name that is currently playing (or crossfading to) */
  const activeClipRef = useRef<string | null>(null);
  /** Timestamp of the last crossfade start — enforces MIN_CROSSFADE_HOLD_S */
  const lastCrossfadeTimeRef = useRef<number>(0);
  /** The resolved clip name of the last state we committed to */
  const committedClipRef = useRef<string | null>(null);
  const lastPlayedTriggerRef = useRef(0);
  /** Tekken/SB oneshot hold — idle/walk cannot cut a punch still playing. */
  const oneshotHoldRef = useRef<OneshotHold | null>(null);
  const pendingLoopRef = useRef<string | null>(null);
  const [deferTick, setDeferTick] = useState(0);
  const deferTimerRef = useRef<number | null>(null);

  // ── Bone hitbox system ────────────────────────────────────────────────────
  const boneHitboxRef = useRef<BoneHitboxSystem>(new BoneHitboxSystem());

  // ── Active attack key for root motion ────────────────────────────────────
  const activeAttackKeyRef = useRef<string | null>(null);

  // ── Deformation integrity: track whether combat-entry check has run ───────
  // AGENT LAW: The 14-point deformation integrity test runs ONCE per fighter
  // load when the first combat-active state is entered. It never runs on
  // select-screen idle states. If the test returns BLOCKED, combat is frozen
  // by logging the failure — the caller (CombatArena3D) reads the ref.
  const combatEntryCheckedRef = useRef<boolean>(false);
  /**
   * Set to true if the deformation integrity test PASSED.
   * Set to false if BLOCKED — CombatArena3D should freeze combat.
   * Exposed via onDeformationBlocked callback if provided.
   */
  const deformationPassedRef = useRef<boolean>(true);

  // useGLTF caches the result — Meshopt + Draco MUST be on (Bannon GLBs are Meshopt).
  // drei only enables them when the flags are passed; defaults on the helper are unused.
  const { scene, animations } = useGLTF(gltfUrl, true, true);

  // ── Universal normalization + mixer creation ──────────────────────────────
  useEffect(() => {
    if (!scene) return;

    // Run rig diagnostic on the original scene
    const report = AutoRigDetector.analyze(scene, animations);
    evaluateLoadedRig(scene, gltfUrl);
    onRigDiagnostic?.(report);

    // Normalize and create mixer bound to the cloned visible scene
    let cancelled = false;
    normalizeGLB(scene as THREE.Group, animations, gltfUrl, report).then(result => {
      if (cancelled) return;

      // BLOCKED — asset failed CharacterPipeline validation.
      // DO NOT secretly re-rig. Fire the blocked callback and stop.
      if (!result) {
        const characterName = gltfUrl.split('/').pop()?.replace('.glb', '') ?? gltfUrl;
        console.error(
          `[FighterMesh] 🚫 BLOCKED — "${characterName}" failed CharacterPipeline validation. ` +
          `ASSET DEFORMATION INTEGRITY FAILURE. Fix the source GLB.`
        );
        onDeformationBlocked?.(characterName, ['PIPELINE_VALIDATION_FAILED']);
        return;
      }

      // Initialize bone hitbox system from the normalized scene
      result.scene.updateMatrixWorld(true);
      boneHitboxRef.current.initFromSkeleton(result.scene);
      onBoneHitboxReady?.(boneHitboxRef.current);

      // Integrity once at load, never on the first punch. The displacement
      // check calls mixer.stopAllAction(), which used to kill the swing
      // the player just threw and then restart it.
      if (!combatEntryCheckedRef.current) {
        combatEntryCheckedRef.current = true;
        const characterName = gltfUrl.split('/').pop()?.replace('.glb', '') ?? gltfUrl;
        const integrityInput: DeformationIntegrityInput = {
          characterName,
          modelUrl: gltfUrl,
          clonedScene: result.scene,
          mixer: result.mixer,
          actions: result.actions,
          forwardCorrectionY: result.forwardCorrectionY,
        };
        const report = runDeformationIntegrityTest(integrityInput);
        const animIntegrityReport = runAnimationIntegrityGate({
          characterName: characterName.toUpperCase(),
          clonedScene: result.scene,
          mixer: result.mixer,
          actions: result.actions,
          activeClipName: null,
        });
        (onAnimationIntegrityReport as ((r: AnimationIntegrityReport) => void) | undefined)?.(animIntegrityReport);
        const isUnrenderable = report.verdict === 'BLOCKED' && report.failingChecks.includes('NO_VISIBLE_MESH');
        if (isUnrenderable) {
          deformationPassedRef.current = false;
          console.error(
            `[FighterMesh] 🚫 COMBAT FROZEN — ${characterName} has NO_VISIBLE_MESH: nothing to render.`,
          );
          onDeformationBlocked?.(characterName, report.failingChecks);
          return;
        }
        if (report.verdict === 'BLOCKED') {
          console.warn(
            `[FighterMesh] ⚠️ Deformation integrity warnings for ${characterName}: [${report.failingChecks.join(', ')}]`,
          );
        }
      }

      setNormalized(result);
    });

    // Cleanup: stop all actions when model changes
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, gltfUrl]);

  // ── Bind FighterStateMachine state → AnimationMixer playback ─────────────
  useEffect(() => {
    if (!normalized) return;
    const { actions } = normalized;

    const availableClips = Object.keys(actions);
    if (availableClips.length === 0) {
      console.warn(`[FighterMesh] ⚠️ No animation clips available for "${gltfUrl.split('/').pop()}"`);
      return;
    }

    const inputKey = animation ?? state;
    const isAttack = ATTACK_STATES.has(inputKey) || isOneshotCombatState(inputKey);
    const preferred = isAttack && attackClip
      ? [attackClip]
      : [
          ...reactionPreferences(inputKey),
          ...locomotionPreferences(characterId ?? '', inputKey),
        ];
    let clipName = resolveClipName(inputKey, actions, preferred) as string | null;
    const now = performance.now() / 1000;

    // ── Tekken/SB gate: do not hard-cut a committed oneshot to idle/walk ──
    const hold = oneshotHoldRef.current;
    if (hold && !isOneshotInterrupt(inputKey)) {
      const holdAction = actions[hold.clipName];
      const holdClip = holdAction?.getClip();
      const clipTime = holdAction?.time ?? 0;
      const clipDur = holdClip?.duration ?? hold.lockDuration;
      if (shouldHoldOneshot(inputKey, hold, clipTime, clipDur, now)) {
        if (!isAttack) pendingLoopRef.current = inputKey;
        return;
      }
      oneshotHoldRef.current = null;
    }
    if (isAttack) {
      const profile = ATTACK_ROOT_MOTION_PROFILES[inputKey];
      if (profile?.hasRootMotion) {
        activeAttackKeyRef.current = inputKey;
        boneHitboxRef.current.activateAttack(inputKey);
      } else {
        activeAttackKeyRef.current = null;
      }
    } else if (activeAttackKeyRef.current) {
      boneHitboxRef.current.deactivateAll();
      activeAttackKeyRef.current = null;
    }

    // ── COMBAT ENTRY integrity already ran at load (stopAllAction would
    // restart the first punch if it ran here).

    // Only block animation for truly unrenderable assets (NO_VISIBLE_MESH)
    if (!deformationPassedRef.current) {
      return;
    }

    if (!clipName || !actions[clipName]) {
      const semantic = COMBAT_STATE_TO_SEMANTIC[inputKey];
      if (semantic && semantic !== 'idle' && actions[semantic]) {
        clipName = semantic;
      } else if (inputKey === 'idle' || inputKey === 'Neutral') {
        clipName = availableClips.find((n) => /idle/i.test(n)) ?? availableClips[0] ?? null;
      }
    }
    if (!clipName || !actions[clipName]) {
      console.warn(`[FighterMesh] ⚠️ No matching clip for state="${state}" animation="${animation}" on "${gltfUrl.split('/').pop()}"`);
      return;
    }

    const nextAction = actions[clipName];
    const fadeDuration = FADE_DURATIONS[inputKey] ?? DEFAULT_FADE;
    const isLoop = LOOP_STATES.has(inputKey);
    const isUrgent = isAttack || ['hit', 'Hitstun', 'HitStun', 'Stunned', 'knockdown', 'Knockdown', 'ko', 'KO', 'Crumple', 'jump', 'jumpForward', 'jumpBack', 'Jumping'].includes(inputKey);
    const isSameClip = clipName === committedClipRef.current;
    const nowPlay = performance.now() / 1000;

    if (isSameClip && isAttack) {
      if (animationTrigger <= lastPlayedTriggerRef.current) return;
      lastPlayedTriggerRef.current = animationTrigger;
    } else if (!isUrgent && isSameClip) {
      return;
    } else if (!isUrgent && nowPlay - lastCrossfadeTimeRef.current < MIN_CROSSFADE_HOLD_S) {
      // Don't drop the transition — Claude's deferUntil. An effect does not
      // re-run just because time passed.
      const wait = MIN_CROSSFADE_HOLD_S - (nowPlay - lastCrossfadeTimeRef.current);
      if (deferTimerRef.current) window.clearTimeout(deferTimerRef.current);
      deferTimerRef.current = window.setTimeout(() => {
        deferTimerRef.current = null;
        setDeferTick((n) => n + 1);
      }, Math.max(16, wait * 1000));
      return;
    }
    if (isAttack) lastPlayedTriggerRef.current = animationTrigger;

    const clipDuration = Math.max(0.08, nextAction.getClip().duration);
    const lockDuration = isAttack
      ? computeVisualPlaybackLock(inputKey, clipName, clipDuration)
      : clipDuration;
    const strike = isAttack
      ? computeStrikePlayback(clipDuration, lockDuration, clipName)
      : { timeScale: 1, startTime: 0 };

    nextAction.enabled = true;
    nextAction.paused = false;
    nextAction.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
    nextAction.clampWhenFinished = !isLoop;
    nextAction.reset();
    if (strike.startTime > 0) nextAction.time = strike.startTime;
    nextAction.setEffectiveTimeScale(strike.timeScale);
    nextAction.setEffectiveWeight(1);

    const seen = new Set<THREE.AnimationAction>();
    for (const name of availableClips) {
      const a = actions[name];
      if (!a || a === nextAction || seen.has(a)) continue;
      seen.add(a);
      // Hard-cut idle off whenever a real combat/locomotion clip plays so
      // breathing-idle cannot win the blend and leave a "living statue".
      if (isUrgent || (inputKey !== 'idle' && inputKey !== 'Neutral')) {
        a.stop();
        a.enabled = false;
        a.setEffectiveWeight(0);
      } else if (a.isRunning()) {
        a.fadeOut(fadeDuration);
      }
    }
    nextAction.play();

    if (isAttack) {
      oneshotHoldRef.current = {
        clipName,
        inputKey,
        lockDuration,
        startedAt: nowPlay,
      };
      pendingLoopRef.current = null;
    } else {
      oneshotHoldRef.current = null;
    }

    activeClipRef.current = clipName;
    committedClipRef.current = clipName;
    lastCrossfadeTimeRef.current = nowPlay;
  }, [state, animation, animationTrigger, attackClip, characterId, normalized, gltfUrl, deferTick]);

  // Idle kickstart is handled by the bind effect when `normalized` first lands.
  // A second auto-play effect was overwriting punches with breathing idle.

  // ── Hit-stop: pause/resume mixer time scale ───────────────────────────────
  useEffect(() => {
    if (!normalized) return;
    const { mixer } = normalized;
    // AGENT LAW: Use timeScale=0 to freeze animation during hit-stop.
    // We still call mixer.update() every frame — timeScale=0 means no time advances.
    // This is correct Three.js hit-stop pattern: freeze in place, not skip updates.
    if (hitStopActive) {
      mixer.timeScale = 0;
    } else {
      mixer.timeScale = 1;
    }
  }, [hitStopActive, normalized]);

  // ── Toggle skeleton helper visibility with showHitbox ────────────────────
  useEffect(() => {
    if (!normalized?.skeletonHelper) return;
    normalized.skeletonHelper.visible = showHitbox;
  }, [showHitbox, normalized]);

  // ── useFrame: position + rotation + mixer update + bone hitbox ───────────
  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const slot = poseSlot?.current;
    if (slot) {
      groupRef.current.position.set(slot.x, slot.y, slot.z);
      groupRef.current.rotation.y = slot.yaw;
    } else {
      groupRef.current.position.set(position[0], position[1], position[2]);
      groupRef.current.rotation.y = rotationY;
    }
    groupRef.current.scale.set(1, 1, 1);

    // AGENT LAW: ALWAYS call mixer.update() every frame.
    // Hit-stop is handled by mixer.timeScale = 0 (set in useEffect above).
    // Skipping mixer.update() entirely causes animation state to desync —
    // the mixer's internal clock stops tracking and crossfades break on resume.
    if (normalized) {
      normalized.mixer.update(Math.min(delta, 0.1));
      // Update skeleton helper world matrices so bone lines track correctly
      if (normalized.skeletonHelper && showHitbox) {
        normalized.skeletonHelper.updateMatrixWorld(true);
      }

      const hold = oneshotHoldRef.current;
      if (hold) {
        const holdAction = normalized.actions[hold.clipName];
        const holdClip = holdAction?.getClip();
        const finished = !holdAction || !holdClip || isOneshotFinished(holdAction.time, holdClip.duration);
        if (finished) {
          oneshotHoldRef.current = null;
          const pending = pendingLoopRef.current;
          if (pending) {
            pendingLoopRef.current = null;
            const loopName = resolveClipName(pending, normalized.actions);
            const loopAction = loopName ? normalized.actions[loopName] : null;
            if (loopAction && loopName) {
              loopAction.enabled = true;
              loopAction.paused = false;
              loopAction.setLoop(THREE.LoopRepeat, Infinity);
              loopAction.clampWhenFinished = false;
              loopAction.reset();
              loopAction.setEffectiveTimeScale(1);
              loopAction.setEffectiveWeight(1);
              if (holdAction && holdAction !== loopAction) {
                holdAction.fadeOut(0.08);
              }
              loopAction.play();
              activeClipRef.current = loopName;
              committedClipRef.current = loopName;
            }
          }
        }
      }
    }

    // Update bone hitbox system (tracks bone world positions)
    // Always update so hitbox positions stay in sync with skeleton
    boneHitboxRef.current.update(delta);
  });

  if (!normalized) return null;

  const activeSpheres = boneHitboxRef.current.getActiveSpheres();

  return (
    <group ref={groupRef} position={position}>
      {/*
        AGENT LAW: The inner group applies the forward correction rotation.
        This is SEPARATE from the outer group's rotationY (P1/P2 orientation).
        forwardCorrectionY is 0 for correctly-exported models (Bannon, Maime).
        forwardCorrectionY is Math.PI for models exported facing +Z (most others).
        This is detected automatically — never hardcoded per character.
      */}
      <group rotation={[0, normalized.forwardCorrectionY, 0]}>
        <primitive object={normalized.scene} />
        {/* Skeleton helper — shows bones/joints as green wireframe lines when showHitbox=true */}
        {normalized.skeletonHelper && showHitbox && (
          <primitive object={normalized.skeletonHelper} />
        )}
      </group>

      {/* Legacy AABB hitbox (shown when bone hitboxes are unavailable) */}
      {showHitbox && hitboxGeometry && activeSpheres.length === 0 && (
        <mesh
          position={[
            hitboxGeometry.offsetX * (facing < 0 ? -1 : 1),
            1.0,
            hitboxGeometry.offsetZ,
          ]}
        >
          <boxGeometry args={[hitboxGeometry.width, 1.6, hitboxGeometry.depth]} />
          <meshBasicMaterial color="#ff2222" wireframe transparent opacity={0.6} />
        </mesh>
      )}

      {/* Bone-parented hitbox spheres — rendered at bone world positions */}
      {showHitbox && activeSpheres.map((sphere, i) => (
        <mesh
          key={`bone-hitbox-${sphere.boneSlot}-${i}`}
          position={[
            sphere.worldCenter.x - position[0],
            sphere.worldCenter.y - position[1],
            sphere.worldCenter.z - position[2],
          ]}
        >
          <sphereGeometry args={[sphere.radius, 8, 8]} />
          <meshBasicMaterial
            color={sphere.attackLevel === 'high' ? '#ff4400' : sphere.attackLevel === 'low' ? '#ffaa00' : '#ff2222'}
            wireframe
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback placeholder while GLB loads
// ─────────────────────────────────────────────────────────────────────────────
function FighterPlaceholder({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.925, 0]}>
        <boxGeometry args={[0.5, 1.85, 0.3]} />
        <meshBasicMaterial color="#333333" wireframe />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Public export — wraps inner component in Suspense
// ─────────────────────────────────────────────────────────────────────────────
export function FighterMesh({
  modelUrl,
  position,
  facing,
  rotationY = 0,
  state,
  animation,
  tint,
  paint,
  addon,
  showHitbox = false,
  hitboxGeometry = null,
  animationTrigger = 0,
  attackClip = null,
  characterId,
  locomotionVelocity,
  poseSlot,
  hitStopActive = false,
  onRigDiagnostic,
  onBoneHitboxReady,
  onDeformationBlocked,
  onAnimationIntegrityReport,
}: FighterMeshProps) {
  if (!modelUrl) return <FighterPlaceholder position={position} />;

  return (
    <Suspense fallback={<FighterPlaceholder position={position} />}>
      <FighterMeshInner
        gltfUrl={modelUrl}
        state={state}
        animation={animation}
        position={position}
        facing={facing}
        rotationY={rotationY}
        tint={tint}
        showHitbox={showHitbox}
        hitboxGeometry={hitboxGeometry}
        animationTrigger={animationTrigger}
        attackClip={attackClip}
        paint={paint}
        addon={addon}
        characterId={characterId}
        locomotionVelocity={locomotionVelocity}
        poseSlot={poseSlot}
        hitStopActive={hitStopActive}
        onRigDiagnostic={onRigDiagnostic}
        onBoneHitboxReady={onBoneHitboxReady}
        onDeformationBlocked={onDeformationBlocked}
        onAnimationIntegrityReport={onAnimationIntegrityReport}
      />
    </Suspense>
  );
}
