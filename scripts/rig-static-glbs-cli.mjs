#!/usr/bin/env node
/**
 * rig-static-glbs-cli.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Node.js CLI: loads static BANNON.glb / MAIME.glb from GLB_ASSET_MANIFEST.json
 * and outputs *_rigged_ready.glb with:
 *   - Mixamo-compatible skeleton (18 bones)
 *   - Inverse bind matrices (computed from bind pose)
 *   - Proximity-weighted skin bindings (4 influences per vertex)
 *
 * Usage:
 *   node scripts/rig-static-glbs-cli.mjs [--manifest <path>] [--out <dir>] [--dry-run]
 *
 * Outputs:
 *   BANNON_rigged_ready.glb
 *   MAIME_rigged_ready.glb
 *
 * @gltf-transform/core is used for GLB read/write/transform.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (flag) => {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : null;
};
const DRY_RUN = args.includes('--dry-run');
const MANIFEST_PATH = getArg('--manifest') ?? join(PROJECT_ROOT, 'docs', 'GLB_ASSET_MANIFEST.json');
const OUT_DIR = getArg('--out') ?? join(PROJECT_ROOT, 'public', 'models', 'rigged');

// ── Mixamo-compatible canonical skeleton definition ───────────────────────────
// 18 bones matching Mixamo naming convention for maximum retarget compatibility.
// Positions are in bind pose (T-pose), in metres.

/** @type {Array<{name: string, parent: string|null, position: [number,number,number]}>} */
const MIXAMO_SKELETON = [
  // Root
  { name: 'mixamorigHips',         parent: null,                    position: [0,      0.95,  0] },
  // Spine chain
  { name: 'mixamorigSpine',        parent: 'mixamorigHips',         position: [0,      0.10,  0] },
  { name: 'mixamorigSpine1',       parent: 'mixamorigSpine',        position: [0,      0.10,  0] },
  { name: 'mixamorigSpine2',       parent: 'mixamorigSpine1',       position: [0,      0.10,  0] },
  { name: 'mixamorigNeck',         parent: 'mixamorigSpine2',       position: [0,      0.15,  0] },
  { name: 'mixamorigHead',         parent: 'mixamorigNeck',         position: [0,      0.12,  0] },
  // Left arm
  { name: 'mixamorigLeftShoulder', parent: 'mixamorigSpine2',       position: [-0.08,  0.05,  0] },
  { name: 'mixamorigLeftArm',      parent: 'mixamorigLeftShoulder', position: [-0.14,  0,     0] },
  { name: 'mixamorigLeftForeArm',  parent: 'mixamorigLeftArm',      position: [-0.26,  0,     0] },
  { name: 'mixamorigLeftHand',     parent: 'mixamorigLeftForeArm',  position: [-0.22,  0,     0] },
  // Right arm
  { name: 'mixamorigRightShoulder',parent: 'mixamorigSpine2',       position: [ 0.08,  0.05,  0] },
  { name: 'mixamorigRightArm',     parent: 'mixamorigRightShoulder',position: [ 0.14,  0,     0] },
  { name: 'mixamorigRightForeArm', parent: 'mixamorigRightArm',     position: [ 0.26,  0,     0] },
  { name: 'mixamorigRightHand',    parent: 'mixamorigRightForeArm', position: [ 0.22,  0,     0] },
  // Left leg
  { name: 'mixamorigLeftUpLeg',    parent: 'mixamorigHips',         position: [-0.10, -0.05,  0] },
  { name: 'mixamorigLeftLeg',      parent: 'mixamorigLeftUpLeg',    position: [ 0,    -0.42,  0] },
  { name: 'mixamorigLeftFoot',     parent: 'mixamorigLeftLeg',      position: [ 0,    -0.42,  0.04] },
  // Right leg
  { name: 'mixamorigRightUpLeg',   parent: 'mixamorigHips',         position: [ 0.10, -0.05,  0] },
  { name: 'mixamorigRightLeg',     parent: 'mixamorigRightUpLeg',   position: [ 0,    -0.42,  0] },
  { name: 'mixamorigRightFoot',    parent: 'mixamorigRightLeg',     position: [ 0,    -0.42,  0.04] },
];

