import * as THREE from 'three';

export interface RetargetDiagnostic {
  bone: string;
  determinant: number;
  mirrored: boolean;
  nonFinite: boolean;
}

export function diagnoseSkeleton(root: THREE.Object3D): RetargetDiagnostic[] {
  const result: RetargetDiagnostic[] = [];
  root.updateMatrixWorld(true);
  root.traverse(o => {
    if (!(o as THREE.Bone).isBone) return;
    const m = new THREE.Matrix4().extractRotation(o.matrixWorld);
    const e = m.elements;
    const det =
      e[0] * (e[5] * e[10] - e[6] * e[9]) -
      e[4] * (e[1] * e[10] - e[2] * e[9]) +
      e[8] * (e[1] * e[6] - e[2] * e[5]);
    const nonFinite = !Number.isFinite(det) || !o.quaternion.toArray().every(Number.isFinite);
    result.push({ bone: o.name, determinant: det, mirrored: det < 0, nonFinite });
  });
  return result;
}

export function assertNoInvalidTransforms(root: THREE.Object3D) {
  const bad = diagnoseSkeleton(root).filter(x => x.nonFinite || x.mirrored);
  if (bad.length) {
    throw new Error(`BANNON_SKELETON_INVALID: ${bad.map(x => x.bone).join(', ')}`);
  }
}
