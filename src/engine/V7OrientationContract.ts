/**
 * Grok v7 orientation doctrine adapted to the Brutal Fist shared runtime.
 * Meshes face +Z; cameras face -Z. Movement and camera bases are independent.
 */
export interface Vec3Like { x: number; y: number; z: number }

export const BF_WORLD_UP: Vec3Like = { x: 0, y: 1, z: 0 };

export function normalizeXZ(x: number, z: number) {
  const length = Math.hypot(x, z);
  if (!Number.isFinite(length) || length < 1e-8) return { x: 0, z: 0 };
  return { x: x / length, z: z / length };
}

/** Character-forward basis for a +Z-facing mesh. */
export function meshForwardBasis(forwardX: number, forwardZ: number) {
  const f = normalizeXZ(forwardX, forwardZ);
  return {
    rightX: -f.z,
    rightZ: f.x,
    forwardX: f.x,
    forwardZ: f.z,
  };
}

/** Camera-forward basis: cameras look down -Z. Kept separate from movement. */
export function cameraForwardBasis(forwardX: number, forwardZ: number) {
  const f = normalizeXZ(forwardX, forwardZ);
  return {
    rightX: f.z,
    rightZ: -f.x,
    forwardX: f.x,
    forwardZ: f.z,
  };
}

export function boundedDeltaSeconds(deltaSeconds: number) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return Math.min(deltaSeconds, 0.1);
}

export function fixedStepCount(accumulatorSeconds: number, fixedStepSeconds = 1 / 60) {
  if (!Number.isFinite(accumulatorSeconds) || accumulatorSeconds <= 0) return 0;
  if (!Number.isFinite(fixedStepSeconds) || fixedStepSeconds <= 0) return 0;
  return Math.floor(accumulatorSeconds / fixedStepSeconds);
}
