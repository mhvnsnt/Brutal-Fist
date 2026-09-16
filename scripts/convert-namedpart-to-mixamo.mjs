#!/usr/bin/env node
/**
 * Convert a Bannon named-part GLB (pelvis/chest/head/shL/…) into a Mixamo
 * SkinnedMesh GLB. Each part is 100% weighted to its mapped Mixamo bone.
 * Inverse bind matrices come from the part's authored world transform —
 * no proximity guess, no runtime synthetic skeleton.
 *
 * Usage: node scripts/convert-namedpart-to-mixamo.mjs
 */
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

const ROOT = process.cwd();
const MODELS = join(ROOT, 'public', 'models');

const PART_TO_MIXAMO = {
  pelvis: 'mixamorigHips',
  chest: 'mixamorigSpine2',
  head: 'mixamorigHead',
  shL: 'mixamorigLeftArm',
  elL: 'mixamorigLeftForeArm',
  haL: 'mixamorigLeftHand',
  shR: 'mixamorigRightArm',
  elR: 'mixamorigRightForeArm',
  haR: 'mixamorigRightHand',
  hipL: 'mixamorigLeftUpLeg',
  knL: 'mixamorigLeftLeg',
  ftL: 'mixamorigLeftFoot',
  hipR: 'mixamorigRightUpLeg',
  knR: 'mixamorigRightLeg',
  ftR: 'mixamorigRightFoot',
};

const MIXAMO_HIERARCHY = [
  ['mixamorigHips', null],
  ['mixamorigSpine', 'mixamorigHips'],
  ['mixamorigSpine1', 'mixamorigSpine'],
  ['mixamorigSpine2', 'mixamorigSpine1'],
  ['mixamorigNeck', 'mixamorigSpine2'],
  ['mixamorigHead', 'mixamorigNeck'],
  ['mixamorigLeftShoulder', 'mixamorigSpine2'],
  ['mixamorigLeftArm', 'mixamorigLeftShoulder'],
  ['mixamorigLeftForeArm', 'mixamorigLeftArm'],
  ['mixamorigLeftHand', 'mixamorigLeftForeArm'],
  ['mixamorigRightShoulder', 'mixamorigSpine2'],
  ['mixamorigRightArm', 'mixamorigRightShoulder'],
  ['mixamorigRightForeArm', 'mixamorigRightArm'],
  ['mixamorigRightHand', 'mixamorigRightForeArm'],
  ['mixamorigLeftUpLeg', 'mixamorigHips'],
  ['mixamorigLeftLeg', 'mixamorigLeftUpLeg'],
  ['mixamorigLeftFoot', 'mixamorigLeftLeg'],
  ['mixamorigLeftToeBase', 'mixamorigLeftFoot'],
  ['mixamorigRightUpLeg', 'mixamorigHips'],
  ['mixamorigRightLeg', 'mixamorigRightUpLeg'],
  ['mixamorigRightFoot', 'mixamorigRightLeg'],
  ['mixamorigRightToeBase', 'mixamorigRightFoot'],
];

function createIO() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
}

function mat4Identity() {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function invertMat4(m) {
  // gl-matrix style invert for column-major 4x4
  const out = new Float32Array(16);
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) return mat4Identity();
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}

function translationMat4(x, y, z) {
  const m = mat4Identity();
  m[12] = x; m[13] = y; m[14] = z;
  return m;
}