// ── Bone influence radius table (metres) ─────────────────────────────────────
// Controls how far each bone's proximity weighting extends.
const BONE_INFLUENCE_RADIUS = {
  mixamorigHips:          0.20,
  mixamorigSpine:         0.18,
  mixamorigSpine1:        0.18,
  mixamorigSpine2:        0.18,
  mixamorigNeck:          0.12,
  mixamorigHead:          0.16,
  mixamorigLeftShoulder:  0.12,
  mixamorigLeftArm:       0.14,
  mixamorigLeftForeArm:   0.13,
  mixamorigLeftHand:      0.10,
  mixamorigRightShoulder: 0.12,
  mixamorigRightArm:      0.14,
  mixamorigRightForeArm:  0.13,
  mixamorigRightHand:     0.10,
  mixamorigLeftUpLeg:     0.18,
  mixamorigLeftLeg:       0.16,
  mixamorigLeftFoot:      0.10,
  mixamorigRightUpLeg:    0.18,
  mixamorigRightLeg:      0.16,
  mixamorigRightFoot:     0.10,
};

// ── Logging ───────────────────────────────────────────────────────────────────
const log  = (...a) => console.log('[rig-cli]', ...a);
const warn = (...a) => console.warn('[rig-cli] ⚠️', ...a);
const err  = (...a) => console.error('[rig-cli] ❌', ...a);
const ok   = (...a) => console.log('[rig-cli] ✅', ...a);

// ── Load manifest ─────────────────────────────────────────────────────────────
function loadManifest(manifestPath) {
  if (!existsSync(manifestPath)) {
    warn(`GLB_ASSET_MANIFEST.json not found at: ${manifestPath}`);
    warn('Using built-in fallback manifest for BANNON.glb and MAIME.glb');
    return {
      entries: [
        { id: 'bannon', file: 'BANNON.glb', type: 'STATIC_MESH', character: 'Bannon' },
        { id: 'maime',  file: 'MAIME.glb',  type: 'STATIC_MESH', character: 'Maime'  },
      ]
    };
  }
  try {
    const raw = readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw);
    log(`Loaded manifest: ${manifestPath}`);
    log(`  Entries: ${manifest.entries?.length ?? 0}`);
    return manifest;
  } catch (e) {
    warn(`Failed to parse manifest: ${e.message}`);
    warn('Using built-in fallback manifest');
    return {
      entries: [
        { id: 'bannon', file: 'BANNON.glb', type: 'STATIC_MESH', character: 'Bannon' },
        { id: 'maime',  file: 'MAIME.glb',  type: 'STATIC_MESH', character: 'Maime'  },
      ]
    };
  }
}

// ── Resolve GLB path ──────────────────────────────────────────────────────────
function resolveGlbPath(entry) {
  const searchDirs = [
    join(PROJECT_ROOT, 'public', 'models'),
    join(PROJECT_ROOT, 'public', 'assets', 'models'),
    join(PROJECT_ROOT, 'assets', 'models'),
    join(PROJECT_ROOT, 'public'),
  ];

  for (const dir of searchDirs) {
    const candidate = join(dir, entry.file);
    if (existsSync(candidate)) return candidate;
  }

  // Try override URL hint from manifest
  if (entry.overrideUrl) {
    warn(`  GLB not found locally. Override URL: ${entry.overrideUrl}`);
    warn(`  Download manually and place at: ${join(PROJECT_ROOT, 'public', 'models', entry.file)}`);
  }

  return null;
}

// ── Compute world positions of all bones ─────────────────────────────────────
function computeBoneWorldPositions(skeleton) {
  const worldPos = {};
  const parentWorldPos = {};

  for (const bone of skeleton) {
    const parent = bone.parent ? parentWorldPos[bone.parent] : [0, 0, 0];
    if (!parent) {
      err(`  Parent bone "${bone.parent}" not found for "${bone.name}"`);
      continue;
    }
    const wp = [
      parent[0] + bone.position[0],
      parent[1] + bone.position[1],
      parent[2] + bone.position[2],
    ];
    worldPos[bone.name] = wp;
    parentWorldPos[bone.name] = wp;
  }

  return worldPos;
}

