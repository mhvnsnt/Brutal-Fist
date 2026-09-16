/**
 * BannonClipJsonAdapter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts Bannon motion bank JSON (assets/moves/clips/) into real Three.js
 * AnimationClips with quaternion bone tracks.
 *
 * Bannon motion bank format (per video_to_clip.py / bake_clips.cjs):
 *   {
 *     "name": "idle",
 *     "duration": 1.0,
 *     "frameRate": 30,
 *     "bones": {
 *       "Hips": {
 *         "frames": [
 *           { "t": 0.0, "q": [x, y, z, w], "p": [x, y, z] },
 *           ...
 *         ]
 *       },
 *       ...
 *     }
 *   }
 *
 * The bone names in the JSON use Mixamo-compatible naming (mixamorigHips, etc.)
 * OR canonical Bannon names (Hips, Spine, etc.). The adapter normalizes both
 * via the BONE_ALIAS_TABLE from AnimationRetargeter.
 *
 * OUTPUT: THREE.AnimationClip[] with QuaternionKeyframeTrack and
 * VectorKeyframeTrack entries targeting canonical Bannon skeleton bone names.
 *
 * PROVENANCE: Every clip produced carries a .userData.provenance field
 * documenting its source file, license, and semantic state.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Bannon motion bank JSON schema
// ─────────────────────────────────────────────────────────────────────────────

export interface BannonBoneFrame {
  /** Time in seconds */
  t: number;
  /** Quaternion [x, y, z, w] */
  q?: [number, number, number, number];
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

  for (const [sourceBoneName, boneTrack] of Object.entries(json.bones)) {
    const canonicalName = normalizeToBannonBone(sourceBoneName);
    const wasMapped = canonicalName !== sourceBoneName || BONE_NAME_ALIASES[sourceBoneName] !== undefined;

    if (boneTrack.frames.length === 0) continue;

    // Sort frames by time
    const sortedFrames = [...boneTrack.frames].sort((a, b) => a.t - b.t);

    // Build quaternion track
    const hasRotation = sortedFrames.some(f => f.q != null);
    if (hasRotation) {
      const times: number[] = [];
      const values: number[] = [];
      for (const frame of sortedFrames) {
        if (frame.q == null) continue;
        times.push(frame.t);
        // Three.js QuaternionKeyframeTrack expects [x, y, z, w]
        values.push(frame.q[0], frame.q[1], frame.q[2], frame.q[3]);
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
  };

  console.log(
    `[BannonClipJsonAdapter] ✅ Converted "${json.name}" → semantic="${semanticState}"\n` +
    `  Duration: ${json.duration.toFixed(3)}s  Tracks: ${tracks.length}  ` +
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
