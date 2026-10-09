/**
 * customization/facepaintAdapter.ts — bridge from the customizer to the
 * face-paint module. Imports ONLY from ./facepaint/index.ts (the module's
 * public surface), mirroring the AshLanev2 suite's facepaint-adapter.ts.
 *
 * Availability is per fighter: only fighters with a verified paint profile
 * (cipher, onyx, echo — same canon as the AshLanev2 suite) get paint. The
 * UI gates on `supportsFacePaint(fighterId)`; this module returns false
 * (never fake paint) when there is no profile.
 *
 * The decal is built once per character root (bind pose preferred — call
 * before the idle clip starts) and repaints reuse it. `spec` is either a
 * canon preset id ("cipher-grin") or serialized FacePaintLayer[].
 *
 * SwiftShader note (carried from the AshLanev2 integration): the decal
 * material ships `transparent + depthWrite:false`, which does not composite
 * under SwiftShader. The adapter forces `depthWrite:true` (polygonOffset
 * still prevents z-fighting) so paint verifies in headless QC and on GPU.
 */
import * as THREE from 'three';
import {
  getPickerData,
  getPreset,
  clonePresetLayers,
  validateLayers,
  serializeLayers,
  parseLayers,
  FACE_PATTERNS,
  FacePaintPainter,
  FacePaintDecal,
  getProfile,
  type FaceDecal,
  type FacePaintLayer,
} from './facepaint/index';

export { getPickerData, serializeLayers, parseLayers, validateLayers, clonePresetLayers, getPreset };
export type { FacePaintLayer };

const DECAL_KEY = '__bfFacePaintDecal';

/** Does this fighter have a verified paint profile? (UI enablement gate.) */
export function supportsFacePaint(fighterId: string): boolean {
  return !!getProfile(fighterId);
}

/** Resolve a FacePaintSpec to layers: preset id -> clone, else parse. */
export function resolvePaintLayers(spec: string): FacePaintLayer[] | null {
  try {
    return clonePresetLayers(getPreset(spec));
  } catch {
    try {
      return parseLayers(spec);
    } catch {
      return null;
    }
  }
}

function getDecal(root: THREE.Object3D): FaceDecal | undefined {
  return (root.userData as Record<string, unknown>)[DECAL_KEY] as FaceDecal | undefined;
}

function setDecal(root: THREE.Object3D, decal: FaceDecal | undefined): void {
  (root.userData as Record<string, unknown>)[DECAL_KEY] = decal;
}

/** The skinned mesh whose surface contains the head bone (body, or head part). */
function findFaceMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let headBone: THREE.Bone | null = null;
  root.traverse((o) => {
    if (headBone) return;
    const b = o as THREE.Bone;
    if (b.isBone && /head/i.test(b.name) && !/end|tip|top/i.test(b.name)) headBone = b;
  });
  if (!headBone) return null;
  const hp = new THREE.Vector3();
  headBone.getWorldPosition(hp);

  let best: THREE.SkinnedMesh | null = null;
  let bestVol = Infinity;
  const box = new THREE.Box3();
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh || !m.skeleton) return;
    if (m.name.startsWith('facepaint-decal-')) return;
    box.setFromObject(m);
    if (!box.containsPoint(hp)) return;
    const size = box.getSize(new THREE.Vector3());
    const vol = size.x * size.y * size.z;
    if (vol < bestVol) {
      bestVol = vol;
      best = m;
    }
  });
  return best;
}

/**
 * Apply a face-paint spec to the character. Builds the decal once per root,
 * repaints on later calls. `null` spec hides the decal (base skin untouched).
 * Returns false when paint is unavailable/invalid — never fake paint.
 */
export async function applyFacePaint(
  root: THREE.Object3D,
  spec: string | null,
  fighterId: string,
): Promise<boolean> {
  const existing = getDecal(root);
  if (!spec) {
    existing?.setVisible(false);
    return true;
  }
  const profile = getProfile(fighterId);
  if (!profile) return false;
  const layers = resolvePaintLayers(spec);
  if (!layers) return false;
  if (validateLayers(layers).length > 0) return false;

  let decal = existing;
  if (!decal) {
    const skinned = findFaceMesh(root);
    if (!skinned) return false;
    try {
      decal = FacePaintDecal.build(skinned, profile, 512);
    } catch {
      return false;
    }
    // SwiftShader compositing fix (see module docstring).
    decal.material.depthWrite = true;
    decal.material.needsUpdate = true;
    setDecal(root, decal);
  }
  const painter: FacePaintPainter = decal.painter;
  await painter.paint(layers, FACE_PATTERNS);
  decal.texture.needsUpdate = true;
  decal.setVisible(true);
  return true;
}

/** Remove the decal from the root (full teardown, e.g. on model swap). */
export function disposeFacePaint(root: THREE.Object3D): void {
  const decal = getDecal(root);
  if (decal) {
    decal.dispose();
    setDecal(root, undefined);
  }
}
