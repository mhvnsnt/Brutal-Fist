import * as THREE from 'three';
import { retargetClipByRestPose, validateRetargetedClip } from './ClipRetarget';

export type FighterMotionState =
  | 'idle' |'walkForward' |'walkBackward' |'strafeLeft' |'strafeRight' |'crouch' |'guard' |'lightAttack' |'heavyAttack' |'hit' |'knockdown' |'wake';

export interface RetargetedAnimationSet {
  clips: Map<FighterMotionState, THREE.AnimationClip>;
}

export type AnimationController = ReturnType<typeof buildAnimationController>;

// ── Crossfade durations per transition ───────────────────────────────────────
const CROSSFADE_DURATIONS: Partial<Record<FighterMotionState, number>> = {
  idle:         0.15,
  walkForward:  0.12,
  walkBackward: 0.12,
  strafeLeft:   0.12,
  strafeRight:  0.12,
  lightAttack:  0.06,  // fast snap into attack
  heavyAttack:  0.08,
  hit:          0.05,  // snap into hit reaction
  knockdown:    0.08,
  guard:        0.10,
  crouch:       0.10,
  wake:         0.15,
};

const DEFAULT_FADE = 0.10;

/**
 * buildAnimationController — wraps THREE.AnimationMixer with crossfading.
 *
 * Key behaviours:
 * - play(next) crossfades from the current action to the next using
 *   .crossFadeTo(nextAction, duration, true) so transitions are smooth.
 * - The fade duration is tuned per state (attacks snap in fast, locomotion
 *   blends gently).
 * - update(delta) must be called every frame (inside useFrame).
 */
export function buildAnimationController(
  root: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  clips: RetargetedAnimationSet,
): AnimationController {
  let currentAction: THREE.AnimationAction | null = null;
  let currentState: FighterMotionState = 'idle';

  const getAction = (state: FighterMotionState): THREE.AnimationAction | null => {
    const clip = clips.clips.get(state) ?? clips.clips.get('idle');
    if (!clip) return null;
    return mixer.clipAction(validateRetargetedClip(clip), root);
  };

  const play = (next: FighterMotionState, overrideFade?: number) => {
    if (next === currentState && currentAction) return;

    const nextAction = getAction(next);
    if (!nextAction) return;

    const fadeDuration = overrideFade ?? CROSSFADE_DURATIONS[next] ?? DEFAULT_FADE;

    if (currentAction && currentAction !== nextAction) {
      // Crossfade: blend out current, blend in next
      nextAction.reset();
      nextAction.setEffectiveTimeScale(1);
      nextAction.setEffectiveWeight(1);
      currentAction.crossFadeTo(nextAction, fadeDuration, true);
      nextAction.play();
    } else {
      // No current action — just start
      nextAction.reset().fadeIn(fadeDuration).play();
    }

    currentAction = nextAction;
    currentState = next;
  };

  // Boot into idle immediately
  const idleAction = getAction('idle');
  if (idleAction) {
    idleAction.reset().play();
    currentAction = idleAction;
  }

  return {
    get state() { return currentState; },
    play,
    update(delta: number) { mixer.update(delta); },
  };
}

export function retargetAnimationSet(
  clips: THREE.AnimationClip[],
  sourceRoot: THREE.Object3D,
  destinationRoot: THREE.Object3D,
  sourceRest: Parameters<typeof retargetClipByRestPose>[1]['sourceRest'],
  destinationRest: Parameters<typeof retargetClipByRestPose>[1]['destinationRest'],
): THREE.AnimationClip[] {
  return clips.map(clip =>
    retargetClipByRestPose(clip, { sourceRoot, destinationRoot, sourceRest, destinationRest })
  );
}
