#!/usr/bin/env node
/**
 * verify-bannon-motion-bank.mjs
 * Offline measurement for the live Bannon motion bank (keys[] Euler format).
 *
 * Source index is a dict keyed by clip id (IDLE, HIT_REACTION, …).
 * Preferred semantic → file map mirrors src/engine/retarget/BannonMotionBankPreferred.ts.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const DEFAULT_INDEX_URL =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/index.json';
const CDN_BASE =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips';

const PREFERRED = {
  idle: 'IDLE.json',
  walk_forward: 'GINGA_FORWARD.json',
  walk_back: 'GINGA_BACKWARD.json',
  strafe_left: 'GINGA_SIDEWAYS_2.json',
  strafe_right: 'CROUCH_TORCH_WALK_RIGHT.json',
  attack_1: 'BODY_JAB_CROSS.json',
  attack_2: 'COMBO_PUNCH.json',
  block: 'CENTER_BLOCK.json',
  hit_reaction: 'HIT_REACTION.json',
  knockdown: 'FALLING_FLAT_IMPACT.json',
  getup: 'KIP_UP.json',
};

const REQUIRED_SEMANTIC_STATES = Object.keys(PREFERRED);

const CANONICAL_17_BONES = [
  'Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'LUpperArm', 'LForeArm', 'LHand',
  'RUpperArm', 'RForeArm', 'RHand',
  'LUpperLeg', 'LLowerLeg', 'LFoot',
  'RUpperLeg', 'RLowerLeg', 'RFoot',
];

const MIXAMO_TO_CANONICAL = {
  mixamorigHips: 'Hips', Hips: 'Hips',
  mixamorigSpine: 'Spine', Spine: 'Spine',
  mixamorigSpine1: 'Spine', mixamorigSpine2: 'Chest', Chest: 'Chest',
  mixamorigNeck: 'Neck', Neck: 'Neck',
  mixamorigHead: 'Head', Head: 'Head',
  mixamorigLeftArm: 'LUpperArm', mixamorigLeftShoulder: 'LUpperArm', LUpperArm: 'LUpperArm',
  mixamorigLeftForeArm: 'LForeArm', LForeArm: 'LForeArm',
  mixamorigLeftHand: 'LHand', LHand: 'LHand',
  mixamorigRightArm: 'RUpperArm', mixamorigRightShoulder: 'RUpperArm', RUpperArm: 'RUpperArm',
  mixamorigRightForeArm: 'RForeArm', RForeArm: 'RForeArm',
  mixamorigRightHand: 'RHand', RHand: 'RHand',
  mixamorigLeftUpLeg: 'LUpperLeg', LUpperLeg: 'LUpperLeg',
  mixamorigLeftLeg: 'LLowerLeg', LLowerLeg: 'LLowerLeg',
  mixamorigLeftFoot: 'LFoot', LFoot: 'LFoot',
  mixamorigRightUpLeg: 'RUpperLeg', RUpperLeg: 'RUpperLeg',
  mixamorigRightLeg: 'RLowerLeg', RLowerLeg: 'RLowerLeg',
  mixamorigRightFoot: 'RFoot', RFoot: 'RFoot',
  'mixamorig:Hips': 'Hips', 'mixamorig:Spine': 'Spine', 'mixamorig:Spine1': 'Spine',
  'mixamorig:Spine2': 'Chest', 'mixamorig:Neck': 'Neck', 'mixamorig:Head': 'Head',
  'mixamorig:LeftArm': 'LUpperArm', 'mixamorig:LeftForeArm': 'LForeArm', 'mixamorig:LeftHand': 'LHand',
  'mixamorig:RightArm': 'RUpperArm', 'mixamorig:RightForeArm': 'RForeArm', 'mixamorig:RightHand': 'RHand',
  'mixamorig:LeftUpLeg': 'LUpperLeg', 'mixamorig:LeftLeg': 'LLowerLeg', 'mixamorig:LeftFoot': 'LFoot',
  'mixamorig:RightUpLeg': 'RUpperLeg', 'mixamorig:RightLeg': 'RLowerLeg', 'mixamorig:RightFoot': 'RFoot',
};

function normalizeBoneName(name) {
  return MIXAMO_TO_CANONICAL[name] ?? name;
}

function isKeysEuler(json) {
  return Array.isArray(json?.keys) && json.keys[0]?.bones &&
    typeof Object.values(json.keys[0].bones)[0]?.rx === 'number';
}

function isBonesFramesEuler(json) {
  if (json?.hasQuaternion !== false || !json?.bones) return false;
  for (const boneData of Object.values(json.bones)) {
    if (boneData?.frames?.[0] && typeof boneData.frames[0].rx === 'number') return true;
  }
  return false;
}

function eulerToQuat(rx, ry, rz) {
  const c1 = Math.cos(rx / 2), s1 = Math.sin(rx / 2);
  const c2 = Math.cos(ry / 2), s2 = Math.sin(ry / 2);
  const c3 = Math.cos(rz / 2), s3 = Math.sin(rz / 2);
  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 + s1 * s2 * c3,
    w: c1 * c2 * c3 - s1 * s2 * s3,
  };
}

function quatDot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

function measureFramesTravel(frames) {
  let travel = 0;
  let prev = null;
  for (const frame of frames) {
    const q = eulerToQuat(frame.rx ?? 0, frame.ry ?? 0, frame.rz ?? 0);
    if (prev) {
      const dot = Math.min(1.0, Math.abs(quatDot(prev, q)));
      travel += 2 * Math.acos(dot);
    }
    prev = q;
  }
  return travel;
}

function normalizeKeysToBones(json) {
  const bones = {};
  for (const key of json.keys) {
    const t = key.t ?? 0;
    for (const [boneName, rot] of Object.entries(key.bones ?? {})) {
      if (typeof rot?.rx !== 'number') continue;
      if (!bones[boneName]) bones[boneName] = { frames: [] };
      bones[boneName].frames.push({ t, rx: rot.rx, ry: rot.ry ?? 0, rz: rot.rz ?? 0 });
    }
  }
  return {
    name: json.name ?? 'clip',
    duration: json.dur ?? json.duration ?? 1,
    hasQuaternion: false,
    bones,
  };
}

function convertClip(raw) {
  let json = raw;
  let format = 'UNKNOWN';
  if (isKeysEuler(raw)) {
    json = normalizeKeysToBones(raw);
    format = 'BANNON_KEYS_EULER→EULER_FRAMES';
  } else if (isBonesFramesEuler(raw)) {
    format = 'BANNON_EULER_RX_RY_RZ';
  }

  const tracks = [];
  const mappedBones = new Set();
  const unmappedBones = new Set();
  let totalAngularTravel = 0;

  for (const [boneName, boneData] of Object.entries(json.bones ?? {})) {
    if (!boneData?.frames?.length) continue;
    const canonical = normalizeBoneName(boneName);
    if (CANONICAL_17_BONES.includes(canonical)) mappedBones.add(canonical);
    else unmappedBones.add(boneName);
    const travel = measureFramesTravel(boneData.frames);
    totalAngularTravel += travel;
    tracks.push({ boneName, canonical, frameCount: boneData.frames.length, travel });
  }

  return {
    name: json.name,
    format,
    trackCount: tracks.length,
    mappedBones: [...mappedBones],
    unmappedBones: [...unmappedBones],
    totalAngularTravel,
  };
}

async function loadJson(urlOrPath) {
  if (urlOrPath.startsWith('http')) {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`HTTP ${res.status} ${urlOrPath}`);
    return res.json();
  }
  return JSON.parse(readFileSync(urlOrPath, 'utf8'));
}

async function main() {
  const args = process.argv.slice(2);
  const preferLocal = !args.includes('--cdn-only');
  const localDir = join(ROOT, 'public/assets/moves/clips');

  console.log('═'.repeat(70));
  console.log('BANNON MOTION BANK VERIFICATION');
  console.log('═'.repeat(70));

  let indexSize = 0;
  try {
    const index = await loadJson(DEFAULT_INDEX_URL);
    indexSize = Array.isArray(index) ? index.length : Object.keys(index).length;
    console.log(`Remote index size: ${indexSize}`);
  } catch (e) {
    console.warn(`Index load warning: ${e.message}`);
  }

  const results = [];
  const missingStates = [];
  let converted = 0;
  let failed = 0;

  for (const semanticState of REQUIRED_SEMANTIC_STATES) {
    const file = PREFERRED[semanticState];
    const localPath = join(localDir, file);
    const url = `${CDN_BASE}/${file}`;
    let raw;
    let source;
    try {
      if (preferLocal && existsSync(localPath)) {
        raw = await loadJson(localPath);
        source = `local:${file}`;
      } else {
        raw = await loadJson(url);
        source = `cdn:${file}`;
      }
    } catch (e) {
      console.error(`❌ MISSING_CLIP ${semanticState}: ${e.message}`);
      missingStates.push(semanticState);
      failed++;
      continue;
    }

    try {
      const result = convertClip(raw);
      result.semanticState = semanticState;
      result.source = source;
      results.push(result);
      converted++;
      console.log(
        `✅ ${semanticState.padEnd(14)} ${result.format.padEnd(28)} tracks=${String(result.trackCount).padStart(3)} travel=${result.totalAngularTravel.toFixed(2)} (${source})`,
      );
    } catch (e) {
      console.error(`❌ convert failed ${semanticState}: ${e.message}`);
      failed++;
    }
  }

  const totalTravel = results.reduce((s, r) => s + r.totalAngularTravel, 0);
  const avgTracks = results.length
    ? Math.round(results.reduce((s, r) => s + r.trackCount, 0) / results.length)
    : 0;
  const canonicalCoverage = new Set(results.flatMap((r) => r.mappedBones));

  console.log('─'.repeat(70));
  console.log(`Preferred attempted: ${REQUIRED_SEMANTIC_STATES.length}`);
  console.log(`Converted:           ${converted} / ${REQUIRED_SEMANTIC_STATES.length}`);
  console.log(`Failed:              ${failed}`);
  console.log(`MISSING_CLIP:        ${missingStates.length ? missingStates.join(', ') : 'none'}`);
  console.log(`Avg tracks/clip:     ${avgTracks}`);
  console.log(`Canonical coverage:  ${canonicalCoverage.size} / 17`);
  console.log(`Total angular travel:${totalTravel.toFixed(2)} rad`);
  console.log('─'.repeat(70));
  console.log('FIGHT GATE');
  const conversionPass = converted === REQUIRED_SEMANTIC_STATES.length && failed === 0 && totalTravel > 0;
  console.log(`Conversion PASS: ${conversionPass ? 'YES' : 'NO'}`);
  console.log('FIGHT remains BLOCKED until live GLB SkinnedMesh deformation is measured.');
  console.log('BannonSource submodule is empty on this clone — GLBs not local.');
  console.log('═'.repeat(70));

  if (!conversionPass) process.exitCode = 1;
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
