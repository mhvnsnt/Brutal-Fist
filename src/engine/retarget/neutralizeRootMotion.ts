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
 * Legal operations: hip Y as a delta from key 0 (clamped), zero hip yaw, keep lean/pitch.
 * Illegal: absolute Mixamo pelvis height, hip XZ root, rest-pose-ignorant track rename.
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

/**
 * Constant hip yaw is a Mixamo facing bias (IDLE hips.ry ≈ −0.75). Zero that
 * so the fighter instance owns facing.
 *
 * A real spin is NOT a bias. HURRICANE_KICK sweeps the hips through a full
 * turn (and back) while the legs stay put — zeroing every key deletes the
 * kick and leaves a body flop. If unwrapped yaw travel is a spin, subtract
 * the first frame so t=0 still faces forward and the turn plays out.
 */
const SPIN_YAW_TRAVEL = 0.85;

export function neutralizeHipYaw(clip: THREE.AnimationClip): THREE.AnimationClip {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.quaternion')) continue;
    if (!isRootBone(boneFromTrack(track.name))) continue;
    const values = track.values;
    const count = Math.floor(values.length / 4);
    if (count === 0) continue;

    const yaws: number[] = [];
    for (let k = 0; k < count; k++) {
      const i = k * 4;
      _q.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
      _e.setFromQuaternion(_q, 'YXZ');
      yaws.push(_e.y);
    }
    const unwrapped = [yaws[0]];
    for (let k = 1; k < yaws.length; k++) {
      let y = yaws[k];
      while (y - unwrapped[k - 1] > Math.PI) y -= Math.PI * 2;
      while (y - unwrapped[k - 1] < -Math.PI) y += Math.PI * 2;
      unwrapped.push(y);
    }
    let lo = unwrapped[0];
    let hi = unwrapped[0];
    for (const y of unwrapped) {
      if (y < lo) lo = y;
      if (y > hi) hi = y;
    }
    const spinning = hi - lo >= SPIN_YAW_TRAVEL;
    const base = unwrapped[0];

    for (let k = 0; k < count; k++) {
      const i = k * 4;
      _q.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
      _e.setFromQuaternion(_q, 'YXZ');
      _e.y = spinning ? unwrapped[k] - base : 0;
      _q.setFromEuler(_e);
      values[i] = _q.x;
      values[i + 1] = _q.y;
      values[i + 2] = _q.z;
      values[i + 3] = _q.w;
    }
  }
  return clip;
}

const HIP_RISE_MAX = 0.42;
const HIP_DROP_MAX = 0.48;

/**
 * Absolute Mixamo hip height (~0.9m) on an already-planted mesh hovers.
 * Dropping the track entirely is what stranded crouches and jumps: the
 * torso never left the bind height, so feet came up instead of the body
 * going down (Claude's grounding gap).
 *
 * Keep a bind-relative Y delta from the clip's first key, clamped.
 * t=0 is always 0 so plantFeetOnFloor still owns the floor. XZ stays 0 —
 * the instance owns the lane and the radial sidestep.
 */
export function relativizeRootHeight(clip: THREE.AnimationClip): THREE.AnimationClip {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position')) continue;
    if (!isRootBone(boneFromTrack(track.name))) continue;
    const values = track.values;
    if (values.length < 3) continue;
    const y0 = values[1];
    for (let i = 0; i + 2 < values.length; i += 3) {
      let dy = values[i + 1] - y0;
      if (dy > HIP_RISE_MAX) dy = HIP_RISE_MAX;
      if (dy < -HIP_DROP_MAX) dy = -HIP_DROP_MAX;
      values[i] = 0;
      values[i + 1] = dy;
      values[i + 2] = 0;
    }
  }
  return clip;
}

export function sanitizeMotionClip(clip: THREE.AnimationClip): THREE.AnimationClip {
  relativizeRootHeight(clip);
  neutralizeHipYaw(clip);
  return clip;
}
