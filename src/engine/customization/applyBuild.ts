/**
 * customization/applyBuild.ts — the single entry point that applies a
 * player's full CustomBuild to a live character root.
 *
 * Order matters:
 *  1. applyFighterLook (existing paint + gear addons — the select screen's
 *     pre-existing look; additive, untouched behavior)
 *  2. eye colors (cloned iris materials only; no-op when unsupported)
 *  3. morphs (bone scaling + dynamic reground to the pre-morph floor plane)
 *  4. accessories (procedural PS1 builders, bone-parented)
 *  5. face paint (decal built once per root, repainted after; base skin
 *     never written)
 *
 * Call after the character is normalized/scaled in the scene, BEFORE the
 * idle clip starts when possible (bind-pose preferred for the decal).
 * Safe to call repeatedly — every step is idempotent (morphs reset to base,
 * accessories clear before re-attach, paint repaints the same decal).
 */
import * as THREE from 'three';
import { applyFighterLook } from '../render/applyPartPaint';
import { applyEyeColor } from './eyeColors';
import { applyMorphs } from './morphs';
import { applyAccessories } from './accessories';
import { applyFacePaint } from './facepaintAdapter';
import type { CustomBuild } from './types';

/** Floor plane the model's feet rest at before morphs (portrait/arena normalize first). */
function measureFloorY(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  return isFinite(box.min.y) ? box.min.y : 0;
}

export async function applyCustomBuild(root: THREE.Object3D, build: CustomBuild): Promise<void> {
  // 1. Existing look (paint slots + gear addons).
  applyFighterLook(root, build.paint, build.addon);
  // 2. Iris colors (no-op when the model bakes its eyes).
  applyEyeColor(root, build.eyeColor);
  // 3. Morphs, re-grounded to the pre-morph floor plane.
  const floorY = measureFloorY(root);
  applyMorphs(root, build.morphs, floorY);
  // 4. Accessories.
  applyAccessories(root, build.accessories);
  // 5. Face paint (async: pattern PNG loads).
  await applyFacePaint(root, build.facePaint, build.fighterId);
}
