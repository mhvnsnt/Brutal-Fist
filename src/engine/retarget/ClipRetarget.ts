import * as THREE from 'three';
import { normalizeBoneName } from '../BannonRetargetContract';

export interface RetargetOptions {
  sourceRoot: THREE.Object3D;
  destinationRoot: THREE.Object3D;
  sourceRest: Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }>;
  destinationRest: Map<string, { position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }>;
}

/**
 * Retargets an AnimationClip by normalized bone identity.
 * Rotation tracks are converted from source rest orientation into the
 * destination rest orientation, avoiding fighter-specific Euler offsets.
 */
export function retargetClipByRestPose(
  clip: THREE.AnimationClip,
  options: RetargetOptions
): THREE.AnimationClip {
  const sourceBones = new Map<string, THREE.Bone>();
  const destinationBones = new Map<string, THREE.Bone>();

  options.sourceRoot.traverse(o => {
    if ((o as THREE.Bone).isBone) sourceBones.set(normalizeBoneName(o.name), o as THREE.Bone);
  });
  options.destinationRoot.traverse(o => {
    if ((o as THREE.Bone).isBone) destinationBones.set(normalizeBoneName(o.name), o as THREE.Bone);
  });

  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    const match = track.name.match(/^([^\.]+)\.(.+)$/);
    if (!match) continue;
    const sourceBone = sourceBones.get(normalizeBoneName(match[1]));
    const destinationBone = destinationBones.get(normalizeBoneName(match[1]));
    if (!sourceBone || !destinationBone) continue;

    const property = match[2];
    if (property !== 'quaternion' && property !== 'position' && property !== 'scale') continue;

    const values = Array.from(track.values);
    if (property === 'quaternion') {
      const srcRest = options.sourceRest.get(normalizeBoneName(sourceBone.name))?.quaternion;
      const dstRest = options.destinationRest.get(normalizeBoneName(destinationBone.name))?.quaternion;
      if (!srcRest || !dstRest) continue;

      const correction = dstRest.clone().multiply(srcRest.clone().invert());
      for (let i = 0; i < values.length; i += 4) {
        const q = new THREE.Quaternion(values[i], values[i+1], values[i+2], values[i+3]);
        const corrected = correction.clone().multiply(q).normalize();
        values[i]=corrected.x; values[i+1]=corrected.y; values[i+2]=corrected.z; values[i+3]=corrected.w;
      }
    }
    tracks.push(new (track.constructor as any)(destinationBone.name + '.' + property, track.times, values, track.getInterpolation()));
  }

  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export function validateRetargetedClip(clip: THREE.AnimationClip) {
  for (const track of clip.tracks) {
    for (const v of track.values) {
      if (!Number.isFinite(v)) throw new Error(`BANNON_RETARGET_INVALID: non-finite value in ${track.name}`);
    }
  }
  return clip;
}