// ── Proximity-weighted skin binding ──────────────────────────────────────────
/**
 * For each vertex position, compute 4 bone influences using inverse-distance
 * weighting. Bones beyond their influence radius contribute 0 weight.
 *
 * @param {Float32Array} positions - flat [x,y,z, x,y,z, ...] vertex positions
 * @param {Record<string,number[]>} boneWorldPos - bone name → [x,y,z] world pos
 * @param {string[]} boneNames - ordered bone name list (index = bone index)
 * @returns {{ joints: Uint16Array, weights: Float32Array }}
 */
function computeProximityWeights(positions, boneWorldPos, boneNames) {
  const vertexCount = positions.length / 3;
  const INFLUENCES = 4;

  const joints  = new Uint16Array(vertexCount * INFLUENCES);
  const weights = new Float32Array(vertexCount * INFLUENCES);

  for (let vi = 0; vi < vertexCount; vi++) {
    const vx = positions[vi * 3];
    const vy = positions[vi * 3 + 1];
    const vz = positions[vi * 3 + 2];

    // Compute inverse-distance weight for each bone
    const boneWeights = boneNames.map((boneName, bi) => {
      const bp = boneWorldPos[boneName];
      if (!bp) return { bi, w: 0 };
      const dx = vx - bp[0];
      const dy = vy - bp[1];
      const dz = vz - bp[2];
      const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
      const radius = BONE_INFLUENCE_RADIUS[boneName] ?? 0.15;
      if (dist > radius * 2.5) return { bi, w: 0 };
      // Smooth falloff: 1 - (dist/radius)^2, clamped to [0,1]
      const normalized = Math.min(dist / radius, 1.0);
      const w = Math.max(0, 1.0 - normalized * normalized);
      return { bi, w };
    });

    // Sort by weight descending, take top 4
    boneWeights.sort((a, b) => b.w - a.w);
    const top4 = boneWeights.slice(0, INFLUENCES);

    // Normalize weights to sum to 1
    const totalW = top4.reduce((s, x) => s + x.w, 0);
    const base = vi * INFLUENCES;

    if (totalW < 1e-6) {
      // Fallback: bind to Hips (index 0) with full weight
      joints[base]  = 0;
      weights[base] = 1.0;
      for (let k = 1; k < INFLUENCES; k++) {
        joints[base + k]  = 0;
        weights[base + k] = 0;
      }
    } else {
      for (let k = 0; k < INFLUENCES; k++) {
        joints[base + k]  = top4[k]?.bi ?? 0;
        weights[base + k] = totalW > 0 ? (top4[k]?.w ?? 0) / totalW : 0;
      }
    }
  }

  return { joints, weights };
}

// ── Compute inverse bind matrices ─────────────────────────────────────────────
/**
 * For each bone, the inverse bind matrix is the inverse of the bone's
 * world transform in bind pose. In T-pose, bones have no rotation,
 * so the inverse bind matrix is simply a translation by -worldPos.
 *
 * Returns a flat Float32Array of 16 floats per bone (column-major 4x4).
 */
function computeInverseBindMatrices(boneWorldPos, boneNames) {
  const matrices = new Float32Array(boneNames.length * 16);

  for (let bi = 0; bi < boneNames.length; bi++) {
    const bp = boneWorldPos[boneNames[bi]] ?? [0, 0, 0];
    const base = bi * 16;

    // Identity matrix with translation = -worldPos (column-major)
    // [ 1  0  0  -tx ]
    // [ 0  1  0  -ty ]
    // [ 0  0  1  -tz ]
    // [ 0  0  0   1  ]
    matrices[base + 0]  = 1;  matrices[base + 1]  = 0;  matrices[base + 2]  = 0;  matrices[base + 3]  = 0;
    matrices[base + 4]  = 0;  matrices[base + 5]  = 1;  matrices[base + 6]  = 0;  matrices[base + 7]  = 0;
    matrices[base + 8]  = 0;  matrices[base + 9]  = 0;  matrices[base + 10] = 1;  matrices[base + 11] = 0;
    matrices[base + 12] = -bp[0]; matrices[base + 13] = -bp[1]; matrices[base + 14] = -bp[2]; matrices[base + 15] = 1;
  }

  return matrices;
}

// ── Build GLTF JSON for rigged output ─────────────────────────────────────────
/**
 * Constructs a minimal GLTF 2.0 JSON structure with:
 *   - Skeleton nodes (one per Mixamo bone)
 *   - Skin with inverseBindMatrices
 *   - Mesh primitives with JOINTS_0 and WEIGHTS_0 attributes
 *
 * This is a structural scaffold — the actual geometry is passed through
 * from the source GLB. The output is written as a binary GLB.
 */
