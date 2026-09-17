/**
 * BannonEulerMotionAdapter.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts the REAL Bannon motion-bank JSON format into THREE.AnimationClip
 * quaternion tracks.
 *
 * Actual on-disk / GitHub format (assets/moves/clips/*.json):
 *   {
 *     "dur": 1.7333,
 *     "keys": [
 *       {
 *         "t": 0.0,
 *         "pose": { "pelvis": [x, y, z], ... },
 *         "bones": {
 *           "mixamorigHips": { "rx": -0.02, "ry": -0.60, "rz": -0.02 },
 *           "mixamorigRightArm": { "rx": 0.88, "ry": -0.39, "rz": -0.67 }
 *         }
 *       }
 *     ]
 *   }
 *
 * This is Euler rotation (rx/ry/rz, radians, XYZ order) — NOT quaternions.
 * Do not describe the Bannon source data as already being quaternion animation.
 *
 * OUTPUT: QuaternionKeyframeTrack per Mixamo source bone. Track names keep
 * the Mixamo source names (mixamorigHips, …) so AnimationRetargeter can bind
 * them against the LIVE target skeleton. Unresolved tracks are reported, never
 * silently rewritten onto a fake bone.
 *
 * TEST_ONLY procedural clips live in BannonClipJsonAdapter and must never
 * be stamped AUTHORED_CLIP.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';

export const BANNON_MOTION_BANK_INDEX =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/index.json';
export const BANNON_MOTION_BANK_BASE =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/';

export interface BannonEulerSample {
  rx?: number;
  ry?: number;
  rz?: number;
  q?: [number, number, number, number];
}

export interface BannonEulerKey {
  t?: number;
  pose?: Record<string, [number, number, number] | number[]>;
  bones?: Record<string, BannonEulerSample>;
}

export interface BannonEulerClipJson {
  dur?: number;
  duration?: number;
  name?: string;
  frameRate?: number;
  keys?: BannonEulerKey[];
  bones?: unknown;
  license?: string;
  source?: string;
  semanticState?: string;
}

export interface EulerConversionResult {
  clip: THREE.AnimationClip;
  semanticState: string;
  trackCount: number;
  sourceBoneNames: string[];
  frameCount: number;
  duration: number;
  sourceFormat: 'BANNON_EULER_RX_RY_RZ';
  angularTravelRadians: number;
}

/** Preferred Bannon motion-bank files for each required semantic combat state. */
export const SEMANTIC_PREFERRED_CLIPS: Record<string, string[]> = {
  idle:           ['BOX_IDLE', 'STANCE_WIDE', 'IDLE', 'ACTION_IDLE_TO_STANDING_IDLE', 'STANCE_BLADED'],
  walk_forward:   ['DWARF_WALK', 'DRUNK_WALK', 'GINGA_FORWARD', 'LOCO_STRUT', 'LOCO_LIGHT'],
  walk_back:      ['GINGA_BACKWARD', 'INJURED_RUN_BACKWARDS_RIGHT_TURN'],
  strafe_left:    ['GINGA_SIDEWAYS_2', 'LOCO_PROWL'],
  strafe_right:   ['CROUCH_TORCH_WALK_RIGHT', 'INJURED_TURN_RIGHT'],
  attack_1:       ['BOXING', 'BODY_JAB_CROSS', 'BOXING__1_'],
  attack_rp:      ['COMBO_PUNCH', 'BOXING__2_', 'ILLEGAL_ELBOW_PUNCH', 'ILLEGAL_ELBOW_PUNCH__1_', 'BASEBALL_HIT'],
  attack_2:       ['HURRICANE_KICK', 'DROP_KICK', 'ILLEGAL_KNEE'],
  attack_lk:      ['DROP_KICK', 'ILLEGAL_KNEE', 'TIGER_FEINT_KICK'],
  attack_rk:      ['HURRICANE_KICK', 'AU', 'CAPOEIRA', 'BASH', 'CROSS_JUMPS'],
  block:          ['CENTER_BLOCK', 'GUARD_HIGH', 'GUARD_LOW', 'DEFENDER', 'ESQUIVA_4'],
  hit_reaction:   ['HIT_REACTION', 'HIT_TO_BODY', 'HIT_TO_HEAD', 'BIG_RIB_HIT', 'HIT_ON_THE_BACK', 'HIT_ON_SIDE_OF_HEAD', 'BIG_BODY_BLOW'],
  knockdown:      ['FALLING_FLAT_IMPACT', 'FALLING_FORWARD_DEATH', 'DEFEAT', 'DYING_BACKWARDS'],
  getup:          ['KIP_UP', 'CORKSCREW_KIP_UP', 'ACTION_IDLE_TO_STANDING_IDLE', 'CORKSCREW_EVADE'],
  grapple:        ['DOUBLE_LEG_TAKEDOWN___VICTIM', 'SUPLEX', 'GERMANSUPLEX', 'DDT', 'CHOKESLAM'],
  crouch:         ['STANCE_CROUCH', 'CROUCH_IDLE_02_LOOKING_AROUND', 'CROUCH_WALK_FORWARD'],
  run:            ['DRUNK_RUN_FORWARD', 'LOCO_LIGHT'],
  dash_forward:   ['DRUNK_RUN_FORWARD', 'LOCO_STRUT'],
  jump:           ['CROSS_JUMPS'],
  taunt:          ['BREAKDANCE_READY', 'STANCE_BLADED', 'CAPOEIRA'],
  victory:        ['BREAKDANCE_READY', 'STANCE_WIDE'],
  defeat:         ['DEFEAT', 'DYING_BACKWARDS', 'FALLING_FORWARD_DEATH'],
};

