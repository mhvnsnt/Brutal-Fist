/**
 * BannonClipJsonAdapter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts Bannon motion bank JSON (assets/moves/clips/) into real Three.js
 * AnimationClips with quaternion bone tracks.
 *
 * REAL Bannon GitHub format (video_to_clip / bake_clips output):
 *   { "dur": 1.73, "keys": [{ "t": 0, "pose": {...}, "bones": { mixamorigHips: {rx,ry,rz} } }] }
 * This is Euler rotation in radians (XYZ). It is NOT quaternion animation.
 * convertAnyBannonClipJson() detects this via isBannonEulerMotionBank() and
 * delegates to BannonEulerMotionAdapter.
 *
 * Legacy / adapter quaternion schema (also supported):
 *   { "name", "duration", "bones": { Bone: { frames: [{ t, q, p }] } } }
 *
 * Track names keep Mixamo source names for Euler clips so AnimationRetargeter
 * can bind them against the LIVE target skeleton. Unresolved tracks are
 * reported, never rewritten onto a fake bone.
 *
 * PROCEDURAL placeholders are PLACEHOLDER_TEST_CLIP / TEST_ONLY and must
 * never be stamped AUTHORED_CLIP or used to unlock FIGHT.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';
import {
  convertBannonEulerMotionClip,
  isBannonEulerMotionBank,
  pickPreferredMotionBankFiles,
  BANNON_MOTION_BANK_INDEX,
  BANNON_MOTION_BANK_BASE,
  type BannonEulerClipJson,
  type BannonMotionIndex,
} from './BannonEulerMotionAdapter';

// ─────────────────────────────────────────────────────────────────────────────
// Bannon motion bank JSON schema
// ─────────────────────────────────────────────────────────────────────────────

export interface BannonBoneFrame {
  /** Time in seconds */
  t: number;
  /** Quaternion [x, y, z, w] */
  q?: [number, number, number, number];
  /** Euler radians — the real Bannon motion-bank channel when q is absent */
  rx?: number;
  ry?: number;
  rz?: number;
  /** Position [x, y, z] — optional, only for root/Hips */
  p?: [number, number, number];
  /** Scale [x, y, z] — optional */
  s?: [number, number, number];
}

export interface BannonBoneTrack {
  frames: BannonBoneFrame[];
}

