#!/usr/bin/env node
/**
 * Reproducible proof runner using the canonical public Bannon assets.
 *
 * This does NOT vendor a multi-MB GLB into Brutal-Fist. It downloads the
 * known Bannon source assets into a temporary directory, retargets only the
 * bone names needed by the real 28-joint BANNON rig, and invokes the live
 * deformation harness.
 *
 * Finger tracks are omitted because the 28-joint target does not contain
 * finger joints. No rotations are invented or modified; only target naming
 * is changed. The live harness remains the authority for PASS/UNKNOWN/BLOCKED.
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

const TARGET_NAMES = {
  mixamorigHips: 'Hips',
  mixamorigSpine: 'Spine',
  mixamorigSpine1: 'Spine1',
  mixamorigSpine2: 'Spine2',
  mixamorigNeck: 'Neck',
  mixamorigHead: 'Head',
  mixamorigLeftShoulder: 'LeftShoulder',
  mixamorigLeftArm: 'LeftArm',
  mixamorigLeftForeArm: 'LeftForeArm',
  mixamorigLeftHand: 'LeftHand',
  mixamorigRightShoulder: 'RightShoulder',
  mixamorigRightArm: 'RightArm',
  mixamorigRightForeArm: 'RightForeArm',
  mixamorigRightHand: 'RightHand',
  mixamorigLeftUpLeg: 'LeftUpLeg',
  mixamorigLeftLeg: 'LeftLeg',
  mixamorigLeftFoot: 'LeftFoot',
  mixamorigLeftToeBase: 'LeftToeBase',
  mixamorigRightUpLeg: 'RightUpLeg',
  mixamorigRightLeg: 'RightLeg',
  mixamorigRightFoot: 'RightFoot',
  mixamorigRightToeBase: 'RightToeBase',
};

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
      const targetName = TARGET_NAMES[sourceName];
      if (!targetName) {
        dropped++;
        continue;
      }
      nextBones[targetName] = sample;
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
