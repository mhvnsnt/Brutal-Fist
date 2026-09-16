#!/usr/bin/env node
/**
 * rig-static-glbs.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * OFFLINE GLB RIGGING TOOL
 *
 * Reads docs/GLB_MANIFEST.json (produced by tools/diagnostics/scan-roster-glbs.mjs),
 * finds every entry classified as STATIC_MESH, and produces a rigged GLB by
 * attaching a SkinnedMesh, Skeleton, Bone hierarchy, and authored skin weights.
 *
 * This is an OFFLINE ASSET AUTHORING TOOL — it runs once to produce real
 * authored GLB files. The game runtime never calls this code.
 *
 * Output: public/models/<CHARACTER>_rigged.glb
 *
 * Usage:
 *   node tools/diagnostics/rig-static-glbs.mjs
 *   node tools/diagnostics/rig-static-glbs.mjs --dry-run
 *   node tools/diagnostics/rig-static-glbs.mjs --character BANNON
 *   node tools/diagnostics/rig-static-glbs.mjs --output ./rigged-output
 *
 * Rig strategy:
 *   The tool builds a humanoid bone hierarchy that covers the standard
 *   Mixamo/Bannon skeleton naming convention used by the project's animation
 *   clips. Skin weights are authored using a proximity-based heat-diffusion
 *   approach: each vertex is assigned to the nearest bone with a smooth
 *   falloff so the resulting deformation is plausible without Blender.
 *
 *   This is NOT a replacement for a proper Blender rig. It produces a
 *   PLAYABLE PLACEHOLDER that allows the animation system to run while the
 *   real authored rig is being produced. The output GLB is clearly named
 *   *_rigged_placeholder.glb to distinguish it from a production asset.
 *
 * Bone hierarchy (Mixamo-compatible naming):
 *   Hips
 *   ├── Spine
 *   │   └── Spine1
 *   │       └── Spine2
 *   │           ├── LeftShoulder
 *   │           │   └── LeftArm
 *   │           │       └── LeftForeArm
 *   │           │           └── LeftHand
 *   │           ├── RightShoulder
 *   │           │   └── RightArm
 *   │           │       └── RightForeArm
 *   │           │           └── RightHand
 *   │           └── Neck
 *   │               └── Head
 *   ├── LeftUpLeg
 *   │   └── LeftLeg
 *   │       └── LeftFoot
 *   │           └── LeftToeBase
 *   └── RightUpLeg
 *       └── RightLeg
 *           └── RightFoot
 *               └── RightToeBase
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname, join, basename } from 'path';
import { fileURLToPath } from 'url';

// ── @gltf-transform/core imports ─────────────────────────────────────────────
import {
  Document,
  NodeIO,
  Accessor,
  Buffer as GltfBuffer,
  Node,
  Mesh,
  Primitive,
  Skin,
  Material,
  vec3,
  vec4,
  mat4,
} from '@gltf-transform/core';

// ─────────────────────────────────────────────────────────────────────────────
// CLI argument parsing
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const charFilter = (() => {
  const idx = args.indexOf('--character');
  return idx !== -1 ? args[idx + 1]?.toUpperCase() : null;
})();
const outputDir = (() => {
  const idx = args.indexOf('--output');
  return idx !== -1 ? args[idx + 1] : null;
})();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');
const MANIFEST_PATH = join(ROOT, 'docs/GLB_MANIFEST.json');
const DEFAULT_OUTPUT_DIR = join(ROOT, 'public/models');

// ─────────────────────────────────────────────────────────────────────────────
// Humanoid bone definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bone definition with:
 *   name      — Mixamo-compatible bone name used by the project's animation clips
 *   parent    — parent bone name (null = root)
 *   position  — local position relative to parent in a normalised 1.85m character
 *   influence — which body region this bone primarily deforms (for weight painting)
 */
