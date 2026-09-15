#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.env.BANNON_SOURCE ?? 'BannonSource');
const ASSET_ROOTS = [
  path.join(ROOT, 'assets', 'mocap'),
  path.join(ROOT, 'assets', 'moves'),
  path.join(ROOT, 'assets', 'animations'),
  path.join(ROOT, 'assets', 'models')
];
const METADATA_FILES = [
  path.join(ROOT, 'assets', 'moves', 'clips_available.json'),
  path.join(ROOT, 'assets', 'moves', 'authored_clips.json')
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function rel(file) {
  return file.replace(ROOT + path.sep, 'BannonSource/').split(path.sep).join('/');
}

function classify(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.fbx') return 'fbx_animation';
  if (ext === '.glb') return 'glb_model_or_animation';
  return 'other';
}

const records = new Map();
for (const root of ASSET_ROOTS) {
  for (const file of walk(root)) {
    const kind = classify(file);
    if (kind === 'other') continue;
    const stat = fs.statSync(file);
    const id = path.basename(file, path.extname(file));
    const key = rel(file).toLowerCase();
    records.set(key, {
      id,
      asset: rel(file),
      kind,
      bytes: stat.size,
      sourceAuthority: 'bannon',
      status: 'discovered',
      filenameIsNotProof: true
    });
  }
}

for (const file of METADATA_FILES.filter(fs.existsSync)) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(data)
    ? data
    : Object.entries(data.clips ?? {}).map(([id, value]) => ({ id, ...value }));
  for (const clip of list) {
    const id = String(clip.id ?? clip.name ?? clip.key ?? '').trim();
    if (!id) continue;
    const key = `metadata:${id.toLowerCase()}`;
    records.set(key, {
      id,
      asset: clip.asset ?? clip.path ?? null,
      kind: 'metadata_clip',
      source: rel(file),
      sourceAuthority: 'bannon',
      status: 'metadata_only',
      filenameIsNotProof: true
    });
  }
}

const clips = [...records.values()].sort((a, b) => a.id.localeCompare(b.id) || String(a.asset).localeCompare(String(b.asset)));
const out = {
  schema: 2,
  policy: 'REAL_ANIMATION_DATA_FIRST',
  rules: {
    noProceduralFallback: true,
    filenameMatchIsNotProof: true,
    metadataDoesNotPromoteAsset: true,
    everyDiscoveredAnimationIsIndexed: true,
    proprietaryExternalAssetsMustBeSeparatelyLicensed: true
  },
  scannedRoots: ASSET_ROOTS.map(rel),
  metadataSources: METADATA_FILES.filter(fs.existsSync).map(rel),
  counts: {
    total: clips.length,
    fbx: clips.filter(x => x.kind === 'fbx_animation').length,
    glb: clips.filter(x => x.kind === 'glb_model_or_animation').length,
    metadataOnly: clips.filter(x => x.kind === 'metadata_clip').length
  },
  clips
};

const outPath = path.resolve('src/data/bannonAnimationManifest.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`Indexed ${clips.length} Bannon animation/model records (${out.counts.fbx} FBX, ${out.counts.glb} GLB, ${out.counts.metadataOnly} metadata-only).`);
