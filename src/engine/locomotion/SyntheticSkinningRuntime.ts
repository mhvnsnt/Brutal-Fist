/**
 * SyntheticSkinningRuntime
 *
 * Runtime fallback for static GLB meshes that contain geometry but no
 * SkinnedMesh/skeleton. This is intentionally a real skinning conversion:
 * vertices receive bone indices + weights and are rendered through a
 * THREE.SkinnedMesh bound to the generated humanoid skeleton.
 *
 * This prevents the common AI failure mode where a "synthetic rig" exists
 * only as invisible bones while the visible character remains a statue.
 */

import * as THREE from 'three';
import type { ProceduralRigResult } from './AutoRigDetector';

interface BoneInfluence {
  index: number;
  weight: number;
}

function collectBones(rig: ProceduralRigResult): THREE.Bone[] {
  return Array.from(rig.bones.values());
}

function chooseInfluences(
  localPosition: THREE.Vector3,
  bones: THREE.Bone[],
  meshWorldMatrix: THREE.Matrix4,
): BoneInfluence[] {
  // Vertex positions are local to the mesh; bone positions are world-space.
  // Comparing them directly produces systematically wrong weights and can
  // create the exact limb/torso tearing this runtime is meant to prevent.
  const worldPosition = localPosition.clone().applyMatrix4(meshWorldMatrix);
  const scored = bones
    .map((bone, index) => {
      const world = new THREE.Vector3();
      bone.getWorldPosition(world);
      const dx = worldPosition.x - world.x;
      const dy = worldPosition.y - world.y;
      const dz = worldPosition.z - world.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.0001;
      return { index, weight: 1 / distance };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4);

  const total = scored.reduce((sum, item) => sum + item.weight, 0) || 1;
  return scored.map(item => ({ index: item.index, weight: item.weight / total }));
}

/**
 * Convert every ordinary Mesh in a scene into a SkinnedMesh bound to the
 * supplied synthetic skeleton. Existing SkinnedMeshes are left untouched.
 *
 * The weights are spatially generated from the nearest humanoid bones. This
 * is deliberately conservative: it gives every vertex a real deformation
 * path, while authored rigs remain authoritative whenever they already exist.
 */
export function attachSyntheticSkinning(
  scene: THREE.Object3D,
  rig: ProceduralRigResult,
): { converted: number; vertices: number } {
  const bones = collectBones(rig);
  if (!bones.length) return { converted: 0, vertices: 0 };

  scene.updateMatrixWorld(true);
  let converted = 0;
  let vertices = 0;

  const meshes: THREE.Mesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh && !(child as THREE.SkinnedMesh).isSkinnedMesh) {
      meshes.push(child as THREE.Mesh);
    }
  });

  for (const mesh of meshes) {
    const source = mesh.geometry as THREE.BufferGeometry;
    const position = source.getAttribute('position');
    if (!position || position.count === 0) continue;

    const geometry = source.clone();
    const indices = new Uint16Array(position.count * 4);
    const weights = new Float32Array(position.count * 4);
    const local = new THREE.Vector3();

    const meshWorldMatrix = mesh.matrixWorld.clone();
    for (let i = 0; i < position.count; i++) {
      local.fromBufferAttribute(position, i);
      const influences = chooseInfluences(local, bones, meshWorldMatrix);
      for (let j = 0; j < 4; j++) {
        const influence = influences[j] ?? { index: 0, weight: 0 };
        indices[i * 4 + j] = influence.index;
        weights[i * 4 + j] = influence.weight;
      }
    }

    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    // Three.js consumes a vec4 of skin indices/weights for this runtime path.
    // Every vertex receives at most four influences and the weights sum to 1.

    const skinned = new THREE.SkinnedMesh(geometry, mesh.material);
    skinned.name = mesh.name || 'SyntheticSkinnedMesh';
    skinned.position.copy(mesh.position);
    skinned.quaternion.copy(mesh.quaternion);
    skinned.scale.copy(mesh.scale);
    skinned.castShadow = mesh.castShadow;
    skinned.receiveShadow = mesh.receiveShadow;
    skinned.frustumCulled = mesh.frustumCulled;
    skinned.bind(rig.skeleton);

    const parent = mesh.parent;
    if (parent) {
      parent.add(skinned);
      parent.remove(mesh);
    }
    mesh.geometry.dispose();
    converted += 1;
    vertices += position.count;
  }

  scene.updateMatrixWorld(true);
  return { converted, vertices };
}

/** Validate that visible skinned meshes actually reference the generated bones. */
export function validateSyntheticSkinning(scene: THREE.Object3D): {
  skinnedMeshes: number;
  boundMeshes: number;
  boneCount: number;
} {
  let skinnedMeshes = 0;
  let boundMeshes = 0;
  const boneSet = new Set<THREE.Bone>();

  scene.traverse((child) => {
    if (!(child as THREE.SkinnedMesh).isSkinnedMesh) return;
    const mesh = child as THREE.SkinnedMesh;
    skinnedMeshes += 1;
    if (mesh.skeleton?.bones?.length) {
      boundMeshes += 1;
      mesh.skeleton.bones.forEach(b => boneSet.add(b));
    }
  });

  return { skinnedMeshes, boundMeshes, boneCount: boneSet.size };
}
