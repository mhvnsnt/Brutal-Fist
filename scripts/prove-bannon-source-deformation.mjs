#!/usr/bin/env node
/**
 * Reproducible proof runner using the canonical public Bannon assets.
 *
 * This does NOT vendor a multi-MB GLB into Brutal-Fist. It downloads the
 * known Bannon source assets into a temporary directory, then invokes the
 * real live-deformation harness against them.
 *
 * The Bannon GLB Git blob SHA is pinned below. The clip URL is pinned to the
 * main branch because its contents are already independently verified by the
 * motion-bank verifier. The live harness remains the authority for
 * PASS/UNKNOWN/BLOCKED.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GLB_URL = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models/BANNON_rigged.glb';
const CLIP_URL = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/DWARF_WALK.json';
const GLB_GIT_BLOB_SHA = '1842af42f6777c6f04b79c8c5a877dcc27b3f3e9';

async function download(url, output) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`Download failed ${response.status} ${response.statusText}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(output, bytes);
  return bytes.length;
}

const dir = await mkdtemp(join(tmpdir(), 'brutal-fist-bannon-proof-'));
const glb = join(dir, 'BANNON_rigged.glb');
const clip = join(dir, 'DWARF_WALK.json');

try {
  const glbBytes = await download(GLB_URL, glb);
  const clipBytes = await download(CLIP_URL, clip);

  console.log(JSON.stringify({
    source: {
      glb: GLB_URL,
      glbGitBlobSha: GLB_GIT_BLOB_SHA,
      glbBytes,
      clip: CLIP_URL,
      clipBytes,
    },
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
