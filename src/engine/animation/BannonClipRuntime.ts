import * as THREE from 'three';

/**
 * Runtime bridge for Bannon's authored motion JSON.
 *
 * The combat state/frame systems remain authoritative. This module only turns
 * real Bannon bone keyframes into Three.js clips that deform the rendered
 * SkinnedMesh through AnimationMixer.
 */
export interface BannonMotionKey {
  t: number;
  bones?: Record<string, { rx: number; ry: number; rz: number }>;
}

export interface BannonMotionFile {
  dur: number;
  keys: BannonMotionKey[];
}

const BANNON_RAW = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips';
const cache = new Map<string, Promise<THREE.AnimationClip | null>>();

const aliases: Record<string, string[]> = {
  mixamorigHips: ['mixamorigHips', 'Hips', 'hips', 'pelvis', 'Pelvis', 'root', 'Root'],
  mixamorigSpine: ['mixamorigSpine', 'Spine', 'spine', 'spine_01'],
  mixamorigSpine1: ['mixamorigSpine1', 'Spine1', 'Spine_01', 'spine_02'],
  mixamorigSpine2: ['mixamorigSpine2', 'Spine2', 'Spine_02', 'chest', 'Chest'],
  mixamorigNeck: ['mixamorigNeck', 'Neck', 'neck'],
  mixamorigHead: ['mixamorigHead', 'Head', 'head'],
  mixamorigLeftShoulder: ['mixamorigLeftShoulder', 'LeftShoulder', 'shoulder_l'],
  mixamorigLeftArm: ['mixamorigLeftArm', 'LeftArm', 'upperarm_l', 'UpperArm.L'],
  mixamorigLeftForeArm: ['mixamorigLeftForeArm', 'LeftForeArm', 'forearm_l', 'LowerArm.L'],
  mixamorigLeftHand: ['mixamorigLeftHand', 'LeftHand', 'hand_l', 'Hand.L'],
  mixamorigRightShoulder: ['mixamorigRightShoulder', 'RightShoulder', 'shoulder_r'],
  mixamorigRightArm: ['mixamorigRightArm', 'RightArm', 'upperarm_r', 'UpperArm.R'],
  mixamorigRightForeArm: ['mixamorigRightForeArm', 'RightForeArm', 'forearm_r', 'LowerArm.R'],
  mixamorigRightHand: ['mixamorigRightHand', 'RightHand', 'hand_r', 'Hand.R'],
  mixamorigLeftUpLeg: ['mixamorigLeftUpLeg', 'LeftUpLeg', 'thigh_l', 'Thigh.L'],
  mixamorigLeftLeg: ['mixamorigLeftLeg', 'LeftLeg', 'calf_l', 'Shin.L'],
  mixamorigLeftFoot: ['mixamorigLeftFoot', 'LeftFoot', 'foot_l', 'Foot.L'],
  mixamorigRightUpLeg: ['mixamorigRightUpLeg', 'RightUpLeg', 'thigh_r', 'Thigh.R'],
  mixamorigRightLeg: ['mixamorigRightLeg', 'RightLeg', 'calf_r', 'Shin.R'],
  mixamorigRightFoot: ['mixamorigRightFoot', 'RightFoot', 'foot_r', 'Foot.R'],
};

function findTargetBone(root: THREE.Object3D, sourceName: string): THREE.Bone | null {
  const candidates = aliases[sourceName] ?? [sourceName];
  let result: THREE.Bone | null = null;
  root.traverse(o => {
    if (result || !(o as THREE.Bone).isBone) return;
    const n = o.name.toLowerCase();
    if (candidates.some(c => n === c.toLowerCase())) result = o as THREE.Bone;
  });
  return result;
}

export function buildBannonAnimationClip(root: THREE.Object3D, name: string, motion: BannonMotionFile): THREE.AnimationClip | null {
  if (!motion.keys?.length) return null;
  const tracks: THREE.KeyframeTrack[] = [];
  const first = motion.keys[0]?.bones ?? {};

  for (const sourceBone of Object.keys(first)) {
    const target = findTargetBone(root, sourceBone);
    if (!target) continue;
    const times: number[] = [];
    const values: number[] = [];
    const q = new THREE.Quaternion();
    for (const key of motion.keys) {
      const e = key.bones?.[sourceBone];
      if (!e) continue;
      times.push(key.t);
      q.setFromEuler(new THREE.Euler(e.rx, e.ry, e.rz, 'XYZ'));
      values.push(q.x, q.y, q.z, q.w);
    }
    if (times.length >= 2) tracks.push(new THREE.QuaternionKeyframeTrack(`${target.uuid}.quaternion`, times, values));
  }

  return tracks.length ? new THREE.AnimationClip(name, motion.dur, tracks) : null;
}

export async function loadBannonAnimation(root: THREE.Object3D, clipName: string): Promise<THREE.AnimationClip | null> {
  const key = clipName.trim().toUpperCase();
  if (!key) return null;
  const cacheKey = `${key}:${root.uuid}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const promise = fetch(`${BANNON_RAW}/${encodeURIComponent(key)}.json`, { cache: 'force-cache' })
    .then(async r => {
      if (!r.ok) throw new Error(`Bannon animation ${key}: HTTP ${r.status}`);
      return (await r.json()) as BannonMotionFile;
    })
    .then(data => buildBannonAnimationClip(root, key, data))
    .catch(err => {
      console.warn(`[BannonAnimation] unavailable: ${key}`, err);
      return null;
    });

  cache.set(cacheKey, promise);
  return promise;
}

export const BANNON_CORE_ANIMATION_ALIASES: Record<string, string> = {
  idle: 'BOX_IDLE', Neutral: 'BOX_IDLE', walk: 'DRUNK_WALK', Walking: 'DRUNK_WALK',
  walkForward: 'DRUNK_WALK', walkBackward: 'DRUNK_WALK', lightAttack: 'COMBO_PUNCH',
  light: 'COMBO_PUNCH', heavyAttack: 'BIG_BODY_BLOW', heavy: 'BIG_BODY_BLOW',
  guard: 'CENTER_BLOCK', block: 'CENTER_BLOCK', hit: 'BIG_RIB_HIT',
  Hitstun: 'BIG_RIB_HIT', HitStun: 'BIG_RIB_HIT',
};
