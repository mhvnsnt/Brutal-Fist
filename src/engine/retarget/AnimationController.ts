import * as THREE from 'three';
import { retargetClipByRestPose, validateRetargetedClip } from './ClipRetarget';
import { computeVisualPlaybackLock, computeOneshotTimeScale } from '../combat/ClipPlaybackGate';

export type FighterMotionState =
  | 'idle' | 'walkForward' | 'walkBackward' | 'strafeLeft' | 'strafeRight' |'crouch'| 'crouchWalk' | 'guard' | 'guardLow' |'lightAttack'| 'heavyAttack' | 'lightKick' | 'heavyKick' | 'crouchLightAttack' | 'crouchHeavyAttack' |'jumpAttack'| 'runAttack' |'hit' | 'hitLow' | 'hitHigh' | 'knockdown' | 'wake'
  // ── Extended locomotion states ────────────────────────────────────────────
  | 'walk' | 'run' | 'dash' | 'dashForward' |'Walking' | 'Backdashing' | 'Guard' | 'Knockdown'
  | 'WakeupTechRoll'| 'WakeupBackrise' | 'WakeupQuickStand' |'HitStun' | 'Stunned' | 'Crumple' | 'CommandThrow' | 'ThrowWhiff'
  // ── Extended combat states ────────────────────────────────────────────────
  | 'Startup' | 'Active' | 'Blockstun' | 'Hitstun'
  // ── Tekken-specific states ────────────────────────────────────────────────
  | 'heatBurst' | 'rageArt' | 'powerCrush' | 'sidestepLeft' | 'sidestepRight'
  | 'jump' | 'jumpForward' | 'jumpBack'
  // ── Post-match states ─────────────────────────────────────────────────────
  | 'victory' | 'defeat' | 'taunt' | 'intro';

export interface RetargetedAnimationSet {
  clips: Map<FighterMotionState, THREE.AnimationClip>;
}

export type AnimationController = ReturnType<typeof buildAnimationController>;

// ── Crossfade durations per transition (seconds) ─────────────────────────────
// Frame counts at 60fps: 6f=0.100s, 4f=0.067s, 3f=0.050s, 2f=0.033s
const CROSSFADE_DURATIONS: Partial<Record<FighterMotionState, number>> = {
  // Locomotion — gentle blends
  idle:              0.100,  // 6 frames — gentle deceleration to idle
  walk:              0.100,
  run:               0.083,
  dash:              0.067,
  dashForward:       0.067,
  Walking:           0.100,
  walkForward:       0.100,
  walkBackward:      0.100,
  strafeLeft:        0.100,
  strafeRight:       0.100,
  sidestepLeft:      0.067,
  sidestepRight:     0.067,
  crouch:            0.083,
  crouchWalk:        0.100,
  Backdashing:       0.067,  // 4 frames — snappy backdash entry
  // Wakeup
  WakeupTechRoll:    0.083,
  WakeupBackrise:    0.083,
  WakeupQuickStand:  0.067,
  // Attacks — fast snaps
  lightAttack:       0.050,  // 3 frames — fast snap into attack
  heavyAttack:       0.067,
  crouchLightAttack: 0.050,
  crouchHeavyAttack: 0.067,
  jumpAttack:        0.050,
  runAttack:         0.050,
  CommandThrow:      0.067,
  Startup:           0.050,
  Active:            0.033,
  // Tekken specials
  heatBurst:         0.050,
  rageArt:           0.067,
  powerCrush:        0.067,
  // Hit reactions — very fast
  hit:               0.033,  // 2 frames — snap into hit reaction
  hitLow:            0.033,
  hitHigh:           0.033,
  HitStun:           0.033,
  Stunned:           0.033,
  Hitstun:           0.033,
  Blockstun:         0.050,
  // Knockdown
  knockdown:         0.067,
  Knockdown:         0.067,
  Crumple:           0.067,
  // Guard
  guard:             0.083,
  guardLow:          0.083,
  Guard:             0.083,
  // Wakeup
  wake:              0.100,
  // Throw whiff
  ThrowWhiff:        0.083,
  // Post-match
  victory:           0.150,
  defeat:            0.150,
  taunt:             0.150,
  intro:             0.150,
};

const DEFAULT_FADE = 0.083;

// ── States that should loop continuously ─────────────────────────────────────
const LOOP_STATES = new Set<FighterMotionState>([
  'idle', 'walk', 'run', 'Walking', 'walkForward', 'walkBackward',
  'strafeLeft', 'strafeRight', 'sidestepLeft', 'sidestepRight',
  'crouch', 'crouchWalk', 'guard', 'guardLow', 'Guard',
  'Backdashing', 'Knockdown',
  'WakeupTechRoll', 'WakeupBackrise', 'WakeupQuickStand',
]);

