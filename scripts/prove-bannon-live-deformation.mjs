#!/usr/bin/env node
/**
 * Live deformation proof for a REAL skinned GLB + REAL Bannon motion clip.
 *
 * This is deliberately different from motion-bank conversion verification:
 * conversion/track counts are not enough to claim animation PASS.
 *
 * Usage:
 *   node scripts/prove-bannon-live-deformation.mjs \
 *     --glb path/to/BANNON_rigged_ready.glb \
 *     --clip path/to/BOXING.json \
 *     --at 0.5
 *
 * The harness proves the runtime chain:
 *   GLB -> SkinnedMesh/Skeleton -> Bannon Euler clip -> AnimationMixer
 *       -> CPU skinning -> measurable vertex displacement
 *
 * It never creates a skeleton, weights, inverse bind matrices, or placeholder
 * animation. A missing/unresolved target bone or zero vertex deformation is
 * BLOCKED/UNKNOWN rather than PASS.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const EPSILON = 1e-5;
const DEFAULT_SAMPLE_LIMIT = 512;

function arg(name, fallback = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const glbPath = arg('--glb');
const clipPath = arg('--clip');
const requestedTime = arg('--at');
const sampleLimit = Number(arg('--samples', String(DEFAULT_SAMPLE_LIMIT)));

if (!glbPath || !clipPath) {
  console.error('Usage: node scripts/prove-bannon-live-deformation.mjs --glb <file.glb> --clip <clip.json> [--at <seconds>] [--samples <count>]');
  process.exit(2);
}

function toRadians(v) {
  return Math.abs(v) > Math.PI * 2.5 ? THREE.MathUtils.degToRad(v) : v;
}

function sampleQuaternion(sample) {
  if (sample?.q && sample.q.length === 4) {
    return new THREE.Quaternion(sample.q[0], sample.q[1], sample.q[2], sample.q[3]).normalize();
  }
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(
    toRadians(sample?.rx ?? 0),
    toRadians(sample?.ry ?? 0),
    toRadians(sample?.rz ?? 0),
    'XYZ',
  ));
}

function frameTime(key, index, frameRate) {
  return Number.isFinite(key?.t) ? key.t : index / Math.max(1, frameRate);
}

function convertBannonClip(json) {
  const keys = [...(json.keys ?? [])];
  const frameRate = Number(json.frameRate ?? 30);
  const duration = Number(json.dur ?? json.duration ?? (keys.length ? frameTime(keys.at(-1), keys.length - 1, frameRate) : 0));
  const boneNames = new Set();
  for (const key of keys) for (const bone of Object.keys(key.bones ?? {})) boneNames.add(bone);

  const tracks = [];
  for (const bone of boneNames) {
    const times = [];
    const values = [];
    keys.forEach((key, index) => {
      const sample = key.bones?.[bone];
      if (!sample || (sample.rx == null && sample.ry == null && sample.rz == null && sample.q == null)) return;
      const q = sampleQuaternion(sample);
      times.push(frameTime(key, index, frameRate));
      values.push(q.x, q.y, q.z, q.w);
    });
    if (times.length) tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, values));
  }

  // Bannon pose.pelvis is included only when the source explicitly has a
  // Mixamo hips bone. No synthetic root is invented.
  const pelvisTimes = [];
  const pelvisValues = [];
  keys.forEach((key, index) => {
    const pelvis = key.pose?.pelvis;
    if (!Array.isArray(pelvis) || pelvis.length < 3) return;
    pelvisTimes.push(frameTime(key, index, frameRate));
    pelvisValues.push(Number(pelvis[0]) || 0, Number(pelvis[1]) || 0, Number(pelvis[2]) || 0);
  });
  if (pelvisTimes.length && boneNames.has('mixamorigHips')) {
    tracks.push(new THREE.VectorKeyframeTrack('mixamorigHips.position', pelvisTimes, pelvisValues));
  }

  return new THREE.AnimationClip(json.name ?? path.basename(clipPath, '.json'), duration, tracks);
}

const aliases = {
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

function canonical(name) {
  return aliases[name] ?? name;
}

function collectSkinnedMeshes(root) {
  const meshes = [];
  root.traverse((object) => {
    if (object.isSkinnedMesh) meshes.push(object);
  });
  return meshes;
}

function collectBones(root) {
  const bones = [];
  root.traverse((object) => {
    if (object.isBone) bones.push(object);
  });
  return bones;
}

function resolveTracks(clip, bones) {
  const exact = new Set(bones.map((b) => b.name));
  const byCanonical = new Map();
  for (const bone of bones) {
    const key = canonical(bone.name);
    if (!byCanonical.has(key)) byCanonical.set(key, bone.name);
  }

  const resolved = [];
  const unresolved = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    const objectPath = dot >= 0 ? track.name.slice(0, dot) : track.name;
    const property = dot >= 0 ? track.name.slice(dot + 1) : '';
    const pipe = objectPath.lastIndexOf('|');
    const sourceName = pipe >= 0 ? objectPath.slice(pipe + 1) : objectPath;
    const target = exact.has(sourceName) ? sourceName : byCanonical.get(canonical(sourceName));
    if (target && property) {
      const Ctor = track.constructor;
      resolved.push(new Ctor(`${target}.${property}`, track.times, track.values, track.getInterpolation()));
    } else {
      unresolved.push(track.name);
    }
  }

  return {
    clip: new THREE.AnimationClip(clip.name, clip.duration, resolved),
    resolved,
    unresolved,
  };
}

function sampleMesh(mesh, limit) {
  const count = mesh.geometry.attributes.position?.count ?? 0;
  const n = Math.min(count, Math.max(1, limit));
  const indices = [];
  if (n === count) {
    for (let i = 0; i < count; i++) indices.push(i);
  } else {
    for (let i = 0; i < n; i++) indices.push(Math.floor(i * count / n));
  }
  return indices;
}

function captureVertices(meshes, limit) {
  const samples = [];
  for (const mesh of meshes) {
    const indices = sampleMesh(mesh, limit);
    for (const index of indices) {
      const position = mesh.getVertexPosition(index, new THREE.Vector3());
      samples.push({ mesh, index, position: position.clone() });
    }
  }
  return samples;
}

function measureVertexDisplacement(samples) {
  let max = 0;
  let sum = 0;
  let changed = 0;
  for (const sample of samples) {
    const current = sample.mesh.getVertexPosition(sample.index, new THREE.Vector3());
    const d = current.distanceTo(sample.position);
    max = Math.max(max, d);
    sum += d;
    if (d > EPSILON) changed++;
  }
  return {
    sampledVertices: samples.length,
    changedVertices: changed,
    maxDisplacement: max,
    meanDisplacement: samples.length ? sum / samples.length : 0,
  };
}

function captureBoneRotations(bones) {
  return new Map(bones.map((bone) => [bone.uuid, bone.quaternion.clone()]));
}

function measureBoneRotationTravel(bones, before) {
  let max = 0;
  let total = 0;
  let changed = 0;
  for (const bone of bones) {
    const q = before.get(bone.uuid);
    if (!q) continue;
    const angle = q.angleTo(bone.quaternion);
    max = Math.max(max, angle);
    total += angle;
    if (angle > EPSILON) changed++;
  }
  return { changedBones: changed, maxBoneRotationRadians: max, totalBoneRotationRadians: total };
}

async function loadGLB(filename) {
  const buffer = await fs.readFile(filename);
  const loader = new GLTFLoader();
  return await new Promise((resolve, reject) => {
    loader.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), path.dirname(filename) + '/', resolve, reject);
  });
}

const gltf = await loadGLB(glbPath);
const scene = gltf.scene;
const meshes = collectSkinnedMeshes(scene);
const bones = collectBones(scene);

const baseReport = {
  glb: path.resolve(glbPath),
  clip: path.resolve(clipPath),
  skinnedMeshes: meshes.length,
  bones: bones.length,
  skinAttributesValid: meshes.every((mesh) => !!mesh.geometry.attributes.skinIndex && !!mesh.geometry.attributes.skinWeight),
};

if (!meshes.length || !bones.length || !baseReport.skinAttributesValid) {
  console.log(JSON.stringify({
    verdict: 'BLOCKED',
    reason: 'TARGET_NOT_SKINNED',
    ...baseReport,
  }, null, 2));
  process.exit(1);
}

for (const mesh of meshes) mesh.skeleton?.update();
scene.updateMatrixWorld(true);

const clipJson = JSON.parse(await fs.readFile(clipPath, 'utf8'));
const sourceClip = convertBannonClip(clipJson);
const bound = resolveTracks(sourceClip, bones);

if (bound.resolved.length === 0 || bound.unresolved.length > 0) {
  console.log(JSON.stringify({
    verdict: 'BLOCKED',
    reason: bound.resolved.length === 0 ? 'NO_TRACKS_RESOLVED' : 'UNRESOLVED_TRACKS',
    ...baseReport,
    clipDuration: sourceClip.duration,
    sourceTracks: sourceClip.tracks.length,
    resolvedTracks: bound.resolved.length,
    unresolvedTracks: bound.unresolved.length,
    unresolvedTrackNames: bound.unresolved.slice(0, 50),
  }, null, 2));
  process.exit(1);
}

const mixer = new THREE.AnimationMixer(scene);
const action = mixer.clipAction(bound.clip);
action.reset().setLoop(THREE.LoopOnce, 1).clampWhenFinished = true;
action.play();

for (const mesh of meshes) mesh.skeleton?.pose();
for (const mesh of meshes) mesh.skeleton?.update();
scene.updateMatrixWorld(true);
const vertexSamples = captureVertices(meshes, Number.isFinite(sampleLimit) ? sampleLimit : DEFAULT_SAMPLE_LIMIT);
const beforeBones = captureBoneRotations(bones);

const testTime = Number.isFinite(Number(requestedTime))
  ? Math.max(0, Math.min(Number(requestedTime), sourceClip.duration || 0))
  : Math.max(0.05, Math.min(sourceClip.duration * 0.5, sourceClip.duration));

mixer.setTime(testTime);
scene.updateMatrixWorld(true);
for (const mesh of meshes) mesh.skeleton?.update();

const vertex = measureVertexDisplacement(vertexSamples);
const bone = measureBoneRotationTravel(bones, beforeBones);
const verdict = vertex.maxDisplacement > EPSILON && bone.changedBones > 0
  ? 'PASS'
  : 'UNKNOWN';

console.log(JSON.stringify({
  verdict,
  reason: verdict === 'PASS'
    ? 'AUTHORED_CLIP_DEFORMED_VISIBLE_SKINNED_MESH'
    : 'MIXER_OR_BONE_ACTIVITY_DID_NOT_PROVE_VISIBLE_VERTEX_DEFORMATION',
  ...baseReport,
  clipName: sourceClip.name,
  clipDuration: sourceClip.duration,
  sampleTime: testTime,
  sourceTracks: sourceClip.tracks.length,
  resolvedTracks: bound.resolved.length,
  unresolvedTracks: bound.unresolved.length,
  vertex,
  bone,
}, null, 2));

process.exit(verdict === 'PASS' ? 0 : 1);
