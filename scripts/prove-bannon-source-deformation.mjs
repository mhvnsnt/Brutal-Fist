#!/usr/bin/env node
/**
 * Reproducible proof runner using the canonical public Bannon assets.
 *
 * This does NOT vendor a multi-MB GLB into Brutal-Fist. It downloads the
 * known Bannon source assets into a temporary directory, retains only the
 * bone tracks present on the real 28-joint BANNON reference rig, and invokes
 * the live deformation harness.
 *
 * Finger tracks are omitted because the 28-joint target does not contain
 * finger joints. No rotations are invented or modified; source Mixamo bone
 * names are preserved because the reference GLB itself uses those names.
 * The live harness remains the authority for PASS/UNKNOWN/BLOCKED.
 */

import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GLB_URL = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models/BANNON_rigged.glb';
const CLIP_URL = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/DWARF_WALK.json';
const GLB_GIT_BLOB_SHA = '1842af42f6777c6f04b79c8c5a877dcc27b3f3e9';

// These are the 20-joint pose vocabulary plus the additional hand/toe joints
// present in the actual Mixamo-named BANNON reference skeleton. We preserve
// names byte-for-byte so the live harness can exact-match the real GLB bones.
const TARGET_NAMES = new Set([
  'mixamorigHips',
  'mixamorigSpine',
  'mixamorigSpine1',
  'mixamorigSpine2',
  'mixamorigNeck',
  'mixamorigHead',
  'mixamorigLeftShoulder',
  'mixamorigLeftArm',
  'mixamorigLeftForeArm',
  'mixamorigLeftHand',
  'mixamorigRightShoulder',
  'mixamorigRightArm',
  'mixamorigRightForeArm',
  'mixamorigRightHand',
  'mixamorigLeftUpLeg',
  'mixamorigLeftLeg',
  'mixamorigLeftFoot',
  'mixamorigLeftToeBase',
  'mixamorigRightUpLeg',
  'mixamorigRightLeg',
  'mixamorigRightFoot',
  'mixamorigRightToeBase',
]);

async function download(url, output) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed ${response.status} ${response.statusText}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(output, bytes);
  return bytes.length;
}

async function retargetClip(sourcePath, targetPath) {
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  let retained = 0;
  let dropped = 0;

  for (const key of source.keys ?? []) {
    const nextBones = {};
    for (const [sourceName, sample] of Object.entries(key.bones ?? {})) {
      if (!TARGET_NAMES.has(sourceName)) {
        dropped++;
        continue;
      }
      nextBones[sourceName] = sample;
      retained++;
    }
    key.bones = nextBones;
  }

  source.name = source.name ?? 'DWARF_WALK';
  await writeFile(targetPath, JSON.stringify(source));
  return { retained, dropped, frames: source.keys?.length ?? 0 };
}

const dir = await mkdtemp(join(tmpdir(), 'brutal-fist-bannon-proof-'));
const glb = join(dir, 'BANNON_rigged.glb');
const sourceClip = join(dir, 'DWARF_WALK.source.json');
const clip = join(dir, 'DWARF_WALK.target.json');

try {
  const glbBytes = await download(GLB_URL, glb);
  const clipBytes = await download(CLIP_URL, sourceClip);
  const retarget = await retargetClip(sourceClip, clip);

  console.log(JSON.stringify({
    source: {
      glb: GLB_URL,
      glbGitBlobSha: GLB_GIT_BLOB_SHA,
      glbBytes,
      clip: CLIP_URL,
      clipBytes,
    },
    retarget,
  }, null, 2));

  const script = join(ROOT, 'scripts', 'prove-bannon-live-deformation.mjs');
  const child = spawn(process.execPath, [script, '--glb', glb, '--clip', clip], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  process.exit(code ?? 1);
} finally {
  await rm(dir, { recursive: true, force: true });
}
