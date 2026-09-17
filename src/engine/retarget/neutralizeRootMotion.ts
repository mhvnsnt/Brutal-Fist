/**
 * Universal Mixamo / mocap clip sanitizer.
 *
 * Fighting-game instances own facing (outer yaw) and floor plant (outer Y).
 * Clips must be in-place and face the skeleton's bind forward (+Z for Mixamo).
 *
 * Why AI always breaks this:
 *   1. Copying Mixamo hip quaternion as-is leaves ~40–90° of yaw in IDLE
 *      (our IDLE.json hips.ry ≈ −0.75). Stack that with outer yaw and the
 *      abs face away from the opponent while the neck still looks at them.
 *   2. pose.pelvis Y (~0.91m) applied as Hips.position on a mesh already
 *      planted at bind-pose height double-counts hip height → hover.
 *   3. Procedural Euler banks written as ABSOLUTE local quaternions replace
 *      Mixamo rest (legs rz ≈ ±π) with made-up angles → truck-hit twist.
 *
 * Legal operations: drop root translation, zero hip yaw, keep lean/pitch.
 * Illegal: rest-pose-ignorant track rename, hip Y-π "align", bone-snap floor.
 */
import * as THREE from 'three';

const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

function boneFromTrack(trackName: string): string {
  const dot = trackName.lastIndexOf('.');
  const withoutProp = dot === -1 ? trackName : trackName.slice(0, dot);
  const pipe = withoutProp.lastIndexOf('|');
  const raw = pipe === -1 ? withoutProp : withoutProp.slice(pipe + 1);
  return raw.replace(/^mixamorig:?/i, '');
}

function isRootBone(bone: string): boolean {
  return /^(hips?|pelvis|root|armature)$/i.test(bone);
}

export function stripRootPositionTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  clip.tracks = clip.tracks.filter((track) => {
    if (!track.name.endsWith('.position')) return true;
    return !isRootBone(boneFromTrack(track.name));
  });
  return clip;
}

/** Zero hip yaw so the instance yaw is the only facing. Keeps X/Z lean. */
export function neutralizeHipYaw(clip: THREE.AnimationClip): THREE.AnimationClip {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    if (!isRootBone(boneFromTrack(track.name))) continue;
    const values = track.values;
    for (let i = 0; i + 3 < values.length; i += 4) {
      _q.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
      _e.setFromQuaternion(_q, 'YXZ');
      _e.y = 0;
      _q.setFromEuler(_e);
      values[i] = _q.x;
      values[i + 1] = _q.y;
      values[i + 2] = _q.z;
      values[i + 3] = _q.w;
    }
  }
  return clip;
}

export function sanitizeMotionClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  stripRootPositionTracks(clip);
  neutralizeHipYaw(clip);
  return clip;
}