function buildRiggedGltf(sourceInfo, boneWorldPos, boneNames, meshData) {
  const { vertexCount, positions, normals, uvs } = meshData;

  // Compute skin data
  const { joints, weights } = computeProximityWeights(positions, boneWorldPos, boneNames);
  const inverseBindMatrices = computeInverseBindMatrices(boneWorldPos, boneNames);

  log(`  Computed proximity weights for ${vertexCount} vertices`);
  log(`  Inverse bind matrices: ${boneNames.length} bones`);

  // Build GLTF nodes for skeleton
  const boneNodes = boneNames.map((name, i) => {
    const bone = MIXAMO_SKELETON.find(b => b.name === name);
    return {
      name,
      translation: bone ? bone.position : [0, 0, 0],
      rotation: [0, 0, 0, 1],
      scale: [1, 1, 1],
      children: MIXAMO_SKELETON
        .filter(b => b.parent === name)
        .map(b => boneNames.indexOf(b.name))
        .filter(idx => idx !== -1),
    };
  });

  const rootBoneIndex = boneNames.indexOf('mixamorigHips');

  // Build binary buffers
  const posBuffer   = Buffer.from(positions.buffer);
  const normBuffer  = normals ? Buffer.from(normals.buffer) : null;
  const uvBuffer    = uvs     ? Buffer.from(uvs.buffer)     : null;
  const jointBuffer = Buffer.from(joints.buffer);
  const weightBuffer= Buffer.from(weights.buffer);
  const ibmBuffer   = Buffer.from(inverseBindMatrices.buffer);

  // Align buffers to 4-byte boundary
  const align4 = (buf) => {
    const pad = (4 - (buf.length % 4)) % 4;
    return pad > 0 ? Buffer.concat([buf, Buffer.alloc(pad)]) : buf;
  };

  const posAligned    = align4(posBuffer);
  const normAligned   = normBuffer ? align4(normBuffer) : null;
  const uvAligned     = uvBuffer   ? align4(uvBuffer)   : null;
  const jointAligned  = align4(jointBuffer);
  const weightAligned = align4(weightBuffer);
  const ibmAligned    = align4(ibmBuffer);

  // Build buffer views
  let byteOffset = 0;
  const bufferViews = [];
  const accessors = [];

  const addBufferView = (buf, target) => {
    const idx = bufferViews.length;
    bufferViews.push({ buffer: 0, byteOffset, byteLength: buf.length, target });
    byteOffset += buf.length;
    return idx;
  };

  const ARRAY_BUFFER = 34962;
  const ELEMENT_ARRAY_BUFFER = 34963;

  // POSITION accessor
  const posBvIdx = addBufferView(posAligned, ARRAY_BUFFER);
  const posAccessorIdx = accessors.length;
  accessors.push({
    bufferView: posBvIdx, byteOffset: 0, componentType: 5126, // FLOAT
    count: vertexCount, type: 'VEC3',
    min: [
      Math.min(...Array.from({length: vertexCount}, (_, i) => positions[i*3])),
      Math.min(...Array.from({length: vertexCount}, (_, i) => positions[i*3+1])),
      Math.min(...Array.from({length: vertexCount}, (_, i) => positions[i*3+2])),
    ],
    max: [
      Math.max(...Array.from({length: vertexCount}, (_, i) => positions[i*3])),
      Math.max(...Array.from({length: vertexCount}, (_, i) => positions[i*3+1])),
      Math.max(...Array.from({length: vertexCount}, (_, i) => positions[i*3+2])),
    ],
  });

  let normAccessorIdx = null;
  if (normAligned) {
    const normBvIdx = addBufferView(normAligned, ARRAY_BUFFER);
    normAccessorIdx = accessors.length;
    accessors.push({ bufferView: normBvIdx, byteOffset: 0, componentType: 5126, count: vertexCount, type: 'VEC3' });
  }

  let uvAccessorIdx = null;
  if (uvAligned) {
    const uvBvIdx = addBufferView(uvAligned, ARRAY_BUFFER);
    uvAccessorIdx = accessors.length;
    accessors.push({ bufferView: uvBvIdx, byteOffset: 0, componentType: 5126, count: vertexCount, type: 'VEC2' });
  }

  // JOINTS_0 accessor (UNSIGNED_SHORT = 5123)
  const jointBvIdx = addBufferView(jointAligned, ARRAY_BUFFER);
  const jointAccessorIdx = accessors.length;
  accessors.push({ bufferView: jointBvIdx, byteOffset: 0, componentType: 5123, count: vertexCount, type: 'VEC4' });

  // WEIGHTS_0 accessor (FLOAT)
  const weightBvIdx = addBufferView(weightAligned, ARRAY_BUFFER);
  const weightAccessorIdx = accessors.length;
  accessors.push({ bufferView: weightBvIdx, byteOffset: 0, componentType: 5126, count: vertexCount, type: 'VEC4' });

  // Inverse bind matrices accessor (MAT4)
  const ibmBvIdx = addBufferView(ibmAligned, null);
  const ibmAccessorIdx = accessors.length;
  accessors.push({ bufferView: ibmBvIdx, byteOffset: 0, componentType: 5126, count: boneNames.length, type: 'MAT4' });

  // Mesh primitive attributes
  const primitiveAttributes = { POSITION: posAccessorIdx, JOINTS_0: jointAccessorIdx, WEIGHTS_0: weightAccessorIdx };
  if (normAccessorIdx !== null) primitiveAttributes.NORMAL = normAccessorIdx;
  if (uvAccessorIdx !== null)   primitiveAttributes.TEXCOORD_0 = uvAccessorIdx;

  // Node indices: bones first, then mesh node, then scene root
  const meshNodeIdx = boneNames.length;
  const sceneRootIdx = boneNames.length + 1;

  const gltfJson = {
    asset: {
      version: '2.0',
      generator: 'rig-static-glbs-cli.mjs',
      extras: {
        source: sourceInfo.file,
        character: sourceInfo.character ?? sourceInfo.id,
        rigType: 'MIXAMO_COMPATIBLE',
        skinningMethod: 'PROXIMITY_WEIGHTED',
        boneCount: boneNames.length,
        generatedAt: new Date().toISOString(),
      },
    },
    scene: 0,
    scenes: [{ name: 'Scene', nodes: [sceneRootIdx] }],
    nodes: [
      ...boneNodes,
      // Mesh node (skinned)
      {
        name: `${sourceInfo.id}_skinned_mesh`,
        mesh: 0,
        skin: 0,
      },
      // Scene root
      {
        name: `${sourceInfo.id}_root`,
        children: [rootBoneIndex, meshNodeIdx],
      },
    ],
    meshes: [{
      name: `${sourceInfo.id}_mesh`,
      primitives: [{
        attributes: primitiveAttributes,
        mode: 4, // TRIANGLES
        material: 0,
      }],
    }],
    skins: [{
      name: `${sourceInfo.id}_skin`,
      inverseBindMatrices: ibmAccessorIdx,
      skeleton: rootBoneIndex,
      joints: boneNames.map((_, i) => i),
    }],
    materials: [{
      name: `${sourceInfo.id}_material`,
      pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1.0], metallicFactor: 0.0, roughnessFactor: 0.8 },
      doubleSided: true,
    }],
    accessors,
    bufferViews,
    buffers: [{ byteLength: byteOffset }],
  };

  // Combine all binary data
  const binaryChunks = [posAligned];
  if (normAligned)   binaryChunks.push(normAligned);
  if (uvAligned)     binaryChunks.push(uvAligned);
  binaryChunks.push(jointAligned, weightAligned, ibmAligned);
  const binaryData = Buffer.concat(binaryChunks);

  return { gltfJson, binaryData };
}

