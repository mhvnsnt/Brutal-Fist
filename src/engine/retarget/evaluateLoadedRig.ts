import * as THREE from 'three';

/**
 * Read-only rig check after GLTFLoader + meshopt decode.
 * Does not rewrite weights, bind matrices, or bone transforms.
 * Source GLB fixes belong in `scripts/audit-rigs.mjs --fix`.
 */
export type LoadedRigReport = {
  file: string;
  bones: number;
  skinnedMeshes: number;
  weightSamples: number;
  weightOff: number;
  missingInverseBind: number;
};

const WEIGHT_EPS = 0.05;

export function evaluateLoadedRig(root: THREE.Object3D, modelUrl: string): LoadedRigReport {
  const bones = new Set<THREE.Bone>();
  let skinnedMeshes = 0;
  let weightSamples = 0;
  let weightOff = 0;
  let missingInverseBind = 0;

  root.traverse((child) => {
    const skinned = child as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    skinnedMeshes++;
    const skeleton = skinned.skeleton;
    if (!skeleton || skeleton.bones.length === 0) {
      missingInverseBind++;
      return;
    }
    for (const bone of skeleton.bones) bones.add(bone);
    const ibm = skeleton.boneInverses;
    if (!ibm || ibm.length !== skeleton.bones.length) missingInverseBind++;

    const weights = skinned.geometry.getAttribute('skinWeight');
    if (!weights) return;
    const step = Math.max(1, Math.floor(weights.count / 64));
    for (let i = 0; i < weights.count; i += step) {
      const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
      weightSamples++;
      if (sum > 1e-4 && Math.abs(sum - 1) > WEIGHT_EPS) weightOff++;
    }
  });

  const file = (modelUrl.split('?')[0].split('/').pop() ?? modelUrl).trim();
  const report: LoadedRigReport = {
    file,
    bones: bones.size,
    skinnedMeshes,
    weightSamples,
    weightOff,
    missingInverseBind,
  };
  console.info(
    `[rig-audit] ${file} bones=${report.bones} skins=${report.skinnedMeshes} weightOff=${report.weightOff}/${report.weightSamples} ibm=${report.missingInverseBind}`,
  );
  return report;
}
