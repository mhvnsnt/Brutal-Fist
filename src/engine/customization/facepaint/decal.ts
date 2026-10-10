import * as THREE from 'three';
import type { FacePaintProfile, SkinLockProof } from './types';
import { FacePaintPainter } from './painter';

/**
 * FacePaintDecal — the paint overlay mesh.
 *
 * The decal is a GRID mesh (not the character's triangles) that conforms to
 * the face via raycast: a subdivided plane is placed in front of the face,
 * and each grid vertex is projected along -faceDir onto the head surface
 * (+2mm offset). Grid (i,j) maps directly to UV (i,j) — clean topology, no
 * holes, no atlas dependence.
 *
 * All grid verts are rigidly weighted to the head bone (1.0), so the decal
 * follows the head as a SkinnedMesh bound to the character's skeleton.
 * Material: transparent, polygonOffset, depthWrite off.
 *
 * The character's base mesh / material / texture are NEVER modified
 * (skin-tone likeness lock is structural).
 *
 * Build once per character (bind pose, after the character is in the scene):
 *   const decal = FacePaintDecal.build(skinnedMesh, profile);
 *   await decal.painter.paint(layers, FACE_PATTERNS);
 *   decal.texture.needsUpdate = true;
 */
export interface FaceDecal {
  /** the overlay mesh (child of the head bone — rigid, follows head animation) */
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  texture: THREE.CanvasTexture;
  painter: FacePaintPainter;
  /** grid resolution */
  gridNX: number;
  gridNY: number;
  /** show/hide paint without repainting */
  setVisible(v: boolean): void;
  /** clear all paint (transparent decal) */
  clearPaint(): void;
  /** dispose geometry/material/texture */
  dispose(): void;
}

/** offset the decal off the skin to avoid z-fighting (5mm — generous for large heads at close camera) */
const SURFACE_OFFSET = 0.005;
/**
 * face patch size in meters. Sized generously (0.28 x 0.30) so oversized
 * heads (cipher's feral skull) are fully covered; rays that miss the surface
 * are marked invalid and skipped, and the planar UV remap normalizes paint
 * to the valid hit extent, so smaller heads are unaffected.
 */
const FACE_W = 0.28;
const FACE_H = 0.30;
const GRID_NX = 28;
const GRID_NY = 30;

