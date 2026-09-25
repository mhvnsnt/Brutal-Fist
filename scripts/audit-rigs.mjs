/**
 * Decode every public/models GLB with glTF-Transform + meshoptimizer and
 * measure skins, joints, and weight sums. Does not rewrite a file unless
 * `--fix` is passed AND a vertex weight sum is off by more than 0.02.
 * Runtime playback must not renormalize weights (CharacterPipeline law).
 *
 *   node scripts/audit-rigs.mjs
 *   node scripts/audit-rigs.mjs --fix
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const FIX = process.argv.includes('--fix');
const MODELS = join(process.cwd(), 'public/models');
const OUT = join(process.cwd(), 'src/data/rigAudit.generated.json');
const WEIGHT_EPS = 0.02;

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  });

function rosterExpectations() {
  const src = readFileSync(join(process.cwd(), 'src/data/bannonGlbRoster.ts'), 'utf8');
  const rows = [];
  for (const line of src.split('\n')) {
    const model = line.match(/model:"([^"]+)"/);
    if (!model) continue;
    const joints = line.match(/measuredJoints:(\d+)/);
    const gate = line.match(/playableGate:"([^"]+)"/);
    rows.push({
      model: model[1],
      measuredJoints: joints ? Number(joints[1]) : null,
      playable: gate?.[1] === 'PASS',
    });
  }
  return rows;
}

function weightStats(doc) {
  let samples = 0;
  let off = 0;
  let corrected = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const weights = prim.getAttribute('WEIGHTS_0');
      if (!weights) continue;
      const src = weights.getArray();
      if (!src || src.length < 4) continue;
      const next = FIX ? new Float32Array(src.length) : null;
      for (let i = 0; i < src.length; i += 4) {
        const sum = src[i] + src[i + 1] + src[i + 2] + src[i + 3];
        samples++;
        if (sum <= 1e-6) {
          if (next) next.set(src.subarray(i, i + 4), i);
          continue;
        }
        if (Math.abs(sum - 1) > WEIGHT_EPS) {
          off++;
          if (next) {
            corrected++;
            next[i] = src[i] / sum;
            next[i + 1] = src[i + 1] / sum;
            next[i + 2] = src[i + 2] / sum;
            next[i + 3] = src[i + 3] / sum;
          }
        } else if (next) {
          next.set(src.subarray(i, i + 4), i);
        }
      }
      if (next && corrected > 0) weights.setArray(next);
    }
  }
  return { samples, off, corrected };
}

const files = readdirSync(MODELS).filter((f) => f.endsWith('.glb')).sort();
const reports = [];
let wrote = 0;

for (const file of files) {
  const path = join(MODELS, file);
  const doc = await io.read(path);
  const root = doc.getRoot();
  const skins = root.listSkins();
  const jointNames = new Set();
  let ibmShort = 0;
  for (const skin of skins) {
    const joints = skin.listJoints();
    for (const joint of joints) jointNames.add(joint.getName());
    const ibm = skin.getInverseBindMatrices();
    if (!ibm || ibm.getCount() !== joints.length) ibmShort++;
  }
  let joints0 = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getAttribute('JOINTS_0')) joints0++;
    }
  }
  const weights = weightStats(doc);
  const row = {
    file,
    skins: skins.length,
    joints: jointNames.size,
    joints0,
    ibmShort,
    weightSamples: weights.samples,
    weightOff: weights.off,
    animations: root.listAnimations().length,
    extensions: root.listExtensionsUsed().map((e) => e.extensionName),
  };
  reports.push(row);
  if (FIX && weights.corrected > 0) {
    await io.write(path, doc);
    wrote++;
    console.log(`fixed ${file} vertices=${weights.corrected}`);
  }
}

const roster = rosterExpectations();
const byFile = new Map(reports.map((r) => [r.file, r]));
const problems = [];
for (const entry of roster) {
  const measured = byFile.get(entry.model);
  if (!measured) {
    problems.push(`roster model missing on disk: ${entry.model}`);
    continue;
  }
  if (entry.playable && (measured.skins < 1 || measured.joints < 15 || measured.joints0 < 1)) {
    problems.push(`playable but not skinned: ${entry.model} skins=${measured.skins} joints=${measured.joints}`);
  }
  if (entry.measuredJoints != null && entry.measuredJoints !== measured.joints) {
    problems.push(`joint count drift ${entry.model}: roster ${entry.measuredJoints} measured ${measured.joints}`);
  }
}

const registered = new Set(roster.map((r) => r.model));
const unlisted = reports
  .filter((r) => !registered.has(r.file))
  .map((r) => ({
    file: r.file,
    skins: r.skins,
    joints: r.joints,
    playable: r.skins >= 1 && r.joints >= 15 && r.joints0 >= 1,
  }));

writeFileSync(OUT, JSON.stringify({ generatedBy: 'scripts/audit-rigs.mjs', reports, unlisted }, null, 2));

const playable = reports.filter((r) => r.skins >= 1 && r.joints >= 15 && r.joints0 >= 1);
const weak = reports.filter((r) => !(r.skins >= 1 && r.joints >= 15 && r.joints0 >= 1));
const weightBad = reports.filter((r) => r.weightOff > 0);
console.log(`glbs=${reports.length} skinned=${playable.length} unskinned=${weak.length} weightOff=${weightBad.length} rewrote=${wrote}`);
if (weak.length) console.log('unskinned', weak.map((r) => r.file).join(', '));
if (weightBad.length) console.log('weightOff', weightBad.map((r) => `${r.file}:${r.weightOff}`).join(', '));
if (unlisted.length) {
  console.log('not in roster', unlisted.map((r) => `${r.file}${r.playable ? ' (skinned, not a new costume)' : ''}`).join(', '));
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
