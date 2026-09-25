import * as THREE from 'three';
import {
  paintMultiply,
  regionForMesh,
  type GearAddon,
  type PartPaint,
} from './paintMath';

const GEAR = 'bf-gear';

function tintColor(hex: string | undefined): THREE.Color | null {
  if (!hex) return null;
  const { r, g, b } = paintMultiply(hex);
  return new THREE.Color(r, g, b);
}

function paintMaterial(mesh: THREE.Mesh, mat: THREE.Material): THREE.MeshStandardMaterial | null {
  const src = mat as THREE.MeshStandardMaterial;
  if (!src || !src.color) return null;
  if (src.userData?.bfPaintOwner === mesh.uuid && src.isMeshStandardMaterial) return src;
  if (!src.isMeshStandardMaterial && !(src as THREE.Material).clone) return null;
  const clone = src.clone() as THREE.MeshStandardMaterial;
  if (!clone.color) return null;
  clone.userData = { ...src.userData, bfPaintOwner: mesh.uuid };
  return clone;
}

type PaintUniforms = {
  cloth: { value: THREE.Color };
  metal: { value: THREE.Color };
  clothOn: { value: number };
  metalOn: { value: number };
};

function bindAtlasShader(
  mat: THREE.MeshStandardMaterial,
  cloth: THREE.Color | null,
  metal: THREE.Color | null,
): void {
  let uniforms = mat.userData.bfUniforms as PaintUniforms | undefined;
  if (!uniforms) {
    uniforms = {
      cloth: { value: new THREE.Color(1, 1, 1) },
      metal: { value: new THREE.Color(1, 1, 1) },
      clothOn: { value: 0 },
      metalOn: { value: 0 },
    };
    mat.userData.bfUniforms = uniforms;
    mat.onBeforeCompile = (shader) => {
      const live = mat.userData.bfUniforms as PaintUniforms;
      shader.uniforms.bfCloth = live.cloth;
      shader.uniforms.bfMetal = live.metal;
      shader.uniforms.bfClothOn = live.clothOn;
      shader.uniforms.bfMetalOn = live.metalOn;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
          float bfMx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
          float bfMn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
          float bfSat = bfMx - bfMn;
          float bfLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          if (bfClothOn > 0.5 && bfSat > 0.06 && bfLuma < 0.62) {
            diffuseColor.rgb *= bfCloth;
          }
          if (bfMetalOn > 0.5 && bfSat < 0.08 && bfLuma > 0.15 && bfLuma < 0.82) {
            diffuseColor.rgb = mix(diffuseColor.rgb, bfMetal * max(bfLuma, 0.35), 0.72);
          }
        `,
      );
    };
    mat.customProgramCacheKey = () => 'bf-cloth-metal-v1';
  }
  if (cloth) uniforms.cloth.value.copy(cloth);
  uniforms.clothOn.value = cloth ? 1 : 0;
  if (metal) uniforms.metal.value.copy(metal);
  uniforms.metalOn.value = metal ? 1 : 0;
  mat.needsUpdate = true;
}

function sceneIsSplit(root: THREE.Object3D): boolean {
  let named = 0;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && regionForMesh(mesh.name)) named += 1;
  });
  return named >= 4;
}

/** Clone materials on this instance only. Never writes the cached GLB. */
export function applyPartPaint(root: THREE.Object3D, paint: PartPaint | undefined): boolean {
  const split = sceneIsSplit(root);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || mesh.name.startsWith(GEAR) || !mesh.material) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = list.map((mat) => {
      const working = paintMaterial(mesh, mat);
      if (!working) return mat;
      if (split) {
        const slot = regionForMesh(mesh.name) ?? 'torso';
        const col = tintColor(paint?.[slot]);
        working.color.setRGB(1, 1, 1);
        if (col) {
          working.color.copy(col);
          if ('emissive' in working && working.emissive) {
            working.emissive.copy(col);
            working.emissiveIntensity = 0.12;
          }
        } else if ('emissive' in working && working.emissive) {
          working.emissive.setRGB(0, 0, 0);
          working.emissiveIntensity = 0;
        }
        working.needsUpdate = true;
        return working;
      }
      working.color.setRGB(1, 1, 1);
      const wantsAtlas = Boolean(paint?.cloth || paint?.metal);
      if (working.isMeshStandardMaterial && (wantsAtlas || working.userData.bfUniforms)) {
        bindAtlasShader(working, tintColor(paint?.cloth), tintColor(paint?.metal));
      }
      return working;
    });
    mesh.material = Array.isArray(mesh.material) ? next : next[0];
  });
  return split;
}

function findBone(root: THREE.Object3D, test: (bare: string) => boolean): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((child) => {
    if (found) return;
    const bone = child as THREE.Bone;
    if (!bone.isBone) return;
    const bare = bone.name.replace(/^mixamorig:?/i, '');
    if (test(bare)) found = bone;
  });
  return found;
}

function gearMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x141414,
    metalness: 0.74,
    roughness: 0.28,
  });
}

/**
 * Extra geometry parented to the head or hand bones.
 * Bannon GLBs have no separate mask or accessory mesh — Titan's unmasked
 * look is a different GLB, already on the attire row.
 */
export function applyGearAddon(root: THREE.Object3D, addon: GearAddon | undefined): void {
  const drop: THREE.Object3D[] = [];
  root.traverse((child) => {
    if (child.name.startsWith(GEAR)) drop.push(child);
  });
  for (const obj of drop) obj.parent?.remove(obj);

  if (!addon || addon === 'none') return;

  const head = findBone(root, (name) => /^head$/i.test(name));
  const handL = findBone(root, (name) => /^(lefthand|hal)$/i.test(name));
  const handR = findBone(root, (name) => /^(righthand|har)$/i.test(name));

  if ((addon === 'visor' || addon === 'mouthplate') && head) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(
        addon === 'visor' ? 0.15 : 0.1,
        addon === 'visor' ? 0.028 : 0.055,
        0.016,
      ),
      gearMaterial(),
    );
    mesh.name = `${GEAR}-face`;
    mesh.position.set(0, addon === 'visor' ? 0.045 : -0.025, 0.1);
    mesh.frustumCulled = false;
    head.add(mesh);
  }

  if (addon === 'wristtape') {
    for (const hand of [handL, handR]) {
      if (!hand) continue;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.018, 0.05), gearMaterial());
      mesh.name = `${GEAR}-wrist`;
      mesh.position.set(0, 0.02, 0);
      mesh.frustumCulled = false;
      hand.add(mesh);
    }
  }
}

export function applyFighterLook(
  root: THREE.Object3D,
  paint: PartPaint | undefined,
  addon: GearAddon | undefined,
): void {
  applyPartPaint(root, paint);
  applyGearAddon(root, addon);
}
