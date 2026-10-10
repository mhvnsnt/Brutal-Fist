/**
 * customization/accessories.ts — PS1-budget procedural accessories.
 *
 * Port of the AshLanev2 suite's accessories lane, rebuilt for Brutal-Fist's
 * INTENTIONAL PS1 look: every accessory is a low-poly procedural builder
 * (a handful of boxes/cones/spheres, flat-shaded) parented to the
 * character's bones — the same technique as the select screen's existing
 * gear add-ons (applyPartPaint.ts). No hi-res GLB imports, nothing to
 * decimate; the poly/texture budget is PS1 by construction and the render
 * profile's vertex-snap + 256px textures do the rest.
 *
 * Manifest: PSX_ACCESSORIES (built-in constant — the suite's normalized
 * manifest shape, see types.ts AccessoryDef). attach.bone is the preferred
 * bone; the loader falls back to case-insensitive bare-name match
 * (strips the `mixamorig:` prefix, handles Maime's packed `mixamorigX` form).
 *
 * Chain pendant orientation fix (suite item 1): each chain def carries
 * `pendantRotation` (degrees XYZ) — the tuning knob that rotates the pendant
 * sub-mesh before it hangs, so the pendant faces forward-down instead of
 * swinging sideways on rigs whose neck-bone local axes don't map to world
 * axes. Defaults below are tuned for the cast's Mixamo necks.
 */
import * as THREE from 'three';
import type { AccessoryDef, AccessorySlotId } from './types';
import { estimateRigForwardXZ } from '../pipeline/CharacterPipeline';

const ACC_PREFIX = 'bf-acc';

/** PS1-faceted standard material. */
function accMat(color: number, opts: { metal?: number; rough?: number } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: opts.metal ?? 0.05,
    roughness: opts.rough ?? 0.75,
    flatShading: true,
  });
}

function box(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), accMat(color));
  m.position.set(x, y, z);
  m.frustumCulled = false;
  return m;
}

function cone(r: number, h: number, color: number, x = 0, y = 0, z = 0, seg = 7): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), accMat(color));
  m.position.set(x, y, z);
  m.frustumCulled = false;
  return m;
}

function ball(r: number, color: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), accMat(color));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.frustumCulled = false;
  return m;
}

function ring(r: number, tube: number, color: number, metal = 0.05): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 6, 14), accMat(color, { metal }));
  m.frustumCulled = false;
  return m;
}

/** Builder signature: side is -1 (left), 1 (right), 0 (center). ctx carries
 *  measured anatomy (faceDist = head-joint → face-surface along face dir). */
export interface BuilderCtx {
  faceDist: number;
}
type Builder = (side: -1 | 0 | 1, ctx: BuilderCtx) => THREE.Group;

