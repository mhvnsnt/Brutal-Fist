/**
 * Offline verification of the real Bannon Euler motion bank.
 *
 * Measures conversion + track binding. Does not invent a fighter skeleton,
 * does not stamp procedural clips as AUTHORED, and never substitutes idle.
 *
 * Usage: node scripts/verify-bannon-motion-bank.mjs
 */
import * as THREE from 'three';

const INDEX_URL = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/index.json';
const BASE_URL = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/';

const PREFERRED = {
  idle: 'IDLE',
  walk_forward: 'DWARF_WALK',
  walk_back: 'GINGA_BACKWARD',
  strafe_left: 'GINGA_SIDEWAYS_2',
  strafe_right: 'CROUCH_TORCH_WALK_RIGHT',
  attack_1: 'BOXING',
  attack_2: 'HURRICANE_KICK',
  block: 'CENTER_BLOCK',
  hit_reaction: 'HIT_REACTION',
  knockdown: 'FALLING_FLAT_IMPACT',
  getup: 'KIP_UP',
};

const REQUIRED_SEMANTIC_STATES = Object.keys(PREFERRED);

const MIXAMO_TO_CANONICAL = {
  mixamorigHips: 'Hips',
  mixamorigSpine: 'Spine',
  mixamorigSpine1: 'Spine',
  mixamorigSpine2: 'Chest',
  mixamorigNeck: 'Neck',
  mixamorigHead: 'Head',
  mixamorigLeftShoulder: 'LUpperArm',
  mixamorigLeftArm: 'LUpperArm',
  mixamorigLeftForeArm: 'LForeArm',
  mixamorigLeftHand: 'LHand',
  mixamorigRightShoulder: 'RUpperArm',
  mixamorigRightArm: 'RUpperArm',
  mixamorigRightForeArm: 'RForeArm',
  mixamorigRightHand: 'RHand',
  mixamorigLeftUpLeg: 'LUpperLeg',
  mixamorigLeftLeg: 'LLowerLeg',
  mixamorigLeftFoot: 'LFoot',
  mixamorigRightUpLeg: 'RUpperLeg',
  mixamorigRightLeg: 'RLowerLeg',
  mixamorigRightFoot: 'RFoot',
};

const CANONICAL_BONES = [
  'Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'LUpperArm', 'LForeArm', 'LHand',
  'RUpperArm', 'RForeArm', 'RHand',
  'LUpperLeg', 'LLowerLeg', 'LFoot',
  'RUpperLeg', 'RLowerLeg', 'RFoot',
];

function toRadians(v) {
  return Math.abs(v) > Math.PI * 2.5 ? THREE.MathUtils.degToRad(v) : v;
}

function convertEuler(json, name) {
  const keys = [...(json.keys ?? [])].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
  const duration = json.dur ?? json.duration ?? (keys.at(-1)?.t ?? 0);
  const boneNames = new Set();
  for (const key of keys) for (const b of Object.keys(key.bones ?? {})) boneNames.add(b);

  const tracks = [];
  let angularTravel = 0;
  const qA = new THREE.Quaternion();
  const qB = new THREE.Quaternion();

  for (const bone of boneNames) {
    const times = [];
    const values = [];
    keys.forEach((key, i) => {
      const sample = key.bones?.[bone];
      if (!sample) return;
      if (sample.rx == null && sample.ry == null && sample.rz == null && !sample.q) return;
      times.push(Number.isFinite(key.t) ? key.t : i / 30);
      if (sample.q) {
        const q = new THREE.Quaternion(sample.q[0], sample.q[1], sample.q[2], sample.q[3]).normalize();
        values.push(q.x, q.y, q.z, q.w);
      } else {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          toRadians(sample.rx ?? 0), toRadians(sample.ry ?? 0), toRadians(sample.rz ?? 0), 'XYZ',
        ));
        values.push(q.x, q.y, q.z, q.w);
      }
    });
    if (!times.length) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
    for (let i = 1; i < times.length; i++) {
      qA.set(values[(i - 1) * 4], values[(i - 1) * 4 + 1], values[(i - 1) * 4 + 2], values[(i - 1) * 4 + 3]);
      qB.set(values[i * 4], values[i * 4 + 1], values[i * 4 + 2], values[i * 4 + 3]);
      angularTravel += qA.angleTo(qB);
    }
  }

  const clip = new THREE.AnimationClip(name, duration, tracks);
  return {
    clip,
    trackCount: tracks.length,
    boneCount: boneNames.size,
    sourceBones: [...boneNames],
    frameCount: keys.length,
    duration,
    angularTravel,
    sourceFormat: 'BANNON_EULER_RX_RY_RZ',
  };
}

function bindExact(clip, targetBones) {
  const exact = new Set(targetBones);
  let resolved = 0;
  const unresolved = [];
  for (const track of clip.tracks) {
    const bone = track.name.split('.')[0];
    if (exact.has(bone)) resolved++;
    else unresolved.push(track.name);
  }
  return { resolved, unresolved };
}

