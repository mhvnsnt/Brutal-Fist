#!/usr/bin/env node
/**
 * verify-bannon-motion-bank.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Offline measurement script for the Bannon motion bank.
 *
 * Loads the Bannon clip index from GitHub, detects format (Euler vs quaternion),
 * converts all preferred semantic state clips, and reports:
 *   - Index size
 *   - Format detected per clip (BANNON_EULER_RX_RY_RZ vs quaternion)
 *   - Converted / failed counts
 *   - Tracks per clip
 *   - Mixamo identity resolution
 *   - Canonical 17-bone coverage
 *   - Total quaternion angular travel (radians)
 *   - Per-clip angular travel
 *
 * Usage:
 *   node scripts/verify-bannon-motion-bank.mjs
 *   node scripts/verify-bannon-motion-bank.mjs --index-url <url>
 *   node scripts/verify-bannon-motion-bank.mjs --dry-run
 *
 * Source: https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/index.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_INDEX_URL =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/index.json';

const REQUIRED_SEMANTIC_STATES = [
  'idle',
  'walk_forward',
  'walk_back',
  'strafe_left',
  'strafe_right',
  'attack_1',
  'attack_2',
  'block',
  'hit_reaction',
  'knockdown',
  'getup',
];

const CANONICAL_17_BONES = [
  'Hips', 'Spine', 'Chest', 'Neck', 'Head',
  'LUpperArm', 'LForeArm', 'LHand',
  'RUpperArm', 'RForeArm', 'RHand',
  'LUpperLeg', 'LLowerLeg', 'LFoot',
  'RUpperLeg', 'RLowerLeg', 'RFoot',
];

// Mixamo bone name → canonical name
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
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeBoneName(name) {
  return MIXAMO_TO_CANONICAL[name] ?? name;
}

function isEulerFormat(json) {
  if (json.hasQuaternion !== false) return false;
  if (!json.bones) return false;
  for (const boneData of Object.values(json.bones)) {
    if (!boneData?.frames?.length) continue;
    if (typeof boneData.frames[0]?.rx === 'number') return true;
  }
  return false;
}

function eulerToQuat(rx, ry, rz, order = 'XYZ') {
  // Manual Euler → quaternion (no Three.js dependency in Node)
  const c1 = Math.cos(rx / 2), s1 = Math.sin(rx / 2);
  const c2 = Math.cos(ry / 2), s2 = Math.sin(ry / 2);
  const c3 = Math.cos(rz / 2), s3 = Math.sin(rz / 2);
  // XYZ order
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

function measureAngularTravel(frames, isEuler) {
  let travel = 0;
  let prev = null;
  for (const frame of frames) {
    let q;
    if (isEuler) {
      q = eulerToQuat(frame.rx ?? 0, frame.ry ?? 0, frame.rz ?? 0);
    } else if (frame.q) {
      q = { x: frame.q[0], y: frame.q[1], z: frame.q[2], w: frame.q[3] };
    } else {
      continue;
    }
    if (prev) {
      const dot = Math.min(1.0, Math.abs(quatDot(prev, q)));
      travel += 2 * Math.acos(dot);
    }
    prev = q;
  }
  return travel;
}

function convertClip(json) {
  const euler = isEulerFormat(json);
  const tracks = [];
  const mappedBones = new Set();
  const unmappedBones = new Set();
  let totalAngularTravel = 0;

  for (const [boneName, boneData] of Object.entries(json.bones ?? {})) {
    if (!boneData?.frames?.length) continue;
    const canonical = normalizeBoneName(boneName);
    const isMapped = CANONICAL_17_BONES.includes(canonical);
    if (isMapped) mappedBones.add(canonical);
    else unmappedBones.add(boneName);

    const travel = measureAngularTravel(boneData.frames, euler);
    totalAngularTravel += travel;
    tracks.push({ boneName, canonical, isMapped, frameCount: boneData.frames.length, travel });
  }

  return {
    name: json.name,
    semanticState: json.semanticState ?? json.name,
    format: euler ? 'BANNON_EULER_RX_RY_RZ' : 'QUATERNION',
    hasQuaternion: !euler,
    trackCount: tracks.length,
    mappedBones: [...mappedBones],
    unmappedBones: [...unmappedBones],
    canonicalCoverage: mappedBones.size,
    totalAngularTravel,
    tracks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const indexUrlArg = args.indexOf('--index-url');
  const indexUrl = indexUrlArg !== -1 ? args[indexUrlArg + 1] : DEFAULT_INDEX_URL;

  console.log('═'.repeat(70));
  console.log('BANNON MOTION BANK VERIFICATION');
  console.log('═'.repeat(70));
  console.log(`Source: ${indexUrl}`);
  if (isDryRun) console.log('DRY RUN — no files written');
  console.log('');

  // Load index
  let index;
  try {
    const res = await fetch(indexUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    index = await res.json();
  } catch (e) {
    console.error(`❌ Failed to load index: ${e.message}`);
    process.exit(1);
  }

  const clips = Array.isArray(index) ? index : (index.clips ?? []);
  console.log(`Index size: ${clips.length}`);
  console.log('');

  // Load and convert preferred semantic state clips
  const results = [];
  const missingStates = [];
  let converted = 0;
  let failed = 0;

  for (const semanticState of REQUIRED_SEMANTIC_STATES) {
    // Find clip entry for this semantic state
    const entry = clips.find(c =>
      c.semanticState === semanticState ||
      c.name === semanticState ||
      (c.aliases ?? []).includes(semanticState)
    );

    if (!entry) {
      missingStates.push(semanticState);
      console.warn(`⚠️  MISSING: No clip entry for semantic state "${semanticState}"`);
      continue;
    }

    // Load the clip JSON
    const clipUrl = entry.url ?? `${indexUrl.replace('index.json', '')}${entry.file ?? entry.name + '.json'}`;
    let clipJson;
    try {
      const res = await fetch(clipUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      clipJson = await res.json();
    } catch (e) {
      console.error(`❌ Failed to load clip "${semanticState}" from ${clipUrl}: ${e.message}`);
      failed++;
      continue;
    }

    try {
      const result = convertClip(clipJson);
      result.semanticState = semanticState;
      results.push(result);
      converted++;
    } catch (e) {
      console.error(`❌ Failed to convert clip "${semanticState}": ${e.message}`);
      failed++;
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────

  console.log('─'.repeat(70));
  console.log('CONVERSION RESULTS');
  console.log('─'.repeat(70));
  console.log(`Preferred attempted:  ${REQUIRED_SEMANTIC_STATES.length} required semantic states`);
  console.log(`Converted:            ${converted} / ${REQUIRED_SEMANTIC_STATES.length}`);
  console.log(`Failed:               ${failed}`);
  console.log(`Missing states:       ${missingStates.length > 0 ? missingStates.join(', ') : 'none'}`);
  console.log('');

  if (results.length > 0) {
    const avgTracks = Math.round(results.reduce((s, r) => s + r.trackCount, 0) / results.length);
    const totalTravel = results.reduce((s, r) => s + r.totalAngularTravel, 0);
    const eulerCount = results.filter(r => r.format === 'BANNON_EULER_RX_RY_RZ').length;
    const quatCount = results.filter(r => r.format === 'QUATERNION').length;

    // Mixamo identity resolution
    const mixamoUnresolved = results.reduce((s, r) => s + r.unmappedBones.length, 0);
    const canonicalCoverage = new Set(results.flatMap(r => r.mappedBones));
    const canonicalUnresolved = CANONICAL_17_BONES.filter(b => !canonicalCoverage.has(b));

    console.log(`Format breakdown:`);
    console.log(`  BANNON_EULER_RX_RY_RZ:  ${eulerCount} clips (hasQuaternion: false)`);
    console.log(`  QUATERNION:             ${quatCount} clips`);
    console.log('');
    console.log(`Tracks / clip:            ${avgTracks} Mixamo quaternion tracks (avg)`);
    console.log(`Mixamo identity unresolved: ${mixamoUnresolved}`);
    console.log(`Canonical 17-bone coverage: ${canonicalCoverage.size} / 17`);
    console.log(`Canonical unresolved / clip: ${canonicalUnresolved.length} (${canonicalUnresolved.join(', ') || 'none'})`);
    console.log(`Total quaternion angular travel: ${totalTravel.toFixed(2)} rad across ${results.length} clips`);
    console.log('');

    console.log('─'.repeat(70));
    console.log('PER-CLIP ANGULAR TRAVEL (radians)');
    console.log('─'.repeat(70));
    for (const r of results) {
      const travelStr = r.totalAngularTravel.toFixed(2).padStart(7);
      const formatStr = r.format === 'BANNON_EULER_RX_RY_RZ' ? '[EULER]' : '[QUAT] ';
      console.log(`  ${formatStr} ${r.semanticState.padEnd(20)} ${travelStr} rad  (${r.trackCount} tracks)`);
    }
    console.log('');

    // FIGHT gate
    console.log('─'.repeat(70));
    console.log('FIGHT GATE');
    console.log('─'.repeat(70));
    const conversionPass = converted === REQUIRED_SEMANTIC_STATES.length && failed === 0;
    console.log(`Conversion PASS: ${conversionPass ? '✅ YES' : '❌ NO'}`);
    console.log('');
    console.log('⚠️  FIGHT IS BLOCKED.');
    console.log('   Conversion PASS is not a skinned-rig PASS.');
    console.log('   The live GLB deformation has not been measured.');
    console.log('   Next step: load a *_rigged_ready.glb → measure actual SkinnedMesh');
    console.log('   vertex/bone deformation → confirm non-zero travel on visible mesh.');
    console.log('');
    console.log('   MISSING_CLIP (required set): ' + (missingStates.length === 0 ? 'none' : missingStates.join(', ')));
  }

  console.log('═'.repeat(70));
  console.log('VERIFICATION COMPLETE');
  console.log('═'.repeat(70));
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