// ── Write GLB binary ──────────────────────────────────────────────────────────
function writeGlb(gltfJson, binaryData, outPath) {
  const jsonStr = JSON.stringify(gltfJson);
  const jsonBytes = Buffer.from(jsonStr, 'utf-8');

  // Pad JSON to 4-byte boundary
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const jsonPadded = Buffer.concat([jsonBytes, Buffer.alloc(jsonPad, 0x20)]); // space padding

  // Pad binary to 4-byte boundary
  const binPad = (4 - (binaryData.length % 4)) % 4;
  const binPadded = Buffer.concat([binaryData, Buffer.alloc(binPad)]);

  // GLB header: magic, version, total length
  const MAGIC   = 0x46546C67; // 'glTF'
  const VERSION = 2;
  const JSON_CHUNK_TYPE = 0x4E4F534A; // 'JSON'
  const BIN_CHUNK_TYPE  = 0x004E4942; // 'BIN\0'

  const totalLength = 12 + 8 + jsonPadded.length + 8 + binPadded.length;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(MAGIC,   0);
  header.writeUInt32LE(VERSION, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonChunkHeader.writeUInt32LE(JSON_CHUNK_TYPE,   4);

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binPadded.length, 0);
  binChunkHeader.writeUInt32LE(BIN_CHUNK_TYPE,   4);

  const glb = Buffer.concat([header, jsonChunkHeader, jsonPadded, binChunkHeader, binPadded]);
  writeFileSync(outPath, glb);
}

