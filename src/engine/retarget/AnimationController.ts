import * as THREE from 'three';
import { retargetClipByRestPose, validateRetargetedClip } from './ClipRetarget';

export type FighterMotionState =
  | 'idle' | 'walkForward' | 'walkBackward'
  | 'strafeLeft' | 'strafeRight' | 'crouch' | 'guard'
  | 'lightAttack' | 'heavyAttack' | 'hit' | 'knockdown' | 'wake';

export interface RetargetedAnimationSet {
  clips: Map<FighterMotionState, THREE.AnimationClip>;
}

export type AnimationController = ReturnType<typeof buildAnimationController>;

export function buildAnimationController(root: THREE.Object3D, mixer: THREE.AnimationMixer, clips: RetargetedAnimationSet): AnimationController {
  let current: THREE.AnimationAction | null = null;
  let state: FighterMotionState = 'idle';
  const play = (next: FighterMotionState, fade = 0.08) => {
    const clip = clips.clips.get(next) ?? clips.clips.get('idle');
    if (!clip) throw new Error(`No animation for ${next} and no idle fallback`);
    const action = mixer.clipAction(validateRetargetedClip(clip), root);
    if (action === current) return;
    action.reset().fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = action;
    state = next;
  };
  play('idle', 0);
  return { get state() { return state; }, play, update(delta: number) { mixer.update(delta); } };
}

export function retargetAnimationSet(clips: THREE.AnimationClip[], sourceRoot: THREE.Object3D, destinationRoot: THREE.Object3D, sourceRest: Parameters<typeof retargetClipByRestPose>[1]['sourceRest'], destinationRest: Parameters<typeof retargetClipByRestPose>[1]['destinationRest']): THREE.AnimationClip[] {
  return clips.map(clip => retargetClipByRestPose(clip, { sourceRoot, destinationRoot, sourceRest, destinationRest }));
}
