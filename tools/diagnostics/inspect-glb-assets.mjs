#!/usr/bin/env node
/**
 * inspect-glb-assets.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * OFFLINE GLB ASSET INSPECTOR — Animation Pipeline Diagnostic
 *
 * Scans every roster GLB and produces a deterministic asset manifest that
 * classifies each file as:
 *   RIGGED_AND_ANIMATABLE  — has SkinnedMesh + Skeleton + animation clips
 *   RIGGED_NO_ANIMATIONS   — has SkinnedMesh + Skeleton but no animation clips
 *   STATIC_MESH            — no SkinnedMesh, no Skeleton (cannot animate)
 *   ANIMATION_ONLY         — has animation clips but no SkinnedMesh
 *   MALFORMED              — corrupt or unreadable
 *
 * For each GLB also reports:
 *   - SHA256 hash (for change detection)
 *   - mesh count / SkinnedMesh count / skin count / bone count
 *   - JOINTS_0 / WEIGHTS_0 attribute presence
 *   - inverse bind matrices presence
 *   - animation clip count + names
 *   - bone names (full list)
 *   - root node name
 *   - bounding box height + bottom Y
 *   - native root rotation
 *   - animation channel → bone resolution (per clip)
 *   - unresolved channel count (statue/bind-pose lock indicator)
 *
 * Output: docs/GLB_ASSET_MANIFEST.json
 *
 * Usage:
 *   node tools/diagnostics/inspect-glb-assets.mjs
 *   node tools/diagnostics/inspect-glb-assets.mjs --verbose
 *   node tools/diagnostics/inspect-glb-assets.mjs --character BANNON
 *   node tools/diagnostics/inspect-glb-assets.mjs --output ./custom-output.json
 *
 * IMPORTANT: This tool reads the actual GLB binary data using @gltf-transform/core.
 * It does NOT modify any files. It is read-only.
 *
 * The manifest is consumed by:
 *   - CharacterPipeline.ts (runtime validation)
 *   - FighterMesh.tsx (animation integrity gate)
 *   - rig-static-glbs.mjs (offline rigging tool)
 *   - AGENTS.md (agent context)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

// ── @gltf-transform/core ─────────────────────────────────────────────────────
import { NodeIO, Document } from '@gltf-transform/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const charFilter = (() => {
  const idx = args.indexOf('--character');
  return idx !== -1 ? args[idx + 1]?.toUpperCase() : null;
})();
const outputPath = (() => {
  const idx = args.indexOf('--output');
  return idx !== -1 ? args[idx + 1] : join(ROOT, 'docs/GLB_ASSET_MANIFEST.json');
})();

// ── Model search paths ────────────────────────────────────────────────────────
const MODEL_DIRS = [
  join(ROOT, 'public/models'),
  join(ROOT, 'public/assets/models'),
  join(ROOT, 'assets/models'),
  join(ROOT, 'src/assets/models'),
];

// ── Bannon source inventory (from bannonGlbSourceInventory.ts) ───────────────
// These are the "rigready" variants that should be preferred over static ones.
const RIGREADY_VARIANTS = [
  'BANNON_rigged.glb',
  'BANNON_v1_rigready.glb',
  'BANNON_alt_rigready.glb',
  'BANNON_masked_rigready.glb',
  'MAIME_v1_rigready.glb',
];

// ── Canonical Bannon bone names (from BannonRetargetContract) ────────────────
const CANONICAL_BONES = [
  'Hips', 'Spine', 'Spine1', 'Spine2',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'Neck', 'Head',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
];

// ── Mixamo prefix variants ────────────────────────────────────────────────────
const MIXAMO_PREFIXES = ['mixamorig', 'mixamorigHips', ''];

function normalizeBoneName(name) {
  // Strip Mixamo prefix
  for (const prefix of MIXAMO_PREFIXES) {
    if (prefix && name.startsWith(prefix)) {
      return name.slice(prefix.length);
    }
  }
  return name;
}

// ── Collect all GLB files ─────────────────────────────────────────────────────
function findGlbFiles() {
  const found = [];
  for (const dir of MODEL_DIRS) {
    if (!existsSync(dir)) continue;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && extname(entry.name).toLowerCase() === '.glb') {
          const fullPath = join(dir, entry.name);
          if (!charFilter || entry.name.toUpperCase().includes(charFilter)) {
            found.push({ path: fullPath, name: entry.name, dir });
          }
        }
      }
    } catch (e) {
      // Directory not accessible
    }
  }
  return found;
}

// ── SHA256 hash ───────────────────────────────────────────────────────────────
function sha256(filePath) {
  try {
    const data = readFileSync(filePath);
    return createHash('sha256').update(data).digest('hex');
  } catch {
    return 'UNREADABLE';
  }
}

// ── Inspect a single GLB ──────────────────────────────────────────────────────
async function inspectGlb(filePath, fileName) {
  const result = {
    file: fileName,
    path: filePath,
    sha256: sha256(filePath),
    fileSizeBytes: 0,
    classification: 'MALFORMED',
    meshCount: 0,
    skinnedMeshCount: 0,
    skinCount: 0,
    boneCount: 0,
    hasJointsAttribute: false,
    hasWeightsAttribute: false,
    hasInverseBindMatrices: false,
    animationClipCount: 0,
    animationClipNames: [],
    boneNames: [],
    normalizedBoneNames: [],
    rootNodeName: null,
    heightEstimate: null,
    bottomY: null,
    nativeRootRotation: null,
    channelResolution: [],
    unresolvedChannelCount: 0,
    resolvedChannelCount: 0,
    isRigreadyVariant: RIGREADY_VARIANTS.includes(fileName),
    canonicalBonesPresent: [],
    canonicalBonesMissing: [],
    error: null,
  };

  try {
    const stat = statSync(filePath);
    result.fileSizeBytes = stat.size;

    const io = new NodeIO();
    const doc = await io.read(filePath);
    const root = doc.getRoot();

    // ── Meshes ────────────────────────────────────────────────────────────
    const meshes = root.listMeshes();
    result.meshCount = meshes.length;

    let hasJoints = false;
    let hasWeights = false;
    let skinnedMeshCount = 0;

    for (const mesh of meshes) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getAttribute('JOINTS_0')) hasJoints = true;
        if (prim.getAttribute('WEIGHTS_0')) hasWeights = true;
        if (prim.getAttribute('JOINTS_0') && prim.getAttribute('WEIGHTS_0')) {
          skinnedMeshCount++;
        }
      }
    }

    result.hasJointsAttribute = hasJoints;
    result.hasWeightsAttribute = hasWeights;
    result.skinnedMeshCount = skinnedMeshCount;

    // ── Skins ─────────────────────────────────────────────────────────────
    const skins = root.listSkins();
    result.skinCount = skins.length;

    let boneNames = [];
    let hasIBM = false;

    for (const skin of skins) {
      if (skin.getInverseBindMatrices()) hasIBM = true;
      for (const joint of skin.listJoints()) {
        const name = joint.getName();
        if (name && !boneNames.includes(name)) {
          boneNames.push(name);
        }
      }
    }

    // Also collect bones from node hierarchy (some exporters don't use skins)
    const nodes = root.listNodes();
    for (const node of nodes) {
      const name = node.getName();
      if (name && name.toLowerCase().includes('bone') ||
          name && (name.startsWith('mixamorig') || CANONICAL_BONES.some(b => normalizeBoneName(name) === b))) {
        if (!boneNames.includes(name)) boneNames.push(name);
      }
    }

    result.boneCount = boneNames.length;
    result.boneNames = boneNames;
    result.normalizedBoneNames = boneNames.map(normalizeBoneName);
    result.hasInverseBindMatrices = hasIBM;

    // ── Root node ─────────────────────────────────────────────────────────
    const scenes = root.listScenes();
    if (scenes.length > 0) {
      const rootNodes = scenes[0].listChildren();
      if (rootNodes.length > 0) {
        result.rootNodeName = rootNodes[0].getName();
        const rot = rootNodes[0].getRotation();
        result.nativeRootRotation = rot ? Array.from(rot) : null;
      }
    }

    // ── Animations ────────────────────────────────────────────────────────
    const animations = root.listAnimations();
    result.animationClipCount = animations.length;
    result.animationClipNames = animations.map(a => a.getName() || '(unnamed)');

    // ── Channel resolution ────────────────────────────────────────────────
    const boneNameSet = new Set(boneNames);
    const normalizedBoneSet = new Set(boneNames.map(normalizeBoneName));

    let resolvedTotal = 0;
    let unresolvedTotal = 0;
    const channelResolution = [];

    for (const anim of animations) {
      const clipName = anim.getName() || '(unnamed)';
      const channels = anim.listChannels();
      let clipResolved = 0;
      let clipUnresolved = 0;
      const mismatches = [];

      for (const channel of channels) {
        const targetNode = channel.getTargetNode();
        const targetName = targetNode ? targetNode.getName() : null;
        const normalizedTarget = targetName ? normalizeBoneName(targetName) : null;

        const resolves = targetName && (
          boneNameSet.has(targetName) ||
          normalizedBoneSet.has(normalizedTarget)
        );

        if (resolves) {
          clipResolved++;
          resolvedTotal++;
        } else {
          clipUnresolved++;
          unresolvedTotal++;
          mismatches.push({
            targetName: targetName || '(null)',
            normalizedTarget: normalizedTarget || '(null)',
            path: channel.getTargetPath(),
          });
        }
      }

      channelResolution.push({
        clipName,
        totalChannels: channels.length,
        resolvedChannels: clipResolved,
        unresolvedChannels: clipUnresolved,
        mismatches: mismatches.slice(0, 10), // cap at 10 for readability
      });
    }

    result.channelResolution = channelResolution;
    result.resolvedChannelCount = resolvedTotal;
    result.unresolvedChannelCount = unresolvedTotal;

    // ── Canonical bone coverage ───────────────────────────────────────────
    const present = [];
    const missing = [];
    for (const canonical of CANONICAL_BONES) {
      const found = boneNames.some(b => normalizeBoneName(b) === canonical);
      if (found) present.push(canonical);
      else missing.push(canonical);
    }
    result.canonicalBonesPresent = present;
    result.canonicalBonesMissing = missing;

    // ── Classification ────────────────────────────────────────────────────
    const hasRig = result.skinCount > 0 || result.boneCount > 0 ||
                   (result.hasJointsAttribute && result.hasWeightsAttribute);
    const hasAnimations = result.animationClipCount > 0;

    if (result.meshCount === 0) {
      result.classification = 'MALFORMED';
    } else if (hasRig && hasAnimations) {
      result.classification = 'RIGGED_AND_ANIMATABLE';
    } else if (hasRig && !hasAnimations) {
      result.classification = 'RIGGED_NO_ANIMATIONS';
    } else if (!hasRig && hasAnimations) {
      result.classification = 'ANIMATION_ONLY';
    } else {
      result.classification = 'STATIC_MESH';
    }

  } catch (err) {
    result.classification = 'MALFORMED';
    result.error = err.message;
  }

  return result;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 GLB Asset Inspector — Brutal Fist Animation Pipeline Diagnostic');
  console.log('═'.repeat(70));

  const glbFiles = findGlbFiles();

  if (glbFiles.length === 0) {
    console.warn('⚠️  No GLB files found in model directories:');
    MODEL_DIRS.forEach(d => console.warn(`   ${d}`));
    console.warn('\nThis is expected in the Rocket.new environment where GLB files');
    console.warn('are served from the Bannon repository CDN, not stored locally.');
    console.warn('\nThe manifest will document the expected asset contract instead.');
  }

  console.log(`\nFound ${glbFiles.length} GLB file(s) to inspect.\n`);

  const results = [];
  const summary = {
    RIGGED_AND_ANIMATABLE: [],
    RIGGED_NO_ANIMATIONS: [],
    STATIC_MESH: [],
    ANIMATION_ONLY: [],
    MALFORMED: [],
  };

  for (const { path: filePath, name: fileName } of glbFiles) {
    process.stdout.write(`  Inspecting ${fileName}... `);
    const result = await inspectGlb(filePath, fileName);
    results.push(result);
    summary[result.classification].push(fileName);

    const icon = {
      RIGGED_AND_ANIMATABLE: '✅',
      RIGGED_NO_ANIMATIONS: '⚠️ ',
      STATIC_MESH: '❌',
      ANIMATION_ONLY: '🎬',
      MALFORMED: '💥',
    }[result.classification];

    console.log(`${icon} ${result.classification} (bones=${result.boneCount} clips=${result.animationClipCount} skins=${result.skinCount})`);

    if (VERBOSE) {
      if (result.boneNames.length > 0) {
        console.log(`     Bones: ${result.boneNames.slice(0, 8).join(', ')}${result.boneNames.length > 8 ? ` +${result.boneNames.length - 8} more` : ''}`);
      }
      if (result.animationClipNames.length > 0) {
        console.log(`     Clips: ${result.animationClipNames.slice(0, 5).join(', ')}${result.animationClipNames.length > 5 ? ` +${result.animationClipNames.length - 5} more` : ''}`);
      }
      if (result.unresolvedChannelCount > 0) {
        console.log(`     ⚠️  ${result.unresolvedChannelCount} unresolved animation channels (statue/bind-pose lock risk)`);
      }
      if (result.canonicalBonesMissing.length > 0) {
        console.log(`     Missing canonical bones: ${result.canonicalBonesMissing.join(', ')}`);
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('CLASSIFICATION SUMMARY');
  console.log('═'.repeat(70));
  console.log(`✅ RIGGED_AND_ANIMATABLE:  ${summary.RIGGED_AND_ANIMATABLE.length}`);
  console.log(`⚠️  RIGGED_NO_ANIMATIONS:   ${summary.RIGGED_NO_ANIMATIONS.length}`);
  console.log(`❌ STATIC_MESH:            ${summary.STATIC_MESH.length}`);
  console.log(`🎬 ANIMATION_ONLY:         ${summary.ANIMATION_ONLY.length}`);
  console.log(`💥 MALFORMED:              ${summary.MALFORMED.length}`);

  if (summary.STATIC_MESH.length > 0) {
    console.log('\n⚠️  STATIC MESH ASSETS (require offline rigging before animation):');
    summary.STATIC_MESH.forEach(f => console.log(`   • ${f}`));
    console.log('\n   → Run: node tools/diagnostics/rig-static-glbs.mjs');
    console.log('   → Or use Blender with the Bannon rig template for authored skinning');
  }

  if (summary.RIGGED_NO_ANIMATIONS.length > 0) {
    console.log('\n⚠️  RIGGED BUT NO ANIMATIONS (require animation clip source):');
    summary.RIGGED_NO_ANIMATIONS.forEach(f => console.log(`   • ${f}`));
    console.log('\n   → Check Bannon mocap pipeline: tools/mocap/');
    console.log('   → Or retarget from Mixamo/BVH source using ClipRetarget.ts');
  }

  // ── Write manifest ────────────────────────────────────────────────────────
  const manifest = {
    schema: 2,
    generatedAt: new Date().toISOString(),
    tool: 'tools/diagnostics/inspect-glb-assets.mjs',
    policy: 'REAL_AUTHORED_ASSETS_ONLY — no synthetic rigging, no fabricated clips',
    modelDirsSearched: MODEL_DIRS,
    totalFilesInspected: results.length,
    summary: {
      RIGGED_AND_ANIMATABLE: summary.RIGGED_AND_ANIMATABLE.length,
      RIGGED_NO_ANIMATIONS: summary.RIGGED_NO_ANIMATIONS.length,
      STATIC_MESH: summary.STATIC_MESH.length,
      ANIMATION_ONLY: summary.ANIMATION_ONLY.length,
      MALFORMED: summary.MALFORMED.length,
    },
    // Asset contract: what the runtime expects for each fighter
    assetContract: {
      required: ['SkinnedMesh', 'Skeleton', 'Bones', 'skinWeights', 'inverseBindMatrices', 'AnimationClips'],
      blocked: ['STATIC_MESH', 'MALFORMED'],
      warning: ['RIGGED_NO_ANIMATIONS'],
      pass: ['RIGGED_AND_ANIMATABLE'],
    },
    // Known rigready variants from Bannon source inventory
    rigreadyVariants: RIGREADY_VARIANTS,
    // Canonical Bannon bone names (from BannonRetargetContract)
    canonicalBones: CANONICAL_BONES,
    assets: results,
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\n📄 Manifest written to: ${outputPath}`);
  console.log(`   ${results.length} assets documented.`);

  // ── Pipeline recommendation ───────────────────────────────────────────────
  console.log('\n' + '═'.repeat(70));
  console.log('ANIMATION PIPELINE RECOMMENDATION');
  console.log('═'.repeat(70));
  console.log(`
The correct pipeline for animated fighters is:

  AUTHORED RIGGED GLB (with SkinnedMesh + Skeleton + skin weights)
    ↓
  GLTFLoader → gltf.scene + gltf.animations
    ↓
  SkeletonUtils.clone(gltf.scene)  ← CRITICAL: not scene.clone(true)
    ↓
  AnimationMixer(clonedScene)      ← targets the VISIBLE clone
    ↓
  mixer.clipAction(clip, clonedScene).play()
    ↓
  mixer.update(delta) every frame  ← drives bone rotations
    ↓
  SkinnedMesh deforms via authored skin weights
    ↓
  VISIBLE JOINT DEFORMATION

For STATIC_MESH assets:
  → Use BANNON_rigged.glb / MAIME_v1_rigready.glb as the authoritative rig
  → Do NOT generate synthetic bones at runtime
  → Run offline rigging via Blender or rig-static-glbs.mjs (placeholder only)

For RIGGED_NO_ANIMATIONS assets:
  → Source animation clips from Bannon mocap pipeline (tools/mocap/)
  → Or retarget Mixamo/BVH clips using ClipRetarget.ts
  → Validate channel resolution before playback
`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
