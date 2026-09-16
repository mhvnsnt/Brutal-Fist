/**
 * AnimationRetargeter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic animation retargeter that maps source animation bone names
 * (Mixamo, mocap, FBX, BVH conventions) to canonical Bannon skeleton bones
 * via name-based resolution — NOT UUID binding.
 *
 * CANONICAL BONE SET (Bannon skeleton):
 *   Hips, Spine, Chest, Neck, Head,
 *   LUpperArm, LForeArm, LHand,
 *   RUpperArm, RForeArm, RHand,
 *   LUpperLeg, LLowerLeg, LFoot,
 *   RUpperLeg, RLowerLeg, RFoot
 *
 * ALIAS SOURCES SUPPORTED:
 *   • Mixamo (mixamorigHips, mixamorigSpine, etc.)
 *   • Bannon canonical names
 *   • Common FBX conventions (Bip001_Pelvis, Bip01_Spine, etc.)
 *   • BVH conventions (hip, abdomen, chest, etc.)
 *   • Bannon mocap naming (from tools/mocap/)
 *   • Schwarzerblitz naming conventions
 *
 * IDENTITY: SOURCE BONE NAME → canonical semantic name → TARGET SKELETON BONE
 * UUIDs are NEVER used as cross-file identity — names are stable, UUIDs change
 * every time a scene is cloned.
 *
 * Every mapping is measurable and reported:
 *   source bone | canonical bone | target bone | resolved/unresolved
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Canonical bone names (Bannon skeleton)
// ─────────────────────────────────────────────────────────────────────────────

export type CanonicalBone =
  | 'Hips' |'Spine' |'Chest' |'Neck' |'Head' |'LUpperArm' |'LForeArm' |'LHand' |'RUpperArm' |'RForeArm' |'RHand' |'LUpperLeg' |'LLowerLeg' |'LFoot' |'RUpperLeg' |'RLowerLeg' |'RFoot';

export const CANONICAL_BONES: CanonicalBone[] = [
  'Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'LUpperArm', 'LForeArm', 'LHand',
  'RUpperArm', 'RForeArm', 'RHand',
  'LUpperLeg', 'LLowerLeg', 'LFoot',
  'RUpperLeg', 'RLowerLeg', 'RFoot',
];

// ─────────────────────────────────────────────────────────────────────────────
// Alias table: source bone name → canonical bone
// Covers Mixamo, FBX, BVH, Bannon mocap, Schwarzerblitz conventions
// ─────────────────────────────────────────────────────────────────────────────

const BONE_ALIAS_TABLE: Record<string, CanonicalBone> = {
  // ── Hips ──────────────────────────────────────────────────────────────────
  'Hips':                   'Hips',
  'hips':                   'Hips',
  'Hip':                    'Hips',
  'hip':                    'Hips',
  'Pelvis':                 'Hips',
  'pelvis':                 'Hips',
  'mixamorigHips':          'Hips',
  'Bip001_Pelvis':          'Hips',
  'Bip01_Pelvis':           'Hips',
  'Bip001 Pelvis':          'Hips',
  'Bip01 Pelvis':           'Hips',
  'ROOT':                   'Hips',
  'Root':                   'Hips',
  'root':                   'Hips',
  'HipNode':                'Hips',
  'CharacterRoot':          'Hips',
  'Skeleton_Root':          'Hips',
  'Armature':               'Hips',
  'armature':               'Hips',
  'Bannon_Hips':            'Hips',
  'bannon_hips':            'Hips',

  // ── Spine ─────────────────────────────────────────────────────────────────
  'Spine':                  'Spine',
  'spine':                  'Spine',
  'Spine1':                 'Spine',
  'spine1':                 'Spine',
  'Abdomen':                'Spine',
  'abdomen':                'Spine',
  'mixamorigSpine':         'Spine',
  'mixamorigSpine1':        'Spine',
  'Bip001_Spine':           'Spine',
  'Bip01_Spine':            'Spine',
  'Bip001 Spine':           'Spine',
  'Bip01 Spine':            'Spine',
  'LowerBack':              'Spine',
  'lowerback':              'Spine',
  'Bannon_Spine':           'Spine',

  // ── Chest ─────────────────────────────────────────────────────────────────
  'Chest':                  'Chest',
  'chest':                  'Chest',
  'Spine2':                 'Chest',
  'spine2':                 'Chest',
  'Spine3':                 'Chest',
  'spine3':                 'Chest',
  'UpperBack':              'Chest',
  'upperback':              'Chest',
  'Torso':                  'Chest',
  'torso':                  'Chest',
  'mixamorigSpine2':        'Chest',
  'mixamorigChest':         'Chest',
  'Bip001_Spine1':          'Chest',
  'Bip01_Spine1':           'Chest',
  'Bip001 Spine1':          'Chest',
  'Bip01 Spine1':           'Chest',
  'Bip001_Spine2':          'Chest',
  'Bip01_Spine2':           'Chest',
  'Bannon_Chest':           'Chest',

  // ── Neck ──────────────────────────────────────────────────────────────────
  'Neck':                   'Neck',
  'neck':                   'Neck',
  'Neck1':                  'Neck',
  'neck1':                  'Neck',
  'mixamorigNeck':          'Neck',
  'mixamorigNeck1':         'Neck',
  'Bip001_Neck':            'Neck',
  'Bip01_Neck':             'Neck',
  'Bip001 Neck':            'Neck',
  'Bip01 Neck':             'Neck',
  'Bannon_Neck':            'Neck',

  // ── Head ──────────────────────────────────────────────────────────────────
  'Head':                   'Head',
  'head':                   'Head',
  'Head1':                  'Head',
  'mixamorigHead':          'Head',
  'Bip001_Head':            'Head',
  'Bip01_Head':             'Head',
  'Bip001 Head':            'Head',
  'Bip01 Head':             'Head',
  'Skull':                  'Head',
  'skull':                  'Head',
  'Bannon_Head':            'Head',

  // ── Left Upper Arm ────────────────────────────────────────────────────────
  'LUpperArm':              'LUpperArm',
  'LeftUpperArm':           'LUpperArm',
  'leftUpperArm':           'LUpperArm',
  'LeftArm':                'LUpperArm',
  'leftArm':                'LUpperArm',
  'Left_Arm':               'LUpperArm',
  'L_Arm':                  'LUpperArm',
  'mixamorigLeftArm':       'LUpperArm',
  'Bip001_L_UpperArm':      'LUpperArm',
  'Bip01_L_UpperArm':       'LUpperArm',
  'Bip001 L UpperArm':      'LUpperArm',
  'Bip01 L UpperArm':       'LUpperArm',
  'LeftShoulder':           'LUpperArm',
  'leftShoulder':           'LUpperArm',
  'mixamorigLeftShoulder':  'LUpperArm',
  'Bannon_LUpperArm':       'LUpperArm',
  'Arm_L':                  'LUpperArm',
  'arm_l':                  'LUpperArm',

  // ── Left Forearm ──────────────────────────────────────────────────────────
  'LForeArm':               'LForeArm',
  'LeftForeArm':            'LForeArm',
  'leftForeArm':            'LForeArm',
  'LeftForearm':            'LForeArm',
  'Left_ForeArm':           'LForeArm',
  'L_ForeArm':              'LForeArm',
  'mixamorigLeftForeArm':   'LForeArm',
  'Bip001_L_Forearm':       'LForeArm',
  'Bip01_L_Forearm':        'LForeArm',
  'Bip001 L Forearm':       'LForeArm',
  'Bip01 L Forearm':        'LForeArm',
  'Bannon_LForeArm':        'LForeArm',
  'ForeArm_L':              'LForeArm',
  'forearm_l':              'LForeArm',

  // ── Left Hand ─────────────────────────────────────────────────────────────
  'LHand':                  'LHand',
  'LeftHand':               'LHand',
  'leftHand':               'LHand',
  'Left_Hand':              'LHand',
  'L_Hand':                 'LHand',
  'mixamorigLeftHand':      'LHand',
  'Bip001_L_Hand':          'LHand',
  'Bip01_L_Hand':           'LHand',
  'Bip001 L Hand':          'LHand',
  'Bip01 L Hand':           'LHand',
  'Bannon_LHand':           'LHand',
  'Hand_L':                 'LHand',
  'hand_l':                 'LHand',

  // ── Right Upper Arm ───────────────────────────────────────────────────────
  'RUpperArm':              'RUpperArm',
  'RightUpperArm':          'RUpperArm',
  'rightUpperArm':          'RUpperArm',
  'RightArm':               'RUpperArm',
  'rightArm':               'RUpperArm',
  'Right_Arm':              'RUpperArm',
  'R_Arm':                  'RUpperArm',
  'mixamorigRightArm':      'RUpperArm',
  'Bip001_R_UpperArm':      'RUpperArm',
  'Bip01_R_UpperArm':       'RUpperArm',
  'Bip001 R UpperArm':      'RUpperArm',
  'Bip01 R UpperArm':       'RUpperArm',
  'RightShoulder':          'RUpperArm',
  'rightShoulder':          'RUpperArm',
  'mixamorigRightShoulder': 'RUpperArm',
  'Bannon_RUpperArm':       'RUpperArm',
  'Arm_R':                  'RUpperArm',
  'arm_r':                  'RUpperArm',

  // ── Right Forearm ─────────────────────────────────────────────────────────
  'RForeArm':               'RForeArm',
  'RightForeArm':           'RForeArm',
  'rightForeArm':           'RForeArm',
  'RightForearm':           'RForeArm',
  'Right_ForeArm':          'RForeArm',
  'R_ForeArm':              'RForeArm',
  'mixamorigRightForeArm':  'RForeArm',
  'Bip001_R_Forearm':       'RForeArm',
  'Bip01_R_Forearm':        'RForeArm',
  'Bip001 R Forearm':       'RForeArm',
  'Bip01 R Forearm':        'RForeArm',
  'Bannon_RForeArm':        'RForeArm',
  'ForeArm_R':              'RForeArm',
  'forearm_r':              'RForeArm',

  // ── Right Hand ────────────────────────────────────────────────────────────
  'RHand':                  'RHand',
  'RightHand':              'RHand',
  'rightHand':              'RHand',
  'Right_Hand':             'RHand',
  'R_Hand':                 'RHand',
  'mixamorigRightHand':     'RHand',
  'Bip001_R_Hand':          'RHand',
  'Bip01_R_Hand':           'RHand',
  'Bip001 R Hand':          'RHand',
  'Bip01 R Hand':           'RHand',
  'Bannon_RHand':           'RHand',
  'Hand_R':                 'RHand',
  'hand_r':                 'RHand',

  // ── Left Upper Leg ────────────────────────────────────────────────────────
  'LUpperLeg':              'LUpperLeg',
  'LeftUpperLeg':           'LUpperLeg',
  'leftUpperLeg':           'LUpperLeg',
  'LeftLeg':                'LUpperLeg',
  'leftLeg':                'LUpperLeg',
  'Left_Leg':               'LUpperLeg',
  'L_Leg':                  'LUpperLeg',
  'LeftUpLeg':              'LUpperLeg',
  'leftUpLeg':              'LUpperLeg',
  'mixamorigLeftUpLeg':     'LUpperLeg',
  'Bip001_L_Thigh':         'LUpperLeg',
  'Bip01_L_Thigh':          'LUpperLeg',
  'Bip001 L Thigh':         'LUpperLeg',
  'Bip01 L Thigh':          'LUpperLeg',
  'LeftThigh':              'LUpperLeg',
  'leftThigh':              'LUpperLeg',
  'Bannon_LUpperLeg':       'LUpperLeg',
  'UpLeg_L':                'LUpperLeg',
  'uplleg_l':               'LUpperLeg',

  // ── Left Lower Leg ────────────────────────────────────────────────────────
  'LLowerLeg':              'LLowerLeg',
  'LeftLowerLeg':           'LLowerLeg',
  'leftLowerLeg':           'LLowerLeg',
  'LeftShin':               'LLowerLeg',
  'leftShin':               'LLowerLeg',
  'Left_Shin':              'LLowerLeg',
  'mixamorigLeftLeg':       'LLowerLeg',
  'Bip001_L_Calf':          'LLowerLeg',
  'Bip01_L_Calf':           'LLowerLeg',
  'Bip001 L Calf':          'LLowerLeg',
  'Bip01 L Calf':           'LLowerLeg',
  'LeftCalf':               'LLowerLeg',
  'leftCalf':               'LLowerLeg',
  'Bannon_LLowerLeg':       'LLowerLeg',
  'Leg_L':                  'LLowerLeg',
  'leg_l':                  'LLowerLeg',

  // ── Left Foot ─────────────────────────────────────────────────────────────
  'LFoot':                  'LFoot',
  'LeftFoot':               'LFoot',
  'leftFoot':               'LFoot',
  'Left_Foot':              'LFoot',
  'L_Foot':                 'LFoot',
  'mixamorigLeftFoot':      'LFoot',
  'Bip001_L_Foot':          'LFoot',
  'Bip01_L_Foot':           'LFoot',
  'Bip001 L Foot':          'LFoot',
  'Bip01 L Foot':           'LFoot',
  'Bannon_LFoot':           'LFoot',
  'Foot_L':                 'LFoot',
  'foot_l':                 'LFoot',

  // ── Right Upper Leg ───────────────────────────────────────────────────────
  'RUpperLeg':              'RUpperLeg',
  'RightUpperLeg':          'RUpperLeg',
  'rightUpperLeg':          'RUpperLeg',
  'RightLeg':               'RUpperLeg',
  'rightLeg':               'RUpperLeg',
  'Right_Leg':              'RUpperLeg',
  'R_Leg':                  'RUpperLeg',
  'RightUpLeg':             'RUpperLeg',
  'rightUpLeg':             'RUpperLeg',
  'mixamorigRightUpLeg':    'RUpperLeg',
  'Bip001_R_Thigh':         'RUpperLeg',
  'Bip01_R_Thigh':          'RUpperLeg',
  'Bip001 R Thigh':         'RUpperLeg',
  'Bip01 R Thigh':          'RUpperLeg',
  'RightThigh':             'RUpperLeg',
  'rightThigh':             'RUpperLeg',
  'Bannon_RUpperLeg':       'RUpperLeg',
  'UpLeg_R':                'RUpperLeg',
  'upleg_r':                'RUpperLeg',

  // ── Right Lower Leg ───────────────────────────────────────────────────────
  'RLowerLeg':              'RLowerLeg',
  'RightLowerLeg':          'RLowerLeg',
  'rightLowerLeg':          'RLowerLeg',
  'RightShin':              'RLowerLeg',
  'rightShin':              'RLowerLeg',
  'Right_Shin':             'RLowerLeg',
  'mixamorigRightLeg':      'RLowerLeg',
  'Bip001_R_Calf':          'RLowerLeg',
  'Bip01_R_Calf':           'RLowerLeg',
  'Bip001 R Calf':          'RLowerLeg',
  'Bip01 R Calf':           'RLowerLeg',
  'RightCalf':              'RLowerLeg',
  'rightCalf':              'RLowerLeg',
  'Bannon_RLowerLeg':       'RLowerLeg',
  'Leg_R':                  'RLowerLeg',
  'leg_r':                  'RLowerLeg',

  // ── Right Foot ────────────────────────────────────────────────────────────
  'RFoot':                  'RFoot',
  'RightFoot':              'RFoot',
  'rightFoot':              'RFoot',
  'Right_Foot':             'RFoot',
  'R_Foot':                 'RFoot',
  'mixamorigRightFoot':     'RFoot',
  'Bip001_R_Foot':          'RFoot',
  'Bip01_R_Foot':           'RFoot',
  'Bip001 R Foot':          'RFoot',
  'Bip01 R Foot':           'RFoot',
  'Bannon_RFoot':           'RFoot',
  'Foot_R':                 'RFoot',
  'foot_r':                 'RFoot',
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BoneMappingEntry {
  sourceBone: string;
  canonicalBone: CanonicalBone | null;
  targetBone: string | null;
  resolved: boolean;
}

export interface RetargetReport {
  sourceName: string;
  targetName: string;
  totalSourceBones: number;
  totalTargetBones: number;
  mappedBones: number;
  unmappedSourceBones: string[];
  missingRequiredTargetBones: CanonicalBone[];
  entries: BoneMappingEntry[];
  resolvedTrackCount: number;
  unresolvedTrackCount: number;
  verdict: 'PASS' | 'PARTIAL' | 'FAIL';
}

export interface RetargetedClipResult {
  clip: THREE.AnimationClip;
  resolvedTracks: number;
  unresolvedTracks: number;
  unresolvedTrackNames: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// AnimationRetargeter
// ─────────────────────────────────────────────────────────────────────────────

export class AnimationRetargeter {
  private readonly sourceName: string;
  private readonly targetName: string;

  /** source bone name → canonical bone */
  private readonly sourceToCanonical = new Map<string, CanonicalBone>();
  /** canonical bone → target bone name */
  private readonly canonicalToTarget = new Map<CanonicalBone, string>();
  /** source bone name → target bone name (resolved shortcut) */
  private readonly sourceToTarget = new Map<string, string>();

  constructor(sourceName: string, targetName: string) {
    this.sourceName = sourceName;
    this.targetName = targetName;
  }

  /**
   * Build the retarget map from source skeleton → target skeleton.
   * Uses canonical bone names as the stable intermediate identity.
   * NEVER uses UUIDs.
   *
   * @param sourceRoot  Root of the source skeleton (animation source)
   * @param targetRoot  Root of the target skeleton (the visible clone)
   * @returns RetargetReport with full mapping details
   */
  buildMap(sourceRoot: THREE.Object3D, targetRoot: THREE.Object3D): RetargetReport {
    this.sourceToCanonical.clear();
    this.canonicalToTarget.clear();
    this.sourceToTarget.clear();

    // Index source bones
    const sourceBoneNames: string[] = [];
    sourceRoot.traverse((child) => {
      if ((child as THREE.Bone).isBone && child.name) {
        sourceBoneNames.push(child.name);
      }
    });

    // Index target bones
    const targetBoneNames: string[] = [];
    targetRoot.traverse((child) => {
      if ((child as THREE.Bone).isBone && child.name) {
        targetBoneNames.push(child.name);
      }
    });

    // Map source bones → canonical
    for (const srcName of sourceBoneNames) {
      const canonical = this._resolveToCanonical(srcName);
      if (canonical) {
        this.sourceToCanonical.set(srcName, canonical);
      }
    }

    // Map canonical → target bones
    for (const tgtName of targetBoneNames) {
      const canonical = this._resolveToCanonical(tgtName);
      if (canonical && !this.canonicalToTarget.has(canonical)) {
        this.canonicalToTarget.set(canonical, tgtName);
      }
    }

    // Build direct source → target shortcut
    const unmappedSourceBones: string[] = [];
    for (const srcName of sourceBoneNames) {
      const canonical = this.sourceToCanonical.get(srcName);
      if (canonical) {
        const tgtName = this.canonicalToTarget.get(canonical);
        if (tgtName) {
          this.sourceToTarget.set(srcName, tgtName);
        } else {
          unmappedSourceBones.push(srcName);
        }
      } else {
        unmappedSourceBones.push(srcName);
      }
    }

    // Check required target bones
    const missingRequiredTargetBones: CanonicalBone[] = [];
    for (const canonical of CANONICAL_BONES) {
      if (!this.canonicalToTarget.has(canonical)) {
        missingRequiredTargetBones.push(canonical);
      }
    }

    // Build entries for report
    const entries: BoneMappingEntry[] = sourceBoneNames.map((srcName) => {
      const canonical = this.sourceToCanonical.get(srcName) ?? null;
      const targetBone = canonical ? (this.canonicalToTarget.get(canonical) ?? null) : null;
      return {
        sourceBone: srcName,
        canonicalBone: canonical,
        targetBone,
        resolved: targetBone !== null,
      };
    });

    const mappedBones = entries.filter((e) => e.resolved).length;
    const verdict =
      mappedBones === 0 ? 'FAIL' :
      missingRequiredTargetBones.length > 0 ? 'PARTIAL': 'PASS';

    const report: RetargetReport = {
      sourceName: this.sourceName,
      targetName: this.targetName,
      totalSourceBones: sourceBoneNames.length,
      totalTargetBones: targetBoneNames.length,
      mappedBones,
      unmappedSourceBones,
      missingRequiredTargetBones,
      entries,
      resolvedTrackCount: 0,
      unresolvedTrackCount: 0,
      verdict,
    };

    this._logReport(report);
    return report;
  }

  /**
   * Retarget an AnimationClip from source skeleton naming to target skeleton naming.
   * Rewrites track names: source bone name → target bone name.
   * Tracks that cannot be resolved are dropped and reported.
   *
   * @param clip  Source AnimationClip
   * @returns RetargetedClipResult with the new clip and resolution counts
   */
  retargetClip(clip: THREE.AnimationClip): RetargetedClipResult {
    const retargetedTracks: THREE.KeyframeTrack[] = [];
    let resolvedTracks = 0;
    let unresolvedTracks = 0;
    const unresolvedTrackNames: string[] = [];

    for (const track of clip.tracks) {
      // Parse track name: "<boneName>.<property>" or "Armature|<boneName>.<property>"
      const rawName = track.name;
      const dotIdx = rawName.lastIndexOf('.');
      const withoutProp = dotIdx !== -1 ? rawName.slice(0, dotIdx) : rawName;
      const property = dotIdx !== -1 ? rawName.slice(dotIdx + 1) : '';
      const pipeIdx = withoutProp.lastIndexOf('|');
      const sourceBoneName = pipeIdx !== -1 ? withoutProp.slice(pipeIdx + 1) : withoutProp;

      const targetBoneName = this.sourceToTarget.get(sourceBoneName);

      if (targetBoneName && property) {
        // Rewrite track name to use target bone name
        const newTrackName = `${targetBoneName}.${property}`;
        const RetargetedTrack = track.constructor as unknown as new (...args: unknown[]) => THREE.KeyframeTrack;
        retargetedTracks.push(
          new RetargetedTrack(newTrackName, track.times, track.values, track.getInterpolation())
        );
        resolvedTracks++;
      } else {
        unresolvedTracks++;
        unresolvedTrackNames.push(`${clip.name}::${sourceBoneName}`);
      }
    }

    const retargetedClip = new THREE.AnimationClip(
      clip.name,
      clip.duration,
      retargetedTracks
    );

    return { clip: retargetedClip, resolvedTracks, unresolvedTracks, unresolvedTrackNames };
  }

  /**
   * Retarget an array of AnimationClips and log full instrumentation.
   * Returns retargeted clips with per-clip and aggregate resolution counts.
   */
  retargetClips(
    clips: THREE.AnimationClip[],
    label = ''
  ): { clips: THREE.AnimationClip[]; totalResolved: number; totalUnresolved: number } {
    const retargetedClips: THREE.AnimationClip[] = [];
    let totalResolved = 0;
    let totalUnresolved = 0;

    console.log(`\n[AnimationRetargeter] ── Retargeting ${clips.length} clip(s) ${label ? `[${label}]` : ''}`);

    for (const clip of clips) {
      const result = this.retargetClip(clip);
      retargetedClips.push(result.clip);
      totalResolved += result.resolvedTracks;
      totalUnresolved += result.unresolvedTracks;

      if (result.unresolvedTracks > 0) {
        console.warn(
          `[AnimationRetargeter] ⚠️  Clip "${clip.name}": ` +
          `${result.resolvedTracks} resolved / ${result.unresolvedTracks} unresolved tracks`
        );
        result.unresolvedTrackNames.slice(0, 5).forEach((n) =>
          console.warn(`  • UNRESOLVED: ${n}`)
        );
      } else {
        console.log(
          `[AnimationRetargeter] ✅ Clip "${clip.name}": ` +
          `${result.resolvedTracks}/${clip.tracks.length} tracks resolved`
        );
      }
    }

    console.log(
      `[AnimationRetargeter] ── Summary: ${totalResolved} resolved / ${totalUnresolved} unresolved ` +
      `across ${clips.length} clip(s)`
    );

    return { clips: retargetedClips, totalResolved, totalUnresolved };
  }

  /**
   * Resolve a bone name to its canonical form using the alias table.
   * Falls back to normalized comparison if exact match not found.
   */
  private _resolveToCanonical(boneName: string): CanonicalBone | null {
    // 1. Exact match in alias table
    if (BONE_ALIAS_TABLE[boneName]) return BONE_ALIAS_TABLE[boneName];

    // 2. Case-insensitive match
    const lower = boneName.toLowerCase();
    for (const [alias, canonical] of Object.entries(BONE_ALIAS_TABLE)) {
      if (alias.toLowerCase() === lower) return canonical;
    }

    // 3. Normalized match (strip mixamorig prefix, non-alphanumeric chars)
    const normalized = boneName
      .toLowerCase()
      .replace(/mixamorig[:._-]?/g, '')
      .replace(/[^a-z0-9]/g, '');

    for (const [alias, canonical] of Object.entries(BONE_ALIAS_TABLE)) {
      const aliasNorm = alias
        .toLowerCase()
        .replace(/mixamorig[:._-]?/g, '')
        .replace(/[^a-z0-9]/g, '');
      if (aliasNorm === normalized) return canonical;
    }

    return null;
  }

  private _logReport(report: RetargetReport): void {
    const line = '─'.repeat(60);
    console.log(`\n${line}`);
    console.log(`ANIMATION RETARGET MAP — ${report.sourceName} → ${report.targetName}`);
    console.log(line);
    console.log(`  Source bones:   ${report.totalSourceBones}`);
    console.log(`  Target bones:   ${report.totalTargetBones}`);
    console.log(`  Mapped:         ${report.mappedBones}`);
    console.log(`  Unmapped src:   ${report.unmappedSourceBones.length}`);
    console.log(`  Missing req:    ${report.missingRequiredTargetBones.length}`);
    console.log(`  Verdict:        ${report.verdict}`);

    if (report.unmappedSourceBones.length > 0) {
      console.warn(
        `[AnimationRetargeter] ⚠️  Unmapped source bones (${report.unmappedSourceBones.length}): ` +
        report.unmappedSourceBones.slice(0, 10).join(', ') +
        (report.unmappedSourceBones.length > 10 ? ` +${report.unmappedSourceBones.length - 10} more` : '')
      );
    }

    if (report.missingRequiredTargetBones.length > 0) {
      console.warn(
        `[AnimationRetargeter] ⚠️  Missing required target bones: ` +
        report.missingRequiredTargetBones.join(', ')
      );
    }

    // Log full mapping table at debug level
    for (const entry of report.entries) {
      const status = entry.resolved ? '✅' : '❌';
      const canonical = entry.canonicalBone ?? 'UNKNOWN';
      const target = entry.targetBone ?? 'MISSING';
      console.log(
        `  ${status} ${entry.sourceBone.padEnd(30)} → ${canonical.padEnd(15)} → ${target}`
      );
    }
    console.log(line);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: resolve source bone name → canonical name (stateless)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a single bone name to its canonical Bannon skeleton name.
 * Returns null if the bone name is not recognized.
 */
export function resolveToCanonicalBone(boneName: string): CanonicalBone | null {
  if (BONE_ALIAS_TABLE[boneName]) return BONE_ALIAS_TABLE[boneName];
  const lower = boneName.toLowerCase();
  for (const [alias, canonical] of Object.entries(BONE_ALIAS_TABLE)) {
    if (alias.toLowerCase() === lower) return canonical;
  }
  const normalized = boneName
    .toLowerCase()
    .replace(/mixamorig[:._-]?/g, '')
    .replace(/[^a-z0-9]/g, '');
  for (const [alias, canonical] of Object.entries(BONE_ALIAS_TABLE)) {
    const aliasNorm = alias
      .toLowerCase()
      .replace(/mixamorig[:._-]?/g, '')
      .replace(/[^a-z0-9]/g, '');
    if (aliasNorm === normalized) return canonical;
  }
  return null;
}

/**
 * Bind a clip's tracks to an actual target skeleton's bone names.
 *
 * Policy:
 *   1. Exact target bone name match (Mixamo→Mixamo) wins.
 *   2. Else canonical alias match (mixamorigHips → Hips, etc.).
 *   3. Else the track is UNRESOLVED — never rewritten onto a fake bone.
 */
export function bindClipTracksToTargetBones(
  clip: THREE.AnimationClip,
  targetBoneNames: readonly string[],
): RetargetedClipResult {
  const exact = new Set(targetBoneNames);
  const canonicalToTarget = new Map<CanonicalBone, string>();
  for (const name of targetBoneNames) {
    const canonical = resolveToCanonicalBone(name);
    if (canonical && !canonicalToTarget.has(canonical)) {
      canonicalToTarget.set(canonical, name);
    }
  }

  const retargetedTracks: THREE.KeyframeTrack[] = [];
  const unresolvedTrackNames: string[] = [];
  let resolvedTracks = 0;
  let unresolvedTracks = 0;

  for (const track of clip.tracks) {
    const rawName = track.name;
    const dotIdx = rawName.lastIndexOf('.');
    const withoutProp = dotIdx !== -1 ? rawName.slice(0, dotIdx) : rawName;
    const property = dotIdx !== -1 ? rawName.slice(dotIdx + 1) : '';
    const pipeIdx = withoutProp.lastIndexOf('|');
    const sourceBoneName = pipeIdx !== -1 ? withoutProp.slice(pipeIdx + 1) : withoutProp;

    let targetBoneName: string | null = null;
    if (exact.has(sourceBoneName)) {
      targetBoneName = sourceBoneName;
    } else {
      const canonical = resolveToCanonicalBone(sourceBoneName);
      targetBoneName = canonical ? (canonicalToTarget.get(canonical) ?? null) : null;
    }

    if (targetBoneName && property) {
      const newTrackName = `${targetBoneName}.${property}`;
      const TrackCtor = track.constructor as unknown as new (
        name: string,
        times: ArrayLike<number>,
        values: ArrayLike<number>,
        interpolation?: THREE.InterpolationModes,
      ) => THREE.KeyframeTrack;
      retargetedTracks.push(
        new TrackCtor(newTrackName, track.times, track.values, track.getInterpolation()),
      );
      resolvedTracks++;
    } else {
      unresolvedTracks++;
      unresolvedTrackNames.push(`${clip.name}::${sourceBoneName}${property ? '.' + property : ''}`);
    }
  }

  const retargetedClip = new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks);
  const srcUserData = (clip as THREE.AnimationClip & { userData?: Record<string, unknown> }).userData ?? {};
  (retargetedClip as THREE.AnimationClip & { userData: Record<string, unknown> }).userData = {
    ...srcUserData,
    clipSourceType: resolvedTracks > 0 ? 'RETARGETED_AUTHORED_CLIP' : 'MISSING_CLIP',
    resolvedTracks,
    unresolvedTracks,
    unresolvedTrackNames,
  };

  return { clip: retargetedClip, resolvedTracks, unresolvedTracks, unresolvedTrackNames };
}
