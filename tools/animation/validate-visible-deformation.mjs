#!/usr/bin/env node
import fs from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const file = process.argv[2];
if (!file) {
  console.error('usage: node tools/animation/validate-visible-deformation.mjs <fighter.glb>');
  process.exit(2);
}

const bytes = await fs.readFile(file);
const loader = new GLTFLoader();
const gltf = await new Promise((resolve, reject) => loader.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject));
const root = SkeletonUtils.clone(gltf.scene);
const meshes = [];
root.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });

const report = {
  file,
  bones: 0,
  skinnedMeshes: meshes.length,
  nativeClips: gltf.animations.length,
  deformingClips: [],
  status: 'BLOCKED',
};
root.traverse(o => { if (o.isBone) report.bones += 1; });

if (!report.bones || !meshes.length || !gltf.animations.length) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(1);
}

const mixer = new THREE.AnimationMixer(root);
const before = new Map();
const sample = new THREE.Vector3();
for (const mesh of meshes) {
  const n = Math.min(mesh.geometry.getAttribute('position')?.count ?? 0, 64);
  const values = [];
  for (let i = 0; i < n; i++) values.push(mesh.getVertexPosition(i, new THREE.Vector3()).clone());
  before.set(mesh, values);
}

for (const clip of gltf.animations) {
  root.traverse(o => { if (o.isBone) o.rotation.set(0, 0, 0); });
  const action = mixer.clipAction(clip);
  action.reset().setLoop(THREE.LoopOnce, 1).play();
  mixer.update(Math.min(Math.max(clip.duration * 0.5, 1 / 60), 0.5));
  let maxDelta = 0;
  for (const mesh of meshes) {
    const prior = before.get(mesh) ?? [];
    for (let i = 0; i < prior.length; i++) {
      const now = mesh.getVertexPosition(i, sample);
      maxDelta = Math.max(maxDelta, now.distanceTo(prior[i]));
    }
  }
  action.stop();
  if (maxDelta > 1e-4) report.deformingClips.push({ name: clip.name, maxVertexDelta: maxDelta });
}

report.status = report.deformingClips.length ? 'PASS' : 'BLOCKED';
console.log(JSON.stringify(report, null, 2));
process.exit(report.status === 'PASS' ? 0 : 1);
