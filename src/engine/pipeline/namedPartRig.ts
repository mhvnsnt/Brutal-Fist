import * as THREE from 'three';

/**
 * Named-part GLBs (Maime pelvis/chest/head/…) whose Mixamo bones have no rest
 * translation cannot be driven. Skinning them with the Bannon bank is skeleton
 * desync: parts fly apart. Do not re-rig at runtime — skip the mixer.
 */
export function skeletonHasAuthoredRestPose(root: THREE.Object3D): boolean {
  let found = false;
  root.traverse((obj) => {
    if (found) return;
    const bone = obj as THREE.Bone;
    if (!bone.isBone && obj.type !== 'Bone') return;
    if (obj.position.length() > 0.02) found = true;
  });
  return found;
}

export function isCollapsedNamedPartRig(root: THREE.Object3D): boolean {
  let meshCount = 0;
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) meshCount += 1;
  });
  return meshCount >= 8 && !skeletonHasAuthoredRestPose(root);
}

/** In-place: subtract frame-0 hip Y so idle/walk stay on the authored floor. */
export function flattenRootMotionY(clip: THREE.AnimationClip): void {
  for (const track of clip.tracks) {
    if (!/\.position$/i.test(track.name) || !/hips/i.test(track.name)) continue;
    const v = track.values;
    if (v.length < 3) continue;
    const y0 = v[1];
    for (let i = 1; i < v.length; i += 3) v[i] -= y0;
  }
}

const FOOT_RE = /foot|toe|ankle/i;

/**
 * After mixer.update(), put soles on y=0 using FOOT BONES — not mesh AABB.
 * Box3.setFromObject uses undeformed bind geometry, so AABB snap cannot see
 * Mixamo idle lifting the skinned verts (the hover in the screenshots).
 */
export function snapAuthoredFeetToFloor(root: THREE.Object3D, soleY = 0.02): void {
  root.updateMatrixWorld(true);
  const world = new THREE.Vector3();
  let minY = Infinity;
  root.traverse((obj) => {
    const bone = obj as THREE.Bone;
    if (!bone.isBone && obj.type !== 'Bone') return;
    if (!FOOT_RE.test(obj.name || '')) return;
    obj.getWorldPosition(world);
    if (world.y < minY) minY = world.y;
  });
  if (!Number.isFinite(minY)) return;
  const dy = soleY - minY;
  if (Math.abs(dy) > 0.001) root.position.y += dy;
}

