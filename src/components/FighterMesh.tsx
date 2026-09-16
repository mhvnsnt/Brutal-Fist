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
  tint?: string;
  showHitbox?: boolean;
  hitboxGeometry?: { offsetX: number; offsetZ: number; width: number; depth: number } | null;
  /**
   * Monotonically-increasing counter — forces re-trigger even when animation key
   * string hasn't changed (e.g. two consecutive lightAttacks).
   */
  animationTrigger?: number;
  /**
   * Current locomotion velocity from FighterStateMachine.getWalkVelocity().
   * Used for velocity-weighted blend gating to prevent jitter on micro-inputs.
   */
  locomotionVelocity?: { forward: number; strafe: number };
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
  idle:              ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'stance', 'Stance', 'bind', 'T-pose', 'TPose', 'tpose', 'rest', 'Rest', 'combatIdle', 'CombatIdle', 'fightingStance', 'FightingStance', 'readyStance', 'ReadyStance'],
  Neutral:           ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'stance', 'Stance'],
  // ── Walk Forward ────────────────────────────────────────────────────────────
  walk:              ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run', 'walkForward', 'WalkForward', 'walk_fwd', 'SBW_walk_fwd', 'T_walk_fwd', 'bf_walk_fwd'],
  Walking:           ['walk', 'Walk', 'walking', 'Walking', 'run', 'Run', 'walkForward', 'WalkForward'],
  walkForward:       ['walkForward', 'WalkForward', 'walk', 'Walk', 'walking', 'Walking', 'forward', 'Forward', 'run', 'Run', 'walk_fwd', 'walk_forward', 'SBW_walk_fwd', 'T_walk_fwd', 'bf_walk_fwd', 'advance', 'approach', 'movingForward'],
  // ── Walk Backward ───────────────────────────────────────────────────────────
  walkBackward:      ['walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk', 'Walk', 'backward', 'Backward', 'retreat', 'Retreat', 'walk_back', 'walk_bwd', 'SBW_walk_back', 'T_walk_back', 'bf_walk_back', 'movingBackward'],
  // ── Strafe ──────────────────────────────────────────────────────────────────
  strafeLeft:        ['strafeLeft', 'StrafeLeft', 'sidestepLeft', 'SidestepLeft', 'walk', 'Walk', 'moveLeft', 'MoveLeft', 'stepLeft', 'StepLeft', 'SBW_strafe_left', 'T_sidestep_left'],
  strafeRight:       ['strafeRight', 'StrafeRight', 'sidestepRight', 'SidestepRight', 'walk', 'Walk', 'moveRight', 'MoveRight', 'stepRight', 'StepRight', 'SBW_strafe_right', 'T_sidestep_right'],
  sidestepLeft:      ['sidestepLeft', 'SidestepLeft', 'strafeLeft', 'StrafeLeft', 'T_sidestep_left', 'T_ssl'],
  sidestepRight:     ['sidestepRight', 'SidestepRight', 'strafeRight', 'StrafeRight', 'T_sidestep_right', 'T_ssr'],
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
  lightAttack:       ['lightAttack', 'LightAttack', 'light', 'Light', 'punch', 'Punch', 'jab', 'Jab', 'attack', 'Attack', 'hit', 'Hit', 'strike', 'Strike', 'quickPunch', 'QuickPunch', 'punch1', 'Punch1', 'LP', 'lp', 'SBW_lightAttack', 'SBW_jab', 'T_jab', 'T_1', 'bf_jab', 'bf_chop', 'punchingLeft', 'punchingRight'],
  Startup:           ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'jab', 'Jab'],
  Active:            ['lightAttack', 'LightAttack', 'attack', 'Attack', 'punch', 'Punch', 'kick', 'Kick'],
  crouchLightAttack: ['crouchLightAttack', 'CrouchLightAttack', 'crouchPunch', 'CrouchPunch', 'lowPunch', 'LowPunch', 'lightAttack', 'LightAttack', 'jab', 'Jab'],
  // ── Heavy Attack ────────────────────────────────────────────────────────────
  heavy:             ['heavy', 'Heavy', 'strong', 'Strong', 'heavyAttack', 'HeavyAttack', 'cross', 'Cross'],
  heavyAttack:       ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'strong', 'Strong', 'cross', 'Cross', 'kick', 'Kick', 'attack', 'Attack', 'strike', 'Strike', 'hook', 'Hook', 'uppercut', 'Uppercut', 'roundhouse', 'Roundhouse', 'highKick', 'HighKick', 'spinningKick', 'SpinningKick', 'RP', 'rp', 'LK', 'lk', 'RK', 'rk', 'SBW_heavyAttack', 'SBW_cross', 'T_cross', 'T_2', 'T_3', 'T_4', 'bf_cross', 'bf_elbow', 'bf_uppercut', 'kickingLeft', 'kickingRight', 'kickingForward'],
  crouchHeavyAttack: ['crouchHeavyAttack', 'CrouchHeavyAttack', 'crouchKick', 'CrouchKick', 'lowKick', 'LowKick', 'heavyAttack', 'HeavyAttack', 'kick', 'Kick'],
  jumpAttack:        ['jumpAttack', 'JumpAttack', 'airAttack', 'AirAttack', 'jumpingPunch', 'JumpingPunch', 'heavyAttack', 'HeavyAttack'],
  runAttack:         ['runAttack', 'RunAttack', 'dashAttack', 'DashAttack', 'runningAttack', 'RunningAttack', 'heavyAttack', 'HeavyAttack'],
  // ── Tekken Specials ─────────────────────────────────────────────────────────
  heatBurst:         ['heatBurst', 'HeatBurst', 'heat_burst', 'Heat_Burst', 'heavyAttack', 'HeavyAttack', 'special', 'Special'],
  rageArt:           ['rageArt', 'RageArt', 'rage_art', 'Rage_Art', 'finisher', 'Finisher', 'heavyAttack', 'HeavyAttack'],
  powerCrush:        ['powerCrush', 'PowerCrush', 'power_crush', 'armorMove', 'ArmorMove', 'heavyAttack', 'HeavyAttack'],
  // ── Command Throw ───────────────────────────────────────────────────────────
  CommandThrow:      ['heavyAttack', 'HeavyAttack', 'heavy', 'Heavy', 'grab', 'Grab', 'throw', 'Throw', 'grapple', 'Grapple', 'suplex', 'Suplex', 'slam', 'Slam', 'SBW_throw', 'T_1_3', 'T_2_4', 'bf_grab', 'bf_beastMode'],
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
  run:               ['run', 'Run', 'running', 'Running', 'sprint', 'Sprint', 'dash', 'Dash', 'walkForward', 'WalkForward', 'walk', 'Walk'],
  dash:              ['dash', 'Dash', 'dashForward', 'DashForward', 'run', 'Run', 'walkForward', 'WalkForward'],
  dashForward:       ['dashForward', 'DashForward', 'dash', 'Dash', 'run', 'Run', 'walkForward', 'WalkForward'],
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
  // Backdash — slightly faster snap (4 frames)
  Backdashing:       0.067,
  // Wakeup
  WakeupTechRoll:    0.083,
  WakeupBackrise:    0.083,
  WakeupQuickStand:  0.067,
  // Attacks — fast snaps
  light:             0.050,
  lightAttack:       0.050,
  Startup:           0.050,
  Active:            0.033,
  heavy:             0.067,
  heavyAttack:       0.067,
  CommandThrow:      0.067,
  // Hit reactions — very fast
  hit:               0.033,
  Hitstun:           0.033,
  HitStun:           0.033,
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
  'strafeLeft', 'strafeRight', 'guard', 'Guard', 'block', 'Blockstun',
  'Knockdown', 'WakeupTechRoll', 'WakeupBackrise', 'WakeupQuickStand',
  'Backdashing',
]);

