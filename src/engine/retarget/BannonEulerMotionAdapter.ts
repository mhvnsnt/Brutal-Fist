/**
 * BannonEulerMotionAdapter
 *
 * The Bannon motion bank stores bone rotations as Euler channels:
 *   rx / ry / rz
 *
 * It is NOT a quaternion JSON format. This adapter is intentionally separate
 * from BannonClipJsonAdapter so the existing adapter can remain backward
 * compatible while the runtime is migrated safely.
 *
 * Pipeline:
 *   Bannon JSON Euler channels -> quaternion keyframe tracks
 *   -> canonical target bone names -> Three.js AnimationClip
 *
 * No procedural motion is generated here. A clip is only marked authored when
 * it was produced from supplied motion-bank frames.
 */

import * as THREE from 'three';

export interface BannonEulerFrame {
  t?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  /** Some Bannon exports carry an optional position channel. */
  p?: [number, number, number];
}

export interface BannonEulerTrack {
  frames?: BannonEulerFrame[];
  [key: string]: unknown;
}

export interface BannonEulerClipJson {
  name: string;
  duration?: number;
  frameRate?: number;
  semanticState?: string;
  bones: Record<string, BannonEulerTrack | BannonEulerFrame[]>;
  source?: string;
  license?: string;
}

const ALIASES: Record<string, string> = {
  mixamorigHips: 'Hips', mixamorigSpine: 'Spine', mixamorigSpine1: 'Spine',
  mixamorigSpine2: 'Chest', mixamorigNeck: 'Neck', mixamorigHead: 'Head',
  mixamorigLeftShoulder: 'LUpperArm', mixamorigLeftArm: 'LUpperArm',
  mixamorigLeftForeArm: 'LForeArm', mixamorigLeftHand: 'LHand',
  mixamorigRightShoulder: 'RUpperArm', mixamorigRightArm: 'RUpperArm',
  mixamorigRightForeArm: 'RForeArm', mixamorigRightHand: 'RHand',
  mixamorigLeftUpLeg: 'LUpperLeg', mixamorigLeftLeg: 'LLowerLeg',
  mixamorigLeftFoot: 'LFoot', mixamorigRightUpLeg: 'RUpperLeg',
  mixamorigRightLeg: 'RLowerLeg', mixamorigRightFoot: 'RFoot',
  Hips: 'Hips', Spine: 'Spine', Spine1: 'Spine', Spine2: 'Chest',
  Chest: 'Chest', Neck: 'Neck', Head: 'Head',
  LUpperArm: 'LUpperArm', LeftUpperArm: 'LUpperArm', LeftArm: 'LUpperArm',
  LForeArm: 'LForeArm', LeftForeArm: 'LForeArm', LeftForearm: 'LForeArm',
  LHand: 'LHand', LeftHand: 'LHand',
  RUpperArm: 'RUpperArm', RightUpperArm: 'RUpperArm', RightArm: 'RUpperArm',
  RForeArm: 'RForeArm', RightForeArm: 'RForeArm', RightForearm: 'RForeArm',
  RHand: 'RHand', RightHand: 'RHand',
  LUpperLeg: 'LUpperLeg', LeftUpperLeg: 'LUpperLeg', LeftThigh: 'LUpperLeg',
  LLowerLeg: 'LLowerLeg', LeftLowerLeg: 'LLowerLeg', LeftCalf: 'LLowerLeg',
  LFoot: 'LFoot', LeftFoot: 'LFoot',
  RUpperLeg: 'RUpperLeg', RightUpperLeg: 'RUpperLeg', RightThigh: 'RUpperLeg',
  RLowerLeg: 'RLowerLeg', RightLowerLeg: 'RLowerLeg', RightCalf: 'RLowerLeg',
  RFoot: 'RFoot', RightFoot: 'RFoot',
};

function eulerXYZ(rx: number, ry: number, rz: number): THREE.Quaternion {
  const q = new THREE.Quaternion();
  // Bannon's move_sheet.py defines these channels as XYZ Euler rotations.
  q.setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
  return q;
}

function angleUnit(value: number): number {
  // Bannon's current motion-bank writer uses radians; accept degree exports
  // without silently producing enormous rotations.
  return Math.abs(value) > Math.PI * 2.25 ? THREE.MathUtils.degToRad(value) : value;
}

