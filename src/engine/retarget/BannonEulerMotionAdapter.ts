import * as THREE from 'three';
import { normalizeToBannonBone } from './BannonClipJsonAdapter';

/** Real Bannon motion-bank frame as emitted by the mocap tooling.
 * The bank uses rx/ry/rz Euler rotations; q is optional for compatibility with
 * newer baked exports. Angles may be expressed in radians or degrees.
 */
export interface BannonEulerFrame {
  t?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  q?: [number, number, number, number];
  p?: [number, number, number];
}

export interface BannonEulerClip {
  name: string;
  duration: number;
  frameRate?: number;
  semanticState?: string;
  source?: string;
  license?: string;
  bones: Record<string, { frames: BannonEulerFrame[] }>;
}

function looksLikeDegrees(value: number): boolean {
  return Math.abs(value) > Math.PI * 2.5;
}

function toRadians(value: number): number {
  return looksLikeDegrees(value) ? THREE.MathUtils.degToRad(value) : value;
}

function frameTime(frame: BannonEulerFrame, index: number, frameRate: number): number {
  return Number.isFinite(frame.t) ? frame.t! : index / frameRate;
}

/**
 * Converts the actual Bannon mocap representation into Three.js tracks.
 * No procedural pose is invented here: every rotation key comes from the
 * supplied motion-bank frame (or its explicitly supplied quaternion).
 */
export function convertBannonEulerClip(json: BannonEulerClip): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  const frameRate = json.frameRate ?? 30;

  for (const [sourceBone, boneTrack] of Object.entries(json.bones)) {
    const targetBone = normalizeToBannonBone(sourceBone);
    const frames = [...boneTrack.frames].sort((a, b) => frameTime(a, 0, frameRate) - frameTime(b, 0, frameRate));
    if (!frames.length) continue;

    const rotationFrames = frames.filter(f => f.q || f.rx != null || f.ry != null || f.rz != null);
    if (rotationFrames.length) {
      const times: number[] = [];
      const values: number[] = [];
      for (let i = 0; i < rotationFrames.length; i++) {
        const frame = rotationFrames[i];
        times.push(frameTime(frame, i, frameRate));
        const q = frame.q
          ? new THREE.Quaternion(frame.q[0], frame.q[1], frame.q[2], frame.q[3]).normalize()
          : new THREE.Quaternion().setFromEuler(new THREE.Euler(
              toRadians(frame.rx ?? 0),
              toRadians(frame.ry ?? 0),
              toRadians(frame.rz ?? 0),
              'XYZ',
            ));
        values.push(q.x, q.y, q.z, q.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${targetBone}.quaternion`, times, values));
    }

    const positionFrames = frames.filter(f => f.p != null);
    if (positionFrames.length) {
      const times: number[] = [];
      const values: number[] = [];
      for (let i = 0; i < positionFrames.length; i++) {
        const frame = positionFrames[i];
        times.push(frameTime(frame, i, frameRate));
        values.push(frame.p![0], frame.p![1], frame.p![2]);
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${targetBone}.position`, times, values));
    }
  }

  const clip = new THREE.AnimationClip(json.name, json.duration, tracks);
  (clip as any).userData = {
    semanticState: json.semanticState ?? json.name,
    source: json.source ?? 'BANNON_MOTION_BANK',
    license: json.license ?? 'unknown',
    sourceFormat: 'BANNON_EULER_RX_RY_RZ',
    isProcedural: false,
  };
  return clip;
}

export function convertBannonEulerBank(clips: BannonEulerClip[]): THREE.AnimationClip[] {
  return clips.map(convertBannonEulerClip).filter(clip => clip.tracks.length > 0);
}