function groupOf(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

const HAIR = 0x1a1512;
const SKIN_DARK = 0x2a2320;

const BUILDERS: Record<string, Builder> = {
  // ── HAIR ──────────────────────────────────────────────────────────────
  hair_flattop: () => groupOf(
    box(0.17, 0.055, 0.19, HAIR, 0, 0.105, -0.01),
    box(0.15, 0.03, 0.17, HAIR, 0, 0.075, -0.01),
  ),
  hair_mohawk: () => {
    const g = groupOf();
    for (let i = 0; i < 4; i++) {
      const h = 0.09 - i * 0.012;
      g.add(box(0.025, h, 0.05, 0x8a1f1f, 0, 0.1 + h / 2, 0.06 - i * 0.045));
    }
    return g;
  },
  hair_dreads: () => {
    const g = groupOf(box(0.16, 0.05, 0.18, HAIR, 0, 0.095, -0.01));
    for (let i = 0; i < 5; i++) {
      const d = cone(0.018, 0.17, HAIR, -0.06 + i * 0.03, -0.03, -0.11, 6);
      d.rotation.x = 0.18;
      g.add(d);
    }
    return g;
  },
  hair_buzz: () => groupOf(
    (() => {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.098, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), accMat(0x241d18));
      cap.position.set(0, 0.015, -0.008);
      cap.frustumCulled = false;
      return cap;
    })(),
  ),
  hair_long: () => groupOf(
    box(0.16, 0.06, 0.18, HAIR, 0, 0.1, -0.01),
    box(0.15, 0.24, 0.055, HAIR, 0, -0.05, -0.105),
  ),
  // ── MASK ──────────────────────────────────────────────────────────────
  // Bands/plates ride just off the measured face surface (ctx.faceDist).
  mask_eyeband: (side, ctx) => groupOf(
    box(0.175, 0.038, 0.022, 0xff0000, 0, 0.02, ctx.faceDist),
    box(0.03, 0.02, 0.1, 0x101010, -0.095, 0.02, ctx.faceDist * 0.55),
    box(0.03, 0.02, 0.1, 0x101010, 0.095, 0.02, ctx.faceDist * 0.55),
  ),
  mask_plate: (side, ctx) => groupOf(
    // brow plate + cheek plate, leaving an eye slit open
    box(0.16, 0.05, 0.025, 0x3a3f4a, 0, 0.055, ctx.faceDist),
    box(0.15, 0.07, 0.025, 0x3a3f4a, 0, -0.045, ctx.faceDist),
    box(0.02, 0.02, 0.03, 0x8a8f9a, 0, 0.055, ctx.faceDist + 0.006),
  ),
  // ── HOOD ──────────────────────────────────────────────────────────────
  hood_up: () => {
    const c = cone(0.135, 0.26, 0x23232c, 0, 0.07, -0.02, 8);
    (c.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    const g = groupOf(c, box(0.2, 0.1, 0.12, 0x23232c, 0, -0.1, -0.03));
    return g;
  },
  // ── CHAIN (pendant orientation fix lives in the def) ──────────────────
  chain_gold: () => {
    const t = ring(0.078, 0.009, 0xc9a227, 0.85);
    t.rotation.x = Math.PI / 2 - 0.25;
    t.position.set(0, -0.02, 0.01);
    const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.022), accMat(0xc9a227, { metal: 0.9, rough: 0.25 }));
    p.name = 'bf-pendant';
    p.position.set(0, -0.115, 0.062);
    p.frustumCulled = false;
    return groupOf(t, p);
  },
  chain_dogtags: () => {
    const t = ring(0.07, 0.006, 0x9aa0a8, 0.8);
    t.rotation.x = Math.PI / 2 - 0.25;
    t.position.set(0, -0.02, 0.01);
    const p = box(0.032, 0.05, 0.006, 0x9aa0a8, 0, -0.1, 0.06);
    p.name = 'bf-pendant';
    return groupOf(t, p);
  },
  // ── GLOVES (L/R pairs) ────────────────────────────────────────────────
  gloves_boxing: (side) => groupOf(
    ball(0.058, 0x8a1f1f, side * 0.008, -0.015, 0.045, 1, 0.95, 1.25),
    box(0.07, 0.05, 0.05, 0xd8d2c4, side * 0.008, 0.045, 0.01),
  ),
  gloves_mma: (side) => groupOf(
    ball(0.046, 0x1c1c22, side * 0.006, -0.01, 0.035, 1, 0.85, 1.15),
  ),
  // ── WRISTBANDS (L/R pairs) ────────────────────────────────────────────
  wrist_tape: () => {
    const t = ring(0.037, 0.013, 0xd8d2c4);
    t.rotation.x = Math.PI / 2;
    t.position.set(0, 0.055, 0);
    return groupOf(t);
  },
  wrist_spiked: () => {
    const g = groupOf();
    const t = ring(0.038, 0.011, 0x2a2a30, 0.6);
    t.rotation.x = Math.PI / 2;
    t.position.set(0, 0.055, 0);
    g.add(t);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const s = cone(0.008, 0.025, 0x9aa0a8, Math.cos(a) * 0.048, 0.055, Math.sin(a) * 0.048, 5);
      s.rotation.z = -Math.cos(a) * Math.PI / 2;
      s.rotation.x = Math.sin(a) * Math.PI / 2;
      g.add(s);
    }
    return g;
  },
  // ── SHOES (L/R pairs) ─────────────────────────────────────────────────
  boots_combat: (side) => groupOf(
    box(0.095, 0.085, 0.23, 0x24211c, side * 0.004, -0.055, 0.045),
    box(0.08, 0.12, 0.09, 0x24211c, side * 0.004, 0.02, -0.03),
  ),
  boots_wrestling: (side) => groupOf(
    box(0.09, 0.06, 0.21, 0x7a1f1f, side * 0.004, -0.068, 0.04),
    box(0.075, 0.07, 0.085, 0x7a1f1f, side * 0.004, -0.01, -0.03),
  ),
};

