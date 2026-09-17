/**
 * Bind-relative motion. Keys from LIVE bind: q(t) = q_bind * q_delta.
 * Never write absolute Mixamo/Euler banks — that replaces rest and twists
 * hunched Cipher / plugin Maime / Mixamo legs (rz ≈ ±π).
 */
import * as THREE from 'three';

const _delta = new THREE.Quaternion();
const _out = new THREE.Quaternion();
const _euler = new THREE.Euler();

type BoneRest = { name: string; q: THREE.Quaternion };

function collectRests(root: THREE.Object3D): BoneRest[] {
  const rests: BoneRest[] = [];
  const seen = new Set<string>();
  root.traverse((obj) => {
    if (!(obj as THREE.Bone).isBone || !obj.name || seen.has(obj.name)) return;
    seen.add(obj.name);
    rests.push({ name: obj.name, q: obj.quaternion.clone() });
  });
  return rests;
}

function boneKey(name: string): string {
  return name
    .replace(/^mixamorig[:._-]*/i, '')
    .replace(/^bip0?1[_:]?/i, '')
    .replace(/^bone[_:]?/i, '');
}

/** Slot name (from clipFromDeltas keys) → any common rig synonym. */
const SLOT_RX: Record<string, RegExp> = {
  RightArm: /^(rightarm|rupperarm|rightupperarm|upperarm_r|arm_r|right_arm|r_arm)$/i,
  LeftArm: /^(leftarm|lupperarm|leftupperarm|upperarm_l|arm_l|left_arm|l_arm)$/i,
  RightForeArm: /^(rightforearm|rforearm|rightlowerarm|lowerarm_r|forearm_r|r_forearm)$/i,
  LeftForeArm: /^(leftforearm|lforearm|leftlowerarm|lowerarm_l|forearm_l|l_forearm)$/i,
  RightUpLeg: /^(rightupleg|rupperleg|rightupperleg|thigh_r|upleg_r|rthigh|rightthigh|hip_r)$/i,
  LeftUpLeg: /^(leftupleg|lupperleg|leftupperleg|thigh_l|upleg_l|lthigh|leftthigh|hip_l)$/i,
  RightLeg: /^(rightleg|rlowerleg|rightlowerleg|calf_r|shin_r|rcalf)$/i,
  LeftLeg: /^(leftleg|llowerleg|leftlowerleg|calf_l|shin_l|lcalf)$/i,
  Spine: /^(spine|spine1|spine2|chest|torso|abdomen|spine_01|spine_02|spine01)$/i,
  Head: /^(head|head_01|skull|headtop)$/i,
};

function match(name: string, re: string): boolean {
  const k = boneKey(name);
  const slot = re.replace(/^\^/, '').replace(/\$$/, '');
  const rx = SLOT_RX[slot];
  if (rx) return rx.test(k);
  return new RegExp(re, 'i').test(k);
}

function qMul(bind: THREE.Quaternion, dx: number, dy: number, dz: number): number[] {
  _euler.set(dx, dy, dz, 'XYZ');
  _delta.setFromEuler(_euler);
  _out.copy(bind).multiply(_delta);
  return [_out.x, _out.y, _out.z, _out.w];
}

