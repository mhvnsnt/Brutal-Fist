/**
 * animation_bridge/retarget.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Animation bridge: source registry + measured retarget lane.
 *
 * This module is the integration point between the Bannon animation source
 * registry (SOURCE_REGISTRY.json) and the Three.js runtime.
 *
 * Architecture (from PR #44):
 *   FBX / BVH / animated GLB
 *   → source discovery (SOURCE_REGISTRY.json)
 *   → normalization (bone name aliases)
 *   → retargeting (AnimationRetargeter)
 *   → AnimationClip creation
 *   → clip validation (validateAnimationChannelBones)
 *   → state/action mapping (SEMANTIC_STATE_ALIASES)
 *   → AnimationMixer(visibleClone)
 *   → YOUR SKELETON
 *   → MOVING BANNON
 *
 * Three.js architecture notes:
 *   - SkeletonUtils.clone() preserves the cloned skin/bone relationship
 *   - SkeletonUtils.retargetClip() can transfer an AnimationClip between skeletons
 *   - AnimationMixer must be rooted on the object being animated (the visible clone)
 *   - mixer.update(delta) must be called every render frame
 *
 * IDENTITY: Bone names are the stable cross-file identity — NOT UUIDs.
 * UUIDs change every time a scene is cloned.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';
import { AnimationRetargeter, type RetargetReport } from '../src/engine/retarget/AnimationRetargeter';
import { validateAnimationChannelBones } from '../src/engine/pipeline/CharacterPipeline';

// ─────────────────────────────────────────────────────────────────────────────
// Semantic state aliases
// Maps semantic animation state names to actual clip names from various sources
// ─────────────────────────────────────────────────────────────────────────────

export const SEMANTIC_STATE_ALIASES: Record<string, string[]> = {
  idle:           ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'Standing', 'stance', 'Stance', 'combatIdle', 'CombatIdle'],
  walk_forward:   ['walk', 'Walk', 'walkForward', 'WalkForward', 'walking', 'Walking', 'walk_fwd', 'SBW_walk_fwd'],
  walk_back:      ['walkBack', 'WalkBack', 'walkBackward', 'WalkBackward', 'walk_back', 'walk_bwd', 'SBW_walk_back'],
  strafe_left:    ['strafeLeft', 'StrafeLeft', 'sidestepLeft', 'SidestepLeft', 'SBW_strafe_left'],
  strafe_right:   ['strafeRight', 'StrafeRight', 'sidestepRight', 'SidestepRight', 'SBW_strafe_right'],
  attack_1:       ['lightAttack', 'LightAttack', 'punch', 'Punch', 'jab', 'Jab', 'attack', 'Attack', 'LP', 'T_1', 'bf_jab'],
  attack_2:       ['heavyAttack', 'HeavyAttack', 'kick', 'Kick', 'cross', 'Cross', 'RP', 'T_2', 'bf_cross'],
  block:          ['guard', 'Guard', 'block', 'Block', 'defend', 'Defend', 'SBW_guard', 'T_guard'],
  hit_reaction:   ['hit', 'Hit', 'hurt', 'Hurt', 'flinch', 'Flinch', 'hitstun', 'Hitstun', 'SBW_hit', 'T_hit'],
  knockdown:      ['knockdown', 'Knockdown', 'ko', 'KO', 'fall', 'Fall', 'SBW_knockdown', 'T_knockdown'],
  getup:          ['getUp', 'GetUp', 'quickStand', 'QuickStand', 'gettingUp', 'GettingUp', 'T_quickstand'],
  grapple:        ['grab', 'Grab', 'throw', 'Throw', 'grapple', 'Grapple', 'SBW_throw', 'T_1_3'],
  crouch:         ['crouch', 'Crouch', 'duck', 'Duck', 'SBW_crouch', 'T_crouch'],
  run:            ['run', 'Run', 'running', 'Running', 'sprint', 'Sprint'],
  dash_forward:   ['dashForward', 'DashForward', 'dash', 'Dash', 'run', 'Run'],
  backdash:       ['backdash', 'Backdash', 'backDash', 'BackDash', 'SBW_backdash', 'T_backdash'],
  victory:        ['victory', 'Victory', 'win', 'Win', 'victoryPose', 'VictoryPose'],
  defeat:         ['defeat', 'Defeat', 'lose', 'Lose', 'knockdown', 'Knockdown'],
  taunt:          ['taunt', 'Taunt', 'idle', 'Idle'],
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BridgeClipEntry {
  semanticState: string;
  clipName: string;
  clip: THREE.AnimationClip;
  sourceConvention: 'mixamo' | 'fbx' | 'bvh' | 'mocap' | 'native' | 'unknown';
  license: string;
  provenance: string;
}

export interface AnimationBridgeResult {
  /** Clips keyed by semantic state */
  clipsByState: Map<string, THREE.AnimationClip>;
  /** All retargeted clips */
  allClips: THREE.AnimationClip[];
  /** States with no valid clip */
  missingStates: string[];
  /** Retarget report */
  retargetReport: RetargetReport | null;
  /** Resolved track count */
  resolvedTrackCount: number;
  /** Unresolved track count */
  unresolvedTrackCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// AnimationBridge