function framesOf(track: BannonEulerTrack | BannonEulerFrame[]): BannonEulerFrame[] {
  return Array.isArray(track) ? track : (track.frames ?? []);
}

export interface BannonEulerAdapterResult {
  clip: THREE.AnimationClip;
  semanticState: string;
  source: string;
  license: string;
  mappedBones: string[];
  unmappedBones: string[];
  rotationTrackCount: number;
  positionTrackCount: number;
}

export function normalizeBannonEulerBone(name: string): string {
  return ALIASES[name] ?? name;
}

/** Convert actual rx/ry/rz motion-bank frames into a Three.js clip. */
export function convertBannonEulerClip(
  json: BannonEulerClipJson,
  semanticStateOverride?: string,
): BannonEulerAdapterResult {
  const tracks: THREE.KeyframeTrack[] = [];
  const mappedBones: string[] = [];
  const unmappedBones: string[] = [];

  for (const [sourceName, rawTrack] of Object.entries(json.bones ?? {})) {
    const frames = framesOf(rawTrack).filter(f =>
      Number.isFinite(f.rx ?? 0) && Number.isFinite(f.ry ?? 0) && Number.isFinite(f.rz ?? 0)
    );
    if (!frames.length) continue;

    const canonical = normalizeBannonEulerBone(sourceName);
    if (canonical === sourceName && !ALIASES[sourceName]) unmappedBones.push(sourceName);
    else mappedBones.push(canonical);

    frames.sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
    const times: number[] = [];
    const values: number[] = [];
    for (const frame of frames) {
      times.push(frame.t ?? (times.length / (json.frameRate || 30)));
      const q = eulerXYZ(
        angleUnit(frame.rx ?? 0),
        angleUnit(frame.ry ?? 0),
        angleUnit(frame.rz ?? 0),
      );
      values.push(q.x, q.y, q.z, q.w);
    }
    if (times.length) {
      tracks.push(new THREE.QuaternionKeyframeTrack(`${canonical}.quaternion`, times, values));
    }

    const positions = frames.filter(f => Array.isArray(f.p));
    if (positions.length) {
      const pt: number[] = [];
      const pv: number[] = [];
      for (const frame of positions) {
        pt.push(frame.t ?? (pt.length / (json.frameRate || 30)));
        pv.push(frame.p![0], frame.p![1], frame.p![2]);
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${canonical}.position`, pt, pv));
    }
  }

  const semanticState = semanticStateOverride ?? json.semanticState ?? json.name;
  const clip = new THREE.AnimationClip(json.name, json.duration ?? -1, tracks);
  clip.userData = {
    ...(clip.userData ?? {}),
    semanticState,
    sourceFile: json.source ?? 'assets/moves/clips/',
    license: json.license ?? 'proprietary',
    clipSourceType: 'AUTHORED_CLIP',
    isProcedural: false,
    sourceFormat: 'BANNON_EULER_RX_RY_RZ',
  };

  return {
    clip,
    semanticState,
    source: json.source ?? 'assets/moves/clips/',
    license: json.license ?? 'proprietary',
    mappedBones: [...new Set(mappedBones)],
    unmappedBones: [...new Set(unmappedBones)],
    rotationTrackCount: tracks.filter(t => t.name.endsWith('.quaternion')).length,
    positionTrackCount: tracks.filter(t => t.name.endsWith('.position')).length,
  };
}

/**
 * Validate that every animated canonical bone exists on the live target.
 * The caller passes the actual Object3D loaded from the fighter GLB.
 */
export function validateEulerClipAgainstSkeleton(
  clip: THREE.AnimationClip,
  target: THREE.Object3D,
): { resolved: string[]; unresolved: string[] } {
  const names = new Set<string>();
  target.traverse(object => { if (object.name) names.add(object.name); });
  const resolved: string[] = [];
  const unresolved: string[] = [];
  for (const track of clip.tracks) {
    const bone = track.name.replace(/\.(quaternion|position|scale)$/, '');
    if (names.has(bone)) resolved.push(bone);
    else unresolved.push(bone);
  }
  return { resolved: [...new Set(resolved)], unresolved: [...new Set(unresolved)] };
}
