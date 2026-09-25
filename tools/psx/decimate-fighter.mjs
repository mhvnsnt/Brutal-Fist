#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { simplify, weld, dedup, textureCompress, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import sharp from 'sharp';

const [, , input, output, ...args] = process.argv;
if (!input || !output) {
  console.error('usage: node tools/psx/decimate-fighter.mjs <input.glb> <output.glb> [--tris=18000] [--tex=256]');
  process.exit(2);
}
const arg = (name, fallback) => {
  const v = args.find(x => x.startsWith(`--${name}=`));
  return v ? Number(v.split('=')[1]) : fallback;
};
const targetTris = arg('tris', 18000);
const tex = arg('tex', 256);

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder
  });

function triangleCount(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      n += indices ? indices.getCount() / 3 : (prim.getAttribute('POSITION')?.getCount() ?? 0) / 3;
    }
  }
  return Math.round(n);
}

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;

const doc = await io.read(input);
const before = triangleCount(doc);
const ratio = before ? Math.min(1, targetTris / before) : 1;

await doc.transform(
  weld({ tolerance: 0.0001 }),
  simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01, lockBorder: false }),
  dedup(),
  prune()
);

try {
  await doc.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      resize: [tex, tex],
      quality: 85
    })
  );
} catch (error) {
  console.warn('texture compression skipped:', error.message);
}

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
await io.write(output, doc);

console.log(JSON.stringify({
  input,
  output,
  trianglesBefore: before,
  trianglesAfter: triangleCount(doc),
  textureTarget: tex,
  skins: doc.getRoot().listSkins().length,
  animations: doc.getRoot().listAnimations().length
}, null, 2));
