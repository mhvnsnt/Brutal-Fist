/**
 * Measure Mixamo hip yaw the same way playback does: XYZ euler → quaternion,
 * then YXZ yaw, unwrapped. A spin is yaw range ≥ 0.85 rad (neutralizeHipYaw).
 * Raw euler.ry travel double-counts flips and is not used.
 * This does not rewrite clips.
 *
 *   node scripts/audit-motion.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';

const DIR = join(process.cwd(), 'public/motion');
const OUT = join(process.cwd(), 'src/data/motionAudit.generated.json');
const SKIP = new Set(['index.json', 'local.json', 'combat_clip_map.json']);
const SPIN = 0.85;

const q = new THREE.Quaternion();
const e = new THREE.Euler();

function yawOf(rx, ry, rz) {
  q.setFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
  e.setFromQuaternion(q, 'YXZ');
  return e.y;
}

function hipRange(keys) {
  const yaws = [];
  for (const key of keys ?? []) {
    const hip = key?.bones?.mixamorigHips ?? key?.bones?.['mixamorig:Hips'];
    if (!hip || typeof hip.ry !== 'number') continue;
    yaws.push(yawOf(hip.rx ?? 0, hip.ry, hip.rz ?? 0));
  }
  if (yaws.length < 2) return 0;
  const unwrapped = [yaws[0]];
  for (let i = 1; i < yaws.length; i++) {
    let y = yaws[i];
    while (y - unwrapped[i - 1] > Math.PI) y -= Math.PI * 2;
    while (y - unwrapped[i - 1] < -Math.PI) y += Math.PI * 2;
    unwrapped.push(y);
  }
  let lo = unwrapped[0];
  let hi = unwrapped[0];
  for (const y of unwrapped) {
    if (y < lo) lo = y;
    if (y > hi) hi = y;
  }
  return hi - lo;
}

const rows = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json') && !SKIP.has(f)).sort()) {
  const data = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
  const keys = data.keys ?? [];
  const first = keys[0]?.bones ?? {};
  const travel = hipRange(keys);
  const firstHip = keys[0]?.bones?.mixamorigHips;
  const lastHip = keys[keys.length - 1]?.bones?.mixamorigHips;
  let returns = false;
  if (firstHip && lastHip) {
    const a = new THREE.Quaternion().setFromEuler(new THREE.Euler(firstHip.rx ?? 0, firstHip.ry ?? 0, firstHip.rz ?? 0, 'XYZ'));
    const b = new THREE.Quaternion().setFromEuler(new THREE.Euler(lastHip.rx ?? 0, lastHip.ry ?? 0, lastHip.rz ?? 0, 'XYZ'));
    returns = a.angleTo(b) < 0.05;
  }
  rows.push({
    file: file.replace(/\.json$/, ''),
    dur: data.dur ?? 0,
    keys: keys.length,
    bones: Object.keys(first).length,
    hipYawRange: Math.round(travel * 1000) / 1000,
    returnsToFirstPose: returns,
    spin: travel >= SPIN,
  });
}

const hurricane = rows.find((r) => r.file === 'HURRICANE_KICK');
writeFileSync(OUT, JSON.stringify({ generatedBy: 'scripts/audit-motion.mjs', spinRadians: SPIN, clips: rows }, null, 2));

const spins = rows.filter((r) => r.spin);
console.log(`clips=${rows.length} spins=${spins.length}`);
console.log(spins.map((r) => `${r.file} dur=${r.dur}s yaw=${r.hipYawRange}${r.returnsToFirstPose ? ' returns' : ''}`).join('\n'));
if (!hurricane || hurricane.hipYawRange < 2) {
  console.error(`HURRICANE_KICK yaw range ${hurricane?.hipYawRange ?? 'missing'} — expected a real spin (>2 rad)`);
  process.exit(1);
}