export function isBannonEulerMotionBank(json: unknown): json is BannonEulerClipJson {
  if (!json || typeof json !== 'object') return false;
  const rec = json as Record<string, unknown>;
  if (!Array.isArray(rec.keys) || rec.keys.length === 0) return false;
  const first = rec.keys[0] as Record<string, unknown>;
  return !!first && typeof first === 'object' && first.bones != null && typeof first.bones === 'object';
}

function toRadians(v: number): number {
  // Source values in the bank are Mixamo Euler radians (typical range ±π).
  // Only convert if a sample is unambiguously degrees.
  return Math.abs(v) > Math.PI * 2.5 ? THREE.MathUtils.degToRad(v) : v;
}

function sampleToQuaternion(sample: BannonEulerSample): THREE.Quaternion {
  if (sample.q && sample.q.length === 4) {
    return new THREE.Quaternion(sample.q[0], sample.q[1], sample.q[2], sample.q[3]).normalize();
  }
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      toRadians(sample.rx ?? 0),
      toRadians(sample.ry ?? 0),
      toRadians(sample.rz ?? 0),
      'XYZ',
    ),
  );
}

function frameTime(key: BannonEulerKey, index: number, frameRate: number): number {
  if (Number.isFinite(key.t)) return key.t as number;
  return index / Math.max(1, frameRate);
}

function measureAngularTravel(times: number[], values: number[]): number {
  if (times.length < 2) return 0;
  const qA = new THREE.Quaternion();
  const qB = new THREE.Quaternion();
  let travel = 0;
  for (let i = 1; i < times.length; i++) {
    qA.set(values[(i - 1) * 4], values[(i - 1) * 4 + 1], values[(i - 1) * 4 + 2], values[(i - 1) * 4 + 3]);
    qB.set(values[i * 4], values[i * 4 + 1], values[i * 4 + 2], values[i * 4 + 3]);
    travel += qA.angleTo(qB);
  }
  return travel;
}

/**
 * Convert one Bannon Euler motion-bank clip into a THREE.AnimationClip.
 * Track names keep Mixamo source bone names. Provenance is AUTHORED_CLIP
 * only after tracks are actually produced from rx/ry/rz (or q) samples.
 */
