/**
 * customization/eyeColors.ts — user-settable iris colors.
 *
 * Port of the AshLanev2 suite's eye-colors.ts. The system is material-based:
 * find materials named *iris* (also meshes/nodes named *iris*/*pupil* as a
 * fallback locator), clone them once per model, and drive color via a
 * procedurally generated 256px iris texture (limbal ring + radial striations
 * + pupil). ONLY iris materials are touched — skin is never recolored.
 *
 * CAST SURVEY (Brutal-Fist, 2026-10-09): BANNON_rigged, ONYX_street,
 * CIPHER/CIPHER_rigged, ECHO, HOLLOW, STICKUP are single-material GLBs with
 * eyes baked into the shared body texture; MAIME_skinned has 15 materials
 * but no dedicated iris material either. So `supportsEyeColor()` is false
 * for the whole current cast and the UI disables the palette with an honest
 * note — never a skin tint. The system stays wired for any future model
 * that ships a dedicated iris material.
 */
import * as THREE from 'three';
import type { EyeColor } from './types';

/** Palette of selectable iris colors. "natural" = the model's authored iris. */
export const EYE_COLOR_PALETTE: EyeColor[] = [
  { id: 'natural', label: 'Natural', hex: '#000000' }, // sentinel: keep authored
  { id: 'brown', label: 'Brown', hex: '#4a2c14' },
  { id: 'darkbrown', label: 'Dark Brown', hex: '#241408' },
  { id: 'black', label: 'Black', hex: '#0a0a0a' },
  { id: 'hazel', label: 'Hazel', hex: '#7a5a1e' },
  { id: 'amber', label: 'Amber', hex: '#c07f1a' },
  { id: 'green', label: 'Green', hex: '#3d7a3a' },
  { id: 'blue', label: 'Blue', hex: '#3a6ea5' },
  { id: 'iceblue', label: 'Ice Blue', hex: '#9fd4e8' },
  { id: 'gray', label: 'Gray', hex: '#8a8f94' },
  { id: 'violet', label: 'Violet', hex: '#6a4a9e' },
  { id: 'red', label: 'Blood Red', hex: '#a02020' },
];

const IRIS_MATERIAL_RE = /iris/i;
const IRIS_NODE_RE = /iris|pupil|eyeball/i;

type IrisMat = THREE.MeshStandardMaterial & {
  map: THREE.Texture | null;
};

const APPLIED_KEY = '__bfCustomizerIrisApplied';

function isMeshStandardMaterial(m: THREE.Material | THREE.Material[]): m is IrisMat {
  const single = Array.isArray(m) ? m[0] : m;
  return !!single && (single as THREE.MeshStandardMaterial).isMeshStandardMaterial === true;
}

/**
 * Find the model's dedicated iris materials. Returns [] when the model bakes
 * its eyes into a shared texture (unsupported — skin likeness stays locked).
 */
export function findIrisMaterials(root: THREE.Object3D): IrisMat[] {
  const found: IrisMat[] = [];
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
      Boolean,
    ) as THREE.Material[];
    for (const mat of mats) {
      if (seen.has(mat)) continue;
      const byMaterial = IRIS_MATERIAL_RE.test(mat.name || '');
      const byNode = IRIS_NODE_RE.test(o.name || '');
      if ((byMaterial || byNode) && isMeshStandardMaterial(mat)) {
        seen.add(mat);
        found.push(mat as IrisMat);
      }
    }
  });
  return found;
}

/** Does this model support runtime iris color? (Has a dedicated iris material.) */
export function supportsEyeColor(root: THREE.Object3D): boolean {
  return findIrisMaterials(root).length > 0;
}

/** Generate a 256px iris texture: limbal ring + radial striations + pupil. */
function makeIrisTexture(hex: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = new THREE.Color(hex);

  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.08, size / 2, size / 2, size / 2);
  const light = c.clone().offsetHSL(0, -0.05, 0.22);
  const dark = c.clone().offsetHSL(0, 0.05, -0.18);
  g.addColorStop(0, `#${light.getHexString()}`);
  g.addColorStop(0.55, `#${c.getHexString()}`);
  g.addColorStop(0.82, `#${dark.getHexString()}`);
  g.addColorStop(1, '#050505'); // limbal ring
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  for (let i = 0; i < 220; i++) {
    const a = (i / 220) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.05;
    const r0 = size * (0.1 + 0.04 * Math.abs(Math.sin(i * 78.233)));
    const r1 = size * (0.4 + 0.06 * Math.abs(Math.sin(i * 39.425)));
    const shade = Math.sin(i * 37.719) > 0 ? 0 : 1;
    ctx.strokeStyle = shade ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1 + (i % 3 === 0 ? 1 : 0);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    ctx.stroke();
  }

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.085, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Apply an iris color to the model. Clones each iris material once (original
 * kept in userData for reset). ONLY iris materials are touched — skin and
 * everything else are never recolored. "natural" resets to authored.
 */
export function applyEyeColor(root: THREE.Object3D, eyeColorId: string): boolean {
  if (eyeColorId === 'natural') {
    resetEyeColor(root);
    return true;
  }
  const palette = EYE_COLOR_PALETTE.find((e) => e.id === eyeColorId);
  if (!palette) return false;
  const mats = findIrisMaterials(root);
  if (mats.length === 0) return false;

  let tex = textureCache.get(palette.hex);
  if (!tex) {
    tex = makeIrisTexture(palette.hex);
    textureCache.set(palette.hex, tex);
  }

  for (const mat of mats) {
    let clone = (mat as unknown as Record<string, unknown>)[APPLIED_KEY] as
      | { clone: IrisMat }
      | undefined;
    let target: IrisMat;
    if (clone) {
      target = clone.clone;
    } else {
      target = mat.clone() as IrisMat;
      target.name = `${mat.name}__bfcustomizer`;
      (target as unknown as Record<string, unknown>)[APPLIED_KEY] = { original: mat };
      root.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh.material === mat) mesh.material = target;
        else if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => (m === mat ? target : m));
        }
      });
    }
    target.map = tex;
    target.color.set('#ffffff'); // texture carries the color
    target.roughness = 0.25;
    target.needsUpdate = true;
  }
  return true;
}

/** Restore the model's authored iris material(s). */
export function resetEyeColor(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
      Boolean,
    ) as THREE.Material[];
    const restored = mats.map((m) => {
      const rec = (m as unknown as Record<string, unknown>)[APPLIED_KEY] as
        | { original: THREE.Material }
        | undefined;
      return rec ? rec.original : m;
    });
    mesh.material = Array.isArray(mesh.material) ? restored : restored[0];
  });
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).filter(
      Boolean,
    ) as THREE.Material[];
    for (const m of mats) {
      delete (m as unknown as Record<string, unknown>)[APPLIED_KEY];
    }
  });
}
