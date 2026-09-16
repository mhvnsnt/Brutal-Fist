/**
 * BannonEulerMotionAdapter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts Bannon motion bank JSON with Euler rx/ry/rz rotation channels
 * (BANNON_EULER_RX_RY_RZ format) into Three.js QuaternionKeyframeTrack
 * objects bound to the live cloned mixer skeleton.
 *
 * FORMAT DETECTION:
 *   hasQuaternion: false  → BANNON_EULER_RX_RY_RZ (this adapter)
 *   hasQuaternion: true   → BannonClipJsonAdapter (quaternion path)
 *
 * PIPELINE:
 *   Bannon JSON (rx/ry/rz per bone per frame)
 *   → Euler → THREE.Euler → THREE.Quaternion
 *   → QuaternionKeyframeTrack targeting Mixamo bone names
 *   → bindClipTracksToTargetBones() resolves names onto live clone skeleton
 *   → THREE.AnimationClip ready for mixer.clipAction()
 *
 * MEASUREMENTS (from scripts/verify-bannon-motion-bank.mjs):
 *   Index size: 202 clips
 *   Preferred semantic states: 11/11 converted
 *   Tracks per clip: 52 Mixamo quaternion tracks
 *   Total angular travel: 769.03 rad across 11 clips
 *
 * PROVENANCE: Every clip carries userData.provenance and
 *   userData.clipSourceType = 'RETARGETED_AUTHORED_CLIP'
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';
import { normalizeToBannonBone } from './BannonClipJsonAdapter';

// ─────────────────────────────────────────────────────────────────────────────
// Bannon Euler motion bank JSON schema
// ─────────────────────────────────────────────────────────────────────────────

export interface BannonEulerBoneFrame {
  /** Time in seconds */
  t: number;
  /** Euler X rotation in radians */
  rx: number;
  /** Euler Y rotation in radians */
  ry: number;
  /** Euler Z rotation in radians */
  rz: number;
  /** Optional position [x, y, z] — root/Hips only */
  px?: number;
  py?: number;
  pz?: number;
}

export interface BannonEulerBoneTrack {
  frames: BannonEulerBoneFrame[];
}