export interface BannonClipJson {
  /** Clip name (e.g. "idle", "walk_forward", "attack_1") */
  name: string;
  /** Total duration in seconds */
  duration: number;
  /** Frame rate (typically 30 or 60) */
  frameRate?: number;
  /** Semantic state alias (e.g. "idle", "walk_forward") */
  semanticState?: string;
  /** Per-bone animation data keyed by bone name */
  bones: Record<string, BannonBoneTrack>;
  /** Source file provenance */
  source?: string;
  /** License string */
  license?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bone name alias table (Mixamo → canonical Bannon names)
// Mirrors AnimationRetargeter.BONE_ALIAS_TABLE for standalone use
// ─────────────────────────────────────────────────────────────────────────────

const BONE_NAME_ALIASES: Record<string, string> = {
  // Hips
  mixamorigHips: 'Hips', Hips: 'Hips', hips: 'Hips', hip: 'Hips', Pelvis: 'Hips',
  pelvis: 'Hips', ROOT: 'Hips', Root: 'Hips', root: 'Hips', HipNode: 'Hips',
  CharacterRoot: 'Hips', Skeleton_Root: 'Hips', Armature: 'Hips', armature: 'Hips',
  Bannon_Hips: 'Hips', bannon_hips: 'Hips',
  // Spine
  mixamorigSpine: 'Spine', mixamorigSpine1: 'Spine', Spine: 'Spine', spine: 'Spine',
  Spine1: 'Spine', spine1: 'Spine', Abdomen: 'Spine', abdomen: 'Spine',
  Bip001_Spine: 'Spine', Bip01_Spine: 'Spine', LowerBack: 'Spine', Bannon_Spine: 'Spine',
  // Chest
  mixamorigSpine2: 'Chest', mixamorigChest: 'Chest', Chest: 'Chest', chest: 'Chest',
  Spine2: 'Chest', spine2: 'Chest', Spine3: 'Chest', spine3: 'Chest',
  UpperBack: 'Chest', Torso: 'Chest', torso: 'Chest', Bip001_Spine1: 'Chest',
  Bip001_Spine2: 'Chest', Bannon_Chest: 'Chest',
  // Neck
  mixamorigNeck: 'Neck', mixamorigNeck1: 'Neck', Neck: 'Neck', neck: 'Neck',
  Neck1: 'Neck', Bip001_Neck: 'Neck', Bannon_Neck: 'Neck',
  // Head
  mixamorigHead: 'Head', Head: 'Head', head: 'Head', Bip001_Head: 'Head',
  Skull: 'Head', skull: 'Head', Bannon_Head: 'Head',
  // Left Upper Arm
  mixamorigLeftArm: 'LUpperArm', mixamorigLeftShoulder: 'LUpperArm',
  LUpperArm: 'LUpperArm', LeftUpperArm: 'LUpperArm', LeftArm: 'LUpperArm',
  Left_Arm: 'LUpperArm', L_Arm: 'LUpperArm', Bip001_L_UpperArm: 'LUpperArm',
  LeftShoulder: 'LUpperArm', Bannon_LUpperArm: 'LUpperArm', Arm_L: 'LUpperArm',
  // Left Forearm
  mixamorigLeftForeArm: 'LForeArm', LForeArm: 'LForeArm', LeftForeArm: 'LForeArm',
  LeftForearm: 'LForeArm', Left_ForeArm: 'LForeArm', Bip001_L_Forearm: 'LForeArm',
  Bannon_LForeArm: 'LForeArm', ForeArm_L: 'LForeArm',
  // Left Hand
  mixamorigLeftHand: 'LHand', LHand: 'LHand', LeftHand: 'LHand', Left_Hand: 'LHand',
  Bip001_L_Hand: 'LHand', Bannon_LHand: 'LHand', Hand_L: 'LHand',
  // Right Upper Arm
  mixamorigRightArm: 'RUpperArm', mixamorigRightShoulder: 'RUpperArm',
  RUpperArm: 'RUpperArm', RightUpperArm: 'RUpperArm', RightArm: 'RUpperArm',
  Right_Arm: 'RUpperArm', R_Arm: 'RUpperArm', Bip001_R_UpperArm: 'RUpperArm',
  RightShoulder: 'RUpperArm', Bannon_RUpperArm: 'RUpperArm', Arm_R: 'RUpperArm',
  // Right Forearm
  mixamorigRightForeArm: 'RForeArm', RForeArm: 'RForeArm', RightForeArm: 'RForeArm',
  RightForearm: 'RForeArm', Right_ForeArm: 'RForeArm', Bip001_R_Forearm: 'RForeArm',
  Bannon_RForeArm: 'RForeArm', ForeArm_R: 'RForeArm',
  // Right Hand
  mixamorigRightHand: 'RHand', RHand: 'RHand', RightHand: 'RHand', Right_Hand: 'RHand',
  Bip001_R_Hand: 'RHand', Bannon_RHand: 'RHand', Hand_R: 'RHand',
  // Left Upper Leg
  mixamorigLeftUpLeg: 'LUpperLeg', LUpperLeg: 'LUpperLeg', LeftUpperLeg: 'LUpperLeg',
  LeftLeg: 'LUpperLeg', Left_Leg: 'LUpperLeg', Bip001_L_Thigh: 'LUpperLeg',
  LeftThigh: 'LUpperLeg', Bannon_LUpperLeg: 'LUpperLeg', UpperLeg_L: 'LUpperLeg',
  // Left Lower Leg
  mixamorigLeftLeg: 'LLowerLeg', LLowerLeg: 'LLowerLeg', LeftLowerLeg: 'LLowerLeg',
  LeftCalf: 'LLowerLeg', Left_Calf: 'LLowerLeg', Bip001_L_Calf: 'LLowerLeg',
  Bannon_LLowerLeg: 'LLowerLeg', LowerLeg_L: 'LLowerLeg',
  // Left Foot
  mixamorigLeftFoot: 'LFoot', LFoot: 'LFoot', LeftFoot: 'LFoot', Left_Foot: 'LFoot',
  Bip001_L_Foot: 'LFoot', Bannon_LFoot: 'LFoot', Foot_L: 'LFoot',
  // Right Upper Leg
  mixamorigRightUpLeg: 'RUpperLeg', RUpperLeg: 'RUpperLeg', RightUpperLeg: 'RUpperLeg',
  RightLeg: 'RUpperLeg', Right_Leg: 'RUpperLeg', Bip001_R_Thigh: 'RUpperLeg',
  RightThigh: 'RUpperLeg', Bannon_RUpperLeg: 'RUpperLeg', UpperLeg_R: 'RUpperLeg',
  // Right Lower Leg
  mixamorigRightLeg: 'RLowerLeg', RLowerLeg: 'RLowerLeg', RightLowerLeg: 'RLowerLeg',
  RightCalf: 'RLowerLeg', Right_Calf: 'RLowerLeg', Bip001_R_Calf: 'RLowerLeg',
  Bannon_RLowerLeg: 'RLowerLeg', LowerLeg_R: 'RLowerLeg',
  // Right Foot
  mixamorigRightFoot: 'RFoot', RFoot: 'RFoot', RightFoot: 'RFoot', Right_Foot: 'RFoot',
  Bip001_R_Foot: 'RFoot', Bannon_RFoot: 'RFoot', Foot_R: 'RFoot',
};

/**
 * Normalize a source bone name to its canonical Bannon skeleton name.
 * Returns the canonical name if found, or the original name if not mapped.
 */
export function normalizeToBannonBone(sourceName: string): string {
  return BONE_NAME_ALIASES[sourceName] ?? sourceName;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter result
// ─────────────────────────────────────────────────────────────────────────────

export interface AdapterResult {
  /** Converted AnimationClip */
  clip: THREE.AnimationClip;
  /** Semantic state this clip maps to */
  semanticState: string;
  /** Number of bone tracks successfully converted */
  trackCount: number;
  /** Bone names that were mapped to canonical names */
  mappedBones: string[];
  /** Bone names that could not be mapped */
  unmappedBones: string[];
  /** Source provenance */
  source: string;
  /** License */
  license: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core conversion function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a single BannonClipJson into a Three.js AnimationClip.
 *
 * Each bone's frames are converted to:
 *   - QuaternionKeyframeTrack for rotation (if q present)
 *   - VectorKeyframeTrack for position (if p present, typically only Hips)
 *   - VectorKeyframeTrack for scale (if s present)
 *
 * Track names use canonical Bannon bone names so they resolve against
 * the target skeleton without further retargeting.
 */
export function convertBannonClipJson(
  json: BannonClipJson,
  semanticStateOverride?: string,
): AdapterResult {
  const tracks: THREE.KeyframeTrack[] = [];
  const mappedBones: string[] = [];
  const unmappedBones: string[] = [];

  for (const [sourceBoneName, boneTrack] of Object.entries(json.bones ?? {})) {
    const canonicalName = normalizeToBannonBone(sourceBoneName);
    const wasMapped = canonicalName !== sourceBoneName || BONE_NAME_ALIASES[sourceBoneName] !== undefined;

    if (!boneTrack?.frames?.length) continue;

    // Sort frames by time
    const sortedFrames = [...boneTrack.frames].sort((a, b) => a.t - b.t);

    // Build quaternion track — prefer q, else convert rx/ry/rz Euler
    const hasQuaternion = sortedFrames.some(f => f.q != null);
    const hasEuler = sortedFrames.some(f => f.rx != null || f.ry != null || f.rz != null);
    if (hasQuaternion || hasEuler) {
      const times: number[] = [];
      const values: number[] = [];
      for (const frame of sortedFrames) {
        if (frame.q == null && frame.rx == null && frame.ry == null && frame.rz == null) continue;
        times.push(frame.t);
        if (frame.q != null) {
          values.push(frame.q[0], frame.q[1], frame.q[2], frame.q[3]);
        } else {
          const absMax = Math.max(Math.abs(frame.rx ?? 0), Math.abs(frame.ry ?? 0), Math.abs(frame.rz ?? 0));
          const rx = absMax > Math.PI * 2.5 ? THREE.MathUtils.degToRad(frame.rx ?? 0) : (frame.rx ?? 0);
          const ry = absMax > Math.PI * 2.5 ? THREE.MathUtils.degToRad(frame.ry ?? 0) : (frame.ry ?? 0);
          const rz = absMax > Math.PI * 2.5 ? THREE.MathUtils.degToRad(frame.rz ?? 0) : (frame.rz ?? 0);
          const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
          values.push(q.x, q.y, q.z, q.w);
        }
      }
      if (times.length > 0) {
        tracks.push(
          new THREE.QuaternionKeyframeTrack(
            `${canonicalName}.quaternion`,
            times,
            values,
          )
        );
      }
    }

    // Build position track (typically only Hips/root)
    const hasPosition = sortedFrames.some(f => f.p != null);
    if (hasPosition) {
      const times: number[] = [];
      const values: number[] = [];
      for (const frame of sortedFrames) {
        if (frame.p == null) continue;
        times.push(frame.t);
        values.push(frame.p[0], frame.p[1], frame.p[2]);
      }
      if (times.length > 0) {
        tracks.push(
          new THREE.VectorKeyframeTrack(
            `${canonicalName}.position`,
            times,
            values,
          )
        );
      }
    }

    // Build scale track (rare)
    const hasScale = sortedFrames.some(f => f.s != null);
    if (hasScale) {
      const times: number[] = [];
      const values: number[] = [];
      for (const frame of sortedFrames) {
        if (frame.s == null) continue;
        times.push(frame.t);
        values.push(frame.s[0], frame.s[1], frame.s[2]);
      }
      if (times.length > 0) {
        tracks.push(
          new THREE.VectorKeyframeTrack(
            `${canonicalName}.scale`,
            times,
            values,
          )
        );
      }
    }

    if (tracks.length > 0) {
      if (wasMapped) {
        mappedBones.push(`${sourceBoneName} → ${canonicalName}`);
      } else {
        unmappedBones.push(sourceBoneName);
      }
    }
  }

  const semanticState = semanticStateOverride ?? json.semanticState ?? json.name;
  const clip = new THREE.AnimationClip(json.name, json.duration, tracks);

  // Attach provenance metadata
  (clip as any).userData = {
    semanticState,
    source: json.source ?? 'bannon_motion_bank',
    license: json.license ?? 'unknown',
    provenance: `BannonClipJsonAdapter: ${json.source ?? 'bannon_motion_bank'}`,
    frameRate: json.frameRate ?? 30,
    mappedBones: mappedBones.length,
    unmappedBones: unmappedBones.length,
    clipSourceType: tracks.length > 0 ? 'AUTHORED_CLIP' : 'MISSING_CLIP',
    isProcedural: false,
    sourceFormat: 'BANNON_CLIP_JSON',
  };

  console.log(
    `[BannonClipJsonAdapter] ✅ Converted "${json.name}" → semantic="${semanticState}"\n` +
    `  Duration: ${(json.duration ?? 0).toFixed(3)}s  Tracks: ${tracks.length}  ` +
    `Mapped bones: ${mappedBones.length}  Unmapped: ${unmappedBones.length}\n` +
    (unmappedBones.length > 0 ? `  ⚠️ Unmapped: [${unmappedBones.join(', ')}]` : '')
  );

  return {
    clip,
    semanticState,
    trackCount: tracks.length,
    mappedBones,
    unmappedBones,
    source: json.source ?? 'bannon_motion_bank',
    license: json.license ?? 'unknown',
  };
}

/**
 * Convert an array of BannonClipJson objects into AnimationClips.
 * Returns a map of semanticState → AnimationClip for easy lookup.
 */
export function convertBannonClipBank(
  clips: BannonClipJson[],
): Map<string, THREE.AnimationClip> {
  const result = new Map<string, THREE.AnimationClip>();
  let totalTracks = 0;
  let totalMapped = 0;
  let totalUnmapped = 0;

  for (const json of clips) {
    const adapted = convertBannonClipJson(json);
    if (adapted.trackCount > 0) {
      result.set(adapted.semanticState, adapted.clip);
      totalTracks += adapted.trackCount;
      totalMapped += adapted.mappedBones.length;
      totalUnmapped += adapted.unmappedBones.length;
    } else {
      console.warn(
        `[BannonClipJsonAdapter] ⚠️ Clip "${json.name}" produced 0 tracks — skipped.`
      );
    }
  }

  console.log(
    `[BannonClipJsonAdapter] 📊 Bank conversion complete:\n` +
    `  Input clips:    ${clips.length}\n` +
    `  Output clips:   ${result.size}\n` +
    `  Total tracks:   ${totalTracks}\n` +
    `  Mapped bones:   ${totalMapped}\n` +
    `  Unmapped bones: ${totalUnmapped}\n` +
    `  States:         [${[...result.keys()].join(', ')}]`
  );

  return result;
}

/**
 * Convert either the real Euler motion-bank format (`dur`/`keys`/`rx,ry,rz`)
 * or the quaternion `bones.frames.q` schema. Does not invent tracks.
 */
export function convertAnyBannonClipJson(
  json: unknown,
  clipName: string,
  semanticState?: string,
): AdapterResult {
  if (isBannonEulerMotionBank(json)) {
    const euler = convertBannonEulerMotionClip(json as BannonEulerClipJson, clipName, semanticState);
    return {
      clip: euler.clip,
      semanticState: euler.semanticState,
      trackCount: euler.trackCount,
      mappedBones: euler.sourceBoneNames.map((b) => `${b} → ${normalizeToBannonBone(b)}`),
      unmappedBones: [],
      source: 'BANNON_MOTION_BANK',
      license: (json as BannonEulerClipJson).license ?? 'unknown',
    };
  }

  const rec = json as BannonClipJson;
  if (!rec || typeof rec !== 'object' || !rec.bones) {
    throw new Error('UNSUPPORTED_BANNON_CLIP_FORMAT');
  }
  return convertBannonClipJson({
    ...rec,
    name: rec.name ?? clipName,
    semanticState: semanticState ?? rec.semanticState,
  }, semanticState);
}

export interface MotionBankLoadStats {
  indexSize: number;
  attempted: number;
  converted: number;
  failed: string[];
  unresolvedTrackNames: string[];
  angularTravelRadians: number;
  source: string;
}

let cachedMotionBank: { clips: Map<string, THREE.AnimationClip>; stats: MotionBankLoadStats } | null = null;

export function getCachedBannonMotionBank(): { clips: Map<string, THREE.AnimationClip>; stats: MotionBankLoadStats } | null {
  return cachedMotionBank;
}

// ─────────────────────────────────────────────────────────────────────────────
// Procedural fallback clip generator
// ─────────────────────────────────────────────────────────────────────────────
// When no authored clip exists for a semantic state, generate a minimal
// procedural clip that produces MEASURABLE bone motion.
// This is NOT a replacement for authored animation — it is a diagnostic
// placeholder that makes the integrity gate produce non-zero bone travel
// so the pipeline can be verified end-to-end.
//
// IMPORTANT: These clips are clearly labeled as PROCEDURAL_PLACEHOLDER
// in their userData. They must be replaced with real authored clips.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a minimal procedural idle clip for a given skeleton.
 * Produces a gentle breathing motion on the Spine/Chest bones.
 *
 * DIAGNOSTIC PLACEHOLDER — replace with real authored animation.
 */
export function generateProceduralIdleClip(
  targetBoneNames: string[],
  duration = 2.0,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];

  // Breathing: Spine rocks slightly forward/back
  const spineCanonical = targetBoneNames.find(n =>
    n === 'Spine' || n.toLowerCase().includes('spine')
  );
  if (spineCanonical) {
    // Gentle forward lean oscillation (quaternion around X axis)
    const times = [0, duration * 0.25, duration * 0.5, duration * 0.75, duration];
    const breathAngle = 0.03; // ~1.7 degrees
    const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    const q1 = new THREE.Quaternion().setFromEuler(new THREE.Euler(breathAngle, 0, 0));
    const q2 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    const q3 = new THREE.Quaternion().setFromEuler(new THREE.Euler(-breathAngle * 0.5, 0, 0));
    const q4 = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    const values = [
      q0.x, q0.y, q0.z, q0.w,
      q1.x, q1.y, q1.z, q1.w,
      q2.x, q2.y, q2.z, q2.w,
      q3.x, q3.y, q3.z, q3.w,
      q4.x, q4.y, q4.z, q4.w,
    ];
    tracks.push(new THREE.QuaternionKeyframeTrack(`${spineCanonical}.quaternion`, times, values));
  }

  // Head sway
  const headCanonical = targetBoneNames.find(n =>
    n === 'Head' || n.toLowerCase() === 'head'
  );
  if (headCanonical) {
    const times = [0, duration * 0.33, duration * 0.66, duration];
    const swayAngle = 0.02;
    const qA = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, swayAngle, 0));
    const qB = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -swayAngle, 0));
    const qC = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, swayAngle * 0.5, 0));
    const qD = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, swayAngle, 0));
    const values = [
      qA.x, qA.y, qA.z, qA.w,
      qB.x, qB.y, qB.z, qB.w,
      qC.x, qC.y, qC.z, qC.w,
      qD.x, qD.y, qD.z, qD.w,
    ];
    tracks.push(new THREE.QuaternionKeyframeTrack(`${headCanonical}.quaternion`, times, values));
  }

  const clip = new THREE.AnimationClip('idle_procedural_placeholder', duration, tracks);
  (clip as any).userData = {
    semanticState: 'idle',
    source: 'PROCEDURAL_PLACEHOLDER',
    license: 'N/A',
    provenance: 'BannonClipJsonAdapter: generateProceduralIdleClip — REPLACE WITH AUTHORED ANIMATION',
    clipSourceType: 'PLACEHOLDER_TEST_CLIP',
    isProcedural: true,
  };

  console.warn(
    `[BannonClipJsonAdapter] ⚠️ PROCEDURAL_PLACEHOLDER idle clip generated for bones: ` +
    `[${targetBoneNames.slice(0, 5).join(', ')}${targetBoneNames.length > 5 ? '...' : ''}]\n` +
    `  This is a diagnostic placeholder. Replace with real authored animation.`
  );

  return clip;
}

