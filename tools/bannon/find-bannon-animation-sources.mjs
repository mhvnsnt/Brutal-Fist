#!/usr/bin/env node
/**
 * find-bannon-animation-sources.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Recursively searches the Bannon repository and connected repositories for
 * real animation source assets:
 *
 *   - .fbx files
 *   - .bvh files
 *   - animated .glb files (has animation clips)
 *   - .gltf files
 *   - mocap tooling (tools/mocap/)
 *   - BANNON_rigged.glb reference skeleton
 *   - Mixamo-compatible assets
 *
 * This tool does NOT fabricate animation data. It only reports what exists.
 *
 * Output: docs/BANNON_ANIMATION_SOURCES.json
 *
 * Usage:
 *   BANNON_SOURCE=/path/to/bannon node tools/bannon/find-bannon-animation-sources.mjs
 *   node tools/bannon/find-bannon-animation-sources.mjs --verbose
 *
 * Search terms (from user directive):
 *   .fbx, .bvh, animated .glb, .gltf, AnimationClip, clip, mocap,
 *   BANNON_rigged.glb, Mixamo, WWE, Schwarzerblitz, locomotion, idle,
 *   walk, run, punch, kick, grapple, throw, hit reaction, block,
 *   knockdown, getup
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../');

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const VERBOSE = args.includes('--verbose') || args.includes('-v');

// ── Bannon source root (configurable via env) ─────────────────────────────────
const BANNON_SOURCE = process.env.BANNON_SOURCE ?? join(ROOT, 'BannonSource');
const SCHWARZERBLITZ_SOURCE = process.env.SCHWARZERBLITZ_SOURCE ?? join(ROOT, 'SchwarzerblitzSource');

// ── Search paths ──────────────────────────────────────────────────────────────
const SEARCH_ROOTS = [
  ROOT,
  BANNON_SOURCE,
  SCHWARZERBLITZ_SOURCE,
  join(ROOT, 'public'),
  join(ROOT, 'assets'),
  join(ROOT, 'src/assets'),
  join(ROOT, 'tools'),
].filter(existsSync);

// ── Animation-related file extensions ────────────────────────────────────────
const ANIMATION_EXTENSIONS = new Set(['.fbx', '.bvh', '.glb', '.gltf', '.anim', '.json']);

// ── Animation-related filename keywords ──────────────────────────────────────
const ANIMATION_KEYWORDS = [
  'BANNON_rigged', 'rigged', 'animated', 'animation', 'anim',
  'mocap', 'motion', 'clip', 'idle', 'walk', 'run', 'punch', 'kick',
  'grapple', 'throw', 'hit', 'block', 'knockdown', 'getup', 'stance',
  'attack', 'combo', 'mixamo', 'bvh', 'fbx', 'locomotion',
];

// ── Mocap tool paths to specifically inspect ──────────────────────────────────
const MOCAP_TOOL_PATHS = [
  'tools/mocap',
  'tools/mocap/move_sheet.py',
  'tools/mocap/video_to_clip.py',
  'tools/harness/anim_autopsy.cjs',
  'tools/model_diag/rig_continuity.cjs',
];

// ── Directories to skip ───────────────────────────────────────────────────────
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.cache',
  '__pycache__', '.venv', 'venv',
]);

// ── Recursive file finder ─────────────────────────────────────────────────────
function* walkDir(dir, maxDepth = 6, depth = 0) {
  if (depth > maxDepth) return;
  if (!existsSync(dir)) return;

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath, maxDepth, depth + 1);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

// ── Check if a filename is animation-related ─────────────────────────────────
function isAnimationRelated(filePath) {
  const ext = extname(filePath).toLowerCase();
  const name = basename(filePath).toLowerCase();

  if (!ANIMATION_EXTENSIONS.has(ext)) return false;
  return ANIMATION_KEYWORDS.some(kw => name.includes(kw.toLowerCase()));
}

// ── Check if a GLB/GLTF file has animation data (by reading JSON) ─────────────
function glbHasAnimations(filePath) {
  try {
    const ext = extname(filePath).toLowerCase();
    if (ext === '.gltf') {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      return Array.isArray(data.animations) && data.animations.length > 0;
    }
    if (ext === '.glb') {
      // GLB: read the JSON chunk header to check for animations
      const buf = readFileSync(filePath);
      if (buf.length < 20) return false;
      // GLB header: magic(4) + version(4) + length(4) = 12 bytes
      // Chunk 0: chunkLength(4) + chunkType(4) + chunkData
      const chunkLength = buf.readUInt32LE(12);
      if (buf.length < 20 + chunkLength) return false;
      const jsonStr = buf.slice(20, 20 + chunkLength).toString('utf8').replace(/\0/g, '');
      const data = JSON.parse(jsonStr);
      return Array.isArray(data.animations) && data.animations.length > 0;
    }
  } catch {
    // Not parseable — assume no animations
  }
  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 Bannon Animation Source Finder');
  console.log('═'.repeat(60));
  console.log(`  Bannon source: ${BANNON_SOURCE}`);
  console.log(`  Project root:  ${ROOT}`);
  console.log('');

  const found = {
    fbxFiles: [],
    bvhFiles: [],
    animatedGlbFiles: [],
    staticGlbFiles: [],
    gltfFiles: [],
    mocapTools: [],
    riggedVariants: [],
    animationJsonFiles: [],
  };

  // ── Check mocap tool paths ────────────────────────────────────────────────
  console.log('Checking known mocap tool paths...');
  for (const toolPath of MOCAP_TOOL_PATHS) {
    const fullPath = join(ROOT, toolPath);
    const bannonPath = join(BANNON_SOURCE, toolPath);

    for (const p of [fullPath, bannonPath]) {
      if (existsSync(p)) {
        const stat = statSync(p);
        found.mocapTools.push({
          path: p.replace(ROOT, '.'),
          exists: true,
          isDirectory: stat.isDirectory(),
          sizeBytes: stat.isFile() ? stat.size : null,
        });
        console.log(`  ✅ Found: ${p.replace(ROOT, '.')}`);
      }
    }
  }

  // ── Walk search roots ─────────────────────────────────────────────────────
  console.log('\nSearching for animation assets...');
  let filesScanned = 0;

  for (const searchRoot of SEARCH_ROOTS) {
    if (VERBOSE) console.log(`  Scanning: ${searchRoot.replace(ROOT, '.')}`);

    for (const filePath of walkDir(searchRoot)) {
      filesScanned++;
      const ext = extname(filePath).toLowerCase();
      const name = basename(filePath).toLowerCase();
      const relPath = filePath.replace(ROOT, '.');

      if (ext === '.fbx') {
        found.fbxFiles.push({ path: relPath, name: basename(filePath) });
        if (VERBOSE) console.log(`  📦 FBX: ${relPath}`);
      } else if (ext === '.bvh') {
        found.bvhFiles.push({ path: relPath, name: basename(filePath) });
        if (VERBOSE) console.log(`  🎭 BVH: ${relPath}`);
      } else if (ext === '.glb') {
        const isRigready = name.includes('rigged') || name.includes('rigready');
        const hasAnims = glbHasAnimations(filePath);

        if (isRigready) {
          found.riggedVariants.push({
            path: relPath,
            name: basename(filePath),
            hasAnimations: hasAnims,
          });
          if (VERBOSE) console.log(`  🦴 Rigged GLB: ${relPath} (animations=${hasAnims})`);
        } else if (hasAnims) {
          found.animatedGlbFiles.push({
            path: relPath,
            name: basename(filePath),
          });
          if (VERBOSE) console.log(`  🎬 Animated GLB: ${relPath}`);
        } else if (isAnimationRelated(filePath)) {
          found.staticGlbFiles.push({
            path: relPath,
            name: basename(filePath),
          });
        }
      } else if (ext === '.gltf') {
        const hasAnims = glbHasAnimations(filePath);
        found.gltfFiles.push({
          path: relPath,
          name: basename(filePath),
          hasAnimations: hasAnims,
        });
        if (VERBOSE) console.log(`  📄 GLTF: ${relPath} (animations=${hasAnims})`);
      } else if (ext === '.json' && isAnimationRelated(filePath)) {
        found.animationJsonFiles.push({ path: relPath, name: basename(filePath) });
      }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('ANIMATION SOURCE INVENTORY');
  console.log('═'.repeat(60));
  console.log(`  Files scanned:        ${filesScanned}`);
  console.log(`  FBX files:            ${found.fbxFiles.length}`);
  console.log(`  BVH files:            ${found.bvhFiles.length}`);
  console.log(`  Animated GLBs:        ${found.animatedGlbFiles.length}`);
  console.log(`  Rigged GLB variants:  ${found.riggedVariants.length}`);
  console.log(`  GLTF files:           ${found.gltfFiles.length}`);
  console.log(`  Mocap tools found:    ${found.mocapTools.length}`);
  console.log(`  Animation JSON:       ${found.animationJsonFiles.length}`);

  if (found.riggedVariants.length > 0) {
    console.log('\n✅ RIGGED GLB VARIANTS (use these as skeleton source):');
    found.riggedVariants.forEach(f => {
      console.log(`   • ${f.path} (animations=${f.hasAnimations})`);
    });
  } else {
    console.log('\n⚠️  NO RIGGED GLB VARIANTS FOUND');
    console.log('   → BANNON_rigged.glb is documented in the Bannon repo but not found locally');
    console.log('   → Check: assets/models/BANNON_rigged.glb in the Bannon repository');
    console.log('   → Or: assets/models/incoming/BANNON_v1_rigready.glb');
  }

  if (found.fbxFiles.length > 0) {
    console.log('\n📦 FBX FILES (potential animation sources):');
    found.fbxFiles.forEach(f => console.log(`   • ${f.path}`));
  }

  if (found.bvhFiles.length > 0) {
    console.log('\n🎭 BVH FILES (mocap data):');
    found.bvhFiles.forEach(f => console.log(`   • ${f.path}`));
  }

  if (found.animatedGlbFiles.length > 0) {
    console.log('\n🎬 ANIMATED GLBs (have animation clips):');
    found.animatedGlbFiles.forEach(f => console.log(`   • ${f.path}`));
  }

  if (found.mocapTools.length === 0) {
    console.log('\n⚠️  NO MOCAP TOOLS FOUND locally');
    console.log('   → tools/mocap/ is in the Bannon repository, not this project');
    console.log('   → To use: clone mhvnsnt/Bannon and set BANNON_SOURCE=/path/to/bannon');
  }

  // ── Pipeline recommendation ───────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('RECOMMENDED ANIMATION PIPELINE');
  console.log('═'.repeat(60));

  const hasRiggedGlb = found.riggedVariants.length > 0;
  const hasAnimatedGlb = found.animatedGlbFiles.length > 0;
  const hasFbx = found.fbxFiles.length > 0;
  const hasBvh = found.bvhFiles.length > 0;

  if (hasRiggedGlb && (hasAnimatedGlb || hasFbx || hasBvh)) {
    console.log(`
✅ FULL PIPELINE AVAILABLE:
  1. Use ${found.riggedVariants[0].name} as the reference skeleton
  2. Load animation source (${hasFbx ? 'FBX' : hasBvh ? 'BVH' : 'animated GLB'})
  3. Retarget via ClipRetarget.ts (src/engine/retarget/ClipRetarget.ts)
  4. Validate channel resolution via validateAnimationChannelBones()
  5. Load into AnimationMixer targeting SkeletonUtils.clone(riggedGlb.scene)
`);
  } else if (hasRiggedGlb) {
    console.log(`
⚠️  PARTIAL PIPELINE — rigged skeleton found but no animation source:
  1. Use ${found.riggedVariants[0].name} as the reference skeleton
  2. Source animation clips from:
     - Mixamo (https://www.mixamo.com) — free humanoid animations
     - Bannon mocap pipeline (tools/mocap/video_to_clip.py)
     - BVH files from CMU mocap database
  3. Retarget via ClipRetarget.ts
`);
  } else {
    console.log(`
❌ PIPELINE BLOCKED — no rigged GLB found locally:
  1. Locate BANNON_rigged.glb in the mhvnsnt/Bannon repository
     Path: assets/models/BANNON_rigged.glb (28-joint reference rig)
  2. Or use BANNON_v1_rigready.glb from assets/models/incoming/
  3. Copy to public/models/ in this project
  4. Then run: node tools/diagnostics/inspect-glb-assets.mjs
  
  DO NOT generate synthetic bones at runtime.
  The authored rig must exist as a real GLB file.
`);
  }

  // ── Write output ──────────────────────────────────────────────────────────
  const output = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    tool: 'tools/bannon/find-bannon-animation-sources.mjs',
    policy: 'REAL_ANIMATION_DATA_FIRST — no fabricated clips',
    searchRoots: SEARCH_ROOTS.map(p => p.replace(ROOT, '.')),
    filesScanned,
    summary: {
      fbxFiles: found.fbxFiles.length,
      bvhFiles: found.bvhFiles.length,
      animatedGlbFiles: found.animatedGlbFiles.length,
      riggedVariants: found.riggedVariants.length,
      gltfFiles: found.gltfFiles.length,
      mocapTools: found.mocapTools.length,
      animationJsonFiles: found.animationJsonFiles.length,
    },
    pipelineStatus: hasRiggedGlb && (hasAnimatedGlb || hasFbx || hasBvh)
      ? 'FULL_PIPELINE_AVAILABLE'
      : hasRiggedGlb
      ? 'PARTIAL_PIPELINE_RIGGED_NO_ANIMATIONS'
      : 'BLOCKED_NO_RIGGED_GLB',
    found,
    // Required animation states for a playable fighter
    requiredAnimationStates: [
      'idle', 'walkForward', 'walkBackward', 'strafeLeft', 'strafeRight',
      'lightAttack', 'heavyAttack', 'guard', 'hit', 'knockdown', 'getup',
    ],
    // Canonical bone names required for BoneHitboxSystem
    requiredBones: [
      'Hips', 'Spine', 'Head',
      'RightHand', 'LeftHand',
      'RightFoot', 'LeftFoot',
    ],
  };

  const outPath = join(ROOT, 'docs/BANNON_ANIMATION_SOURCES.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2) + '\n');
  console.log(`\n📄 Source inventory written to: docs/BANNON_ANIMATION_SOURCES.json`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