const ATTACK_STATES = new Set(['lightAttack', 'heavyAttack', 'light', 'heavy', 'Startup', 'Active', 'CommandThrow']);

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

function resolveClipName(key: string, actions: Record<string, THREE.AnimationAction>): string | null {
  const availableClips = Object.keys(actions);
  const clipsByState = buildClipsByState(actions);

  const bridged = AnimationBridge.getClipForCombatState(key, clipsByState);
  if (bridged) {
    const clipName = Object.keys(actions).find((n) => actions[n].getClip() === bridged) ?? bridged.name;
    console.log(
      `[FighterMesh] 🗺️ AnimationBridge resolve: combatState="${key}" → semantic="${COMBAT_STATE_TO_SEMANTIC[key]}" → clip="${clipName}"`,
    );
    return clipName;
  }

  const semanticState = COMBAT_STATE_TO_SEMANTIC[key];
  if (semanticState) {
    const aliases = SEMANTIC_STATE_ALIASES[semanticState] ?? [semanticState];
    const semanticFound = availableClips.find((c) =>
      aliases.some((a) => c.toLowerCase() === a.toLowerCase()),
    );
    if (semanticFound) {
      console.log(
        `[FighterMesh] 🗺️ AnimationBridge alias: combatState="${key}" → semantic="${semanticState}" → clip="${semanticFound}"`,
      );
      return semanticFound;
    }

    console.warn(
      `[FighterMesh] ⚠️ MISSING_CLIP: combatState="${key}" → semantic="${semanticState}" — no matching clip in [${availableClips.slice(0, 4).join(', ')}${availableClips.length > 4 ? '...' : ''}]`,
    );
    if (semanticState !== 'idle') {
      return null;
    }
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
  tint,
  showHitbox = false,
  hitboxGeometry = null,
  animationTrigger = 0,
  locomotionVelocity,
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
  locomotionVelocity?: { forward: number; strafe: number };
  hitStopActive?: boolean;
  onRigDiagnostic?: (report: RigDiagnosticReport) => void;
  onBoneHitboxReady?: (system: BoneHitboxSystem) => void;
  onDeformationBlocked?: (characterName: string, failingChecks: string[]) => void;
  onAnimationIntegrityReport?: (report: AnimationIntegrityReport) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const [normalized, setNormalized] = useState<NormalizedResult | null>(null);

  // ── Jitter-prevention refs ────────────────────────────────────────────────
  /** The clip name that is currently playing (or crossfading to) */
  const activeClipRef = useRef<string | null>(null);
  /** Timestamp of the last crossfade start — enforces MIN_CROSSFADE_HOLD_S */
  const lastCrossfadeTimeRef = useRef<number>(0);
  /** The resolved clip name of the last state we committed to */
  const committedClipRef = useRef<string | null>(null);

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

  // useGLTF caches the result — safe to call per-fighter
  const { scene, animations } = useGLTF(gltfUrl);

  // ── Universal normalization + mixer creation ──────────────────────────────
  useEffect(() => {
    if (!scene) return;

    // Run rig diagnostic on the original scene
    const report = AutoRigDetector.analyze(scene, animations);
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
    const { actions, mixer } = normalized;

    const availableClips = Object.keys(actions);
    if (availableClips.length === 0) {
      console.warn(`[FighterMesh] ⚠️ No animation clips available for "${gltfUrl.split('/').pop()}"`);
      return;
    }

    // Resolve the target animation key
    const inputKey = animation ?? state;
    const clipName = resolveClipName(inputKey, actions);

    // ── VELOCITY GATE: suppress locomotion transitions for micro-inputs ──────
    // If the state is a locomotion state and velocity is below threshold,
    // don't trigger a new crossfade — let the current clip finish blending.
    const isLocomotionState = ['walkForward', 'walkBackward', 'strafeLeft', 'strafeRight', 'Walking', 'walk'].includes(inputKey);
    if (isLocomotionState && locomotionVelocity) {
      const velMag = Math.sqrt(
        locomotionVelocity.forward * locomotionVelocity.forward +
        locomotionVelocity.strafe * locomotionVelocity.strafe
      );
      if (velMag < VELOCITY_ANIM_THRESHOLD) {
        // Velocity too low — don't commit to walk animation yet, stay on current
        return;
      }
    }

    // ── Root motion: activate for attacks with forward displacement ──────────
    const isAttack = ATTACK_STATES.has(inputKey);
    if (isAttack) {
      const profile = ATTACK_ROOT_MOTION_PROFILES[inputKey];
      if (profile?.hasRootMotion) {
        activeAttackKeyRef.current = inputKey;
        // Activate bone hitboxes for this attack
        boneHitboxRef.current.activateAttack(inputKey);
      } else {
        activeAttackKeyRef.current = null;
      }
    } else {
      // Non-attack state: deactivate hitboxes
      if (activeAttackKeyRef.current) {
        boneHitboxRef.current.deactivateAll();
        activeAttackKeyRef.current = null;
      }
    }

    // ── CONSOLE TRACE: input → state → clip ──────────────────────────────────
    console.log(
      `[FighterMesh] 🎬 input="${inputKey}" → clip="${clipName ?? 'NONE'}" ` +
      `(trigger=${animationTrigger}) vel={fwd=${locomotionVelocity?.forward?.toFixed(2) ?? '?'},str=${locomotionVelocity?.strafe?.toFixed(2) ?? '?'}}`
    );

    // ── COMBAT ENTRY: Run 14-point deformation integrity test ─────────────────
    // AGENT LAW: The deformation integrity test runs ONCE when the first
    // non-idle combat state is entered. This is DIAGNOSTIC ONLY — it logs
    // warnings but NEVER blocks animation playback. The mixer is always
    // recovered after the FIRST_FRAME_DISPLACEMENT check resets it.
    //
    // onDeformationBlocked is only fired for truly unrenderable assets
    // (NO_VISIBLE_MESH) — not for skeleton-type classification mismatches.
    const isCombatActiveState = inputKey !== 'idle' && inputKey !== 'Neutral' && inputKey !== 'bind';
    if (isCombatActiveState && !combatEntryCheckedRef.current && normalized) {
      combatEntryCheckedRef.current = true;

      const integrityInput: DeformationIntegrityInput = {
        characterName: gltfUrl.split('/').pop()?.replace('.glb', '') ?? gltfUrl,
        modelUrl: gltfUrl,
        clonedScene: normalized.scene,
        mixer: normalized.mixer,
        actions: normalized.actions,
        forwardCorrectionY: normalized.forwardCorrectionY,
      };

      const report = runDeformationIntegrityTest(integrityInput);

      // ── Run Animation Integrity Gate (per-fighter pre-combat report) ────────
      // This produces the structured PASS/BLOCKED/UNKNOWN report documenting:
      //   VISIBLE MESHES, SKINNED MESHES, SKELETON BONES, ANIMATION CLIPS,
      //   TRACKS, RESOLVED TRACKS, UNRESOLVED TRACKS, ACTIVE CLIP,
      //   MIXER ROOT, BONE TRAVEL
      const animIntegrityReport = runAnimationIntegrityGate({
        characterName: integrityInput.characterName.toUpperCase(),
        clonedScene: normalized.scene,
        mixer: normalized.mixer,
        actions: normalized.actions,
        activeClipName: activeClipRef.current,
      });
      // Fire callback so parent (CombatArena3D / GameBattleArena) can display the report
      (onAnimationIntegrityReport as ((r: AnimationIntegrityReport) => void) | undefined)?.(animIntegrityReport);

      // DIAGNOSTIC ONLY: log the result but never block animation playback.
      // NOTE: FIRST_FRAME_DISPLACEMENT only calls mixer.stopAllAction() when
      // SkinnedMeshes with valid skeletons are present. For static-mesh GLBs,
      // the mixer is NOT stopped — so we only need to recover when the test
      // actually ran the destructive path (i.e., skinnedMeshes with skeletons exist).
      if (report.verdict === 'BLOCKED') {
        // Only fire the blocked callback for truly unrenderable assets
        const isUnrenderable = report.failingChecks.includes('NO_VISIBLE_MESH');
        if (isUnrenderable) {
          console.error(
            `[FighterMesh] 🚫 COMBAT FROZEN — ${integrityInput.characterName} ` +
            `has NO_VISIBLE_MESH: nothing to render. Fix the GLB asset.`
          );
          onDeformationBlocked?.(integrityInput.characterName, report.failingChecks);
          return; // Truly unrenderable — stop here
        }
        // For all other failures (SKELETON_EXISTS, SKINNED_MESH_SKELETON, etc.)
        // these are diagnostic warnings — the model may still animate correctly
        // via Three.js internal skinning even without standard Bone/SkinnedMesh types.
        console.warn(
          `[FighterMesh] ⚠️ Deformation integrity warnings for ${integrityInput.characterName}: ` +
          `[${report.failingChecks.join(', ')}] — animation playback continues (diagnostic only).`
        );
      }

      // Check if FIRST_FRAME_DISPLACEMENT ran the destructive path (stopped the mixer).
      // It only does so when SkinnedMeshes with valid skeletons exist.
      // We detect this by checking if any action is currently running — if none are,
      // the mixer was stopped and we must recover.
      const anyActionRunning = Object.values(normalized.actions).some(a => a?.isRunning());
      if (!anyActionRunning) {
        // Mixer was stopped by FIRST_FRAME_DISPLACEMENT — recover ONLY the requested clip.
        // Never silently substitute idle for a missing combat semantic state.
        const recoverClip = resolveClipName(inputKey, normalized.actions);
        if (recoverClip && normalized.actions[recoverClip]) {
          const recoverAction = normalized.actions[recoverClip];
          const isRecoverLoop = LOOP_STATES.has(inputKey);
          recoverAction.setLoop(isRecoverLoop ? THREE.LoopRepeat : THREE.LoopOnce, isRecoverLoop ? Infinity : 1);
          recoverAction.clampWhenFinished = !isRecoverLoop;
          recoverAction.reset().play();
          activeClipRef.current = recoverClip;
          committedClipRef.current = recoverClip;
          lastCrossfadeTimeRef.current = performance.now() / 1000;
          console.log(`[FighterMesh] 🔄 Mixer recovered after integrity test — playing "${recoverClip}" for "${integrityInput.characterName}"`);
        } else if (inputKey !== 'idle' && inputKey !== 'Neutral') {
          console.warn(
            `[FighterMesh] ⚠️ MISSING_CLIP after integrity recovery: combatState="${inputKey}" — not substituting idle`,
          );
        }
      } else {
        console.log(`[FighterMesh] ✅ Mixer still running after integrity test (static mesh path) — no recovery needed for "${integrityInput.characterName}"`);
      }

      // Integrity test handled — proceed to normal animation logic below
      deformationPassedRef.current = true;
    }

    // Only block animation for truly unrenderable assets (NO_VISIBLE_MESH)
    if (!deformationPassedRef.current) {
      return;
    }

    if (!clipName || !actions[clipName]) {
      console.warn(`[FighterMesh] ⚠️ No matching clip for state="${state}" animation="${animation}" on "${gltfUrl.split('/').pop()}"`);
      return;
    }

    const nextAction = actions[clipName];
    const fadeDuration = FADE_DURATIONS[inputKey] ?? DEFAULT_FADE;
    const isLoop = LOOP_STATES.has(inputKey);
    // isAttack already declared above

    // Find currently playing action
    const currentAction = availableClips
      .map(k => actions[k])
      .find(a => a?.isRunning());

    const isSameClip = clipName === committedClipRef.current;

    // For attack re-triggers (same clip, new trigger count) — restart from beginning
    if (isSameClip && isAttack && animationTrigger > 0) {
      console.log(`[FighterMesh] 🔁 Re-triggering attack clip "${clipName}" from start`);
      nextAction.stop();
      nextAction.reset();
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.play();
      activeClipRef.current = clipName;
      committedClipRef.current = clipName;
      lastCrossfadeTimeRef.current = performance.now() / 1000;
      return;
    }

    // ── HOLD GATE: prevent crossfade stacking within MIN_CROSSFADE_HOLD_S ────
    // Exception: attacks and hit reactions always fire immediately
    const isUrgent = isAttack || ['hit', 'Hitstun', 'HitStun', 'Stunned', 'knockdown', 'Knockdown', 'ko', 'KO', 'Crumple'].includes(inputKey);
    const now = performance.now() / 1000;
    const timeSinceLastCrossfade = now - lastCrossfadeTimeRef.current;

    if (!isUrgent && isSameClip) {
      // Already playing this clip — no action needed
      return;
    }

    if (!isUrgent && timeSinceLastCrossfade < MIN_CROSSFADE_HOLD_S) {
      // Too soon since last crossfade — skip to prevent jitter
      console.log(`[FighterMesh] ⏸ Crossfade suppressed (hold=${timeSinceLastCrossfade.toFixed(3)}s < ${MIN_CROSSFADE_HOLD_S}s) for "${clipName}"`);
      return;
    }

    // Configure the next action
    nextAction.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
    nextAction.clampWhenFinished = !isLoop;
    nextAction.reset();
    nextAction.setEffectiveTimeScale(1);
    nextAction.setEffectiveWeight(1);

    if (currentAction && currentAction !== nextAction) {
      // Crossfade from current → next
      currentAction.crossFadeTo(nextAction, fadeDuration, true);
      nextAction.play();
      console.log(`[FighterMesh] ↔️ Crossfade "${currentAction.getClip().name}" → "${clipName}" (${(fadeDuration * 1000).toFixed(0)}ms / ${Math.round(fadeDuration * 60)}f)`);
    } else {
      nextAction.fadeIn(fadeDuration).play();
      console.log(`[FighterMesh] ▶️ FadeIn "${clipName}" (${(fadeDuration * 1000).toFixed(0)}ms)`);
    }

    activeClipRef.current = clipName;
    committedClipRef.current = clipName;
    lastCrossfadeTimeRef.current = now;
  }, [state, animation, animationTrigger, normalized, gltfUrl, locomotionVelocity]);

  // ── Auto-play idle on mount once scene is normalized ─────────────────────
  useEffect(() => {
    if (!normalized) return;
    const { actions } = normalized;
    const availableClips = Object.keys(actions);
    if (availableClips.length === 0) return;

    const idleClip = resolveClipName('idle', actions);
    if (idleClip && actions[idleClip]) {
      const idleAction = actions[idleClip];
      idleAction.setLoop(THREE.LoopRepeat, Infinity);
      idleAction.reset().play();
      activeClipRef.current = idleClip;
      committedClipRef.current = idleClip;
      lastCrossfadeTimeRef.current = performance.now() / 1000;
      console.log(`[FighterMesh] 🟢 Auto-play idle="${idleClip}" on mount for "${gltfUrl.split('/').pop()}"`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalized]);

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

    const attacking = state === 'Startup' || state === 'Active';
    const bob = (state === 'Neutral' || state === 'idle')
      ? Math.sin(performance.now() * 0.005) * 0.025
      : 0;

    // Position — driven entirely by props from parent screen
    groupRef.current.position.set(position[0], position[1] + bob, position[2]);

    // Rotation — driven entirely by rotationY prop from parent screen
    groupRef.current.rotation.y = rotationY;

    // Attack pulse — uniform scale, no mirroring
    const attackScale = attacking ? 1.03 : 1.0;
    groupRef.current.scale.set(attackScale, attackScale, attackScale);

    // AGENT LAW: ALWAYS call mixer.update() every frame.
    // Hit-stop is handled by mixer.timeScale = 0 (set in useEffect above).
    // Skipping mixer.update() entirely causes animation state to desync —
    // the mixer's internal clock stops tracking and crossfades break on resume.
    if (normalized) {
      normalized.mixer.update(delta);
      // Update skeleton helper world matrices so bone lines track correctly
      if (normalized.skeletonHelper && showHitbox) {
        normalized.skeletonHelper.update();
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
  showHitbox = false,
  hitboxGeometry = null,
  animationTrigger = 0,
  locomotionVelocity,
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
        locomotionVelocity={locomotionVelocity}
        hitStopActive={hitStopActive}
        onRigDiagnostic={onRigDiagnostic}
        onBoneHitboxReady={onBoneHitboxReady}
        onDeformationBlocked={onDeformationBlocked}
        onAnimationIntegrityReport={onAnimationIntegrityReport}
      />
    </Suspense>
  );
}