/**
 * Generate a minimal procedural walk clip.
 * Produces leg/hip oscillation to verify skeleton deformation.
 *
 * DIAGNOSTIC PLACEHOLDER — replace with real authored animation.
 */
export function generateProceduralWalkClip(
  targetBoneNames: string[],
  duration = 0.8,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  const stepAngle = 0.4; // ~23 degrees — visible leg swing

  const boneConfigs: Array<{ canonical: string[]; phase: number; axis: 'x' | 'y' | 'z'; amplitude: number }> = [
    { canonical: ['Hips', 'hips'], phase: 0, axis: 'y', amplitude: 0.02 },
    { canonical: ['LUpperLeg', 'LeftUpperLeg', 'LeftLeg'], phase: 0, axis: 'x', amplitude: stepAngle },
    { canonical: ['RUpperLeg', 'RightUpperLeg', 'RightLeg'], phase: Math.PI, axis: 'x', amplitude: stepAngle },
    { canonical: ['LLowerLeg', 'LeftLowerLeg'], phase: Math.PI * 0.5, axis: 'x', amplitude: stepAngle * 0.5 },
    { canonical: ['RLowerLeg', 'RightLowerLeg'], phase: Math.PI * 1.5, axis: 'x', amplitude: stepAngle * 0.5 },
    { canonical: ['LUpperArm', 'LeftUpperArm', 'LeftArm'], phase: Math.PI, axis: 'x', amplitude: stepAngle * 0.3 },
    { canonical: ['RUpperArm', 'RightUpperArm', 'RightArm'], phase: 0, axis: 'x', amplitude: stepAngle * 0.3 },
  ];

  const STEPS = 8;
  for (const config of boneConfigs) {
    const boneName = targetBoneNames.find(n =>
      config.canonical.some(c => n === c || n.toLowerCase() === c.toLowerCase())
    );
    if (!boneName) continue;

    const times: number[] = [];
    const values: number[] = [];
    for (let i = 0; i <= STEPS; i++) {
      const t = (i / STEPS) * duration;
      const angle = Math.sin((i / STEPS) * Math.PI * 2 + config.phase) * config.amplitude;
      times.push(t);
      const euler = new THREE.Euler(
        config.axis === 'x' ? angle : 0,
        config.axis === 'y' ? angle : 0,
        config.axis === 'z' ? angle : 0,
      );
      const q = new THREE.Quaternion().setFromEuler(euler);
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values));
  }

  const clip = new THREE.AnimationClip('walk_forward_procedural_placeholder', duration, tracks);
  (clip as any).userData = {
    semanticState: 'walk_forward',
    source: 'PROCEDURAL_PLACEHOLDER',
    license: 'N/A',
    provenance: 'BannonClipJsonAdapter: generateProceduralWalkClip — REPLACE WITH AUTHORED ANIMATION',
    clipSourceType: 'PLACEHOLDER_TEST_CLIP',
    isProcedural: true,
  };

  console.warn(
    `[BannonClipJsonAdapter] ⚠️ PROCEDURAL_PLACEHOLDER walk clip generated. ` +
    `Replace with real authored animation.`
  );

  return clip;
}

