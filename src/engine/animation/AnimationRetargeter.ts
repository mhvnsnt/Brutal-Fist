import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

/** Canonical semantic skeleton used by the Bannon animation lane. */
export const CANONICAL_BONES = [
  'Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'LUpperArm', 'LForeArm', 'LHand',
  'RUpperArm', 'RForeArm', 'RHand',
  'LUpperLeg', 'LLowerLeg', 'LFoot',
  'RUpperLeg', 'RLowerLeg', 'RFoot',
] as const;

const ALIASES: Record<string, string[]> = {
  Hips: ['Hips', 'mixamorigHips', 'hip', 'pelvis', 'Pelvis', 'Root'],
  Spine: ['Spine', 'mixamorigSpine', 'spine_01', 'Spine1'],
  Chest: ['Chest', 'mixamorigSpine2', 'spine_02', 'Spine2', 'UpperChest'],
  Neck: ['Neck', 'mixamorigNeck', 'neck_01'],
  Head: ['Head', 'mixamorigHead', 'head'],
  LUpperArm: ['LUpperArm', 'LeftArm', 'mixamorigLeftArm', 'upper_arm.L', 'upperarm_l'],
  LForeArm: ['LForeArm', 'LeftForeArm', 'mixamorigLeftForeArm', 'forearm.L', 'lowerarm_l'],
  LHand: ['LHand', 'LeftHand', 'mixamorigLeftHand', 'hand.L'],
  RUpperArm: ['RUpperArm', 'RightArm', 'mixamorigRightArm', 'upper_arm.R', 'upperarm_r'],
  RForeArm: ['RForeArm', 'RightForeArm', 'mixamorigRightForeArm', 'forearm.R', 'lowerarm_r'],
  RHand: ['RHand', 'RightHand', 'mixamorigRightHand', 'hand.R'],
  LUpperLeg: ['LUpperLeg', 'LeftUpLeg', 'mixamorigLeftUpLeg', 'thigh.L', 'upperleg_l'],
  LLowerLeg: ['LLowerLeg', 'LeftLeg', 'mixamorigLeftLeg', 'calf.L', 'lowerleg_l'],
  LFoot: ['LFoot', 'LeftFoot', 'mixamorigLeftFoot', 'foot.L'],
  RUpperLeg: ['RUpperLeg', 'RightUpLeg', 'mixamorigRightUpLeg', 'thigh.R', 'upperleg_r'],
  RLowerLeg: ['RLowerLeg', 'RightLeg', 'mixamorigRightLeg', 'calf.R', 'lowerleg_r'],
  RFoot: ['RFoot', 'RightFoot', 'mixamorigRightFoot', 'foot.R'],
};

export type BoneMap = Record<string, string>;

export interface BoneResolution {
  canonical: string;
  target: string | null;
  sourceCandidates: string[];
  resolved: boolean;
}

export interface RetargetReport {
  sourceBones: number;
  targetBones: number;
  resolvedBones: number;
  missingCanonicalBones: string[];
  resolutions: BoneResolution[];
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function collectBones(root: THREE.Object3D): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  root.traverse((node) => {
    if ((node as THREE.Bone).isBone) bones.push(node as THREE.Bone);
  });
  return bones;
}

function resolveAlias(canonical: string, bones: THREE.Bone[]): string | null {
  const byNormalized = new Map(bones.map((b) => [normalizeName(b.name), b.name]));
  for (const candidate of [canonical, ...(ALIASES[canonical] ?? [])]) {
    const exact = byNormalized.get(normalizeName(candidate));
    if (exact) return exact;
  }
  return null;
}

/** Build canonical -> target bone names without relying on UUIDs. */
export function buildCanonicalBoneMap(target: THREE.Object3D): { map: BoneMap; report: RetargetReport } {
  const bones = collectBones(target);
  const map: BoneMap = {};
  const resolutions: BoneResolution[] = [];
  const missing: string[] = [];

  for (const canonical of CANONICAL_BONES) {
    const targetName = resolveAlias(canonical, bones);
    map[canonical] = targetName ?? '';
    resolutions.push({
      canonical,
      target: targetName,
      sourceCandidates: ALIASES[canonical] ?? [canonical],
      resolved: Boolean(targetName),
    });
    if (!targetName) missing.push(canonical);
  }

  return {
    map,
    report: {
      sourceBones: 0,
      targetBones: bones.length,
      resolvedBones: CANONICAL_BONES.length - missing.length,
      missingCanonicalBones: missing,
      resolutions,
    },
  };
}

/**
 * Retarget an authored/open source clip to a real target skeleton.
 * The source clip is never mutated and no runtime bones or weights are created.
 */
export function retargetAnimationClip(
  target: THREE.Object3D,
  source: THREE.Object3D | THREE.Skeleton,
  clip: THREE.AnimationClip,
  names: BoneMap,
): THREE.AnimationClip {
  const retargeted = SkeletonUtils.retargetClip(target, source, clip, {
    names,
    preserveBoneMatrix: true,
    preserveBonePositions: true,
  });
  retargeted.name = clip.name;
  return retargeted;
}

export interface ClipValidation {
  name: string;
  duration: number;
  trackCount: number;
  resolvedTrackCount: number;
  unresolvedTrackCount: number;
  unresolvedTracks: string[];
}

/** Validate track node names against the actual target clone before playback. */
export function validateAnimationClip(target: THREE.Object3D, clip: THREE.AnimationClip): ClipValidation {
  const bones = new Set(collectBones(target).map((b) => b.name));
  const unresolvedTracks: string[] = [];

  for (const track of clip.tracks) {
    const nodeName = track.name.split('.')[0];
    if (!bones.has(nodeName)) unresolvedTracks.push(track.name);
  }

  return {
    name: clip.name,
    duration: clip.duration,
    trackCount: clip.tracks.length,
    resolvedTrackCount: clip.tracks.length - unresolvedTracks.length,
    unresolvedTrackCount: unresolvedTracks.length,
    unresolvedTracks,
  };
}

/** Mixer/action bank rooted on the visible clone, never the hidden source GLTF. */
export function createVisibleAnimationBank(
  visibleClone: THREE.Object3D,
  clips: THREE.AnimationClip[],
) {
  const mixer = new THREE.AnimationMixer(visibleClone);
  const actions = new Map<string, THREE.AnimationAction>();
  const reports: ClipValidation[] = [];

  for (const clip of clips) {
    const report = validateAnimationClip(visibleClone, clip);
    reports.push(report);
    if (report.trackCount === 0 || report.unresolvedTrackCount > 0) continue;
    actions.set(clip.name, mixer.clipAction(clip, visibleClone));
  }

  return {
    mixer,
    actions,
    reports,
    play(name: string): boolean {
      const action = actions.get(name);
      if (!action) return false;
      action.reset().play();
      return true;
    },
    update(delta: number): void {
      mixer.update(delta);
    },
  };
}
