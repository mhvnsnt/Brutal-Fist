#!/usr/bin/env node
/**
 * normalize-glb.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * BUILD-TIME character GLB pre-normalization script.
 *
 * What it does (per GLB):
 *   1. Reads the source GLB via @gltf-transform/core NodeIO
 *   2. Locates the root scene node (first child of the default scene)
 *   3. Zeros the root node's translation → [0, 0, 0]
 *   4. Zeros the root node's rotation  → [0, 0, 0, 1]  (identity quaternion)
 *   5. Measures the aggregate AABB of all Mesh primitives in the document
 *   6. Computes a uniform scale factor so the character's height = TARGET_HEIGHT
 *   7. Applies that scale to the root node's scale component
 *   8. Writes the result to the output path
 *
 * Per-character overrides are read from src/config/characterNormalization.json:
 *   - uniformScale  → explicit scale override (skips auto-height measurement)
 *   - yOffset       → additional Y translation applied after centering
 *   - rotationY     → additional Y-axis rotation (radians) applied after zeroing
 *   - blocked       → skip this character entirely (writes nothing)
 *
 * AUTHORED SKELETON LAW
 * ─────────────────────
 * This script ONLY modifies the root scene node's TRS (translation/rotation/scale).
 * It does NOT:
 *   • touch any bone/joint nodes below the root
 *   • modify inverse-bind matrices
 *   • rewrite skinIndex/skinWeight attributes
 *   • alter mesh geometry, materials, or textures
 *   • change animation clips
 *
 * Usage:
 *   node scripts/normalize-glb.mjs [options]
 *
 * Options:
 *   --input  <dir>    Directory containing source .glb files  (default: public/models/source)
 *   --output <dir>    Directory for normalized .glb files     (default: public/models)
 *   --config <path>   Path to characterNormalization.json     (default: src/config/characterNormalization.json)
 *   --height <n>      Target height in world units            (default: 1.85)
 *   --dry-run         Print what would be done without writing files
 *   --verbose         Print per-character diagnostic details
 *   --character <id>  Process only this character id (may be repeated)
 *
 * Examples:
 *   node scripts/normalize-glb.mjs
 *   node scripts/normalize-glb.mjs --input assets/raw --output public/models --verbose
 *   node scripts/normalize-glb.mjs --character bannon --character maime --dry-run
 *
 * Add to package.json scripts:
 *   "glb:normalize": "node scripts/normalize-glb.mjs"
 */

import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { readFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');

const DEFAULT_TARGET_HEIGHT = 1.85;
const DEFAULT_INPUT_DIR     = join(ROOT, 'public', 'models', 'source');
const DEFAULT_OUTPUT_DIR    = join(ROOT, 'public', 'models');
const DEFAULT_CONFIG_PATH   = join(ROOT, 'src', 'config', 'characterNormalization.json');

// ─────────────────────────────────────────────────────────────────────────────
// CLI argument parsing
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    input:      DEFAULT_INPUT_DIR,
    output:     DEFAULT_OUTPUT_DIR,
    config:     DEFAULT_CONFIG_PATH,
    height:     DEFAULT_TARGET_HEIGHT,
    dryRun:     false,
    verbose:    false,
    characters: [],
  };

  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    switch (flag) {
      case '--input':      args.input      = resolve(argv[++i]); break;
      case '--output':     args.output     = resolve(argv[++i]); break;
      case '--config':     args.config     = resolve(argv[++i]); break;
      case '--height':     args.height     = parseFloat(argv[++i]); break;
      case '--dry-run':    args.dryRun     = true; break;
      case '--verbose':    args.verbose    = true; break;
      case '--character':  args.characters.push(argv[++i]); break;
      default:
        console.warn(`[normalize-glb] Unknown flag: ${flag}`);
    }
  }

  return args;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config loader
// ─────────────────────────────────────────────────────────────────────────────

