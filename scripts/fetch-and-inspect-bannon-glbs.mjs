#!/usr/bin/env node
/**
 * Download every character GLB from mhvnsnt/Bannon and inspect skins/skeletons.
 * Does not invent characters. Does not write a synthetic skeleton.
 */
import { mkdirSync, writeFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;

function createIO() {
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'meshopt.decoder': MeshoptDecoder,
      'meshopt.encoder': MeshoptEncoder,
    });
}

const BASE = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models';
const OUT = join(process.cwd(), 'public', 'models');
mkdirSync(OUT, { recursive: true });

const FILES = [
  'AARON_RUBEN.glb',
  'BANNON.glb',
  'BANNON_muscular.glb',
  'BANNON_muscular_rig28.glb',
  'BANNON_muscular_rigready.glb',
  'BANNON_muscular_skinned.glb',
  'BANNON_rigged.glb',
  'BRUTUS.glb',
  'CAIN_ELIAS_gear.glb',
  'CAIN_ELIAS_godwithin.glb',
  'CAIN_ELIAS_ring.glb',
  'CAIN_ELIAS_snakeskin.glb',
  'CIPHER.glb',
  'CIPHER_feral.glb',
  'CIPHER_minion.glb',
  'CIPHER_rigged.glb',
  'CIPHER_rigged_rig28.glb',
  'CODY_gear.glb',
  'CODY_gear_rig28.glb',
  'CODY_gear_rigready.glb',
  'CODY_gear_skinned.glb',
  'CODY_sober.glb',
  'CODY_stressed.glb',
  'ECHO.glb',
  'EDWIN_KENNEDY.glb',
  'EDWIN_KENNEDY_unchained.glb',
  'EDWIN_KENNEDY_unchained_rig28.glb',
  'EL_TORO_DE_ORO.glb',
  'HALL_NIGHTER.glb',
  'HOLLOW.glb',
  'JAGER.glb',
  'JAGER_beard.glb',
  'KOBRA.glb',
  'MAIME.glb',
  'MAIME_tattered.glb',
  'MASTER_SENSEI.glb',
  'MASTER_SENSEI_rose.glb',
  'ONYX.glb',
  'ONYX_corset.glb',
  'ONYX_corset_rig28.glb',
  'ONYX_corset_rigready.glb',
  'ONYX_corset_skinned.glb',
  'ONYX_rig28.glb',
  'ONYX_rigready.glb',
  'ONYX_skinned.glb',
  'ONYX_straightjacket.glb',
  'ONYX_street.glb',
  'PABLO.glb',
  'PABLO_blackreign.glb',
  'PABLO_goldenbull.glb',
  'STAN_COMBS_gear.glb',
  'STATIC.glb',
  'STATIC_alt.glb',
  'STICKUP.glb',
  'TARZANIAN_DEVIL_dec.glb',
  'TARZANIAN_DEVIL_dec_rig28.glb',
  'TARZANIAN_DEVIL_skinned.glb',
  'TITAN.glb',
  'TITAN_unmasked.glb',
  'TITAN_white.glb',
  'TRIPLE_XXX.glb',
  'TRIPLE_XXX_suit.glb',
  'TRIPLE_XXX_tights.glb',
  'TRIPLE_XXX_trunks.glb',
  'TYNESHIA.glb',
  'TYNESHIA_street.glb',
  'VIPER.glb',
  'WRECK_PATTERSON.glb',
  'WRECK_PATTERSON_attire2.glb',
  'WRECK_PATTERSON_attire3.glb',
  'WRECK_PATTERSON_godwithin.glb',
  'NPC_FINXSSE.glb',
];

const NAMED_PARTS = new Set([
  'pelvis', 'chest', 'head', 'shL', 'shR', 'elL', 'elR', 'haL', 'haR',
  'hipL', 'hipR', 'knL', 'knR', 'ftL', 'ftR', 'spineLow', 'spineMid',
  'clavL', 'clavR',
]);

async function download(file) {
  const dest = join(OUT, file);
  if (existsSync(dest)) {
    const size = statSync(dest).size;
    if (size > 1000) return { file, status: 'cached', bytes: size };
  }
  const res = await fetch(`${BASE}/${encodeURIComponent(file)}`);
  if (!res.ok) return { file, status: `HTTP_${res.status}`, bytes: 0 };
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return { file, status: 'ok', bytes: buf.length };
}