export interface BannonEulerClipJson {
  /** Clip name */
  name: string;
  /** Total duration in seconds */
  duration: number;
  /** Frame rate (typically 30) */
  frameRate?: number;
  /** Semantic state alias */
  semanticState?: string;
  /** Format marker — false = Euler rx/ry/rz */
  hasQuaternion: false;
  /** Euler order (default 'XYZ') */
  eulerOrder?: string;
  /** Per-bone animation data keyed by Mixamo bone name */
  bones: Record<string, BannonEulerBoneTrack>;
  /** Source file provenance */
  source?: string;
  /** License string */
  license?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter result
// ─────────────────────────────────────────────────────────────────────────────

export interface EulerAdapterResult {
  /** Converted AnimationClip with quaternion tracks */
  clip: THREE.AnimationClip;
  /** Semantic state this clip maps to */
  semanticState: string;
  /** Number of bone tracks successfully converted */
  trackCount: number;
  /** Total angular travel in radians across all tracks */
  totalAngularTravel: number;
  /** Bone names that were mapped to canonical names */
  mappedBones: string[];
  /** Bone names that could not be mapped */
  unmappedBones: string[];
  /** Source provenance */
  source: string;
  /** Whether this is confirmed Euler format */
  isEulerFormat: true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Format detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect whether a raw JSON object is in BANNON_EULER_RX_RY_RZ format.
 * Returns true if hasQuaternion === false and at least one bone has rx/ry/rz frames.
 */
export function isBannonEulerFormat(json: unknown): json is BannonEulerClipJson {
  if (!json || typeof json !== 'object') return false;
  const obj = json as Record<string, unknown>;
  if (obj.hasQuaternion !== false) return false;
  if (!obj.bones || typeof obj.bones !== 'object') return false;

  // Check at least one bone has Euler frames
  const bones = obj.bones as Record<string, unknown>;
  for (const boneData of Object.values(bones)) {
    if (!boneData || typeof boneData !== 'object') continue;
    const bd = boneData as Record<string, unknown>;
    if (!Array.isArray(bd.frames) || bd.frames.length === 0) continue;
    const firstFrame = bd.frames[0] as Record<string, unknown>;
    if (typeof firstFrame.rx === 'number') return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Euler → Quaternion conversion
// ─────────────────────────────────────────────────────────────────────────────

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

/**
 * Convert a single BannonEulerClipJson into a Three.js AnimationClip.
 *
 * Each bone's Euler rx/ry/rz frames are converted to quaternion tracks:
 *   rx/ry/rz → THREE.Euler → THREE.Quaternion → QuaternionKeyframeTrack
 *
 * Track names use canonical Bannon bone names (via normalizeToBannonBone)
 * so they resolve against the target skeleton.
 *
 * Angular travel is measured as the sum of quaternion angular distances
 * between consecutive frames — used to verify non-trivial motion.
 */
export function convertBannonEulerClip(
  json: BannonEulerClipJson,
  semanticStateOverride?: string,
): EulerAdapterResult {
  const tracks: THREE.KeyframeTrack[] = [];
  const mappedBones: string[] = [];
  const unmappedBones: string[] = [];
  const eulerOrder = (json.eulerOrder ?? 'XYZ') as THREE.EulerOrder;
  let totalAngularTravel = 0;

  for (const [sourceBoneName, boneTrack] of Object.entries(json.bones)) {
    const canonicalName = normalizeToBannonBone(sourceBoneName);
    const wasMapped = canonicalName !== sourceBoneName;

    if (!boneTrack.frames || boneTrack.frames.length === 0) continue;

    // Sort frames by time
    const sortedFrames = [...boneTrack.frames].sort((a, b) => a.t - b.t);

    // Build quaternion track from Euler rx/ry/rz
    const times: number[] = [];
    const quatValues: number[] = [];
    let prevQuat: THREE.Quaternion | null = null;

    for (const frame of sortedFrames) {
      if (typeof frame.rx !== 'number') continue;

      _euler.set(frame.rx, frame.ry, frame.rz, eulerOrder);
      _quat.setFromEuler(_euler);

      times.push(frame.t);
      quatValues.push(_quat.x, _quat.y, _quat.z, _quat.w);

      // Measure angular travel
      if (prevQuat !== null) {
        const dot = Math.abs(prevQuat.dot(_quat));
        const clampedDot = Math.min(1.0, dot);
        totalAngularTravel += 2 * Math.acos(clampedDot);
      }
      prevQuat = _quat.clone();
    }

    if (times.length > 0) {
      tracks.push(
        new THREE.QuaternionKeyframeTrack(
          `${canonicalName}.quaternion`,
          times,
          quatValues,
        )
      );

      if (wasMapped || sourceBoneName === canonicalName) {
        mappedBones.push(sourceBoneName);
      } else {
        unmappedBones.push(sourceBoneName);
      }
    }

    // Build position track for root bone (Hips)
    const hasPosition = sortedFrames.some(f => typeof f.px === 'number');
    if (hasPosition) {
      const posTimes: number[] = [];
      const posValues: number[] = [];
      for (const frame of sortedFrames) {
        if (typeof frame.px !== 'number') continue;
        posTimes.push(frame.t);
        posValues.push(frame.px, frame.py ?? 0, frame.pz ?? 0);
      }
      if (posTimes.length > 0) {
        tracks.push(
          new THREE.VectorKeyframeTrack(
            `${canonicalName}.position`,
            posTimes,
            posValues,
          )
        );
      }
    }
  }

  const semanticState = semanticStateOverride ?? json.semanticState ?? json.name;
  const clip = new THREE.AnimationClip(json.name, json.duration, tracks);

  // Stamp provenance
  (clip as unknown as Record<string, unknown>).userData = {
    semanticState,
    clipSourceType: 'RETARGETED_AUTHORED_CLIP',
    format: 'BANNON_EULER_RX_RY_RZ',
    source: json.source ?? 'bannon-motion-bank',
    license: json.license ?? 'unknown',
    trackCount: tracks.length,
    totalAngularTravel: Math.round(totalAngularTravel * 100) / 100,
    hasQuaternion: false,
    convertedToQuaternion: true,
  };

  return {
    clip,
    semanticState,
    trackCount: tracks.length,
    totalAngularTravel,
    mappedBones,
    unmappedBones,
    source: json.source ?? 'bannon-motion-bank',
    isEulerFormat: true,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// bindClipTracksToTargetBones
// ─────────────────────────────────────────────────────────────────────────────

export interface BindResult {
  /** Clip with tracks rewritten to target skeleton bone names */
  clip: THREE.AnimationClip;
  /** Number of tracks successfully bound */
  boundTracks: number;
  /** Number of tracks that could not be bound (no matching bone) */
  unboundTracks: number;
  /** Names of unbound track targets */
  unboundTargets: string[];
  /** Total angular travel preserved */
  totalAngularTravel: number;
}

/**
 * Bind converted clip tracks onto a live cloned skeleton.
 *
 * After Euler → quaternion conversion, track names use canonical Bannon bone
 * names (e.g. "Hips.quaternion", "LUpperArm.quaternion"). This function
 * resolves those canonical names to the actual bone names present in the
 * target skeleton, rewriting track names in-place.
 *
 * If a canonical name matches a bone directly, no rewrite is needed.
 * If the skeleton uses Mixamo names (mixamorigHips), the track is rewritten.
 * Tracks with no matching bone are dropped and reported.
 *
 * @param clip          Clip from convertBannonEulerClip()
 * @param targetScene   The live cloned scene (SkeletonUtils.clone() output)
 * @returns BindResult with bound clip and diagnostic counts
 */
export function bindClipTracksToTargetBones(
  clip: THREE.AnimationClip,
  targetScene: THREE.Object3D,
): BindResult {
  // Build bone name index from target skeleton
  const boneNameSet = new Set<string>();
  const canonicalToTarget = new Map<string, string>();

  targetScene.traverse((child) => {
    if ((child as THREE.Bone).isBone && child.name) {
      boneNameSet.add(child.name);
      // Map canonical name → target name via normalizeToBannonBone
      const canonical = normalizeToBannonBone(child.name);
      if (!canonicalToTarget.has(canonical)) {
        canonicalToTarget.set(canonical, child.name);
      }
      // Also map the bone's own name directly
      if (!canonicalToTarget.has(child.name)) {
        canonicalToTarget.set(child.name, child.name);
      }
    }
  });

  const boundTracks: THREE.KeyframeTrack[] = [];
  const unboundTargets: string[] = [];
  let totalAngularTravel = 0;

  for (const track of clip.tracks) {
    // Extract bone name from track path (e.g. "Hips.quaternion" → "Hips")
    const dotIdx = track.name.lastIndexOf('.');
    const boneName = dotIdx !== -1 ? track.name.slice(0, dotIdx) : track.name;
    const property = dotIdx !== -1 ? track.name.slice(dotIdx) : '';

    // Try direct match first
    if (boneNameSet.has(boneName)) {
      boundTracks.push(track);
      if (property === '.quaternion') {
        totalAngularTravel += measureQuatTrackTravel(track);
      }
      continue;
    }

    // Try canonical → target resolution
    const targetBoneName = canonicalToTarget.get(boneName);
    if (targetBoneName) {
      // Rewrite track name to use target bone name
      const rewrittenTrack = track.clone();
      rewrittenTrack.name = `${targetBoneName}${property}`;
      boundTracks.push(rewrittenTrack);
      if (property === '.quaternion') {
        totalAngularTravel += measureQuatTrackTravel(rewrittenTrack);
      }
      continue;
    }

    // No match — drop track
    unboundTargets.push(boneName);
  }

  const boundClip = new THREE.AnimationClip(clip.name, clip.duration, boundTracks);
  // Preserve userData
  (boundClip as unknown as Record<string, unknown>).userData = {
    ...((clip as unknown as Record<string, unknown>).userData ?? {}),
    boundTracks: boundTracks.length,
    unboundTracks: unboundTargets.length,
    totalAngularTravel: Math.round(totalAngularTravel * 100) / 100,
  };

  if (unboundTargets.length > 0) {
    console.warn(
      `[BannonEulerMotionAdapter] ⚠️ bindClipTracksToTargetBones: clip="${clip.name}" ` +
      `${unboundTargets.length} unbound tracks: [${unboundTargets.join(', ')}]`
    );
  }

  return {
    clip: boundClip,
    boundTracks: boundTracks.length,
    unboundTracks: unboundTargets.length,
    unboundTargets,
    totalAngularTravel,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function measureQuatTrackTravel(track: THREE.KeyframeTrack): number {
  const values = track.values;
  let travel = 0;
  for (let i = 4; i < values.length; i += 4) {
    const ax = values[i - 4], ay = values[i - 3], az = values[i - 2], aw = values[i - 1];
    const bx = values[i],     by = values[i + 1], bz = values[i + 2], bw = values[i + 3];
    const dot = Math.abs(ax * bx + ay * by + az * bz + aw * bw);
    travel += 2 * Math.acos(Math.min(1.0, dot));
  }
  return travel;
}

/**
 * Convert and bind a Bannon Euler clip onto a live target skeleton in one step.
 * Combines convertBannonEulerClip() + bindClipTracksToTargetBones().
 */
export function convertAndBindEulerClip(
  json: BannonEulerClipJson,
  targetScene: THREE.Object3D,
  semanticStateOverride?: string,
): BindResult {
  const adapterResult = convertBannonEulerClip(json, semanticStateOverride);
  return bindClipTracksToTargetBones(adapterResult.clip, targetScene);
}