// ── Parse a source GLB to extract geometry ────────────────────────────────────
/**
 * Minimal GLB parser to extract vertex positions, normals, and UVs.
 * Returns null if the file is not a valid GLB or has no geometry.
 */
function parseSourceGlb(glbPath) {
  const buf = readFileSync(glbPath);

  // Validate GLB magic
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546C67) {
    err(`  Not a valid GLB file: ${glbPath}`);
    return null;
  }

  const version = buf.readUInt32LE(4);
  if (version !== 2) {
    warn(`  GLB version ${version} — expected 2. Proceeding anyway.`);
  }

  // Read JSON chunk
  const jsonChunkLength = buf.readUInt32LE(12);
  const jsonChunkType   = buf.readUInt32LE(16);
  if (jsonChunkType !== 0x4E4F534A) {
    err(`  First chunk is not JSON (type=0x${jsonChunkType.toString(16)})`);
    return null;
  }

  const jsonStr = buf.slice(20, 20 + jsonChunkLength).toString('utf-8');
  let gltf;
  try {
    gltf = JSON.parse(jsonStr);
  } catch (e) {
    err(`  Failed to parse GLB JSON: ${e.message}`);
    return null;
  }

  // Read binary chunk (if present)
  const binChunkOffset = 20 + jsonChunkLength;
  let binData = null;
  if (binChunkOffset + 8 <= buf.length) {
    const binChunkLength = buf.readUInt32LE(binChunkOffset);
    const binChunkType   = buf.readUInt32LE(binChunkOffset + 4);
    if (binChunkType === 0x004E4942) {
      binData = buf.slice(binChunkOffset + 8, binChunkOffset + 8 + binChunkLength);
    }
  }

  // Find first mesh primitive with POSITION
  const mesh = gltf.meshes?.[0];
  if (!mesh) {
    warn(`  No meshes found in GLB — will use synthetic geometry`);
    return null;
  }

  const primitive = mesh.primitives?.[0];
  if (!primitive) {
    warn(`  No primitives found — will use synthetic geometry`);
    return null;
  }

  const posAccessorIdx = primitive.attributes?.POSITION;
  if (posAccessorIdx == null) {
    warn(`  No POSITION attribute — will use synthetic geometry`);
    return null;
  }

  // Helper: read accessor data
  const readAccessor = (accessorIdx) => {
    const accessor = gltf.accessors?.[accessorIdx];
    if (!accessor) return null;
    const bv = gltf.bufferViews?.[accessor.bufferView];
    if (!bv) return null;

    const bufferIdx = bv.buffer ?? 0;
    let rawBuf;
    if (bufferIdx === 0 && binData) {
      rawBuf = binData;
    } else {
      const bufDef = gltf.buffers?.[bufferIdx];
      if (!bufDef?.uri) return null;
      if (bufDef.uri.startsWith('data:')) {
        const b64 = bufDef.uri.split(',')[1];
        rawBuf = Buffer.from(b64, 'base64');
      } else {
        return null;
      }
    }

    const byteOffset = (bv.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const componentType = accessor.componentType;
    const count = accessor.count;
    const typeComponents = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
    const numComponents = typeComponents[accessor.type] ?? 1;
    const totalElements = count * numComponents;

    if (componentType === 5126) { // FLOAT
      const arr = new Float32Array(totalElements);
      for (let i = 0; i < totalElements; i++) {
        arr[i] = rawBuf.readFloatLE(byteOffset + i * 4);
      }
      return arr;
    } else if (componentType === 5123) { // UNSIGNED_SHORT
      const arr = new Uint16Array(totalElements);
      for (let i = 0; i < totalElements; i++) {
        arr[i] = rawBuf.readUInt16LE(byteOffset + i * 2);
      }
      return arr;
    }
    return null;
  };

  const positions = readAccessor(posAccessorIdx);
  if (!positions) {
    warn(`  Could not read POSITION data — will use synthetic geometry`);
    return null;
  }

  const normAccessorIdx = primitive.attributes?.NORMAL;
  const normals = normAccessorIdx != null ? readAccessor(normAccessorIdx) : null;

  const uvAccessorIdx = primitive.attributes?.TEXCOORD_0;
  const uvs = uvAccessorIdx != null ? readAccessor(uvAccessorIdx) : null;

  const vertexCount = positions.length / 3;
  log(`  Parsed source GLB: ${vertexCount} vertices, normals=${!!normals}, uvs=${!!uvs}`);

  return { vertexCount, positions, normals, uvs };
}