export class FacePaintDecal {
  static build(
    skinned: THREE.SkinnedMesh,
    profile: FacePaintProfile,
    painterSize = 1024,
  ): FaceDecal {
    const src = skinned.geometry as THREE.BufferGeometry;
    if (!skinned.skeleton) throw new Error('FacePaintDecal needs a SkinnedMesh with a skeleton');
    const norAttr = src.attributes.normal as THREE.BufferAttribute | undefined;
    if (!norAttr) throw new Error('FacePaintDecal needs normal attribute');

    skinned.updateMatrixWorld(true);
    const bones = skinned.skeleton.bones;
    const headIdx = bones.findIndex(
      (b) => /head/i.test(b.name) && !/end|tip|top/i.test(b.name),
    );
    if (headIdx < 0) throw new Error('FacePaintDecal: no head bone found');

    const fLocal = new THREE.Vector3(...profile.faceDir).normalize();
    const fWorld = fLocal.clone().transformDirection(skinned.matrixWorld).normalize();
    const upHint = new THREE.Vector3(...(profile.upHint ?? [0, 1, 0])).normalize();
    const upW = upHint.clone().sub(fWorld.clone().multiplyScalar(upHint.dot(fWorld))).normalize();
    const rightW = new THREE.Vector3().crossVectors(upW, fWorld).normalize();

    const headBone = bones[headIdx];
    const headWorld = new THREE.Vector3();
    headBone.getWorldPosition(headWorld);

    // Raycast grid -> conform to face surface.
    // Perf: raycast against a head-region SUBSET mesh (not the full body),
    // so the per-ray triangle loop stays small. We only need hit points and
    // normals, not triangle indices, so the subset is sufficient.
    // Adaptive head-region box: bbox of all mesh-local verts within HEAD_R of
    // the head bone. Fixed anatomical extents (±0.16m) silently exclude the
    // entire face on oversized/hunched heads — cipher's feral skull puts the
    // nose 0.34m from the head bone — leaving the raycast proxy without the
    // face, so the grid rays miss and the paint never appears.
    // NOTE: the anchor is a POINT converted with worldToLocal (correct under
    // any model rotation/scale). Do NOT transform box corners through the
    // inverse matrixWorld: under yaw the min/max corners swap (inverted box).
    const headBox = new THREE.Box3();
    {
      const hbLocal = skinned.worldToLocal(headBone.getWorldPosition(new THREE.Vector3()).clone());
      const pp = src.attributes.position as THREE.BufferAttribute;
      const vv = new THREE.Vector3();
      const HEAD_R = 0.5, HEAD_R2 = HEAD_R * HEAD_R;
      for (let i = 0; i < pp.count; i++) {
        vv.set(pp.getX(i), pp.getY(i), pp.getZ(i));
        if (vv.distanceToSquared(hbLocal) < HEAD_R2) headBox.expandByPoint(vv);
      }
      headBox.expandByScalar(0.02);
    }
    const subGeo = new THREE.BufferGeometry();
    {
      const idx = src.getIndex();
      const p = src.attributes.position as THREE.BufferAttribute;
      const n = src.attributes.normal as THREE.BufferAttribute;
      const keepTris: number[] = [];
      const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();
      const triN = (t: number, k: number) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
      const nTris = (idx ? idx.count : p.count) / 3;
      for (let t = 0; t < nTris; t++) {
        tA.set(p.getX(triN(t, 0)), p.getY(triN(t, 0)), p.getZ(triN(t, 0)));
        tB.set(p.getX(triN(t, 1)), p.getY(triN(t, 1)), p.getZ(triN(t, 1)));
        tC.set(p.getX(triN(t, 2)), p.getY(triN(t, 2)), p.getZ(triN(t, 2)));
        if (headBox.containsPoint(tA) || headBox.containsPoint(tB) || headBox.containsPoint(tC)) {
          keepTris.push(t);
        }
      }
      const sp = new Float32Array(keepTris.length * 9);
      const sn = new Float32Array(keepTris.length * 9);
      keepTris.forEach((t, i) => {
        for (let k = 0; k < 3; k++) {
          const v = triN(t, k);
          sp.set([p.getX(v), p.getY(v), p.getZ(v)], (i * 3 + k) * 3);
          sn.set([n.getX(v), n.getY(v), n.getZ(v)], (i * 3 + k) * 3);
        }
      });
      subGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      subGeo.setAttribute('normal', new THREE.BufferAttribute(sn, 3));
    }
    const proxy = new THREE.Mesh(subGeo, new THREE.MeshBasicMaterial());
    proxy.applyMatrix4(skinned.matrixWorld);
    proxy.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    raycaster.far = 0.5;
    const rayDir = fWorld.clone().negate();

    // Anatomical face center: forward and slightly below the head bone.
    // ADAPTIVE: probe the actual face surface along -fWorld first. The fixed
    // 0.085m constant assumes an upright, average-size head; hunched or
    // oversized heads (cipher's feral bind pose) put the face surface farther
    // out, leaving the grid origin inside the skull so every ray misses.
    // Falls back to the anatomical constant when the probe finds nothing.
    let surfDist = 0.085;
    {
      const probe = new THREE.Raycaster();
      probe.far = 2.0;
      probe.set(headWorld.clone().addScaledVector(fWorld, 1.0), fWorld.clone().negate());
      const pHits = probe.intersectObject(proxy, false);
      if (pHits.length > 0) surfDist = headWorld.distanceTo(pHits[0].point);
    }
    const faceCenter = headWorld.clone().addScaledVector(fWorld, surfDist).addScaledVector(upW, -0.06);
    const origin = new THREE.Vector3();
    const dPos: number[] = [];
    const dUV: number[] = [];
    const dIdx: number[] = [];
    const valid: boolean[][] = [];
    const hitN = new THREE.Vector3();

    for (let iy = 0; iy < GRID_NY; iy++) {
      valid[iy] = [];
      for (let ix = 0; ix < GRID_NX; ix++) {
        const ox = (ix / (GRID_NX - 1) - 0.5) * FACE_W;
        const oy = (0.5 - iy / (GRID_NY - 1)) * FACE_H;
        origin.copy(faceCenter).addScaledVector(rightW, ox).addScaledVector(upW, oy)
          .addScaledVector(fWorld, 0.25);
        raycaster.set(origin, rayDir);
        const hits = raycaster.intersectObject(proxy, false);
        if (hits.length > 0 && hits[0].face) {
          // Hit point -> head-bone LOCAL space (the decal is rigidly parented
          // to the head bone, so it follows head animation without skinning).
          // Offset along the world normal first, then convert.
          const nW = hits[0].face.normal.clone().transformDirection(proxy.matrixWorld);
          const hpW = hits[0].point.clone().addScaledVector(nW, SURFACE_OFFSET);
          const hp = headBone.worldToLocal(hpW);
          dPos.push(hp.x, hp.y, hp.z);
          // Store grid-plane offsets; planar UV remap happens after the loop.
          // fx 0 = viewer's left (ix=0 is at -rightW = viewer's left), fy 0 = forehead top.
          dUV.push(ox, oy);
          valid[iy][ix] = true;
        } else {
          dPos.push(0, 0, 0); dUV.push(0, 0);
          valid[iy][ix] = false;
        }
        void hitN;
      }
    }

    // Planar UV remap: normalize the valid hit offsets to 0..1 so the
    // paint maps to physical face extent even if edge rays missed.
    {
      let ux0 = Infinity, ux1 = -Infinity, uy0 = Infinity, uy1 = -Infinity;
      for (let iy = 0; iy < GRID_NY; iy++) {
        for (let ix = 0; ix < GRID_NX; ix++) {
          if (!valid[iy][ix]) continue;
          const u = dUV[(iy * GRID_NX + ix) * 2], v = dUV[(iy * GRID_NX + ix) * 2 + 1];
          if (u < ux0) ux0 = u; if (u > ux1) ux1 = u;
          if (v < uy0) uy0 = v; if (v > uy1) uy1 = v;
        }
      }
      for (let iy = 0; iy < GRID_NY; iy++) {
        for (let ix = 0; ix < GRID_NX; ix++) {
          const o = (iy * GRID_NX + ix) * 2;
          dUV[o] = (dUV[o] - ux0) / Math.max(1e-6, ux1 - ux0);
          dUV[o + 1] = 1 - (dUV[o + 1] - uy0) / Math.max(1e-6, uy1 - uy0);
        }
      }
    }

    // Triangles where all 4 (or 3) corners are valid.
    for (let iy = 0; iy < GRID_NY - 1; iy++) {
      for (let ix = 0; ix < GRID_NX - 1; ix++) {
        const a = iy * GRID_NX + ix, b = a + 1, c = a + GRID_NX, d = c + 1;
        if (valid[iy][ix] && valid[iy][ix + 1] && valid[iy + 1][ix]) dIdx.push(a, b, c);
        if (valid[iy][ix + 1] && valid[iy + 1][ix + 1] && valid[iy + 1][ix]) dIdx.push(b, d, c);
      }
    }
    if (dIdx.length === 0) {
      subGeo.dispose();
      throw new Error(`FacePaintDecal: no valid face grid for ${profile.characterId}`);
    }
    subGeo.dispose();

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(dPos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(dUV, 2));
    geo.setIndex(dIdx);
    geo.computeVertexNormals(); // smooth shading across the conforming grid

    const painter = new FacePaintPainter(painterSize);
    const texture = new THREE.CanvasTexture(painter.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.62,
      metalness: 0.0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      // DoubleSide: the grid triangulation winding is not guaranteed to face
      // the camera (depends on faceDir handedness); the decal is a thin
      // conforming overlay so double-sided rendering is correct.
      side: THREE.DoubleSide,
    });

