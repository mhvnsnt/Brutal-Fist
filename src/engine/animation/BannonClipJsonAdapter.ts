import * as THREE from 'three';

export interface BannonMotionBone {
  rx?: number;
  ry?: number;
  rz?: number;
}

export interface BannonMotionKey {
  t: number;
  bones?: Record<string, BannonMotionBone>;
}

export interface BannonMotionClip {
  dur?: number;
  keys: BannonMotionKey[];
}

const ALIASES: Record<string, string> = {
  hips: 'Hips',
  mixamorighips: 'Hips',
  mixamorigspine: 'Spine',
  mixamorigspine1: 'Chest',
  mixamorigspine2: 'Chest',
  mixamorigneck: 'Neck',
  mixamorighead: 'Head',
  mixamorigleftshoulder: 'LUpperArm',
  mixamorigleftarm: 'LUpperArm',
  mixamorigleftforearm: 'LForeArm',
  mixamoriglefthand: 'LHand',
  mixamorigrightshoulder: 'RUpperArm',
  mixamorigrightarm: 'RUpperArm',
  mixamorigrightforearm: 'RForeArm',
  mixamorigrighthand: 'RHand',
  mixamorigleftupleg: 'LUpperLeg',
  mixamorigleftleg: 'LLowerLeg',
  mixamorigleftfoot: 'LFoot',
  mixamorigrightupleg: 'RUpperLeg',
  mixamorigrightleg: 'RLowerLeg',
  mixamorigrightfoot: 'RFoot',
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function targetName(sourceName: string, available: Set<string>): string | null {
  if (available.has(sourceName)) return sourceName;
  const canonical = ALIASES[normalize(sourceName)];
  if (canonical && available.has(canonical)) return canonical;
  const normalizedTarget = new Map([...available].map((name) => [normalize(name), name]));
  return normalizedTarget.get(normalize(sourceName)) ??
    (canonical ? normalizedTarget.get(normalize(canonical)) ?? null : null);
}

/**
 * Convert Bannon's authored motion JSON (assets/moves/clips/*.json) into a
 * real Three.js AnimationClip. The source format contains measured per-bone
 * Euler rotations, not procedural runtime motion. No bones or weights are
 * created here.
 *
 * The adapter deliberately emits quaternion tracks because that is what the
 * GLTF/Three animation path consumes reliably for skeletal rotation.
 */
export function bannonMotionJsonToClip(
  source: BannonMotionClip,
  targetRoot: THREE.Object3D,
  clipName: string,
): { clip: THREE.AnimationClip; resolved: string[]; unresolved: string[] } {
  const available = new Set<string>();
  targetRoot.traverse((node) => {
    if ((node as THREE.Bone).isBone) available.add(node.name);
  });

  const tracks: THREE.KeyframeTrack[] = [];
  const resolved = new Set<string>();
  const unresolved = new Set<string>();
  const timesByBone = new Map<string, number[]>();
  const valuesByBone = new Map<string, number[]>();

  for (const key of source.keys ?? []) {
    const time = Number.isFinite(key.t) ? key.t : 0;
    for (const [sourceBone, euler] of Object.entries(key.bones ?? {})) {
      const target = targetName(sourceBone, available);
      if (!target) {
        unresolved.add(sourceBone);
        continue;
      }
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(euler.rx ?? 0, euler.ry ?? 0, euler.rz ?? 0, 'XYZ'),
      );
      if (!timesByBone.has(target)) {
        timesByBone.set(target, []);
        valuesByBone.set(target, []);
      }
      timesByBone.get(target)!.push(time);
      valuesByBone.get(target)!.push(q.x, q.y, q.z, q.w);
      resolved.add(`${sourceBone}->${target}`);
    }
  }

  for (const [bone, times] of timesByBone) {
    const values = valuesByBone.get(bone)!;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }

  const duration = Math.max(
    Number.isFinite(source.dur ?? NaN) ? source.dur! : 0,
    ...source.keys.map((key) => Number.isFinite(key.t) ? key.t : 0),
  );

  return {
    clip: new THREE.AnimationClip(clipName, duration, tracks),
    resolved: [...resolved],
    unresolved: [...unresolved],
  };
}

/** Fetch a Bannon motion JSON file from an explicitly configured source. */
export async function loadBannonMotionJson(url: string): Promise<BannonMotionClip> {
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Bannon motion fetch failed: ${response.status} ${url}`);
  return response.json() as Promise<BannonMotionClip>;
}
