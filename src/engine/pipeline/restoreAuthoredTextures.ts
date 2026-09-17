import * as THREE from 'three';

/**
 * Skinned re-exports (MAIME_skinned, MAIME_tattered_skinned) dropped their
 * image buffers. Restore the authored albedo from the unskinned sibling PNG
 * without replacing materials or rewriting skin weights.
 */
const SIBLING_ALBEDO: Record<string, string> = {
  'MAIME_skinned.glb': '/models/textures/MAIME_0.png',
  'MAIME_tattered_skinned.glb': '/models/textures/MAIME_tattered_0.png',
  'BANNON_rigged.glb': '/models/textures/BANNON_rigged_0.png',
};

const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();

function fileName(modelUrl: string): string {
  return (modelUrl.split('?')[0].split('/').pop() ?? '').trim();
}

function albedoUrlFor(modelUrl: string): string | null {
  const file = fileName(modelUrl);
  if (SIBLING_ALBEDO[file]) return SIBLING_ALBEDO[file];
  const stem = file.replace(/\.glb$/i, '').replace(/_skinned$/i, '');
  if (/maime|bannon/i.test(stem)) {
    return `/models/textures/${stem}_0.png`;
  }
  return null;
}

function textureFor(url: string): THREE.Texture {
  const hit = cache.get(url);
  if (hit) return hit;
  const tex = loader.load(url, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.flipY = false;
    t.needsUpdate = true;
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  cache.set(url, tex);
  return tex;
}

function materialNeedsAlbedo(mat: THREE.Material | undefined): boolean {
  if (!mat) return false;
  const m = mat as THREE.MeshStandardMaterial;
  return !m.map;
}

export function restoreAuthoredTextures(root: THREE.Object3D, modelUrl: string): boolean {
  const url = albedoUrlFor(modelUrl);
  if (!url) return false;

  let missing = false;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    if (mats.some((m) => materialNeedsAlbedo(m))) missing = true;
  });
  if (!missing) return false;

  const tex = textureFor(url);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((mat) => {
      if (!mat || (mat as THREE.MeshStandardMaterial).map) return;
      const m = mat as THREE.MeshStandardMaterial;
      m.map = tex;
      if ('color' in m && m.color) m.color.set(0xffffff);
      mat.needsUpdate = true;
    });
  });
  return true;
}