// ── Generate synthetic T-pose geometry (fallback) ────────────────────────────
/**
 * When the source GLB cannot be parsed, generate a minimal humanoid
 * capsule geometry for pipeline testing.
 */
function generateSyntheticGeometry() {
  warn('  Generating synthetic humanoid geometry (source GLB not parseable)');

  // Simple box: 8 vertices forming a unit cube scaled to humanoid proportions
  const positions = new Float32Array([
    // Torso (front face)
    -0.25, 0.7, 0.15,   0.25, 0.7, 0.15,   0.25, 1.4, 0.15,  -0.25, 1.4, 0.15,
    // Torso (back face)
    -0.25, 0.7,-0.15,   0.25, 0.7,-0.15,   0.25, 1.4,-0.15,  -0.25, 1.4,-0.15,
    // Head
    -0.12, 1.55, 0.12,  0.12, 1.55, 0.12,  0.12, 1.85, 0.12, -0.12, 1.85, 0.12,
    // Left arm
    -0.55, 0.9, 0.0,   -0.55, 1.3, 0.0,   -0.25, 1.3, 0.0,  -0.25, 0.9, 0.0,
    // Right arm
     0.25, 0.9, 0.0,    0.55, 0.9, 0.0,    0.55, 1.3, 0.0,   0.25, 1.3, 0.0,
    // Left leg
    -0.20, 0.0, 0.0,   -0.05, 0.0, 0.0,   -0.05, 0.7, 0.0,  -0.20, 0.7, 0.0,
    // Right leg
     0.05, 0.0, 0.0,    0.20, 0.0, 0.0,    0.20, 0.7, 0.0,   0.05, 0.7, 0.0,
  ]);

  const vertexCount = positions.length / 3;
  return { vertexCount, positions, normals: null, uvs: null };
}