// ── States that play once and return to idle ──────────────────────────────────
const ONESHOT_STATES = new Set<FighterMotionState>([
  'lightAttack', 'heavyAttack', 'lightKick', 'heavyKick', 'crouchLightAttack', 'crouchHeavyAttack',
  'jumpAttack', 'runAttack', 'CommandThrow', 'ThrowWhiff',
  'heatBurst', 'rageArt', 'powerCrush',
  'hit', 'hitLow', 'hitHigh', 'HitStun', 'Stunned', 'Hitstun',
  'knockdown', 'Crumple',
  'victory', 'defeat', 'taunt', 'intro',
]);

/**
 * buildAnimationController — wraps THREE.AnimationMixer with crossfading.
 *
 * Key behaviours:
 * - play(next) crossfades from the current action to the next using
 *   .crossFadeTo(nextAction, duration, true) so transitions are smooth.
 * - The fade duration is tuned per state (attacks snap in fast, locomotion
 *   blends gently).
 * - update(delta) must be called every frame (inside useFrame).
 * - Loop states loop continuously; one-shot states play once.
 *
 * AGENT LAW: The mixer MUST be created on the cloned scene (not the outer group).
 * This ensures animation transforms drive the actual visible mesh bones.
 */
export function buildAnimationController(
  root: THREE.Object3D,
  mixer: THREE.AnimationMixer,
  clips: RetargetedAnimationSet,
) {
  let currentAction: THREE.AnimationAction | null = null;
  let currentState: FighterMotionState = 'idle';

  const getAction = (state: FighterMotionState): THREE.AnimationAction | null => {
    // Try exact state match first
    let clip = clips.clips.get(state);
    // Fallback chain for combat states
    if (!clip) {
      const fallbacks: Partial<Record<FighterMotionState, FighterMotionState[]>> = {
        crouchLightAttack: ['lightAttack', 'crouch'],
        crouchHeavyAttack: ['heavyAttack', 'crouch'],
        jumpAttack:        ['heavyAttack', 'lightAttack'],
        runAttack:         ['heavyAttack', 'lightAttack'],
        heatBurst:         ['heavyAttack'],
        rageArt:           ['heavyAttack'],
        powerCrush:        ['heavyAttack'],
        hitLow:            ['hit'],
        hitHigh:           ['hit'],
        guardLow:          ['guard'],
        crouchWalk:        ['crouch', 'walkForward'],
        sidestepLeft:      ['strafeLeft', 'walkBackward'],
        sidestepRight:     ['strafeRight', 'walkForward'],
        dashForward:       ['walkForward', 'walk'],
        dash:              ['walkForward', 'walk'],
        run:               ['walkForward', 'walk'],
        Hitstun:           ['hit', 'HitStun'],
        Blockstun:         ['guard', 'Guard'],
        Startup:           ['lightAttack'],
        Active:            ['lightAttack'],
        victory:           ['idle'],
        defeat:            ['knockdown', 'Knockdown'],
        taunt:             ['idle'],
        intro:             ['idle'],
      };
      const chain = fallbacks[state] ?? [];
      for (const fb of chain) {
        clip = clips.clips.get(fb);
        if (clip) break;
      }
    }
    // Final fallback: idle
    if (!clip) clip = clips.clips.get('idle');
    if (!clip) return null;
    return mixer.clipAction(validateRetargetedClip(clip), root);
  };

  const play = (next: FighterMotionState, overrideFade?: number) => {
    if (next === currentState && currentAction) return;

    const nextAction = getAction(next);
    if (!nextAction) return;

    const fadeDuration = overrideFade ?? CROSSFADE_DURATIONS[next] ?? DEFAULT_FADE;

    // Configure loop mode
    if (LOOP_STATES.has(next)) {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
    } else if (ONESHOT_STATES.has(next)) {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    } else {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
    }

    const lock = ONESHOT_STATES.has(next)
      ? computeVisualPlaybackLock(next)
      : 1;
    const scale = ONESHOT_STATES.has(next)
      ? computeOneshotTimeScale(nextAction.getClip().duration, lock)
      : 1;

    if (currentAction && currentAction !== nextAction) {
      nextAction.reset();
      nextAction.setEffectiveTimeScale(scale);
      nextAction.setEffectiveWeight(1);
      currentAction.crossFadeTo(nextAction, fadeDuration, true);
      nextAction.play();
    } else {
      nextAction.reset().setEffectiveTimeScale(scale).fadeIn(fadeDuration).play();
    }

    currentAction = nextAction;
    currentState = next;
  };

  // Boot into idle immediately
  const idleAction = getAction('idle');
  if (idleAction) {
    idleAction.setLoop(THREE.LoopRepeat, Infinity);
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