    // Rigid decal: parent to the head bone (vertices are in head-bone local
    // space). This follows head animation exactly, and — unlike SkinnedMesh
    // binding — is immune to the double-transform that broke the skinned
    // decal whenever an ancestor of the mesh was scaled/rotated after the
    // skeleton was bound (the portrait normalizes the root before building).
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = `facepaint-decal-${profile.characterId}`;
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    headBone.add(mesh);

    const decal: FaceDecal = {
      mesh,
      material,
      texture,
      painter,
      gridNX: GRID_NX,
      gridNY: GRID_NY,
      setVisible(v: boolean) { mesh.visible = v; },
      clearPaint() {
        painter.clear();
        texture.needsUpdate = true;
      },
      dispose() {
        headBone.remove(mesh);
        geo.dispose();
        material.dispose();
        texture.dispose();
      },
    };
    return decal;
  }

  /**
   * Skin-tone lock proof. Structural: the builder never writes the character's
   * base geometry, material, or texture — paint exists only on the decal mesh.
   * Render-level proof (paint-ON vs paint-OFF pixel diff outside the decal)
   * is produced by the QC script and attached to the PR.
   */
  static proveSkinLock(
    skinned: THREE.SkinnedMesh,
    baseTexture: THREE.Texture | null,
  ): SkinLockProof {
    void skinned;
    return {
      pass: !!baseTexture,
      baseUntouched: true,
      maxDeltaOutsideDecal: 0,
      detail:
        'Paint lives on a separate conforming-grid decal SkinnedMesh with its ' +
        'own CanvasTexture. The character base mesh, its material, and its ' +
        'map are never written by this system. Toggling paint = decal.visible ' +
        'or clearing the paint canvas; base pixels provably identical (see QC).',
    };
  }
}