/**
 * The accessory manifest. PS1-budget procedural builders only.
 * No canon flags: none of these reproduce a canon likeness (e.g. Hollow's
 * Super Dragon mask per the 2026-10-06 owner correction is NOT this), so
 * none are badged canon — honest by default.
 */
export const PSX_ACCESSORIES: AccessoryDef[] = [
  // hair
  { id: 'hair_flattop', label: 'Flat-top', slot: 'hair', builder: 'hair_flattop',
    attach: { bone: 'head', position: [0, 0, 0], rotation: [0, 0, 0] } },
  { id: 'hair_mohawk', label: 'Mohawk', slot: 'hair', builder: 'hair_mohawk',
    attach: { bone: 'head', position: [0, 0, 0], rotation: [0, 0, 0] } },
  { id: 'hair_dreads', label: 'Dreads', slot: 'hair', builder: 'hair_dreads',
    attach: { bone: 'head', position: [0, 0, 0], rotation: [0, 0, 0] } },
  { id: 'hair_buzz', label: 'Buzz cut', slot: 'hair', builder: 'hair_buzz',
    attach: { bone: 'head', position: [0, 0, 0], rotation: [0, 0, 0] } },
  { id: 'hair_long', label: 'Long hair', slot: 'hair', builder: 'hair_long',
    attach: { bone: 'head', position: [0, 0, 0], rotation: [0, 0, 0] } },
  // mask
  { id: 'mask_eyeband', label: 'Eye band', slot: 'mask', builder: 'mask_eyeband',
    attach: { bone: 'head', position: [0, 0, 0], rotation: [0, 0, 0] } },
  { id: 'mask_plate', label: 'Face plate', slot: 'mask', builder: 'mask_plate',
    attach: { bone: 'head', position: [0, 0, 0], rotation: [0, 0, 0] } },
  // hood
  { id: 'hood_up', label: 'Hood up', slot: 'hood', builder: 'hood_up',
    attach: { bone: 'head', position: [0, 0, 0], rotation: [0, 0, 0] } },
  // chain — pendantRotation is the orientation-fix knob (suite item 1)
  { id: 'chain_gold', label: 'Gold chain', slot: 'chain', builder: 'chain_gold',
    attach: { bone: 'neck', position: [0, 0, 0], rotation: [0, 0, 0] },
    pendantRotation: [-18, 0, 0] },
  { id: 'chain_dogtags', label: 'Dog tags', slot: 'chain', builder: 'chain_dogtags',
    attach: { bone: 'neck', position: [0, 0, 0], rotation: [0, 0, 0] },
    pendantRotation: [-12, 0, 0] },
  // gloves — L/R pair
  { id: 'gloves_boxing', label: 'Boxing gloves', slot: 'gloves', builder: 'gloves_boxing',
    pairBuilders: ['gloves_boxing'],
    attach: { bone: 'hand', position: [0, 0, 0], rotation: [0, 0, 0] } },
  { id: 'gloves_mma', label: 'MMA gloves', slot: 'gloves', builder: 'gloves_mma',
    pairBuilders: ['gloves_mma'],
    attach: { bone: 'hand', position: [0, 0, 0], rotation: [0, 0, 0] } },
  // wristbands — L/R pair
  { id: 'wrist_tape', label: 'Wrist tape', slot: 'wristbands', builder: 'wrist_tape',
    pairBuilders: ['wrist_tape'],
    attach: { bone: 'forearm', position: [0, 0, 0], rotation: [0, 0, 0] } },
  { id: 'wrist_spiked', label: 'Spiked bands', slot: 'wristbands', builder: 'wrist_spiked',
    pairBuilders: ['wrist_spiked'],
    attach: { bone: 'forearm', position: [0, 0, 0], rotation: [0, 0, 0] } },
  // shoes — L/R pair
  { id: 'boots_combat', label: 'Combat boots', slot: 'shoes', builder: 'boots_combat',
    pairBuilders: ['boots_combat'],
    attach: { bone: 'foot', position: [0, 0, 0], rotation: [0, 0, 0] } },
  { id: 'boots_wrestling', label: 'Wrestling boots', slot: 'shoes', builder: 'boots_wrestling',
    pairBuilders: ['boots_wrestling'],
    attach: { bone: 'foot', position: [0, 0, 0], rotation: [0, 0, 0] } },
];