function clipFromDeltas(
  name: string,
  semantic: string,
  duration: number,
  rests: BoneRest[],
  keys: Array<{ t: number; d: Record<string, [number, number, number]> }>,
  loop = true,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const rest of rests) {
    const times: number[] = [];
    const values: number[] = [];
    let used = false;
    for (const key of keys) {
      let delta: [number, number, number] = [0, 0, 0];
      for (const [re, d] of Object.entries(key.d)) {
        if (match(rest.name, re)) {
          delta = d;
          used = true;
          break;
        }
      }
      times.push(key.t);
      values.push(...qMul(rest.q, delta[0], delta[1], delta[2]));
    }
    if (!used) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${rest.name}.quaternion`, times, values));
  }
  const clip = new THREE.AnimationClip(name, duration, tracks);
  (clip as THREE.AnimationClip & { userData: Record<string, unknown> }).userData = {
    semanticState: semantic,
    clipSourceType: 'BIND_RELATIVE',
    isProcedural: true,
    loop,
  };
  return clip;
}

export function buildBindRelativeClips(root: THREE.Object3D): THREE.AnimationClip[] {
  const rests = collectRests(root);
  if (rests.length === 0) return [];

  const idle = clipFromDeltas('idle', 'idle', 2.0, rests, [
    { t: 0, d: { '^Spine$': [0.03, 0, 0], '^Head$': [-0.02, 0, 0] } },
    { t: 1, d: { '^Spine$': [-0.02, 0, 0], '^Head$': [0.02, 0, 0] } },
    { t: 2, d: { '^Spine$': [0.03, 0, 0], '^Head$': [-0.02, 0, 0] } },
  ]);

  const guard = clipFromDeltas('guard', 'block', 1.6, rests, [
    { t: 0, d: { '^LeftArm$': [-0.55, 0.12, 0.7], '^RightArm$': [-0.55, -0.12, -0.7], '^LeftForeArm$': [-0.4, 0, 0.35], '^RightForeArm$': [-0.4, 0, -0.35], '^Spine$': [0.08, 0, 0] } },
    { t: 0.8, d: { '^LeftArm$': [-0.6, 0.12, 0.75], '^RightArm$': [-0.6, -0.12, -0.75], '^LeftForeArm$': [-0.45, 0, 0.4], '^RightForeArm$': [-0.45, 0, -0.4], '^Spine$': [0.1, 0, 0] } },
    { t: 1.6, d: { '^LeftArm$': [-0.55, 0.12, 0.7], '^RightArm$': [-0.55, -0.12, -0.7], '^LeftForeArm$': [-0.4, 0, 0.35], '^RightForeArm$': [-0.4, 0, -0.35], '^Spine$': [0.08, 0, 0] } },
  ]);

  const jab = clipFromDeltas('attack_1', 'attack_1', 0.42, rests, [
    { t: 0, d: { '^RightArm$': [-0.4, 0.15, -0.5], '^RightForeArm$': [-0.3, 0, -0.4], '^Spine$': [0, 0.08, 0] } },
    { t: 0.12, d: { '^RightArm$': [-0.2, -0.25, -1.35], '^RightForeArm$': [-0.05, 0, -0.15], '^Spine$': [0.08, 0.22, 0], '^LeftArm$': [-0.2, 0.1, 0.35] } },
    { t: 0.42, d: { '^RightArm$': [0, 0, 0], '^Spine$': [0, 0, 0] } },
  ], false);

  const cross = clipFromDeltas('attack_rp', 'attack_rp', 0.5, rests, [
    { t: 0, d: { '^RightArm$': [-0.5, 0.3, -0.4], '^LeftArm$': [-0.25, 0.1, 0.4], '^Spine$': [0, -0.12, 0] } },
    { t: 0.16, d: { '^RightArm$': [-0.15, -0.2, -1.5], '^RightForeArm$': [-0.1, 0, -0.2], '^Spine$': [0.1, 0.28, 0], '^Head$': [0, 0.1, 0] } },
    { t: 0.5, d: { '^RightArm$': [0, 0, 0], '^Spine$': [0, 0, 0] } },
  ], false);

  const heavy = clipFromDeltas('attack_2', 'attack_2', 0.58, rests, [
    { t: 0, d: { '^LeftArm$': [-0.35, 0.2, 0.55], '^Spine$': [0, -0.08, 0] } },
    { t: 0.2, d: { '^LeftArm$': [-0.2, -0.18, 1.2], '^LeftForeArm$': [-0.25, 0, 0.35], '^Spine$': [0.08, 0.18, 0] } },
    { t: 0.58, d: { '^LeftArm$': [0, 0, 0], '^Spine$': [0, 0, 0] } },
  ], false);

  const lightKick = clipFromDeltas('attack_lk', 'attack_lk', 0.5, rests, [
    { t: 0, d: { '^LeftUpLeg$': [0.35, 0, 0], '^Spine$': [0.05, 0, 0], '^LeftArm$': [-0.2, 0, 0.3] } },
    { t: 0.16, d: { '^LeftUpLeg$': [1.15, 0, 0.15], '^LeftLeg$': [0.35, 0, 0], '^Spine$': [-0.08, 0.1, 0], '^RightArm$': [-0.3, 0, -0.4] } },
    { t: 0.5, d: { '^LeftUpLeg$': [0, 0, 0], '^Spine$': [0, 0, 0] } },
  ], false);

  const heavyKick = clipFromDeltas('attack_rk', 'attack_rk', 0.62, rests, [
    { t: 0, d: { '^RightUpLeg$': [0.25, 0, -0.2], '^Spine$': [0, -0.15, 0], '^LeftArm$': [-0.3, 0, 0.4] } },
    { t: 0.22, d: { '^RightUpLeg$': [1.25, 0.2, 0.35], '^RightLeg$': [0.2, 0, 0], '^Spine$': [-0.12, 0.35, 0], '^Head$': [0, 0.15, 0] } },
    { t: 0.62, d: { '^RightUpLeg$': [0, 0, 0], '^Spine$': [0, 0, 0] } },
  ], false);

  const hit = clipFromDeltas('hit_reaction', 'hit_reaction', 0.4, rests, [
    { t: 0, d: { '^Spine$': [0, 0, 0], '^Head$': [0, 0, 0] } },
    { t: 0.12, d: { '^Spine$': [-0.18, 0.2, 0], '^Head$': [-0.12, 0.22, 0], '^LeftArm$': [-0.25, 0, 0.3], '^RightArm$': [-0.25, 0, -0.3] } },
    { t: 0.4, d: { '^Spine$': [0, 0, 0], '^Head$': [0, 0, 0] } },
  ], false);

  const walk = clipFromDeltas('walk_forward', 'walk_forward', 0.7, rests, [
    { t: 0, d: { '^LeftUpLeg$': [0.55, 0, 0], '^RightUpLeg$': [-0.28, 0, 0], '^LeftArm$': [0.25, 0, 0], '^RightArm$': [-0.25, 0, 0], '^Spine$': [0.04, 0.04, 0] } },
    { t: 0.35, d: { '^LeftUpLeg$': [-0.28, 0, 0], '^RightUpLeg$': [0.55, 0, 0], '^LeftArm$': [-0.25, 0, 0], '^RightArm$': [0.25, 0, 0], '^Spine$': [0.04, -0.04, 0] } },
    { t: 0.7, d: { '^LeftUpLeg$': [0.55, 0, 0], '^RightUpLeg$': [-0.28, 0, 0], '^LeftArm$': [0.25, 0, 0], '^RightArm$': [-0.25, 0, 0], '^Spine$': [0.04, 0.04, 0] } },
  ]);

  const walkBack = clipFromDeltas('walk_back', 'walk_back', 0.75, rests, [
    { t: 0, d: { '^LeftUpLeg$': [-0.35, 0, 0], '^RightUpLeg$': [0.22, 0, 0], '^Spine$': [-0.04, 0, 0] } },
    { t: 0.375, d: { '^LeftUpLeg$': [0.22, 0, 0], '^RightUpLeg$': [-0.35, 0, 0], '^Spine$': [-0.04, 0, 0] } },
    { t: 0.75, d: { '^LeftUpLeg$': [-0.35, 0, 0], '^RightUpLeg$': [0.22, 0, 0], '^Spine$': [-0.04, 0, 0] } },
  ]);

  const run = clipFromDeltas('run', 'run', 0.48, rests, [
    { t: 0, d: { '^LeftUpLeg$': [0.75, 0, 0], '^RightUpLeg$': [-0.4, 0, 0], '^LeftArm$': [0.45, 0, 0], '^RightArm$': [-0.45, 0, 0], '^Spine$': [0.1, 0.06, 0] } },
    { t: 0.24, d: { '^LeftUpLeg$': [-0.4, 0, 0], '^RightUpLeg$': [0.75, 0, 0], '^LeftArm$': [-0.45, 0, 0], '^RightArm$': [0.45, 0, 0], '^Spine$': [0.1, -0.06, 0] } },
    { t: 0.48, d: { '^LeftUpLeg$': [0.75, 0, 0], '^RightUpLeg$': [-0.4, 0, 0], '^LeftArm$': [0.45, 0, 0], '^RightArm$': [-0.45, 0, 0], '^Spine$': [0.1, 0.06, 0] } },
  ]);

  const dash = clipFromDeltas('dash_forward', 'dash_forward', 0.4, rests, [
    { t: 0, d: { '^LeftUpLeg$': [0.85, 0, 0], '^RightUpLeg$': [-0.3, 0, 0], '^Spine$': [0.15, 0, 0], '^RightArm$': [-0.4, 0, -0.4] } },
    { t: 0.2, d: { '^LeftUpLeg$': [-0.3, 0, 0], '^RightUpLeg$': [0.85, 0, 0], '^Spine$': [0.15, 0, 0], '^LeftArm$': [-0.4, 0, 0.4] } },
    { t: 0.4, d: { '^LeftUpLeg$': [0.85, 0, 0], '^RightUpLeg$': [-0.3, 0, 0], '^Spine$': [0.15, 0, 0] } },
  ]);

  const strafeL = clipFromDeltas('strafe_left', 'strafe_left', 0.7, rests, [
    { t: 0, d: { '^LeftUpLeg$': [0.2, 0, 0.4], '^RightUpLeg$': [-0.12, 0, -0.25], '^Spine$': [0, 0, 0.08] } },
    { t: 0.35, d: { '^LeftUpLeg$': [-0.12, 0, -0.25], '^RightUpLeg$': [0.2, 0, 0.4], '^Spine$': [0, 0, -0.08] } },
    { t: 0.7, d: { '^LeftUpLeg$': [0.2, 0, 0.4], '^RightUpLeg$': [-0.12, 0, -0.25], '^Spine$': [0, 0, 0.08] } },
  ]);

  const strafeR = clipFromDeltas('strafe_right', 'strafe_right', 0.7, rests, [
    { t: 0, d: { '^LeftUpLeg$': [0.2, 0, -0.4], '^RightUpLeg$': [-0.12, 0, 0.25], '^Spine$': [0, 0, -0.08] } },
    { t: 0.35, d: { '^LeftUpLeg$': [-0.12, 0, 0.25], '^RightUpLeg$': [0.2, 0, -0.4], '^Spine$': [0, 0, 0.08] } },
    { t: 0.7, d: { '^LeftUpLeg$': [0.2, 0, -0.4], '^RightUpLeg$': [-0.12, 0, 0.25], '^Spine$': [0, 0, -0.08] } },
  ]);

  const knockdown = clipFromDeltas('knockdown', 'knockdown', 0.7, rests, [
    { t: 0, d: { '^Spine$': [0, 0, 0] } },
    { t: 0.35, d: { '^Spine$': [0.55, 0, 0], '^Head$': [0.3, 0, 0], '^LeftUpLeg$': [0.4, 0, 0], '^RightUpLeg$': [0.4, 0, 0] } },
    { t: 0.7, d: { '^Spine$': [0.7, 0, 0], '^Head$': [0.35, 0, 0], '^LeftUpLeg$': [0.5, 0, 0], '^RightUpLeg$': [0.5, 0, 0] } },
  ], false);

  const crouch = clipFromDeltas('crouch', 'crouch', 1.2, rests, [
    { t: 0, d: { '^LeftUpLeg$': [0.7, 0, 0], '^RightUpLeg$': [0.7, 0, 0], '^Spine$': [0.18, 0, 0], '^LeftArm$': [-0.25, 0, 0.3], '^RightArm$': [-0.25, 0, -0.3] } },
    { t: 1.2, d: { '^LeftUpLeg$': [0.7, 0, 0], '^RightUpLeg$': [0.7, 0, 0], '^Spine$': [0.18, 0, 0], '^LeftArm$': [-0.25, 0, 0.3], '^RightArm$': [-0.25, 0, -0.3] } },
  ]);

  const getup = clipFromDeltas('getup', 'getup', 0.6, rests, [
    { t: 0, d: { '^Spine$': [0.5, 0, 0], '^LeftUpLeg$': [0.4, 0, 0], '^RightUpLeg$': [0.4, 0, 0] } },
    { t: 0.6, d: { '^Spine$': [0, 0, 0] } },
  ], false);

  const jump = clipFromDeltas('jump', 'jump', 0.55, rests, [
    { t: 0, d: { '^LeftUpLeg$': [0.25, 0, 0], '^RightUpLeg$': [0.25, 0, 0], '^Spine$': [-0.1, 0, 0] } },
    { t: 0.18, d: { '^LeftUpLeg$': [0.85, 0, 0], '^RightUpLeg$': [0.85, 0, 0], '^Spine$': [-0.28, 0, 0], '^LeftArm$': [-0.55, 0, 0.45], '^RightArm$': [-0.55, 0, -0.45] } },
    { t: 0.55, d: { '^LeftUpLeg$': [0.15, 0, 0], '^RightUpLeg$': [0.15, 0, 0], '^Spine$': [0, 0, 0] } },
  ], false);

  return [
    idle, guard, jab, cross, heavy, lightKick, heavyKick, hit,
    walk, walkBack, run, dash, strafeL, strafeR, knockdown, crouch, getup, jump,
  ];
}

export function fillBindRelativeGaps(root: THREE.Object3D, existing: THREE.AnimationClip[]): THREE.AnimationClip[] {
  const have = new Set<string>();
  for (const clip of existing) {
    const sem = String((clip as { userData?: { semanticState?: string } }).userData?.semanticState ?? '');
    if (sem) have.add(sem);
  }
  const out = [...existing];
  for (const clip of buildBindRelativeClips(root)) {
    const sem = String((clip as { userData?: { semanticState?: string } }).userData?.semanticState ?? '');
    if (sem && have.has(sem)) continue;
    out.push(clip);
    if (sem) have.add(sem);
  }
  return out;
}

const _qSrc = new THREE.Quaternion();
const _qRest = new THREE.Quaternion();
const _qInv = new THREE.Quaternion();
const _qOut = new THREE.Quaternion();

export function collectRestMap(root: THREE.Object3D): Map<string, THREE.Quaternion> {
  const map = new Map<string, THREE.Quaternion>();
  root.traverse((obj) => {
    if (!(obj as THREE.Bone).isBone || !obj.name || map.has(obj.name)) return;
    map.set(obj.name, obj.quaternion.clone());
  });
  return map;
}

/**
 * Replay a Mixamo/Euler clip as motion on the LIVE bind:
 *   q(t) = q_bind * q_src(0)^-1 * q_src(t)
 * t=0 stays on the planted pose (hunched Cipher stays hunched).
 * Drop non-quaternion tracks — hip translation is instance-owned.
 */
export function makeClipBindRelative(
  clip: THREE.AnimationClip,
  restMap: Map<string, THREE.Quaternion>,
): THREE.AnimationClip | null {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    const bone = track.name.slice(0, track.name.length - '.quaternion'.length);
    const bind = restMap.get(bone);
    if (!bind) continue;
    const values = track.values;
    if (values.length < 4) continue;
    _qRest.set(values[0], values[1], values[2], values[3]).normalize();
    if (_qRest.lengthSq() < 1e-8) continue;
    _qInv.copy(_qRest).invert();
    const out = new Float32Array(values.length);
    for (let i = 0; i + 3 < values.length; i += 4) {
      _qSrc.set(values[i], values[i + 1], values[i + 2], values[i + 3]).normalize();
      _qOut.copy(bind).multiply(_qInv).multiply(_qSrc);
      out[i] = _qOut.x;
      out[i + 1] = _qOut.y;
      out[i + 2] = _qOut.z;
      out[i + 3] = _qOut.w;
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(track.name, Array.from(track.times), out));
  }
  if (tracks.length === 0) return null;
  const converted = new THREE.AnimationClip(clip.name, clip.duration, tracks);
  const src = (clip as THREE.AnimationClip & { userData?: Record<string, unknown> }).userData ?? {};
  (converted as THREE.AnimationClip & { userData: Record<string, unknown> }).userData = {
    ...src,
    clipSourceType: 'BIND_RELATIVE_BANK',
  };
  return converted;
}
