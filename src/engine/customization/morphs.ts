/**
 * customization/morphs.ts — procedural body/face morphs via bone scaling.
 *
 * Port of the AshLanev2 suite's morphs.ts. The cast GLBs ship zero morph
 * targets, so morphs are procedural: each dial scales a named set of bones.
 * Bone names vary per rig, so dials map to case-insensitive name PATTERNS.
 *
 * Brutal-Fist adaptation (survey 2026-10-09): the cast is Mixamo-rigged
 * (`mixamorig:LeftArm` / packed `mixamorigLeftArm` on Maime). Mixamo names
 * the upper arm `LeftArm`/`RightArm` (no "upper"), so an explicit
 * leftarm|rightarm pattern is added. Patterns match both `mixamorig:X` and
 * packed `mixamorigX` forms.
 *
 * Base scales are snapshotted once per model root (userData) and every apply
 * resets to base first — dials are idempotent and never stack.
 */
import * as THREE from 'three';
import type { MorphKey, MorphValues } from './types';

const BASE_KEY = '__bfCustomizerMorphBase';

/** One dial -> the bones it drives and how 0..1 maps to scale. */
interface MorphDef {
  key: MorphKey;
  label: string;
  hint: string;
  /** Bone-name patterns (first match per pattern wins). */
  bones: { pattern: RegExp; axes: ('x' | 'y' | 'z')[] }[];
  /** Scale at value 0 and value 1 (linear). */
  at0: number;
  at1: number;
}

export const MORPH_DEFS: MorphDef[] = [
  {
    key: 'muscle',
    label: 'Muscle',
    hint: 'Arm, chest and thigh girth.',
    bones: [
      // Mixamo upper arm is LeftArm/RightArm (packed: mixamorigLeftArm).
      { pattern: /leftarm|rightarm/i, axes: ['x', 'z'] },
      { pattern: /upperarm/i, axes: ['x', 'z'] },
      { pattern: /forearm/i, axes: ['x', 'z'] },
      { pattern: /upleg|thigh/i, axes: ['x', 'z'] },
      { pattern: /spine2|chest/i, axes: ['x', 'z'] },
      { pattern: /shoulder/i, axes: ['x', 'z'] },
    ],
    at0: 0.88,
    at1: 1.14,
  },
  {
    key: 'height',
    label: 'Height',
    hint: 'Leg length. The applier re-grounds the feet after scaling.',
    bones: [
      { pattern: /upleg|thigh/i, axes: ['y'] },
      { pattern: /(?<!up)leg(?!_)|shin|calf/i, axes: ['y'] },
    ],
    at0: 0.92,
    at1: 1.1,
  },
  {
    key: 'build',
    label: 'Build',
    hint: 'Hip and shoulder width.',
    bones: [
      { pattern: /hips|pelvis/i, axes: ['x', 'z'] },
      { pattern: /spine1/i, axes: ['x', 'z'] },
      { pattern: /spine(?!1|2)|waist/i, axes: ['x', 'z'] },
    ],
    at0: 0.9,
    at1: 1.12,
  },
  {
    key: 'jaw',
    label: 'Jaw',
    hint: 'Jaw width / face fullness.',
    bones: [{ pattern: /jaw/i, axes: ['x', 'z'] }],
    at0: 0.85,
    at1: 1.18,
  },
];

function snapshotBase(root: THREE.Object3D): Map<THREE.Bone, THREE.Vector3> {
  let base = (root.userData as Record<string, unknown>)[BASE_KEY] as
    | Map<THREE.Bone, THREE.Vector3>
    | undefined;
  if (!base) {
    base = new Map();
    root.traverse((o) => {
      const bone = o as THREE.Bone;
      if (bone.isBone) base!.set(bone, bone.scale.clone());
    });
    (root.userData as Record<string, unknown>)[BASE_KEY] = base;
  }
  return base;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Reset every morphed bone to its authored scale. */
export function resetMorphs(root: THREE.Object3D): void {
  const base = (root.userData as Record<string, unknown>)[BASE_KEY] as
    | Map<THREE.Bone, THREE.Vector3>
    | undefined;
  if (!base) return;
  for (const [bone, scale] of base) bone.scale.copy(scale);
}

/**
 * Apply morph values to the model. Resets to base first (idempotent), scales
 * matched bones, then re-grounds the model so feet sit at the floor plane.
 *
 * `floorY` is the y the model's feet rest at BEFORE morphs (the portrait and
 * the arena both normalize feet to a known plane first). After scaling, the
 * root is shifted so the lowest point returns to floorY — a dynamic reground,
 * never a hardcoded per-character offset (AGENTS.md LAW 2).
 */
export function applyMorphs(root: THREE.Object3D, values: MorphValues, floorY = 0): void {
  const base = snapshotBase(root);
  resetMorphs(root);

  for (const def of MORPH_DEFS) {
    const v = values[def.key];
    if (v === 0.5) continue; // authored shape — skip
    const scale = lerp(def.at0, def.at1, v);
    const matched = new Set<THREE.Bone>();
    for (const { pattern, axes } of def.bones) {
      for (const bone of base.keys()) {
        if (matched.has(bone)) continue;
        if (!pattern.test(bone.name)) continue;
        matched.add(bone);
        const b = base.get(bone)!;
        if (axes.includes('x')) bone.scale.x = b.x * scale;
        if (axes.includes('y')) bone.scale.y = b.y * scale;
        if (axes.includes('z')) bone.scale.z = b.z * scale;
      }
    }
  }
  reground(root, floorY);
}

/** Shift the root so the lowest skinned point sits at floorY (after leg scaling). */
function reground(root: THREE.Object3D, floorY: number): void {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (!isFinite(box.min.y)) return;
  root.position.y += floorY - box.min.y;
}

/** Which morph dials actually found bones on this model (for UI enablement). */
export function supportedMorphs(root: THREE.Object3D): MorphKey[] {
  const bones: string[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o.name);
  });
  return MORPH_DEFS.filter((def) =>
    def.bones.some(({ pattern }) => bones.some((n) => pattern.test(n))),
  ).map((d) => d.key);
}