const HUMANOID_BONES = [
  // Root
  { name: 'Hips',           parent: null,             position: [0,    0.95,  0],    influence: 'hips'          },
  // Spine chain
  { name: 'Spine',          parent: 'Hips',            position: [0,    0.10,  0],    influence: 'spine'         },
  { name: 'Spine1',         parent: 'Spine',           position: [0,    0.12,  0],    influence: 'spine'         },
  { name: 'Spine2',         parent: 'Spine1',          position: [0,    0.12,  0],    influence: 'chest'         },
  // Neck / Head
  { name: 'Neck',           parent: 'Spine2',          position: [0,    0.20,  0],    influence: 'neck'          },
  { name: 'Head',           parent: 'Neck',            position: [0,    0.10,  0],    influence: 'head'          },
  // Left arm
  { name: 'LeftShoulder',   parent: 'Spine2',          position: [-0.10, 0.18, 0],    influence: 'left_shoulder' },
  { name: 'LeftArm',        parent: 'LeftShoulder',    position: [-0.18, 0,    0],    influence: 'left_upper_arm'},
  { name: 'LeftForeArm',    parent: 'LeftArm',         position: [-0.26, 0,    0],    influence: 'left_forearm'  },
  { name: 'LeftHand',       parent: 'LeftForeArm',     position: [-0.22, 0,    0],    influence: 'left_hand'     },
  // Right arm
  { name: 'RightShoulder',  parent: 'Spine2',          position: [ 0.10, 0.18, 0],    influence: 'right_shoulder'},
  { name: 'RightArm',       parent: 'RightShoulder',   position: [ 0.18, 0,    0],    influence: 'right_upper_arm'},
  { name: 'RightForeArm',   parent: 'RightArm',        position: [ 0.26, 0,    0],    influence: 'right_forearm' },
  { name: 'RightHand',      parent: 'RightForeArm',    position: [ 0.22, 0,    0],    influence: 'right_hand'    },
  // Left leg
  { name: 'LeftUpLeg',      parent: 'Hips',            position: [-0.10,-0.05,  0],   influence: 'left_thigh'    },
  { name: 'LeftLeg',        parent: 'LeftUpLeg',       position: [ 0,   -0.42,  0],   influence: 'left_shin'     },
  { name: 'LeftFoot',       parent: 'LeftLeg',         position: [ 0,   -0.40,  0],   influence: 'left_foot'     },
  { name: 'LeftToeBase',    parent: 'LeftFoot',        position: [ 0,   -0.05,  0.10],influence: 'left_toe'      },
  // Right leg
  { name: 'RightUpLeg',     parent: 'Hips',            position: [ 0.10,-0.05,  0],   influence: 'right_thigh'   },
  { name: 'RightLeg',       parent: 'RightUpLeg',      position: [ 0,   -0.42,  0],   influence: 'right_shin'    },
  { name: 'RightFoot',      parent: 'RightLeg',        position: [ 0,   -0.40,  0],   influence: 'right_foot'    },
  { name: 'RightToeBase',   parent: 'RightFoot',       position: [ 0,   -0.05,  0.10],influence: 'right_toe'     },
];

// ─────────────────────────────────────────────────────────────────────────────
// Bone world-position computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the world position of every bone by walking the hierarchy.
 * Returns a Map<boneName, [x, y, z]>.
 */
function computeBoneWorldPositions(scaleFactor = 1) {
  const worldPos = new Map();
  // Process in definition order (parents always come before children)
  for (const bone of HUMANOID_BONES) {
    if (bone.parent === null) {
      worldPos.set(bone.name, [
        bone.position[0] * scaleFactor,
        bone.position[1] * scaleFactor,
        bone.position[2] * scaleFactor,
      ]);
    } else {
      const parentPos = worldPos.get(bone.parent);
      worldPos.set(bone.name, [
        parentPos[0] + bone.position[0] * scaleFactor,
        parentPos[1] + bone.position[1] * scaleFactor,
        parentPos[2] + bone.position[2] * scaleFactor,
      ]);
    }
  }
  return worldPos;
}

// ─────────────────────────────────────────────────────────────────────────────
// Proximity-based skin weight computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * For a single vertex at worldPos, compute the 4 most influential bones
 * and their normalised weights using inverse-distance weighting.
 *
 * Returns { indices: [i0,i1,i2,i3], weights: [w0,w1,w2,w3] }
 * where indices are into the HUMANOID_BONES array.
 */