export function convertBannonEulerMotionClip(
  json: BannonEulerClipJson,
  clipName: string,
  semanticState?: string,
): EulerConversionResult {
  const keys = [...(json.keys ?? [])].sort(
    (a, b) => frameTime(a, 0, 30) - frameTime(b, 0, 30),
  );
  const frameRate = json.frameRate ?? (keys.length > 1
    ? Math.max(1, (keys.length - 1) / Math.max(0.001, frameTime(keys[keys.length - 1], keys.length - 1, 30)))
    : 30);
  const duration = json.dur ?? json.duration ?? (keys.length ? frameTime(keys[keys.length - 1], keys.length - 1, frameRate) : 0);

  const boneNames = new Set<string>();
  for (const key of keys) {
    for (const name of Object.keys(key.bones ?? {})) boneNames.add(name);
  }

  const tracks: THREE.KeyframeTrack[] = [];
  let angularTravelRadians = 0;

  for (const bone of boneNames) {
    const times: number[] = [];
    const values: number[] = [];
    keys.forEach((key, index) => {
      const sample = key.bones?.[bone];
      if (!sample) return;
      if (sample.rx == null && sample.ry == null && sample.rz == null && sample.q == null) return;
      times.push(frameTime(key, index, frameRate));
      const q = sampleToQuaternion(sample);
      values.push(q.x, q.y, q.z, q.w);
    });
    if (times.length === 0) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
    angularTravelRadians += measureAngularTravel(times, values);
  }

  // Do NOT write pose.pelvis as Hips.position. Mixamo pelvis Y (~0.91) on a
  // mesh already planted at bind-pose height is the hover. Instance owns Y.

  const resolvedSemantic = semanticState ?? json.semanticState ?? clipName;
  const clip = new THREE.AnimationClip(clipName, duration, tracks);
  (clip as THREE.AnimationClip & { userData: Record<string, unknown> }).userData = {
    semanticState: resolvedSemantic,
    source: json.source ?? 'BANNON_MOTION_BANK',
    license: json.license ?? 'unknown',
    provenance: `BannonEulerMotionAdapter: ${clipName}`,
    sourceFormat: 'BANNON_EULER_RX_RY_RZ',
    clipSourceType: tracks.length > 0 ? 'RETARGETED_AUTHORED_CLIP' : 'MISSING_CLIP',
    isProcedural: false,
    frameCount: keys.length,
    angularTravelRadians,
  };

  return {
    clip,
    semanticState: resolvedSemantic,
    trackCount: tracks.length,
    sourceBoneNames: [...boneNames],
    frameCount: keys.length,
    duration,
    sourceFormat: 'BANNON_EULER_RX_RY_RZ',
    angularTravelRadians,
  };
}

export interface MotionIndexEntry {
  file: string;
  src?: string;
  dur?: number;
  keys?: number;
  bones?: number;
}

export type BannonMotionIndex = Record<string, MotionIndexEntry>;

export function pickPreferredMotionBankFiles(index: BannonMotionIndex): { key: string; file: string; semanticState: string }[] {
  const picked: { key: string; file: string; semanticState: string }[] = [];
  const used = new Set<string>();

  for (const [semanticState, candidates] of Object.entries(SEMANTIC_PREFERRED_CLIPS)) {
    for (const candidate of candidates) {
      const entry = index[candidate];
      if (!entry?.file) continue;
      if (used.has(candidate)) continue;
      const bones = Number(entry.bones ?? 0);
      const bytes = Number((entry as { bytes?: number }).bytes ?? 0);
      if (bones > 80 || bytes > 160_000) continue;
      picked.push({ key: candidate, file: entry.file, semanticState });
      used.add(candidate);
    }
  }

  return picked;
}

/** Infer a combat semantic from a motion-bank clip key when it is not already preferred. */
export function inferSemanticFromMotionKey(key: string): string {
  for (const [semanticState, candidates] of Object.entries(SEMANTIC_PREFERRED_CLIPS)) {
    if (candidates.includes(key)) return semanticState;
  }
  const k = key.toUpperCase();
  if (/IDLE|STANCE/.test(k)) return 'idle';
  if (/WALK|GINGA_FORWARD|LOCO_|RUN/.test(k) && !/BACK/.test(k)) return 'walk_forward';
  if (/BACK/.test(k) && /WALK|RUN|GINGA/.test(k)) return 'walk_back';
  if (/SIDE|STRAFE|PROWL|STALK|TURN_RIGHT/.test(k)) return 'strafe_right';
  if (/PUNCH|JAB|BOXING|ELBOW|BASEBALL/.test(k)) return 'attack_1';
  if (/KICK|KNEE|BASH|AU|CAPOEIRA|JUMP/.test(k)) return 'attack_2';
  if (/GUARD|BLOCK|DEFEND|ESQUIVA/.test(k)) return 'block';
  if (/HIT|RIB|BLOW/.test(k)) return 'hit_reaction';
  if (/FALL|DEFEAT|DYING|DEATH/.test(k)) return 'knockdown';
  if (/KIP|GETUP|STANDING_IDLE|EVADE/.test(k)) return 'getup';
  if (/SUPLEX|DDT|CHOKE|TAKEDOWN|SLAM/.test(k)) return 'grapple';
  if (/CROUCH/.test(k)) return 'crouch';
  if (/TAUNT|BREAKDANCE|DANCING/.test(k)) return 'taunt';
  return 'idle';
}
