#!/usr/bin/env node
/**
 * Measure Mixamo Euler-track bind against every playable roster GLB.
 * Reads local public/models copies (GitHub-sourced, gitignored except Maime).
 * Never invents a skeleton. UNKNOWN/WARN is not PASS.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

const ROOT = process.cwd();
const MODELS = join(ROOT, 'public', 'models');
const IDLE_URL = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/IDLE.json';

function mixamoBindKey(boneName) {
  return boneName.toLowerCase().replace(/^mixamorig[:._-]*/, 'mixamorig');
}

function loadRoster() {
  const src = readFileSync(join(ROOT, 'src/data/bannonGlbRoster.ts'), 'utf8');
  const entries = [];
  const re = /\{id:"([^"]+)",name:"([^"]+)",model:"([^"]+)",attire:"([^"]*)",rigStatus:"([^"]+)",playableGate:"([^"]+)"[^}]*measuredJoints:(\d+)/g;
  let m;
  while ((m = re.exec(src))) {
    entries.push({
      id: m[1],
      name: m[2],
      model: m[3],
      attire: m[4],
      rigStatus: m[5],
      playableGate: m[6],
      measuredJoints: Number(m[7]),
    });
  }
  return entries;
}

function createIO() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
}

async function jointsOf(file) {
  const path = join(MODELS, file);
  if (!existsSync(path)) return { missing: true, joints: [], skins: 0, joints0: 0 };
  const io = createIO();
  const doc = await io.read(path);
  const root = doc.getRoot();
  const skins = root.listSkins();
  const joints = [];
  for (const skin of skins) {
    for (const j of skin.listJoints()) joints.push(j.getName());
  }
  let joints0 = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getAttribute('JOINTS_0')) joints0++;
    }
  }
  return { missing: false, joints, skins: skins.length, joints0 };
}

const idle = await (await fetch(IDLE_URL)).json();
const clipBones = new Set();
for (const key of idle.keys ?? []) {
  for (const b of Object.keys(key.bones ?? {})) clipBones.add(b);
}

const entries = loadRoster();
const playable = entries.filter(e => e.playableGate === 'PASS');
console.log(`[roster-bind] playable attires=${playable.length} fighters=${new Set(playable.map(e => e.id)).size} idleBones=${clipBones.size}`);

const rows = [];
let fail = 0;
for (const e of playable) {
  const glb = await jointsOf(e.model);
  if (glb.missing) {
    fail++;
    rows.push({ ...e, status: 'MISSING_FILE', resolved: 0, unresolved: clipBones.size, joints: 0, joints0: 0 });
    continue;
  }
  const targetKeys = new Map();
  for (const name of glb.joints) targetKeys.set(mixamoBindKey(name), name);
  let resolved = 0;
  const unresolved = [];
  for (const bone of clipBones) {
    if (targetKeys.has(mixamoBindKey(bone))) resolved++;
    else unresolved.push(bone);
  }
  const status = glb.joints0 < 1 || glb.skins < 1
    ? 'NO_SKIN'
    : resolved === 0
      ? 'UNRESOLVED'
      : unresolved.length === 0
        ? 'PASS'
        : resolved >= 17
          ? 'PARTIAL'
          : 'FAIL';
  if (status !== 'PASS' && status !== 'PARTIAL') fail++;
  rows.push({
    fighter: e.id,
    attire: e.attire,
    model: e.model,
    status,
    joints: glb.joints.length,
    joints0: glb.joints0,
    resolved,
    unresolved: unresolved.length,
    missing: unresolved.slice(0, 8),
  });
}

const fighters = [...new Set(playable.map(e => e.id))];
const passFighters = fighters.filter(id => rows.some(r => r.fighter === id && (r.status === 'PASS' || r.status === 'PARTIAL')));
console.table(rows.map(r => ({
  fighter: r.fighter ?? r.id,
  attire: r.attire,
  model: r.model,
  status: r.status,
  joints: r.joints,
  joints0: r.joints0,
  resolved: r.resolved,
  unresolved: r.unresolved,
})));
console.log(JSON.stringify({
  playableAttires: playable.length,
  fighters: fighters.length,
  passOrPartialFighters: passFighters.length,
  fail,
  clipBones: clipBones.size,
  statuses: rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {}),
}, null, 2));
if (fail > 0) process.exitCode = 1;