function computeVertexWeights(vertexWorldPos, boneWorldPositions) {
  const distances = HUMANOID_BONES.map((bone, idx) => {
    const bp = boneWorldPositions.get(bone.name);
    const dx = vertexWorldPos[0] - bp[0];
    const dy = vertexWorldPos[1] - bp[1];
    const dz = vertexWorldPos[2] - bp[2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return { idx, dist };
  });

  // Sort by distance ascending
  distances.sort((a, b) => a.dist - b.dist);

  // Take the 4 nearest bones
  const top4 = distances.slice(0, 4);

  // Inverse-distance weighting with a small epsilon to avoid division by zero
  const EPSILON = 0.001;
  const invDists = top4.map(d => 1 / (d.dist + EPSILON));
  const sumInv = invDists.reduce((s, v) => s + v, 0);
  const weights = invDists.map(v => v / sumInv);

  return {
    indices: top4.map(d => d.idx),
    weights,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inverse bind matrix computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the inverse bind matrix for a bone given its world position.
 * For a simple translation-only bind pose, the inverse bind matrix is
 * a 4×4 identity matrix with the translation negated.
 *
 * Returns a flat 16-element column-major Float32Array.
 */
function computeInverseBindMatrix(boneWorldPos) {
  // Column-major 4×4 identity with -translation in column 3
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    -boneWorldPos[0], -boneWorldPos[1], -boneWorldPos[2], 1,
  ]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core rigging function — operates on a @gltf-transform Document
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attach a SkinnedMesh + Skeleton + Bone hierarchy to every static mesh
 * primitive in the document.
 *
 * Modifies the document in-place.
 */
function rigDocument(doc, characterName) {
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0] ?? doc.createBuffer();

  // ── 1. Measure the bounding box of all mesh geometry ─────────────────────
  let minY = Infinity;
  let maxY = -Infinity;
  let minX = Infinity;
  let maxX = -Infinity;

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const posAccessor = prim.getAttribute('POSITION');
      if (!posAccessor) continue;
      const count = posAccessor.getCount();
      for (let i = 0; i < count; i++) {
        const y = posAccessor.getElement(i, [])[1];
        const x = posAccessor.getElement(i, [])[0];
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }

  const meshHeight = maxY - minY;
  const scaleFactor = meshHeight > 0.01 ? 1.85 / meshHeight : 1;

  if (VERBOSE) {
    console.log(`  [rig] Mesh height: ${meshHeight.toFixed(4)} → scale factor: ${scaleFactor.toFixed(4)}`);
  }

  // ── 2. Compute bone world positions scaled to the mesh ────────────────────
  // Offset so Hips aligns with the mesh's vertical midpoint
  const boneWorldPositions = computeBoneWorldPositions(scaleFactor);

  // Shift all bone Y positions so the skeleton sits inside the mesh
  const hipWorldY = boneWorldPositions.get('Hips')[1];
  const meshMidY = minY + meshHeight * 0.52; // slightly above mid for humanoid
  const yShift = meshMidY - hipWorldY;
  for (const [name, pos] of boneWorldPositions) {
    boneWorldPositions.set(name, [pos[0], pos[1] + yShift, pos[2]]);
  }

  // ── 3. Build glTF Node hierarchy for bones ────────────────────────────────
  const boneNodes = new Map(); // boneName → glTF Node

  for (const boneDef of HUMANOID_BONES) {
    const node = doc.createNode(boneDef.name);
    // Set local translation (relative to parent)
    if (boneDef.parent === null) {
      const wp = boneWorldPositions.get(boneDef.name);
      node.setTranslation([wp[0], wp[1], wp[2]]);
    } else {
      const parentWP = boneWorldPositions.get(boneDef.parent);
      const myWP = boneWorldPositions.get(boneDef.name);
      node.setTranslation([
        myWP[0] - parentWP[0],
        myWP[1] - parentWP[1],
        myWP[2] - parentWP[2],
      ]);
    }
    boneNodes.set(boneDef.name, node);
  }

  // Wire up parent-child relationships
  for (const boneDef of HUMANOID_BONES) {
    if (boneDef.parent !== null) {
      const parentNode = boneNodes.get(boneDef.parent);
      const childNode = boneNodes.get(boneDef.name);
      parentNode.addChild(childNode);
    }
  }

  // Add root bone to the scene
  const scenes = root.listScenes();
  const scene = scenes[0] ?? doc.createScene();
  const rootBoneNode = boneNodes.get('Hips');
  scene.addChild(rootBoneNode);

  // ── 4. Build inverse bind matrices accessor ───────────────────────────────
  const ibmData = new Float32Array(HUMANOID_BONES.length * 16);
  for (let i = 0; i < HUMANOID_BONES.length; i++) {
    const wp = boneWorldPositions.get(HUMANOID_BONES[i].name);
    const ibm = computeInverseBindMatrix(wp);
    ibmData.set(ibm, i * 16);
  }

  const ibmAccessor = doc.createAccessor()
    .setType('MAT4')
    .setArray(ibmData)
    .setBuffer(buffer);

  // ── 5. Build Skin ─────────────────────────────────────────────────────────
  const skin = doc.createSkin(`${characterName}_Skin`);
  skin.setInverseBindMatrices(ibmAccessor);
  for (const boneDef of HUMANOID_BONES) {
    skin.addJoint(boneNodes.get(boneDef.name));
  }

  // ── 6. For every mesh primitive, add JOINTS_0 and WEIGHTS_0 ──────────────
  let totalVertices = 0;
  let totalPrimitives = 0;

  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const posAccessor = prim.getAttribute('POSITION');
      if (!posAccessor) {
        console.warn(`  [rig] Skipping primitive with no POSITION attribute`);
        continue;
      }

      const vertexCount = posAccessor.getCount();
      const jointsData = new Uint16Array(vertexCount * 4);
      const weightsData = new Float32Array(vertexCount * 4);

      for (let vi = 0; vi < vertexCount; vi++) {
        const pos = posAccessor.getElement(vi, [0, 0, 0]);
        const { indices, weights } = computeVertexWeights(pos, boneWorldPositions);

        for (let j = 0; j < 4; j++) {
          jointsData[vi * 4 + j] = indices[j] ?? 0;
          weightsData[vi * 4 + j] = weights[j] ?? 0;
        }
      }

      const jointsAccessor = doc.createAccessor()
        .setType('VEC4')
        .setArray(jointsData)
        .setBuffer(buffer);

      const weightsAccessor = doc.createAccessor()
        .setType('VEC4')
        .setArray(weightsData)
        .setBuffer(buffer);

      prim.setAttribute('JOINTS_0', jointsAccessor);
      prim.setAttribute('WEIGHTS_0', weightsAccessor);

      totalVertices += vertexCount;
      totalPrimitives++;
    }

    // Attach skin to the mesh node
    for (const node of root.listNodes()) {
      if (node.getMesh() === mesh) {
        node.setSkin(skin);
      }
    }
  }

  if (VERBOSE) {
    console.log(`  [rig] Rigged ${totalPrimitives} primitive(s), ${totalVertices} vertices`);
    console.log(`  [rig] Bone count: ${HUMANOID_BONES.length}`);
  }

  return { totalVertices, totalPrimitives, boneCount: HUMANOID_BONES.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         BRUTAL FIST — OFFLINE GLB RIGGING TOOL              ║');
  console.log('║  Converts STATIC_MESH GLBs → rigged GLBs with skeleton      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  if (DRY_RUN) console.log('⚠️  DRY RUN — no files will be written\n');

  // ── Load manifest ─────────────────────────────────────────────────────────
  if (!existsSync(MANIFEST_PATH)) {
    console.error(`❌ GLB_MANIFEST.json not found at: ${MANIFEST_PATH}`);
    console.error(`   Run: npm run glb:scan`);
    process.exit(1);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (err) {
    console.error(`❌ Failed to parse GLB_MANIFEST.json: ${err.message}`);
    process.exit(1);
  }

  const entries = manifest.characters ?? manifest;
  if (!Array.isArray(entries)) {
    console.error(`❌ GLB_MANIFEST.json has unexpected format — expected array of character entries`);
    process.exit(1);
  }

  // ── Filter to STATIC_MESH entries ─────────────────────────────────────────
  let staticEntries = entries.filter(e => e.classification === 'STATIC_MESH');

  if (charFilter) {
    staticEntries = staticEntries.filter(e =>
      (e.character ?? e.name ?? '').toUpperCase().includes(charFilter)
    );
    console.log(`🔍 Filtered to character: "${charFilter}" — ${staticEntries.length} entry/entries\n`);
  }

  if (staticEntries.length === 0) {
    console.log('✅ No STATIC_MESH entries found in manifest. Nothing to rig.');
    if (!charFilter) {
      console.log('   All roster GLBs are already classified as RIGGED_AND_ANIMATABLE or RIGGED_NO_ANIMATIONS.');
    }
    return;
  }

  console.log(`📋 Found ${staticEntries.length} STATIC_MESH entry/entries to rig:\n`);
  for (const e of staticEntries) {
    console.log(`   • ${e.character ?? e.name} — ${e.file}`);
  }
  console.log('');

  // ── Set up IO ─────────────────────────────────────────────────────────────
  const io = new NodeIO();

  const resolvedOutputDir = outputDir ? resolve(outputDir) : DEFAULT_OUTPUT_DIR;
  if (!DRY_RUN && !existsSync(resolvedOutputDir)) {
    mkdirSync(resolvedOutputDir, { recursive: true });
  }

  // ── Process each static entry ─────────────────────────────────────────────
  const results = [];

  for (const entry of staticEntries) {
    const characterName = (entry.character ?? entry.name ?? 'UNKNOWN').toUpperCase();
    const glbFile = entry.file;

    // Resolve input path — try common locations
    const candidatePaths = [
      join(ROOT, 'public/models', glbFile),
      join(ROOT, 'public', glbFile),
      join(ROOT, 'assets', glbFile),
      join(ROOT, glbFile),
    ];

    let inputPath = null;
    for (const p of candidatePaths) {
      if (existsSync(p)) { inputPath = p; break; }
    }

    if (!inputPath) {
      console.warn(`⚠️  [${characterName}] GLB not found locally — skipping.`);
      console.warn(`   Tried: ${candidatePaths.join(', ')}`);
      results.push({ character: characterName, file: glbFile, status: 'SKIPPED_NOT_FOUND' });
      continue;
    }

    const outputFileName = basename(glbFile, '.glb') + '_rigged_placeholder.glb';
    const outputPath = join(resolvedOutputDir, outputFileName);

    console.log(`🔧 Rigging: ${characterName} (${glbFile})`);
    console.log(`   Input:  ${inputPath}`);
    console.log(`   Output: ${outputPath}`);

    try {
      // Read the static GLB
      const doc = await io.read(inputPath);

      // Validate it's actually static (no existing skin)
      const existingSkins = doc.getRoot().listSkins();
      if (existingSkins.length > 0) {
        console.log(`   ℹ️  Already has ${existingSkins.length} skin(s) — skipping (not truly static)`);
        results.push({ character: characterName, file: glbFile, status: 'SKIPPED_ALREADY_RIGGED' });
        continue;
      }

      // Apply the rig
      const rigStats = rigDocument(doc, characterName);

      if (!DRY_RUN) {
        await io.write(outputPath, doc);
        console.log(`   ✅ Written: ${outputFileName}`);
        console.log(`      Bones: ${rigStats.boneCount} | Primitives: ${rigStats.totalPrimitives} | Vertices: ${rigStats.totalVertices}`);
      } else {
        console.log(`   [DRY RUN] Would write: ${outputFileName}`);
        console.log(`      Bones: ${rigStats.boneCount} | Primitives: ${rigStats.totalPrimitives} | Vertices: ${rigStats.totalVertices}`);
      }

      results.push({
        character: characterName,
        file: glbFile,
        outputFile: outputFileName,
        status: DRY_RUN ? 'DRY_RUN' : 'RIGGED',
        boneCount: rigStats.boneCount,
        totalVertices: rigStats.totalVertices,
      });

    } catch (err) {
      console.error(`   ❌ Failed to rig ${characterName}: ${err.message}`);
      if (VERBOSE) console.error(err.stack);
      results.push({ character: characterName, file: glbFile, status: 'ERROR', error: err.message });
    }

    console.log('');
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════');
  console.log('RIGGING SUMMARY');
  console.log('══════════════════════════════════════════════════════════════');

  const rigged = results.filter(r => r.status === 'RIGGED');
  const dryRun = results.filter(r => r.status === 'DRY_RUN');
  const skipped = results.filter(r => r.status.startsWith('SKIPPED'));
  const errors = results.filter(r => r.status === 'ERROR');

  if (rigged.length > 0) {
    console.log(`\n✅ RIGGED (${rigged.length}):`);
    for (const r of rigged) console.log(`   • ${r.character} → ${r.outputFile}`);
  }
  if (dryRun.length > 0) {
    console.log(`\n🔍 WOULD RIG (${dryRun.length}) [dry run]:`);
    for (const r of dryRun) console.log(`   • ${r.character} → ${r.outputFile}`);
  }
  if (skipped.length > 0) {
    console.log(`\n⏭️  SKIPPED (${skipped.length}):`);
    for (const r of skipped) console.log(`   • ${r.character} — ${r.status}`);
  }
  if (errors.length > 0) {
    console.log(`\n❌ ERRORS (${errors.length}):`);
    for (const r of errors) console.log(`   • ${r.character} — ${r.error}`);
  }

  console.log('');
  console.log('NOTE: Output files are named *_rigged_placeholder.glb to distinguish');
  console.log('      them from production-authored rigs. Replace with Blender-authored');
  console.log('      GLBs when available. Update GLB_MANIFEST.json after replacement.');
  console.log('');

  // Write results manifest
  if (!DRY_RUN) {
    const resultsPath = join(ROOT, 'docs/GLB_RIG_RESULTS.json');
    writeFileSync(resultsPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      tool: 'tools/diagnostics/rig-static-glbs.mjs',
      results,
    }, null, 2));
    console.log(`📄 Results written to: docs/GLB_RIG_RESULTS.json`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
