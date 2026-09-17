import * as THREE from 'three';
import { normalizeBoneName, BANNON_RETARGET_CONTRACT } from '../BannonRetargetContract';

export type BoneMap = Map<string, THREE.Bone>;

export function indexBones(root: THREE.Object3D): BoneMap {
  const map: BoneMap = new Map();
  root.traverse(o => {
    if ((o as THREE.Bone).isBone) {
      const key = normalizeBoneName(o.name);
      if (key && !map.has(key)) map.set(key, o as THREE.Bone);
    }
  });
  return map;
}

function critical(map: BoneMap, chain: readonly string[]) {
  return chain.every(part => {
    const normalized = normalizeBoneName(part);
    return [...map.keys()].some(k => k === normalized || k.endsWith(normalized));
  });
}

export function validateCanonicalSkeleton(root: THREE.Object3D) {
  const bones = indexBones(root);
  const failures: string[] = [];
  for (const chain of BANNON_RETARGET_CONTRACT.criticalChains) {
    if (!critical(bones, chain)) failures.push(`missing chain: ${chain.join(' -> ')}`);
  }
  if (failures.length) throw new Error(`BANNON_RETARGET_REJECTED: ${failures.join('; ')}`);
  return bones;
}

/**
 * Copies only animation-independent rest transforms. Animation clips are
 * subsequently evaluated relative to this captured rest pose; no hard-coded
 * 180-degree limb correction is applied.
 */
export function captureRestPose(root: THREE.Object3D) {
  const pose = new Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }>();
  root.traverse(o => {
    if ((o as THREE.Bone).isBone) {
      pose.set(normalizeBoneName(o.name), {
        position: o.position.clone(),
        quaternion: o.quaternion.clone(),
        scale: o.scale.clone()
      });
    }
  });
  return pose;
}

export function restoreRestPose(root: THREE.Object3D, pose: ReturnType<typeof captureRestPose>) {
  root.traverse(o => {
    if (!(o as THREE.Bone).isBone) return;
    const p = pose.get(normalizeBoneName(o.name));
    if (!p) return;
    o.position.copy(p.position);
    o.quaternion.copy(p.quaternion);
    o.scale.copy(p.scale);
  });
}