async function inspect(file) {
  const io = createIO();
  const dest = join(OUT, file);
  try {
    const doc = await io.read(dest);
    const root = doc.getRoot();
    const meshes = root.listMeshes();
    const skins = root.listSkins();
    const animations = root.listAnimations();
    const nodes = root.listNodes();
    const nodeNames = nodes.map((n) => n.getName() || '').filter(Boolean);
    const namedParts = nodeNames.filter((n) => NAMED_PARTS.has(n));
    let skinnedPrimitives = 0;
    let joints0 = 0;
    let weights0 = 0;
    let vertexCount = 0;
    for (const mesh of meshes) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (pos) vertexCount += pos.getCount();
        if (prim.getAttribute('JOINTS_0')) { joints0++; skinnedPrimitives++; }
        if (prim.getAttribute('WEIGHTS_0')) weights0++;
      }
    }
    const joints = [];
    for (const skin of skins) {
      for (const j of skin.listJoints()) joints.push(j.getName() || '');
    }
    const mixamoJoints = joints.filter((n) => n.toLowerCase().includes('mixamorig') || n.startsWith('mixamo'));
    let classification = 'STATIC_MESH';
    if (skins.length > 0 && joints0 > 0) {
      classification = animations.length > 0 ? 'RIGGED_AND_ANIMATABLE' : 'RIGGED_NO_ANIMATIONS';
    } else if (namedParts.length >= 10) {
      classification = 'NAMED_PART';
    } else if (animations.length > 0) {
      classification = 'ANIMATION_ONLY';
    }
    return {
      file,
      bytes: statSync(dest).size,
      classification,
      meshes: meshes.length,
      primitivesSkinned: skinnedPrimitives,
      joints0,
      weights0,
      skins: skins.length,
      joints: joints.length,
      mixamoJoints: mixamoJoints.length,
      namedParts: namedParts.length,
      namedPartNames: namedParts,
      animations: animations.length,
      animationNames: animations.map((a) => a.getName()),
      vertexCount,
      sampleJoints: joints.slice(0, 24),
      sampleNodes: nodeNames.slice(0, 24),
    };
  } catch (error) {
    return { file, classification: 'MALFORMED', error: String(error.message || error) };
  }
}

async function main() {
  console.log(`Downloading ${FILES.length} GLBs → ${OUT}`);
  const downloads = [];
  const queue = [...FILES];
  const CONCURRENCY = 6;
  async function worker() {
    while (queue.length) {
      const file = queue.shift();
      try {
        const r = await download(file);
        downloads.push(r);
        console.log(`${r.status.padEnd(8)} ${String(r.bytes).padStart(8)}  ${r.file}`);
      } catch (e) {
        downloads.push({ file, status: 'ERROR', bytes: 0, error: String(e.message || e) });
        console.log(`ERROR    ${file}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const reports = [];
  for (const file of FILES) {
    if (!existsSync(join(OUT, file))) {
      reports.push({ file, classification: 'MISSING' });
      continue;
    }
    const r = await inspect(file);
    reports.push(r);
    console.log(
      `${(r.classification || 'UNKNOWN').padEnd(24)} skins=${String(r.skins ?? 0).padStart(2)} ` +
      `joints=${String(r.joints ?? 0).padStart(3)} mixamo=${String(r.mixamoJoints ?? 0).padStart(3)} ` +
      `j0=${String(r.joints0 ?? 0).padStart(2)} named=${String(r.namedParts ?? 0).padStart(2)} ` +
      `anims=${String(r.animations ?? 0).padStart(2)}  ${file}`,
    );
  }

  const summary = {
    source: BASE,
    inspectedAt: new Date().toISOString(),
    downloaded: downloads,
    reports,
    byClassification: reports.reduce((acc, r) => {
      acc[r.classification] = (acc[r.classification] || 0) + 1;
      return acc;
    }, {}),
  };
  writeFileSync(join(process.cwd(), 'docs', 'GLB_ASSET_MANIFEST.json'), JSON.stringify(summary, null, 2));
  console.log('\nSUMMARY', summary.byClassification);
}

main().catch((e) => { console.error(e); process.exit(1); });