/**
 * Generate a minimal procedural attack clip.
 * Produces arm/shoulder swing to verify hitbox bone travel.
 *
 * DIAGNOSTIC PLACEHOLDER — replace with real authored animation.
 */
export function generateProceduralAttackClip(
  targetBoneNames: string[],
  semanticState: 'attack_1' | 'attack_2' = 'attack_1',
  duration = 0.5,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];

  // Right arm punch (attack_1) or left arm (attack_2)
  const isRight = semanticState === 'attack_1';
  const armBones = isRight
    ? ['RUpperArm', 'RightUpperArm', 'RightArm', 'Arm_R']
    : ['LUpperArm', 'LeftUpperArm', 'LeftArm', 'Arm_L'];
  const forearmBones = isRight
    ? ['RForeArm', 'RightForeArm', 'ForeArm_R']
    : ['LForeArm', 'LeftForeArm', 'ForeArm_L'];

  const armBone = targetBoneNames.find(n =>
    armBones.some(b => n === b || n.toLowerCase() === b.toLowerCase())
  );
  const forearmBone = targetBoneNames.find(n =>
    forearmBones.some(b => n === b || n.toLowerCase() === b.toLowerCase())
  );

  // Punch motion: wind-up → extend → retract
  const punchTimes = [0, duration * 0.15, duration * 0.45, duration * 0.7, duration];

  if (armBone) {
    const angles = [-0.3, -0.8, -1.2, -0.5, -0.3]; // shoulder forward rotation
    const values: number[] = [];
    for (const angle of angles) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0));
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${armBone}.quaternion`, punchTimes, values));
  }

  if (forearmBone) {
    const angles = [0.2, 0.1, -0.3, 0.1, 0.2]; // elbow extension
    const values: number[] = [];
    for (const angle of angles) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0));
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${forearmBone}.quaternion`, punchTimes, values));
  }

  // Torso rotation into punch
  const spineBone = targetBoneNames.find(n =>
    n === 'Spine' || n === 'Chest' || n.toLowerCase().includes('spine')
  );
  if (spineBone) {
    const yAngles = [0, isRight ? -0.1 : 0.1, isRight ? -0.2 : 0.2, isRight ? -0.05 : 0.05, 0];
    const values: number[] = [];
    for (const angle of yAngles) {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle, 0));
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${spineBone}.quaternion`, punchTimes, values));
  }

  const clipName = semanticState === 'attack_1' ?'attack_1_procedural_placeholder' :'attack_2_procedural_placeholder';

  const clip = new THREE.AnimationClip(clipName, duration, tracks);
  (clip as any).userData = {
    semanticState,
    source: 'PROCEDURAL_PLACEHOLDER',
    license: 'N/A',
    provenance: `BannonClipJsonAdapter: generateProceduralAttackClip(${semanticState}) — REPLACE WITH AUTHORED ANIMATION`,
    clipSourceType: 'PLACEHOLDER_TEST_CLIP',
    isProcedural: true,
  };

  console.warn(
    `[BannonClipJsonAdapter] ⚠️ PROCEDURAL_PLACEHOLDER ${semanticState} clip generated. ` +
    `Replace with real authored animation.`
  );

  return clip;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch procedural fallback generator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a minimal set of procedural placeholder clips for a skeleton.
 * Used when no authored clips are available to verify the pipeline end-to-end.
 *
 * Returns clips for: idle, walk_forward, attack_1, attack_2, block, hit_reaction,
 * knockdown, getup.
 *
 * ALL clips are labeled PROCEDURAL_PLACEHOLDER — replace with authored animation.
 */
export function generateProceduralClipSet(
  targetBoneNames: string[],
): Map<string, THREE.AnimationClip> {
  const clips = new Map<string, THREE.AnimationClip>();

  const idle = generateProceduralIdleClip(targetBoneNames, 2.0);
  clips.set('idle', idle);

  const walk = generateProceduralWalkClip(targetBoneNames, 0.8);
  clips.set('walk_forward', walk);
  // Walk backward = same clip, played in reverse by the state machine
  const walkBack = walk.clone();
  walkBack.name = 'walk_back_procedural_placeholder';
  (walkBack as any).userData = { ...((walk as any).userData), semanticState: 'walk_back' };
  clips.set('walk_back', walkBack);

  const attack1 = generateProceduralAttackClip(targetBoneNames, 'attack_1', 0.5);
  clips.set('attack_1', attack1);

  const attack2 = generateProceduralAttackClip(targetBoneNames, 'attack_2', 0.6);
  clips.set('attack_2', attack2);

  // Block: slight crouch/guard pose
  const blockClip = idle.clone();
  blockClip.name = 'block_procedural_placeholder';
  (blockClip as any).userData = { ...((idle as any).userData), semanticState: 'block' };
  clips.set('block', blockClip);

  // Hit reaction: reuse idle with faster timing
  const hitClip = idle.clone();
  hitClip.name = 'hit_reaction_procedural_placeholder';
  (hitClip as any).userData = { ...((idle as any).userData), semanticState: 'hit_reaction' };
  clips.set('hit_reaction', hitClip);

  // Knockdown: reuse idle
  const knockdownClip = idle.clone();
  knockdownClip.name = 'knockdown_procedural_placeholder';
  (knockdownClip as any).userData = { ...((idle as any).userData), semanticState: 'knockdown' };
  clips.set('knockdown', knockdownClip);

  // Getup: reuse idle
  const getupClip = idle.clone();
  getupClip.name = 'getup_procedural_placeholder';
  (getupClip as any).userData = { ...((idle as any).userData), semanticState: 'getup' };
  clips.set('getup', getupClip);

  console.warn(
    `[BannonClipJsonAdapter] ⚠️ PROCEDURAL_PLACEHOLDER clip set generated for ${targetBoneNames.length} bones.\n` +
    `  States: [${[...clips.keys()].join(', ')}]\n` +
    `  These are diagnostic placeholders. Replace with real authored animation from Bannon motion bank.`
  );

  return clips;
}

// ─────────────────────────────────────────────────────────────────────────────
// Directory-based clip loader (Node.js / server-side)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load all Bannon motion bank JSON files from a directory.
 * Normalizes Mixamo bone names, validates retarget resolution against
 * the canonical skeleton, and returns a map of semanticState → AnimationClip.
 *
 * This function is designed for use in:
 *   1. Node.js CLI (scripts/rig-static-glbs-cli.mjs)
 *   2. Next.js API routes (app/api/glb-deformation-pipeline/route.ts)
 *   3. Build-time asset processing
 *
 * AUTHORED_CLIP verdict: clips loaded from this function are classified as
 * AUTHORED_CLIP (not PROCEDURAL_PLACEHOLDER) because they originate from
 * the Bannon motion bank JSON files.
 *
 * @param clipsDir - Path to assets/moves/clips/ directory
 * @returns Map<semanticState, AnimationClip> with AUTHORED_CLIP userData
 */
export async function loadBannonClipsFromDirectory(
  clipsDir: string,
): Promise<Map<string, THREE.AnimationClip>> {
  const result = new Map<string, THREE.AnimationClip>();

  // Dynamic import to avoid bundling fs in browser builds
  let fs: typeof import('fs');
  let path: typeof import('path');
  try {
    fs = await import('fs');
    path = await import('path');
  } catch {
    console.warn('[BannonClipJsonAdapter] fs/path not available — skipping directory load');
    return result;
  }

  if (!fs.existsSync(clipsDir)) {
    console.warn(`[BannonClipJsonAdapter] Clips directory not found: ${clipsDir}`);
    console.warn(`  Expected: assets/moves/clips/*.json`);
    console.warn(`  Create JSON files matching BannonClipJson schema to enable AUTHORED_CLIP loading`);
    return result;
  }

  let files: string[];
  try {
    files = fs.readdirSync(clipsDir).filter((f: string) => f.endsWith('.json'));
  } catch (e: any) {
    console.error(`[BannonClipJsonAdapter] Failed to read clips directory: ${e.message}`);
    return result;
  }

  console.log(`[BannonClipJsonAdapter] Loading ${files.length} clip JSON files from: ${clipsDir}`);

  let loadedCount = 0;
  let errorCount = 0;
  const retargetReport: Array<{ file: string; semanticState: string; mappedBones: number; unmappedBones: number; verdict: string }> = [];

  for (const file of files) {
    const filePath = path.join(clipsDir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const json: BannonClipJson = JSON.parse(raw);

      // Validate required fields
      if (!json.name || !json.duration || !json.bones) {
        console.warn(`[BannonClipJsonAdapter] ⚠️ Skipping ${file} — missing required fields (name, duration, bones)`);
        errorCount++;
        continue;
      }

      // Convert to AnimationClip with Mixamo bone name normalization
      const adapted = convertBannonClipJson(json);

      // Mark as AUTHORED_CLIP (not procedural)
      (adapted.clip as any).userData = {
        ...(adapted.clip as any).userData,
        clipSourceType: 'AUTHORED_CLIP',
        sourceFile: filePath,
        isProcedural: false,
      };

      // Validate retarget resolution against canonical skeleton
      const canonicalBones = new Set([
        'Hips', 'Spine', 'Chest', 'Neck', 'Head',
        'LUpperArm', 'LForeArm', 'LHand',
        'RUpperArm', 'RForeArm', 'RHand',
        'LUpperLeg', 'LLowerLeg', 'LFoot',
        'RUpperLeg', 'RLowerLeg', 'RFoot',
      ]);

      const resolvedBones = adapted.mappedBones.map(m => m.split(' → ')[1]).filter(Boolean);
      const unresolvedBones = adapted.unmappedBones.filter(b => !canonicalBones.has(b));
      const retargetVerdict = unresolvedBones.length === 0 ? 'FULL_RESOLUTION' :
        resolvedBones.length > 0 ? 'PARTIAL_RESOLUTION' : 'NO_RESOLUTION';

      retargetReport.push({
        file,
        semanticState: adapted.semanticState,
        mappedBones: adapted.mappedBones.length,
        unmappedBones: adapted.unmappedBones.length,
        verdict: retargetVerdict,
      });

      // Only register if we have at least some tracks
      if (adapted.trackCount > 0) {
        // Prefer higher-priority source if state already registered
        if (!result.has(adapted.semanticState)) {
          result.set(adapted.semanticState, adapted.clip);
          loadedCount++;
        } else {
          console.log(`[BannonClipJsonAdapter] ℹ️ Duplicate semantic state "${adapted.semanticState}" in ${file} — keeping first loaded`);
        }
      } else {
        console.warn(`[BannonClipJsonAdapter] ⚠️ ${file} produced 0 tracks — skipped`);
        errorCount++;
      }

    } catch (e: any) {
      console.error(`[BannonClipJsonAdapter] ❌ Failed to load ${file}: ${e.message}`);
      errorCount++;
    }
  }

  // Print retarget resolution report
  console.log(
    `[BannonClipJsonAdapter] 📊 AUTHORED_CLIP load complete:\n` +
    `  Files scanned:   ${files.length}\n` +
    `  Clips loaded:    ${loadedCount}\n` +
    `  Errors:          ${errorCount}\n` +
    `  Semantic states: [${[...result.keys()].join(', ')}]\n` +
    `\n  Retarget resolution report:\n` +
    retargetReport.map(r =>
      `    ${r.file.padEnd(30)} | ${r.semanticState.padEnd(20)} | mapped=${r.mappedBones} unmapped=${r.unmappedBones} | ${r.verdict}`
    ).join('\n')
  );

  return result;
}

/**
 * Load Bannon clips from the standard assets/moves/clips/ directory.
 * Resolves path relative to the project root.
 *
 * Returns AUTHORED_CLIP classified clips ready for AnimationSourceRegistry.
 */