async function convert(srcName, dstName) {
  const srcPath = join(MODELS, srcName);
  if (!existsSync(srcPath)) throw new Error(`missing ${srcPath}`);
  const io = createIO();
  const src = await io.read(srcPath);
  const srcRoot = src.getRoot();

  const partWorld = {};
  for (const node of srcRoot.listNodes()) {
    const name = node.getName();
    if (!PART_TO_MIXAMO[name]) continue;
    const t = node.getTranslation() ?? [0, 0, 0];
    const parent = node.getParentNode?.() ?? node.getParent?.();
    // Accumulate translations up the named-part chain (these files are translation-only).
    let wx = t[0], wy = t[1], wz = t[2];
    let p = node;
    const seen = new Set();
    while (p) {
      const parentNode = typeof p.getParentNode === 'function' ? p.getParentNode() : null;
      if (!parentNode || seen.has(parentNode)) break;
      seen.add(parentNode);
      const pt = parentNode.getTranslation?.() ?? [0, 0, 0];
      wx += pt[0]; wy += pt[1]; wz += pt[2];
      p = parentNode;
    }
    partWorld[name] = [wx, wy, wz];
  }

  const dst = new Document();
  dst.createBuffer();
  const scene = dst.createScene('Scene');

  const boneNodes = new Map();
  for (const [name, parent] of MIXAMO_HIERARCHY) {
    const node = dst.createNode(name);
    boneNodes.set(name, node);
    if (!parent) scene.addChild(node);
    else boneNodes.get(parent).addChild(node);
  }

  // Place mapped bones at named-part world translations (local = relative to parent).
  const worldOf = {};
  for (const [name, parent] of MIXAMO_HIERARCHY) {
    const part = Object.entries(PART_TO_MIXAMO).find(([, m]) => m === name)?.[0];
    if (part && partWorld[part]) {
      worldOf[name] = partWorld[part];
    } else if (parent && worldOf[parent]) {
      worldOf[name] = [...worldOf[parent]];
    } else {
      worldOf[name] = [0, 0.95, 0];
    }
  }
  for (const [name, parent] of MIXAMO_HIERARCHY) {
    const w = worldOf[name];
    const pw = parent ? worldOf[parent] : [0, 0, 0];
    boneNodes.get(name).setTranslation([w[0] - pw[0], w[1] - pw[1], w[2] - pw[2]]);
  }

  const jointNames = MIXAMO_HIERARCHY.map(([n]) => n);
  const ibm = new Float32Array(jointNames.length * 16);
  jointNames.forEach((name, i) => {
    const w = worldOf[name];
    ibm.set(invertMat4(translationMat4(w[0], w[1], w[2])), i * 16);
  });
  const ibmAcc = dst.createAccessor('IBM')
    .setType('MAT4')
    .setArray(ibm)
    .setBuffer(dst.getRoot().listBuffers()[0]);

  const skin = dst.createSkin('Armature')
    .setSkeleton(boneNodes.get('mixamorigHips'))
    .setInverseBindMatrices(ibmAcc);
  for (const name of jointNames) skin.addJoint(boneNodes.get(name));

  const buffer = dst.getRoot().listBuffers()[0];
  let partsSkinned = 0;

  for (const srcNode of srcRoot.listNodes()) {
    const partName = srcNode.getName();
    const mixamo = PART_TO_MIXAMO[partName];
    const srcMesh = srcNode.getMesh();
    if (!mixamo || !srcMesh) continue;
    const boneIndex = jointNames.indexOf(mixamo);
    if (boneIndex < 0) continue;

    const dstMesh = dst.createMesh(srcMesh.getName() || partName);
    for (const srcPrim of srcMesh.listPrimitives()) {
      const dstPrim = dst.createPrimitive();
      for (const sem of srcPrim.listSemantics()) {
        const acc = srcPrim.getAttribute(sem);
        if (!acc) continue;
        const copy = dst.createAccessor(acc.getName() || sem)
          .setType(acc.getType())
          .setArray(acc.getArray() ? acc.getArray().slice() : acc.getArray())
          .setBuffer(buffer);
        if (acc.getNormalized()) copy.setNormalized(true);
        dstPrim.setAttribute(sem, copy);
      }
      const indices = srcPrim.getIndices();
      if (indices) {
        dstPrim.setIndices(
          dst.createAccessor('indices')
            .setType('SCALAR')
            .setArray(indices.getArray().slice())
            .setBuffer(buffer),
        );
      }
      const pos = srcPrim.getAttribute('POSITION');
      const count = pos ? pos.getCount() : 0;
      const joints = new Uint16Array(count * 4);
      const weights = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) {
        joints[i * 4] = boneIndex;
        weights[i * 4] = 1;
      }
      dstPrim.setAttribute('JOINTS_0', dst.createAccessor('joints').setType('VEC4').setArray(joints).setBuffer(buffer));
      dstPrim.setAttribute('WEIGHTS_0', dst.createAccessor('weights').setType('VEC4').setArray(weights).setBuffer(buffer));
      dstPrim.setMode(srcPrim.getMode());
      const srcMat = srcPrim.getMaterial();
      if (srcMat) {
        const mat = dst.createMaterial(srcMat.getName() || partName);
        const base = srcMat.getBaseColorTexture?.() ?? srcMat.getBaseColorTexture?.();
        try {
          const tex = srcMat.getBaseColorTexture();
          if (tex) {
            const img = tex.getImage();
            if (img) {
              const dstImg = dst.createImage(tex.getName() || 'tex').setMimeType(tex.getMimeType() || 'image/png').setImage(img);
              const dstTex = dst.createTexture(tex.getName() || 'tex').setImage(dstImg);
              mat.setBaseColorTexture(dstTex);
            }
          }
        } catch { /* texture copy best-effort */ }
        const bc = srcMat.getBaseColorFactor?.();
        if (bc) mat.setBaseColorFactor(bc);
        dstPrim.setMaterial(mat);
      }
      dstMesh.addPrimitive(dstPrim);
    }

    const meshNode = dst.createNode(partName).setMesh(dstMesh).setSkin(skin);
    const t = srcNode.getTranslation() ?? [0, 0, 0];
    meshNode.setTranslation(t);
    scene.addChild(meshNode);
    partsSkinned++;
  }

  const outPath = join(MODELS, dstName);
  await io.write(outPath, dst);
  const verify = await io.read(outPath);
  const vRoot = verify.getRoot();
  const skins = vRoot.listSkins().length;
  const joints = vRoot.listSkins()[0]?.listJoints().length ?? 0;
  console.log(`[namedpart] ${srcName} → ${dstName}  parts=${partsSkinned} skins=${skins} joints=${joints}`);
  return { srcName, dstName, partsSkinned, skins, joints };
}

const jobs = [
  ['MAIME.glb', 'MAIME_skinned.glb'],
  ['MAIME_tattered.glb', 'MAIME_tattered_skinned.glb'],
];

const results = [];
for (const [src, dst] of jobs) {
  results.push(await convert(src, dst));
}
console.log(JSON.stringify(results, null, 2));