function loadConfig(configPath) {
  if (!existsSync(configPath)) {
    console.warn(`[normalize-glb] Config not found at ${configPath} — using defaults for all characters.`);
    return { characters: {} };
  }
  try {
    const raw = readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[normalize-glb] Failed to parse config: ${err.message}`);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AABB measurement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Measures the aggregate axis-aligned bounding box of all mesh primitives
 * in the document by reading POSITION accessor data directly.
 *
 * Returns { minY, maxY, height } in the document's local coordinate space
 * (i.e., before any root-node scale is applied).
 *
 * If no POSITION data is found, returns null.
 */
function measureDocumentAABB(document) {
  let globalMinX = Infinity,  globalMaxX = -Infinity;
  let globalMinY = Infinity,  globalMaxY = -Infinity;
  let globalMinZ = Infinity,  globalMaxZ = -Infinity;
  let found = false;

  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const posAccessor = prim.getAttribute('POSITION');
      if (!posAccessor) continue;

      const count = posAccessor.getCount();
      for (let i = 0; i < count; i++) {
        const x = posAccessor.getScalar(i * 3 + 0);
        const y = posAccessor.getScalar(i * 3 + 1);
        const z = posAccessor.getScalar(i * 3 + 2);

        if (x < globalMinX) globalMinX = x;
        if (x > globalMaxX) globalMaxX = x;
        if (y < globalMinY) globalMinY = y;
        if (y > globalMaxY) globalMaxY = y;
        if (z < globalMinZ) globalMinZ = z;
        if (z > globalMaxZ) globalMaxZ = z;
        found = true;
      }
    }
  }

  if (!found) return null;

  return {
    minX: globalMinX, maxX: globalMaxX,
    minY: globalMinY, maxY: globalMaxY,
    minZ: globalMinZ, maxZ: globalMaxZ,
    height: globalMaxY - globalMinY,
    width:  globalMaxX - globalMinX,
    depth:  globalMaxZ - globalMinZ,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Root node helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the root scene node of the document's default scene.
 * For multi-root scenes, returns the first child.
 * Returns null if no scene or no children.
 */
function getRootNode(document) {
  const scene = document.getRoot().getDefaultScene();
  if (!scene) return null;
  const children = scene.listChildren();
  if (children.length === 0) return null;
  return children[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// Quaternion helpers (no Three.js dependency at build time)
// ─────────────────────────────────────────────────────────────────────────────

/** Returns a quaternion representing a rotation of `radians` around the Y axis. */
function quatFromAxisAngleY(radians) {
  const half = radians / 2;
  return [0, Math.sin(half), 0, Math.cos(half)];
}

/** Multiplies two quaternions: q1 * q2 */
function quatMultiply(q1, q2) {
  const [x1, y1, z1, w1] = q1;
  const [x2, y2, z2, w2] = q2;
  return [
    w1*x2 + x1*w2 + y1*z2 - z1*y2,
    w1*y2 - x1*z2 + y1*w2 + z1*x2,
    w1*z2 + x1*y2 - y1*x2 + z1*w2,
    w1*w2 - x1*x2 - y1*y2 - z1*z2,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-character normalization
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Applies normalization transforms to the root node of a loaded document.
 *
 * Transform order:
 *   1. Zero root translation → [0, 0, 0]
 *   2. Zero root rotation   → identity quaternion [0, 0, 0, 1]
 *   3. Apply rotationY override (if any) as a Y-axis quaternion rotation
 *   4. Apply yOffset override to root translation Y
 *   5. Compute uniform scale (auto from AABB height, or explicit uniformScale override)
 *   6. Apply scale to root node
 *
 * Returns a diagnostic object describing what was applied.
 */
function normalizeDocument(document, override, targetHeight, verbose) {
  const diag = {
    rootNodeFound:    false,
    aabb:             null,
    scaleApplied:     1.0,
    scaleSource:      'none',
    translationApplied: [0, 0, 0],
    rotationApplied:  [0, 0, 0, 1],
    warnings:         [],
  };

  const rootNode = getRootNode(document);
  if (!rootNode) {
    diag.warnings.push('No root scene node found — document structure may be non-standard.');
    return diag;
  }
  diag.rootNodeFound = true;

  // ── Step 1 & 2: Zero translation and rotation ──────────────────────────────
  rootNode.setTranslation([0, 0, 0]);
  rootNode.setRotation([0, 0, 0, 1]);

  // ── Step 3: Apply rotationY override ──────────────────────────────────────
  let finalRotation = [0, 0, 0, 1];
  if (override.rotationY && override.rotationY !== 0) {
    finalRotation = quatFromAxisAngleY(override.rotationY);
    rootNode.setRotation(finalRotation);
    if (verbose) {
      console.log(`    rotationY override: ${override.rotationY.toFixed(4)} rad → quaternion [${finalRotation.map(v => v.toFixed(4)).join(', ')}]`);
    }
  }
  diag.rotationApplied = finalRotation;

  // ── Step 4: Apply yOffset override ────────────────────────────────────────
  const yOffset = override.yOffset ?? 0;
  const finalTranslation = [0, yOffset, 0];
  rootNode.setTranslation(finalTranslation);
  diag.translationApplied = finalTranslation;
  if (verbose && yOffset !== 0) {
    console.log(`    yOffset override: ${yOffset}`);
  }

  // ── Step 5 & 6: Compute and apply scale ───────────────────────────────────
  let scale = 1.0;
  let scaleSource = 'identity';

  if (override.uniformScale != null) {
    // Explicit override — use directly
    scale = override.uniformScale;
    scaleSource = 'override';
    if (verbose) {
      console.log(`    uniformScale override: ${scale}`);
    }
  } else {
    // Auto-compute from AABB
    const aabb = measureDocumentAABB(document);
    diag.aabb = aabb;

    if (aabb && aabb.height > 0) {
      scale = targetHeight / aabb.height;
      scaleSource = `auto (measured height=${aabb.height.toFixed(4)}, target=${targetHeight})`;
      if (verbose) {
        console.log(`    AABB: height=${aabb.height.toFixed(4)}, width=${aabb.width.toFixed(4)}, depth=${aabb.depth.toFixed(4)}`);
        console.log(`    auto scale: ${scale.toFixed(6)} (${targetHeight} / ${aabb.height.toFixed(4)})`);
      }

      // Validate against expectedBounds
      const bounds = override.expectedBounds;
      if (bounds) {
        const scaledHeight = aabb.height * scale;
        const scaledWidth  = aabb.width  * scale;
        const scaledDepth  = aabb.depth  * scale;

        if (bounds.minHeight != null && scaledHeight < bounds.minHeight) {
          diag.warnings.push(`Scaled height ${scaledHeight.toFixed(3)} < expectedBounds.minHeight ${bounds.minHeight}`);
        }
        if (bounds.maxHeight != null && scaledHeight > bounds.maxHeight) {
          diag.warnings.push(`Scaled height ${scaledHeight.toFixed(3)} > expectedBounds.maxHeight ${bounds.maxHeight}`);
        }
        if (bounds.maxWidth != null && scaledWidth > bounds.maxWidth) {
          diag.warnings.push(`Scaled width ${scaledWidth.toFixed(3)} > expectedBounds.maxWidth ${bounds.maxWidth}`);
        }
        if (bounds.maxDepth != null && scaledDepth > bounds.maxDepth) {
          diag.warnings.push(`Scaled depth ${scaledDepth.toFixed(3)} > expectedBounds.maxDepth ${bounds.maxDepth}`);
        }
      }
    } else {
      diag.warnings.push('No POSITION data found — scale left at 1.0 (identity). Check that the GLB contains mesh geometry.');
      scaleSource = 'identity (no geometry)';
    }
  }

  rootNode.setScale([scale, scale, scale]);
  diag.scaleApplied = scale;
  diag.scaleSource  = scaleSource;

  return diag;
}

// ─────────────────────────────────────────────────────────────────────────────
// GLB filename → character id mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Derives a character id from a GLB filename by:
 *   1. Stripping the extension
 *   2. Removing known attire suffixes (_ring, _street, _sober, _feral, _gear)
 *   3. Lower-casing and replacing spaces/hyphens with underscores
 *
 * Examples:
 *   BANNON.glb          → bannon
 *   CAIN_ELIAS_ring.glb → cain_elias
 *   ONYX_street.glb     → onyx
 */
function glbFilenameToCharacterId(filename) {
  const ATTIRE_SUFFIXES = ['_ring', '_street', '_sober', '_feral', '_gear'];
  let name = basename(filename, extname(filename));
  for (const suffix of ATTIRE_SUFFIXES) {
    if (name.toLowerCase().endsWith(suffix)) {
      name = name.slice(0, name.length - suffix.length);
      break;
    }
  }
  return name.toLowerCase().replace(/[\s-]+/g, '_');
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args   = parseArgs(process.argv);
  const config = loadConfig(args.config);

  // Ensure output directory exists
  if (!args.dryRun) {
    mkdirSync(args.output, { recursive: true });
  }

  // Collect GLB files from input directory
  if (!existsSync(args.input)) {
    console.error(`[normalize-glb] Input directory not found: ${args.input}`);
    console.error(`  Create the directory and place your source .glb files there, then re-run.`);
    process.exit(1);
  }

  const allFiles = readdirSync(args.input)
    .filter(f => extname(f).toLowerCase() === '.glb')
    .sort();

  if (allFiles.length === 0) {
    console.warn(`[normalize-glb] No .glb files found in ${args.input}`);
    process.exit(0);
  }

  // Filter to requested characters if --character flags were provided
  const targetFiles = args.characters.length > 0
    ? allFiles.filter(f => args.characters.includes(glbFilenameToCharacterId(f)))
    : allFiles;

  if (targetFiles.length === 0) {
    console.warn(`[normalize-glb] No matching .glb files for requested characters: ${args.characters.join(', ')}`);
    process.exit(0);
  }

  // Set up @gltf-transform NodeIO with all known extensions
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

  const results = {
    processed: [],
    skipped:   [],
    warnings:  [],
    errors:    [],
  };

  console.log(`\n[normalize-glb] Processing ${targetFiles.length} GLB file(s)`);
  console.log(`  Input:        ${args.input}`);
  console.log(`  Output:       ${args.output}`);
  console.log(`  Target height: ${args.height} units`);
  console.log(`  Dry run:      ${args.dryRun}`);
  console.log('');

  for (const filename of targetFiles) {
    const characterId = glbFilenameToCharacterId(filename);
    const inputPath   = join(args.input, filename);
    const outputPath  = join(args.output, filename);
    const override    = (config.characters && config.characters[characterId]) ?? {};

    console.log(`── ${filename} (id: ${characterId})`);

    // ── Blocked check ────────────────────────────────────────────────────────
    if (override.blocked === true) {
      const reason = override.blockReason ?? 'blocked=true in characterNormalization.json';
      console.log(`   BLOCKED — ${reason}`);
      results.skipped.push({ filename, characterId, reason });
      continue;
    }

    // ── Load ─────────────────────────────────────────────────────────────────
    let document;
    try {
      document = await io.read(inputPath);
    } catch (err) {
      const msg = `Failed to read GLB: ${err.message}`;
      console.error(`   ERROR — ${msg}`);
      results.errors.push({ filename, characterId, error: msg });
      continue;
    }

    // ── Normalize ─────────────────────────────────────────────────────────────
    const diag = normalizeDocument(document, override, args.height, args.verbose);

    if (diag.warnings.length > 0) {
      for (const w of diag.warnings) {
        console.warn(`   WARNING — ${w}`);
        results.warnings.push({ filename, characterId, warning: w });
      }
    }

    if (args.verbose) {
      console.log(`   rootNodeFound:  ${diag.rootNodeFound}`);
      console.log(`   scaleApplied:   ${diag.scaleApplied.toFixed(6)} (${diag.scaleSource})`);
      console.log(`   translation:    [${diag.translationApplied.map(v => v.toFixed(4)).join(', ')}]`);
      console.log(`   rotation:       [${diag.rotationApplied.map(v => v.toFixed(4)).join(', ')}]`);
    }

    // ── Write ─────────────────────────────────────────────────────────────────
    if (!args.dryRun) {
      try {
        await io.write(outputPath, document);
        console.log(`   ✓ written → ${outputPath}`);
      } catch (err) {
        const msg = `Failed to write GLB: ${err.message}`;
        console.error(`   ERROR — ${msg}`);
        results.errors.push({ filename, characterId, error: msg });
        continue;
      }
    } else {
      console.log(`   [dry-run] would write → ${outputPath}`);
    }

    results.processed.push({
      filename,
      characterId,
      scaleApplied:   diag.scaleApplied,
      scaleSource:    diag.scaleSource,
      aabb:           diag.aabb,
      warnings:       diag.warnings,
    });
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log(`[normalize-glb] Summary`);
  console.log(`  Processed: ${results.processed.length}`);
  console.log(`  Skipped:   ${results.skipped.length}`);
  console.log(`  Warnings:  ${results.warnings.length}`);
  console.log(`  Errors:    ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\n  Errors:');
    for (const e of results.errors) {
      console.log(`    ${e.filename}: ${e.error}`);
    }
  }

  if (results.skipped.length > 0) {
    console.log('\n  Skipped (BLOCKED):');
    for (const s of results.skipped) {
      console.log(`    ${s.filename}: ${s.reason}`);
    }
  }

  if (results.warnings.length > 0) {
    console.log('\n  Warnings:');
    for (const w of results.warnings) {
      console.log(`    ${w.filename}: ${w.warning}`);
    }
  }

  console.log('─────────────────────────────────────────────────────────────────\n');

  // Exit with error code if any GLBs failed
  if (results.errors.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[normalize-glb] Fatal error:', err);
  process.exit(1);
});
