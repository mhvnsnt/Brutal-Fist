#!/usr/bin/env node
/**
 * Pull the baked baseColor atlas from a fighter GLB so 2D card art is the
 * actual model likeness, not a guessed drawing.
 *
 * Usage: node scripts/extract-glb-likeness.mjs <in.glb> <out.png>
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'node:fs';
import path from 'node:path';

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error('usage: node scripts/extract-glb-likeness.mjs <in.glb> <out.png>');
  process.exit(2);
}

import { MeshoptDecoder } from 'meshoptimizer';

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(inPath);
const textures = doc.getRoot().listTextures();
if (!textures.length) {
  console.error('no textures in', inPath);
  process.exit(1);
}
// Prefer the largest image (usually the character atlas).
let best = textures[0];
for (const t of textures) {
  const a = t.getImage()?.byteLength ?? 0;
  const b = best.getImage()?.byteLength ?? 0;
  if (a > b) best = t;
}
const bytes = best.getImage();
if (!bytes) {
  console.error('empty image');
  process.exit(1);
}
const mime = best.getMimeType() || 'image/png';
const ext = mime.includes('jpeg') || mime.includes('jpg') ? '.jpg'
  : mime.includes('webp') ? '.webp'
  : '.png';
const dest = outPath.replace(/\.(png|jpg|jpeg|webp)$/i, ext);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, bytes);
console.log(`wrote ${dest} (${bytes.byteLength} bytes, ${mime}, ${textures.length} textures)`);
