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
import {
  SEMANTIC_STATE_ALIASES,
  COMBAT_STATE_TO_SEMANTIC,
} from '../src/engine/retarget/SemanticStateAliases';
import { loadBannonClipsFromPublic } from '../src/engine/retarget/BannonClipJsonAdapter';
import { bindClipTracksToTargetBones } from '../src/engine/retarget/BannonEulerMotionAdapter';

export { SEMANTIC_STATE_ALIASES, COMBAT_STATE_TO_SEMANTIC };

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

  /**
   * Resolve a FighterStateMachine combat state to a semantic animation state.
   * Returns 'idle' as fallback if no mapping exists.
   */
  static resolveSemanticState(combatState: string): string {
    return COMBAT_STATE_TO_SEMANTIC[combatState] ?? 'idle';
  }

  /**
   * Get the best clip for a combat state from a clips-by-state map.
   * Applies the combat state → semantic state → clip lookup chain.
   *
   * MISSING_CLIP LAW: If no clip exists for a combat verb (attack_1, attack_2,
   * block, hit_reaction, knockdown, getup, grapple), returns null.
   * Combat verbs MUST NOT silently fall back to idle — that would mask a
   * real MISSING_CLIP condition and produce incorrect animation evidence.
   *
   * Only locomotion states (walk_back, strafe_left, strafe_right, backdash,
   * crouch) may fall back to related locomotion clips.
   */
  static getClipForCombatState(
    combatState: string,
    clipsByState: Map<string, THREE.AnimationClip>,
  ): THREE.AnimationClip | null {
    const semanticState = COMBAT_STATE_TO_SEMANTIC[combatState];
    if (!semanticState) {
      // No semantic mapping — MISSING_CLIP, do NOT substitute idle
      console.warn(
        `[AnimationBridge] ⚠️ MISSING_CLIP: no semantic mapping for combatState="${combatState}"`
      );
      return null;
    }

    // Direct semantic state lookup
    const direct = clipsByState.get(semanticState);
    if (direct) return direct;

    // COMBAT VERB GUARD: attack, block, hit, knockdown, getup, grapple
    // must NOT fall back to idle — return null (MISSING_CLIP)
    const COMBAT_VERBS = new Set([
      'attack_1', 'attack_2', 'block', 'hit_reaction',
      'knockdown', 'getup', 'grapple',
    ]);
    if (COMBAT_VERBS.has(semanticState)) {
      console.warn(
        `[AnimationBridge] ⚠️ MISSING_CLIP: combatState="${combatState}" → semantic="${semanticState}" — ` +
        `no clip found. Combat verb will NOT substitute idle. Fix the animation source.`
      );
      return null;
    }

    // Locomotion fallback chain (walk variants may fall back to related locomotion)
    const fallbacks: Record<string, string[]> = {
      walk_back:    ['walk_forward'],
      strafe_left:  ['walk_forward'],
      strafe_right: ['walk_forward'],
      backdash:     ['walk_back', 'walk_forward'],
      crouch:       ['idle'],
      victory:      ['idle'],
      taunt:        ['idle'],
      defeat:       ['knockdown'],
    };

    const chain = fallbacks[semanticState];
    if (chain) {
      for (const fb of chain) {
        const fbClip = clipsByState.get(fb);
        if (fbClip) {
          console.log(
            `[AnimationBridge] ℹ️ Locomotion fallback: "${semanticState}" → "${fb}"`
          );
          return fbClip;
        }
      }
    }

    // No fallback found — MISSING_CLIP
    console.warn(
      `[AnimationBridge] ⚠️ MISSING_CLIP: combatState="${combatState}" → semantic="${semanticState}" — ` +
      `no clip and no fallback found.`
    );
    return null;
  }

  /**
   * Load preferred Bannon Euler motion-bank clips through the same public path
   * CharacterPipeline uses (no duplicate architecture).
   * Optionally bind tracks onto a live target skeleton.
   */
  static async loadPreferredBannonMotionBank(
    targetScene?: THREE.Object3D,
  ): Promise<{
    clipsByState: Map<string, THREE.AnimationClip>;
    missingStates: string[];
    boundTrackCount: number;
    unboundTrackCount: number;
  }> {
    const clipsByState = await loadBannonClipsFromPublic();
    const missingStates: string[] = [];
    let boundTrackCount = 0;
    let unboundTrackCount = 0;

    for (const [state, clip] of [...clipsByState.entries()]) {
      if (targetScene) {
        const bind = bindClipTracksToTargetBones(clip, targetScene);
        clipsByState.set(state, bind.clip);
        boundTrackCount += bind.boundTracks;
        unboundTrackCount += bind.unboundTracks;
      }
    }

    // Report preferred semantic gaps without substituting idle
    for (const [semanticState, aliases] of Object.entries(SEMANTIC_STATE_ALIASES)) {
      if (!clipsByState.has(semanticState)) {
        // Only flag core locomotion/combat aliases present in preferred set
        if (
          [
            'idle', 'walk_forward', 'walk_back', 'strafe_left', 'strafe_right',
            'attack_1', 'attack_2', 'block', 'hit_reaction', 'knockdown', 'getup',
          ].includes(semanticState)
        ) {
          missingStates.push(semanticState);
          console.warn(
            `[AnimationBridge] ⚠️ MISSING_CLIP: preferred motion bank has no clip for "${semanticState}" ` +
            `(aliases tried conceptually: ${aliases.slice(0, 3).join(', ')})`
          );
        }
      }
    }

    console.log(
      `[AnimationBridge] Preferred Bannon motion bank loaded: ${clipsByState.size} clips, ` +
      `bound=${boundTrackCount} unbound=${unboundTrackCount} missing=[${missingStates.join(', ') || 'none'}]`
    );

    return { clipsByState, missingStates, boundTrackCount, unboundTrackCount };
  }
}
