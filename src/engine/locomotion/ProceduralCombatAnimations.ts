/**
 * ProceduralCombatAnimations
 *
 * Minimal fighting-game animation set for runtime-generated Mixamo-compatible
 * skeletons. These clips are a fallback only: authored GLB clips always win.
 *
 * The important property is that these are real THREE.AnimationClip tracks
 * targeting real bones. They are not root-only bobbing and they are not
 * animation state labels pretending to be motion.
 */

import * as THREE from 'three';

const B = {
  hips: 'mixamorigHips',
  spine: 'mixamorigSpine',
  spine2: 'mixamorigSpine2',
  head: 'mixamorigHead',
  lArm: 'mixamorigLeftArm',
  lForeArm: 'mixamorigLeftForeArm',
  lHand: 'mixamorigLeftHand',
  rArm: 'mixamorigRightArm',
  rForeArm: 'mixamorigRightForeArm',
  rHand: 'mixamorigRightHand',
  lUpLeg: 'mixamorigLeftUpLeg',
  lLeg: 'mixamorigLeftLeg',
  lFoot: 'mixamorigLeftFoot',
  rUpLeg: 'mixamorigRightUpLeg',
  rLeg: 'mixamorigRightLeg',
  rFoot: 'mixamorigRightFoot',
} as const;

function qTrack(bone: string, values: Array<[number, number, number, number]>, times: number[]): THREE.QuaternionKeyframeTrack {
  return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values.flat());
}

function vTrack(bone: string, values: Array<[number, number, number]>, times: number[]): THREE.VectorKeyframeTrack {
  return new THREE.VectorKeyframeTrack(`${bone}.position`, times, values.flat());
}

function eulerQuats(eulers: Array<[number, number, number]>, times: number[]): THREE.QuaternionKeyframeTrack {
  const q = new THREE.Quaternion();
  const values: Array<[number, number, number, number]> = [];
  for (const [x, y, z] of eulers) {
    q.setFromEuler(new THREE.Euler(x, y, z));
    values.push([q.x, q.y, q.z, q.w]);
  }
  return qTrack('', values, times);
}

function namedEulerTrack(bone: string, eulers: Array<[number, number, number]>, times: number[]): THREE.QuaternionKeyframeTrack {
  const q = new THREE.Quaternion();
  const values: number[] = [];
  for (const [x, y, z] of eulers) {
    q.setFromEuler(new THREE.Euler(x, y, z));
    values.push(q.x, q.y, q.z, q.w);
  }
  return new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values);
}

const IDLE_TIMES = [0, 0.45, 0.9];
const LOOP_TIMES = [0, 0.25, 0.5, 0.75, 1.0];

