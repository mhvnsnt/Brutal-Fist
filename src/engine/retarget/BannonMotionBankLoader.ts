import * as THREE from 'three';
import { convertBannonClipJson, normalizeToBannonBone, type BannonClipJson, type BannonBoneFrame } from './BannonClipJsonAdapter';
import { registerAuthoredClip, type AnimationSourceRecord } from '../combat/AnimationSourceRegistry';

export const BANNON_MOTION_BANK_INDEX = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/index.json';
export const BANNON_MOTION_BANK_BASE = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/';

interface MotionIndexEntry { file: string; src?: string; dur?: number; keys?: number; bones?: number; }
export type BannonMotionIndex = Record<string, MotionIndexEntry>;

export interface BannonMotionLoadResult {
  clips: THREE.AnimationClip[];
  sources: AnimationSourceRecord[];
  loaded: string[];
  failed: string[];
}

function semanticFromName(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('idle') || n.includes('stance')) return 'idle';
  if (n.includes('walk') || n.includes('run')) return 'walk_forward';
  if (n.includes('block') || n.includes('guard')) return 'block';
  if (n.includes('hit') || n.includes('injured') || n.includes('reaction')) return 'hit_reaction';
  if (n.includes('fall') || n.includes('death') || n.includes('dying') || n.includes('knock')) return 'knockdown';
  if (n.includes('getup') || n.includes('stand')) return 'getup';
  if (n.includes('throw') || n.includes('takedown') || n.includes('grapple')) return 'grapple';
  if (n.includes('kick') || n.includes('punch') || n.includes('jab') || n.includes('cross') || n.includes('elbow') || n.includes('knee') || n.includes('swing') || n.includes('boxing') || n.includes('combo')) return 'attack_1';
  return 'idle';
}

function frameTime(frame: BannonBoneFrame, index: number, frameRate: number) {
  return Number.isFinite(frame.t) ? frame.t : index / frameRate;
}

function toRadians(v: number) {
  return Math.abs(v) > Math.PI * 2.5 ? THREE.MathUtils.degToRad(v) : v;
}

/** Converts the actual Bannon rx/ry/rz motion-bank representation when a JSON clip does not contain q channels. */
function convertEulerMotionBankClip(json: any): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  const frameRate = json.frameRate ?? 30;
  for (const [sourceBone, track] of Object.entries<any>(json.bones ?? {})) {
    const bone = normalizeToBannonBone(sourceBone);
    const frames = [...(track.frames ?? [])].sort((a, b) => frameTime(a, 0, frameRate) - frameTime(b, 0, frameRate));
    const rot = frames.filter(f => f.rx != null || f.ry != null || f.rz != null || f.q != null);
    if (rot.length) {
      const times: number[] = [];
      const values: number[] = [];
      rot.forEach((f, i) => {
        times.push(frameTime(f, i, frameRate));
        const q = f.q
          ? new THREE.Quaternion(f.q[0], f.q[1], f.q[2], f.q[3]).normalize()
          : new THREE.Quaternion().setFromEuler(new THREE.Euler(toRadians(f.rx ?? 0), toRadians(f.ry ?? 0), toRadians(f.rz ?? 0), 'XYZ'));
        values.push(q.x, q.y, q.z, q.w);
      });
      tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
    }
    const pos = frames.filter(f => Array.isArray(f.p));
    if (pos.length) {
      const times: number[] = [];
      const values: number[] = [];
      pos.forEach((f, i) => { times.push(frameTime(f, i, frameRate)); values.push(f.p[0], f.p[1], f.p[2]); });
      tracks.push(new THREE.VectorKeyframeTrack(`${bone}.position`, times, values));
    }
  }
  const clip = new THREE.AnimationClip(json.name, json.duration ?? 0, tracks);
  (clip as any).userData = { semanticState: json.semanticState ?? semanticFromName(json.name), source: json.source ?? 'BANNON_MOTION_BANK', license: json.license ?? 'unknown', sourceFormat: 'BANNON_EULER_RX_RY_RZ', isProcedural: false };
  return clip;
}

export async function loadBannonMotionBank(
  skeletonBones: readonly THREE.Bone[],
  options: { indexUrl?: string; baseUrl?: string; maxClips?: number } = {},
): Promise<BannonMotionLoadResult> {
  const indexUrl = options.indexUrl ?? BANNON_MOTION_BANK_INDEX;
  const baseUrl = options.baseUrl ?? BANNON_MOTION_BANK_BASE;
  const index = await fetch(indexUrl).then(r => { if (!r.ok) throw new Error(`Bannon motion index HTTP ${r.status}`); return r.json() as Promise<BannonMotionIndex>; });
  const entries = Object.entries(index).slice(0, options.maxClips ?? Infinity);
  const clips: THREE.AnimationClip[] = [];
  const sources: AnimationSourceRecord[] = [];
  const loaded: string[] = [];
  const failed: string[] = [];

  for (const [key, meta] of entries) {
    try {
      const json: any = await fetch(`${baseUrl}${encodeURIComponent(meta.file)}`).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
      const hasEuler = Object.values<any>(json.bones ?? {}).some(b => (b.frames ?? []).some((f: any) => f.rx != null || f.ry != null || f.rz != null));
      const hasQuaternion = Object.values<any>(json.bones ?? {}).some(b => (b.frames ?? []).some((f: any) => f.q != null));
      const adapted = hasEuler && !hasQuaternion
        ? convertEulerMotionBankClip(json)
        : convertBannonClipJson(json as BannonClipJson).clip;
      if (!adapted.tracks.length) throw new Error('NO_TRACKS');
      const semanticState = (adapted as any).userData?.semanticState ?? semanticFromName(json.name ?? key);
      const record = registerAuthoredClip(adapted, { semanticState, source: `${baseUrl}${meta.file}`, license: json.license ?? 'unknown', skeletonBones });
      if (record.unresolvedTracks.length > 0 || record.resolvedTracks === 0) throw new Error(`RETARGET_UNRESOLVED:${record.unresolvedTracks.slice(0, 3).join(',')}`);
      clips.push(adapted); sources.push(record); loaded.push(key);
    } catch (error) {
      console.warn(`[BannonMotionBankLoader] ${key} failed:`, error);
      failed.push(key);
    }
  }
  return { clips, sources, loaded, failed };
}