// ─────────────────────────────────────────────────────────────────────────────

export class AnimationBridge {
  private readonly characterId: string;
  private readonly retargeter: AnimationRetargeter;

  constructor(characterId: string) {
    this.characterId = characterId;
    this.retargeter = new AnimationRetargeter(
      `${characterId}_source`,
      `${characterId}_target`
    );
  }

  /**
   * Build the animation bridge for a character.
   *
   * @param sourceScene   Source skeleton scene (animation source)
   * @param targetScene   Target skeleton scene (visible clone)
   * @param sourceClips   Animation clips from the source
   * @returns AnimationBridgeResult with clips keyed by semantic state
   */
  build(
    sourceScene: THREE.Object3D,
    targetScene: THREE.Object3D,
    sourceClips: THREE.AnimationClip[]
  ): AnimationBridgeResult {
    // Build retarget map
    const retargetReport = this.retargeter.buildMap(sourceScene, targetScene);

    // Retarget all clips
    const { clips: retargetedClips, totalResolved, totalUnresolved } =
      this.retargeter.retargetClips(sourceClips, this.characterId);

    // Validate channel resolution on target skeleton
    validateAnimationChannelBones(targetScene, retargetedClips, this.characterId);

    // Map clips to semantic states
    const clipsByState = new Map<string, THREE.AnimationClip>();
    const missingStates: string[] = [];

    for (const [semanticState, aliases] of Object.entries(SEMANTIC_STATE_ALIASES)) {
      let found = false;
      for (const alias of aliases) {
        const clip = retargetedClips.find(
          (c) => c.name === alias || c.name.toLowerCase() === alias.toLowerCase()
        );
        if (clip) {
          clipsByState.set(semanticState, clip);
          found = true;
          break;
        }
      }
      if (!found) {
        missingStates.push(semanticState);
        console.warn(
          `[AnimationBridge] ⚠️ MISSING_CLIP: "${this.characterId}" has no clip for semantic state "${semanticState}"\n` +
          `  Tried aliases: ${aliases.slice(0, 5).join(', ')}${aliases.length > 5 ? ` +${aliases.length - 5} more` : ''}`
        );
      }
    }

    if (missingStates.length > 0) {
      console.warn(
        `[AnimationBridge] ⚠️ "${this.characterId}" missing ${missingStates.length} semantic state(s): ` +
        missingStates.join(', ')
      );
    }

    return {
      clipsByState,
      allClips: retargetedClips,
      missingStates,
      retargetReport,
      resolvedTrackCount: totalResolved,
      unresolvedTrackCount: totalUnresolved,
    };
  }

  /**
   * Feed retargeted clips to an AnimationMixer.
   * The mixer MUST target the visible SkeletonUtils.clone() instance.
   *
   * Pipeline:
   *   source animation → normalize names → canonical mapping → retarget to target skeleton
   *   → validate track paths → AnimationMixer(visibleClone) → clipAction() → .play()
   *   → mixer.update(delta)
   *
   * @param mixer       AnimationMixer rooted on the visible clone
   * @param targetScene The visible clone (must match mixer root)
   * @param clips       Retargeted clips from build()
   * @returns Actions map: clip name → AnimationAction
   */
  feedToMixer(
    mixer: THREE.AnimationMixer,
    targetScene: THREE.Object3D,
    clips: THREE.AnimationClip[]
  ): Record<string, THREE.AnimationAction> {
    const actions: Record<string, THREE.AnimationAction> = {};

    for (const clip of clips) {
      const action = mixer.clipAction(clip, targetScene);
      actions[clip.name] = action;
    }

    console.log(
      `[AnimationBridge] 🎬 "${this.characterId}" fed ${clips.length} clip(s) to mixer.\n` +
      `  Mixer root: ${(mixer as any)._root?.uuid ?? 'unknown'}\n` +
      `  Actions: [${Object.keys(actions).join(', ')}]`
    );

    return actions;
  }
}