export async function loadBannonMotionBank(
  projectRoot?: string,
): Promise<Map<string, THREE.AnimationClip>> {
  let root = projectRoot;

  if (!root) {
    // Try to resolve project root
    try {
      const { resolve, dirname } = await import('path');
      const { fileURLToPath } = await import('url');
      // In ESM context
      root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
    } catch {
      root = process.cwd?.() ?? '.';
    }
  }

  const { join } = await import('path');
  const clipsDir = join(root, 'assets', 'moves', 'clips');

  console.log(`[BannonClipJsonAdapter] Loading motion bank from: ${clipsDir}`);
  return loadBannonClipsFromDirectory(clipsDir);
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser-side fetch-based clip loader
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load Bannon clips from a list of JSON URLs (browser-compatible).
 * Used when the clips are served as static assets.
 *
 * @param clipUrls - Array of URLs to BannonClipJson files
 * @returns Map<semanticState, AnimationClip> with AUTHORED_CLIP userData
 */
export async function loadBannonClipsFromUrls(
  clipUrls: string[],
): Promise<Map<string, THREE.AnimationClip>> {
  const result = new Map<string, THREE.AnimationClip>();

  console.log(`[BannonClipJsonAdapter] Loading ${clipUrls.length} clips from URLs`);

  const loadResults = await Promise.allSettled(
    clipUrls.map(async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      const json = await res.json();
      return { url, json };
    })
  );

  for (const settled of loadResults) {
    if (settled.status === 'rejected') {
      console.warn(`[BannonClipJsonAdapter] ⚠️ Failed to load clip: ${settled.reason}`);
      continue;
    }

    const { url, json } = settled.value;
    try {
      const name = (json as { name?: string }).name
        ?? decodeURIComponent(url.split('/').pop() ?? 'clip').replace(/\.json$/i, '');
      const adapted = convertAnyBannonClipJson(json, name);

      (adapted.clip as any).userData = {
        ...(adapted.clip as any).userData,
        clipSourceType: adapted.trackCount > 0
          ? ((adapted.clip as any).userData?.clipSourceType ?? 'AUTHORED_CLIP')
          : 'MISSING_CLIP',
        sourceUrl: url,
        isProcedural: false,
      };

      if (adapted.trackCount > 0 && !result.has(adapted.semanticState)) {
        result.set(adapted.semanticState, adapted.clip);
      }
    } catch (e: any) {
      console.error(`[BannonClipJsonAdapter] ❌ Failed to convert clip from ${url}: ${e.message}`);
    }
  }

  console.log(`[BannonClipJsonAdapter] ✅ Loaded ${result.size} AUTHORED_CLIP clips from URLs`);
  return result;
}