export function buildProceduralCombatAnimations(): THREE.AnimationClip[] {
  const clips: THREE.AnimationClip[] = [];

  clips.push(new THREE.AnimationClip('ProceduralIdle', 0.9, [
    vTrack(B.hips, [[0, 0, 0], [0, 0.015, 0], [0, 0, 0]], IDLE_TIMES),
    namedEulerTrack(B.spine, [[0, 0, 0], [0.02, 0, 0], [0, 0, 0]], IDLE_TIMES),
    namedEulerTrack(B.head, [[0, 0, 0], [-0.01, 0, 0], [0, 0, 0]], IDLE_TIMES),
  ]));

  clips.push(new THREE.AnimationClip('ProceduralWalk', 1.0, [
    namedEulerTrack(B.lUpLeg, [[0.35, 0, 0], [-0.35, 0, 0], [0.35, 0, 0], [-0.35, 0, 0], [0.35, 0, 0]], LOOP_TIMES),
    namedEulerTrack(B.rUpLeg, [[-0.35, 0, 0], [0.35, 0, 0], [-0.35, 0, 0], [0.35, 0, 0], [-0.35, 0, 0]], LOOP_TIMES),
    namedEulerTrack(B.lArm, [[-0.18, 0, 0], [0.18, 0, 0], [-0.18, 0, 0], [0.18, 0, 0], [-0.18, 0, 0]], LOOP_TIMES),
    namedEulerTrack(B.rArm, [[0.18, 0, 0], [-0.18, 0, 0], [0.18, 0, 0], [-0.18, 0, 0], [0.18, 0, 0]], LOOP_TIMES),
    vTrack(B.hips, [[0, 0, 0], [0, 0.025, 0], [0, 0, 0], [0, 0.025, 0], [0, 0, 0]], LOOP_TIMES),
  ]));

  const punchTimes = [0, 0.10, 0.22, 0.38];
  clips.push(new THREE.AnimationClip('ProceduralJab', 0.38, [
    namedEulerTrack(B.rArm, [[0, 0, 0], [-0.65, 0, -0.25], [-1.25, 0, -0.10], [0, 0, 0]], punchTimes),
    namedEulerTrack(B.rForeArm, [[0, 0, 0], [-0.25, 0, 0], [-0.75, 0, 0], [0, 0, 0]], punchTimes),
    namedEulerTrack(B.spine2, [[0, 0, 0], [0, 0.08, 0], [0, 0.14, 0], [0, 0, 0]], punchTimes),
  ]));

  clips.push(new THREE.AnimationClip('ProceduralCross', 0.48, [
    namedEulerTrack(B.lArm, [[0, 0, 0], [-0.55, 0, 0.20], [-1.35, 0, 0.05], [0, 0, 0]], punchTimes),
    namedEulerTrack(B.lForeArm, [[0, 0, 0], [-0.25, 0, 0], [-0.85, 0, 0], [0, 0, 0]], punchTimes),
    namedEulerTrack(B.spine2, [[0, 0, 0], [0, -0.10, 0], [0, -0.18, 0], [0, 0, 0]], punchTimes),
  ]));

  const kickTimes = [0, 0.12, 0.28, 0.52];
  clips.push(new THREE.AnimationClip('ProceduralKick', 0.52, [
    namedEulerTrack(B.rUpLeg, [[0, 0, 0], [-0.45, 0, 0], [1.0, 0, 0], [0, 0, 0]], kickTimes),
    namedEulerTrack(B.rLeg, [[0, 0, 0], [0.25, 0, 0], [-1.1, 0, 0], [0, 0, 0]], kickTimes),
    namedEulerTrack(B.spine2, [[0, 0, 0], [0, 0.05, 0], [0, 0.12, 0], [0, 0, 0]], kickTimes),
  ]));

  const hitTimes = [0, 0.08, 0.22, 0.55];
  clips.push(new THREE.AnimationClip('ProceduralHit', 0.55, [
    namedEulerTrack(B.spine, [[0, 0, 0], [0, -0.18, 0], [0, -0.35, 0], [0, 0, 0]], hitTimes),
    namedEulerTrack(B.head, [[0, 0, 0], [0, -0.25, 0], [0, -0.40, 0], [0, 0, 0]], hitTimes),
    namedEulerTrack(B.lArm, [[0, 0, 0], [0.25, 0, 0.15], [0.35, 0, 0.20], [0, 0, 0]], hitTimes),
    namedEulerTrack(B.rArm, [[0, 0, 0], [0.25, 0, -0.15], [0.35, 0, -0.20], [0, 0, 0]], hitTimes),
  ]));

  const guardTimes = [0, 0.18, 0.36];
  clips.push(new THREE.AnimationClip('ProceduralGuard', 0.36, [
    namedEulerTrack(B.lArm, [[0, 0, 0], [-0.75, 0, 0.35], [-0.75, 0, 0.35]], guardTimes),
    namedEulerTrack(B.rArm, [[0, 0, 0], [-0.75, 0, -0.35], [-0.75, 0, -0.35]], guardTimes),
    namedEulerTrack(B.lForeArm, [[0, 0, 0], [-0.35, 0, 0], [-0.35, 0, 0]], guardTimes),
    namedEulerTrack(B.rForeArm, [[0, 0, 0], [-0.35, 0, 0], [-0.35, 0, 0]], guardTimes),
  ]));

  const downTimes = [0, 0.18, 0.45, 0.9];
  clips.push(new THREE.AnimationClip('ProceduralKnockdown', 0.9, [
    namedEulerTrack(B.spine, [[0, 0, 0], [0.45, 0, 0], [1.1, 0, 0], [1.2, 0, 0]], downTimes),
    namedEulerTrack(B.hips, [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], downTimes),
    namedEulerTrack(B.lUpLeg, [[0, 0, 0], [0.4, 0, 0], [0.9, 0, 0], [1.1, 0, 0]], downTimes),
    namedEulerTrack(B.rUpLeg, [[0, 0, 0], [-0.4, 0, 0], [-0.9, 0, 0], [-1.1, 0, 0]], downTimes),
  ]));

  clips.push(new THREE.AnimationClip('ProceduralTaunt', 1.1, [
    namedEulerTrack(B.rArm, [[0, 0, 0], [-1.1, 0, 0], [-0.8, 0, 0], [0, 0, 0]], [0, 0.3, 0.7, 1.1]),
    namedEulerTrack(B.head, [[0, 0, 0], [0, 0.15, 0], [0, -0.15, 0], [0, 0, 0]], [0, 0.3, 0.7, 1.1]),
  ]));

  return clips;
}
