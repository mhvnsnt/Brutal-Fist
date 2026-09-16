#!/usr/bin/env node
/**
 * Copy baseColor textures from a painted named-part GLB onto a skinned sibling
 * without touching positions, joints, or weights.
 *
 * Usage: node scripts/restore-glb-textures.mjs <painted.glb> <skinned.glb>
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const [, , paintedPath, skinnedPath] = process.argv;
if (!paintedPath || !skinnedPath) {
  console.error('usage: node scripts/restore-glb-textures.mjs <painted.glb> <skinned.glb>');
  process.exit(2);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const painted = await io.read(paintedPath);
const skinned = await io.read(skinnedPath);

const srcMat = painted.getRoot().listMaterials().find((m) => m.getBaseColorTexture())
  ?? painted.getRoot().listMaterials()[0];
const srcTex = srcMat?.getBaseColorTexture();
if (!srcMat || !srcTex || !srcTex.getImage()) {
  console.error('no baseColor texture on painted source');
  process.exit(1);
}

const image = srcTex.getImage();
const mime = srcTex.getMimeType() || 'image/png';
let restored = 0;
for (const mat of skinned.getRoot().listMaterials()) {
  const tex = skinned.createTexture(srcTex.getName() || 'baseColor')
    .setImage(image)
    .setMimeType(mime);
  mat.setBaseColorTexture(tex);
  restored++;
}

await io.write(skinnedPath, skinned);
console.log(`restored ${restored} material texture(s) → ${skinnedPath} (${image.byteLength} bytes, ${mime})`);