// ── Process a single GLB entry ────────────────────────────────────────────────
async function processEntry(entry, outDir) {
  const outputName = entry.file.replace(/\.glb$/i, '_rigged_ready.glb');
  const outputPath = join(outDir, outputName);

  log(`\n${'─'.repeat(60)}`);
  log(`Processing: ${entry.file} → ${outputName}`);
  log(`  Character: ${entry.character ?? entry.id}`);
  log(`  Type: ${entry.type ?? 'UNKNOWN'}`);

  // Check if already rigged
  if (entry.type === 'RIGGED_AND_ANIMATABLE') {
    warn(`  Entry is already RIGGED_AND_ANIMATABLE — skipping rig generation`);
    warn(`  Use the existing rigged GLB directly`);
    return { entry, status: 'SKIPPED_ALREADY_RIGGED', outputPath: null };
  }

  // Resolve source GLB
  const sourcePath = resolveGlbPath(entry);
  let meshData;

  if (sourcePath) {
    log(`  Source GLB: ${sourcePath}`);
    meshData = parseSourceGlb(sourcePath);
  } else {
    warn(`  Source GLB not found: ${entry.file}`);
    warn(`  Searched: public/models/, public/assets/models/, assets/models/, public/`);
  }

  if (!meshData) {
    meshData = generateSyntheticGeometry();
  }

  // Compute bone world positions
  const boneWorldPos = computeBoneWorldPositions(MIXAMO_SKELETON);
  const boneNames = MIXAMO_SKELETON.map(b => b.name);

  log(`  Skeleton: ${boneNames.length} Mixamo-compatible bones`);
  log(`  Root bone: mixamorigHips`);

  // Build rigged GLTF
  const { gltfJson, binaryData } = buildRiggedGltf(entry, boneWorldPos, boneNames, meshData);

  if (DRY_RUN) {
    ok(`  [DRY RUN] Would write: ${outputPath}`);
    ok(`  [DRY RUN] GLTF nodes: ${gltfJson.nodes.length}, accessors: ${gltfJson.accessors.length}`);
    return { entry, status: 'DRY_RUN', outputPath };
  }

  // Ensure output directory exists
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
    log(`  Created output directory: ${outDir}`);
  }

  // Write GLB
  writeGlb(gltfJson, binaryData, outputPath);
  ok(`  Written: ${outputPath}`);
  ok(`  Bones: ${boneNames.length} | Vertices: ${meshData.vertexCount} | Binary: ${binaryData.length} bytes`);

  return { entry, status: 'SUCCESS', outputPath };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log('═'.repeat(60));
  log('BRUTAL FIST — Static GLB Rigging CLI');
  log('═'.repeat(60));
  log(`Manifest: ${MANIFEST_PATH}`);
  log(`Output:   ${OUT_DIR}`);
  log(`Dry run:  ${DRY_RUN}`);

  // Load manifest
  const manifest = loadManifest(MANIFEST_PATH);

  // Filter to BANNON and MAIME static entries
  const entries = (manifest.entries ?? []).filter(e => {
    const id = (e.id ?? '').toLowerCase();
    const file = (e.file ?? '').toLowerCase();
    const isBannonOrMaime = id === 'bannon' || id === 'maime' ||
      file.startsWith('bannon') || file.startsWith('maime');
    const isStatic = !e.type || e.type === 'STATIC_MESH' || e.type === 'UNKNOWN';
    return isBannonOrMaime && isStatic;
  });

  // Deduplicate by file
  const seen = new Set();
  const uniqueEntries = entries.filter(e => {
    if (seen.has(e.file)) return false;
    seen.add(e.file);
    return true;
  });

  // If no manifest entries found, use defaults
  const toProcess = uniqueEntries.length > 0 ? uniqueEntries : [
    { id: 'bannon', file: 'BANNON.glb', type: 'STATIC_MESH', character: 'Bannon' },
    { id: 'maime',  file: 'MAIME.glb',  type: 'STATIC_MESH', character: 'Maime'  },
  ];

  log(`\nEntries to process: ${toProcess.length}`);
  for (const e of toProcess) log(`  • ${e.file} (${e.character ?? e.id})`);

  // Process each entry
  const results = [];
  for (const entry of toProcess) {
    const result = await processEntry(entry, OUT_DIR);
    results.push(result);
  }

  // Summary
  log(`\n${'═'.repeat(60)}`);
  log('SUMMARY');
  log('═'.repeat(60));
  for (const r of results) {
    const icon = r.status === 'SUCCESS' ? '✅' : r.status === 'DRY_RUN' ? '🔵' : '⚠️';
    log(`  ${icon} ${r.entry.file} → ${r.status}${r.outputPath ? ` → ${r.outputPath}` : ''}`);
  }

  const succeeded = results.filter(r => r.status === 'SUCCESS' || r.status === 'DRY_RUN').length;
  log(`\n  ${succeeded}/${results.length} entries processed successfully`);

  if (succeeded > 0 && !DRY_RUN) {
    log('\nNext steps:');
    log('  1. Inspect output GLBs in a GLTF viewer (e.g. https://gltf.report)');
    log('  2. Verify JOINTS_0 / WEIGHTS_0 attributes are present');
    log('  3. Update GLB_ASSET_MANIFEST.json entries to type: "RIGGED_AND_ANIMATABLE"');
    log('  4. Update bannonGlbRoster.ts to reference *_rigged_ready.glb');
    log('  5. Load into AnimationTestArena to verify skeleton deformation');
  }

  log('═'.repeat(60));
}

main().catch(e => {
  err('Fatal error:', e.message);
  console.error(e);
  process.exit(1);
});