export function getAccessory(id: string): AccessoryDef | undefined {
  return PSX_ACCESSORIES.find((a) => a.id === id);
}

export function listAccessories(slot?: AccessorySlotId): AccessoryDef[] {
  return slot ? PSX_ACCESSORIES.filter((a) => a.slot === slot) : [...PSX_ACCESSORIES];
}

// ── bone lookup ─────────────────────────────────────────────────────────────
function bareName(name: string): string {
  return name.replace(/^mixamorig:?/i, '').toLowerCase();
}

function findBone(root: THREE.Object3D, test: (bare: string) => boolean): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((child) => {
    if (found) return;
    const bone = child as THREE.Bone;
    if (!bone.isBone) return;
    if (test(bareName(bone.name))) found = bone;
  });
  return found;
}

/** Resolve the attach bone for a def: exact name, then bare-name match. */
function resolveBone(root: THREE.Object3D, want: string): THREE.Bone | null {
  const exact = findBone(root, (bare) => bare === want.toLowerCase());
  if (exact) return exact;
  // Slot heuristics for pair bones (hand/forearm/foot): caller handles sides.
  return findBone(root, (bare) => bare.includes(want.toLowerCase()));
}

function findSideBone(root: THREE.Object3D, want: string, side: -1 | 1): THREE.Bone | null {
  const leftFirst = side < 0;
  const cands: THREE.Bone[] = [];
  root.traverse((child) => {
    const bone = child as THREE.Bone;
    if (!bone.isBone) return;
    if (bareName(bone.name).includes(want.toLowerCase())) cands.push(bone);
  });
  if (cands.length === 0) return null;
  const isLeft = (b: THREE.Bone) => /left|l\b/i.test(b.name) && !/right/i.test(b.name);
  const isRight = (b: THREE.Bone) => /right|r\b/i.test(b.name) && !/left/i.test(b.name);
  const pick = cands.find((b) => (leftFirst ? isLeft(b) : isRight(b)));
  return pick ?? cands[0];
}

const D2R = Math.PI / 180;

/**
 * Slots whose accessories have a "front" (mask over the face, chain pendant
 * forward, hood opening). Builders author these in a canonical frame where
 * +Z is face-forward; this aligns the group's +Z to the bone-local face
 * direction so they sit correctly on every rig.
 *
 * Face direction comes from the repo's proven shoulder-line estimator
 * (estimateRigForwardXZ — the same function the portrait and arena use to
 * rest-align models). It is measured in world space, then converted into the
 * attach bone's local frame, so the alignment holds however the model is
 * yawed in the scene (portrait bust vs arena P1/P2).
 */
const FACING_SLOTS: AccessorySlotId[] = ['hair', 'mask', 'hood', 'chain'];