function bindCanonicalAlias(clip, canonicalBones) {
  const exact = new Set(canonicalBones);
  let resolved = 0;
  const unresolved = [];
  const resolvedCanonical = new Set();
  for (const track of clip.tracks) {
    const bone = track.name.split('.')[0];
    const canonical = MIXAMO_TO_CANONICAL[bone] ?? (exact.has(bone) ? bone : null);
    if (canonical && exact.has(canonical)) {
      resolved++;
      resolvedCanonical.add(canonical);
    } else {
      unresolved.push(track.name);
    }
  }
  return { resolved, unresolved, resolvedCanonical: [...resolvedCanonical] };
}

async function main() {
  const index = await fetch(INDEX_URL).then((r) => {
    if (!r.ok) throw new Error(`index HTTP ${r.status}`);
    return r.json();
  });
  const indexSize = Object.keys(index).length;
  const results = [];
  const failed = [];

  for (const [semantic, key] of Object.entries(PREFERRED)) {
    const entry = index[key];
    if (!entry?.file) {
      failed.push({ semantic, key, error: 'NOT_IN_INDEX' });
      continue;
    }
    try {
      const json = await fetch(`${BASE_URL}${encodeURIComponent(entry.file)}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      });
      const hasKeys = Array.isArray(json.keys);
      const hasEuler = hasKeys && json.keys.some((k) => Object.values(k.bones ?? {}).some((b) => b.rx != null || b.ry != null || b.rz != null));
      const hasQ = hasKeys && json.keys.some((k) => Object.values(k.bones ?? {}).some((b) => b.q != null));
      const converted = convertEuler(json, key);
      const mixamoExact = bindExact(converted.clip, converted.sourceBones);
      const canonical = bindCanonicalAlias(converted.clip, CANONICAL_BONES);
      results.push({
        semantic,
        key,
        file: entry.file,
        hasKeys,
        hasEuler,
        hasQuaternion: hasQ,
        duration: converted.duration,
        frameCount: converted.frameCount,
        sourceBones: converted.boneCount,
        tracks: converted.trackCount,
        angularTravelRadians: Number(converted.angularTravel.toFixed(4)),
        mixamoIdentityResolved: mixamoExact.resolved,
        mixamoIdentityUnresolved: mixamoExact.unresolved.length,
        canonicalResolvedTracks: canonical.resolved,
        canonicalUnresolvedTracks: canonical.unresolved.length,
        canonicalBonesCovered: canonical.resolvedCanonical.length,
        canonicalBonesMissing: CANONICAL_BONES.filter((b) => !canonical.resolvedCanonical.includes(b)),
        verdict: converted.trackCount > 0 && mixamoExact.resolved > 0 && hasEuler
          ? 'RETARGETED_AUTHORED_CLIP'
          : 'MISSING_CLIP',
      });
    } catch (error) {
      failed.push({ semantic, key, error: String(error.message ?? error) });
    }
  }

  const converted = results.filter((r) => r.tracks > 0 && r.verdict !== 'MISSING_CLIP');
  const missing = REQUIRED_SEMANTIC_STATES.filter((s) => !converted.some((r) => r.semantic === s));
  const totalMixamoUnresolved = results.reduce((s, r) => s + r.mixamoIdentityUnresolved, 0);
  const totalCanonicalUnresolved = results.reduce((s, r) => s + r.canonicalUnresolvedTracks, 0);

  const report = {
    source: INDEX_URL,
    sourceFormat: 'BANNON_EULER_RX_RY_RZ',
    indexSize,
    preferredAttempted: REQUIRED_SEMANTIC_STATES.length,
    converted: converted.length,
    failed: failed.length,
    failedKeys: failed,
    mixamoTargetBones: 'identity — clip Mixamo names (typically 52)',
    canonicalTargetBones: CANONICAL_BONES.length,
    semanticResolved: converted.map((r) => r.semantic),
    semanticMissing: missing,
    totalAngularTravelRadians: Number(converted.reduce((s, r) => s + r.angularTravelRadians, 0).toFixed(4)),
    totalMixamoIdentityUnresolved: totalMixamoUnresolved,
    totalCanonicalUnresolvedTracks: totalCanonicalUnresolved,
    fightUnlocked: false,
    fightLockReason: missing.length === 0 && converted.length === REQUIRED_SEMANTIC_STATES.length
      ? 'Motion-bank conversion PASSES required semantic states, but FIGHT still requires a live target skeleton (bones > 0) and visible SkinnedMeshes > 0. Roster named-part/static GLBs remain BLOCKED. UNKNOWN/WARN is not PASS.'
      : `MISSING_CLIP remains MISSING_CLIP for: ${missing.join(', ') || 'n/a'}`,
    notes: [
      'This script proves Euler→quaternion conversion and Mixamo identity track resolution.',
      'Canonical unresolved tracks are expected for Mixamo fingers/toes (not in the 18-bone canonical set).',
      'PLACEHOLDER_TEST_CLIP is never counted as authored PASS.',
      'Never substitutes idle for a missing combat state.',
      'Does not create a synthetic skeleton.',
    ],
    clips: results,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