/**
 * Load the real Bannon motion bank from GitHub (rx/ry/rz Euler keys).
 * Falls back to a local /assets/moves/clips/manifest.json if present.
 *
 * Never stamps PLACEHOLDER_TEST_CLIP as AUTHORED_CLIP.
 */
export async function loadBannonClipsFromPublic(): Promise<Map<string, THREE.AnimationClip>> {
  if (cachedMotionBank) {
    return cachedMotionBank.clips;
  }

  const stats: MotionBankLoadStats = {
    indexSize: 0,
    attempted: 0,
    converted: 0,
    failed: [],
    unresolvedTrackNames: [],
    angularTravelRadians: 0,
    source: BANNON_MOTION_BANK_INDEX,
  };

  try {
    const indexRes = await fetch(BANNON_MOTION_BANK_INDEX);
    if (!indexRes.ok) throw new Error(`Bannon motion index HTTP ${indexRes.status}`);
    const index = await indexRes.json() as BannonMotionIndex;
    stats.indexSize = Object.keys(index).length;

    const preferred = pickPreferredMotionBankFiles(index);
    stats.attempted = preferred.length;
    const clips = new Map<string, THREE.AnimationClip>();

    const loaded = await Promise.allSettled(
      preferred.map(async ({ key, file, semanticState }) => {
        const url = `${BANNON_MOTION_BANK_BASE}${encodeURIComponent(file)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${key} HTTP ${res.status}`);
        const json = await res.json();
        const adapted = convertAnyBannonClipJson(json, key, semanticState);
        if (adapted.trackCount === 0) throw new Error(`${key} NO_TRACKS`);
        (adapted.clip as any).userData = {
          ...(adapted.clip as any).userData,
          clipSourceType: (adapted.clip as any).userData?.clipSourceType ?? 'RETARGETED_AUTHORED_CLIP',
          sourceUrl: url,
          sourceFile: file,
          isProcedural: false,
          semanticState,
        };
        return { key, semanticState, adapted };
      }),
    );

    for (const settled of loaded) {
      if (settled.status === 'rejected') {
        stats.failed.push(String(settled.reason));
        console.warn(`[BannonClipJsonAdapter] ⚠️ Motion-bank clip failed:`, settled.reason);
        continue;
      }
      const { semanticState, adapted } = settled.value;
      if (!clips.has(semanticState)) {
        clips.set(semanticState, adapted.clip);
        stats.converted++;
        const travel = Number((adapted.clip as any).userData?.angularTravelRadians ?? 0);
        stats.angularTravelRadians += travel;
      }
    }

    cachedMotionBank = { clips, stats };
    console.log(
      `[BannonClipJsonAdapter] 📊 Bannon Euler motion bank:\n` +
      `  Index size:     ${stats.indexSize}\n` +
      `  Attempted:      ${stats.attempted}\n` +
      `  Converted:      ${stats.converted}\n` +
      `  Failed:         ${stats.failed.length}\n` +
      `  States:         [${[...clips.keys()].join(', ')}]\n` +
      `  Angular travel: ${stats.angularTravelRadians.toFixed(3)} rad`,
    );
    return clips;
  } catch (error: any) {
    console.warn(`[BannonClipJsonAdapter] GitHub motion bank failed (${error.message}). Trying local public/ assets.`);
  }

  const MANIFEST_URL = '/assets/moves/clips/manifest.json';
  try {
    const res = await fetch(MANIFEST_URL);
    if (res.ok) {
      const manifest = await res.json();
      const clipUrls = (manifest.clips ?? []).map((f: string) =>
        f.startsWith('/') || f.startsWith('http') ? f : `/assets/moves/clips/${f}`
      );
      const local = await loadBannonClipsFromUrls(clipUrls);
      cachedMotionBank = { clips: local, stats: { ...stats, converted: local.size, source: MANIFEST_URL } };
      return local;
    }
  } catch {
    // local manifest absent
  }

  console.warn(`[BannonClipJsonAdapter] No authored Bannon motion-bank clips loaded.`);
  cachedMotionBank = { clips: new Map(), stats };
  return cachedMotionBank.clips;
}