function facingAlignment(root: THREE.Object3D, bone: THREE.Bone): THREE.Quaternion | null {
  const fwd = estimateRigForwardXZ(root);
  if (!fwd) return null;
  root.updateMatrixWorld(true);
  // NOTE: estimateRigForwardXZ's cross product (up × across) yields the
  // NEGATION of the true face direction (verified against the facepaint
  // profiles: profile [1,0,0] -> world +Z, estimator -> world -Z). The
  // portrait/arena depend on the estimator as-is (their -Z target cancels
  // the flip), so we negate LOCALLY here to get the true face direction.
  const faceWorld = new THREE.Vector3(-fwd.x, 0, -fwd.z).normalize();
  const boneQ = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
  const zAxis = faceWorld.clone().applyQuaternion(boneQ).normalize();
  if (!isFinite(zAxis.x + zAxis.y + zAxis.z)) return null;
  // Level basis (not shortest-arc): keeps the accessory's local X horizontal
  // so bands lie flat across the face and mohawk fins stay vertical.
  // "Up" is WORLD up expressed in bone space (bone-local +Y is not
  // reliably up on Mixamo head bones).
  const upBone = new THREE.Vector3(0, 1, 0).applyQuaternion(boneQ).normalize();
  const xAxis = new THREE.Vector3().crossVectors(upBone, zAxis);
  if (xAxis.lengthSq() < 1e-6) xAxis.set(1, 0, 0);
  else xAxis.normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

function buildAndPose(
  def: AccessoryDef,
  builderId: string,
  side: -1 | 0 | 1,
  ctx: BuilderCtx,
): THREE.Group {
  const builder = BUILDERS[builderId];
  if (!builder) throw new Error(`Unknown accessory builder: ${builderId}`);
  const g = builder(side, ctx);
  const [px, py, pz] = def.attach.position;
  const [rx, ry, rz] = def.attach.rotation;
  g.position.set(side === 0 ? px : px * side, py, pz);
  g.rotation.set(rx * D2R, ry * D2R, rz * D2R);
  const s = def.attach.scale ?? 1;
  g.scale.setScalar(s);
  // Pendant orientation fix: rotate the pendant sub-mesh before it hangs.
  if (def.pendantRotation) {
    const [prx, pry, prz] = def.pendantRotation;
    g.traverse((o) => {
      if (o.name === 'bf-pendant') o.rotation.set(prx * D2R, pry * D2R, prz * D2R);
    });
  }
  return g;
}

/**
 * Builders that need the face-surface distance get a fixed, verified offset.
 * (A SkinnedMesh raycast was tried: the CPU-side bind-pose geometry does not
 *  live in the normalized bone space, so the ray systematically misses and
 *  the 0.1 fallback always won. The fixed offset is verified on the cast.)
 */
const FIXED_FACE_DIST = 0.1;

/** Pose + face-align a built group, then hang it on the bone. */
function hangAccessory(
  root: THREE.Object3D,
  bone: THREE.Bone,
  def: AccessoryDef,
  builderId: string,
  side: -1 | 0 | 1,
  tag: string,
): void {
  const facing = FACING_SLOTS.includes(def.slot);
  const ctx: BuilderCtx = { faceDist: FIXED_FACE_DIST };
  const g = buildAndPose(def, builderId, side, ctx);
  if (facing) {
    const align = facingAlignment(root, bone);
    if (align) {
      // Face-align first, then the def's authored euler rotation.
      const euler = new THREE.Quaternion().setFromEuler(g.rotation.clone());
      g.quaternion.copy(align).multiply(euler);
    }
  }
  g.name = tag;
  bone.add(g);
}

/**
 * Attach one accessory def to the model. Pair defs (gloves/wristbands/shoes)
 * attach to both side bones. Idempotent per slot: call clearAccessories first.
 */
export function attachAccessory(root: THREE.Object3D, def: AccessoryDef): boolean {
  const isPair = !!def.pairBuilders && def.pairBuilders.length > 0;
  let attached = 0;

  if (isPair) {
    for (const side of [-1, 1] as const) {
      const bone = findSideBone(root, def.attach.bone, side);
      if (!bone) continue;
      for (const bId of def.pairBuilders!) {
        hangAccessory(root, bone, def, bId, side, `${ACC_PREFIX}-${def.slot}-${side < 0 ? 'l' : 'r'}`);
        attached++;
      }
    }
  } else {
    const bone = resolveBone(root, def.attach.bone);
    if (!bone) return false;
    hangAccessory(root, bone, def, def.builder, 0, `${ACC_PREFIX}-${def.slot}`);
    attached++;
  }
  return attached > 0;
}

/** Remove accessory groups from the model (all slots, or one slot). */
export function clearAccessories(root: THREE.Object3D, slot?: AccessorySlotId): void {
  const drop: THREE.Object3D[] = [];
  root.traverse((child) => {
    if (!child.name.startsWith(ACC_PREFIX)) return;
    if (slot && child.name !== `${ACC_PREFIX}-${slot}` && !child.name.startsWith(`${ACC_PREFIX}-${slot}-`)) return;
    drop.push(child);
  });
  for (const obj of drop) {
    obj.parent?.remove(obj);
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => m.dispose());
      }
    });
  }
}

/**
 * Apply a full accessory selection: clears all slots, then attaches each
 * selected def. `selection` maps slot -> accessory id (or null).
 */
export function applyAccessories(
  root: THREE.Object3D,
  selection: Record<AccessorySlotId, string | null>,
): void {
  clearAccessories(root);
  for (const def of PSX_ACCESSORIES) {
    if (selection[def.slot] === def.id) attachAccessory(root, def);
  }
}
