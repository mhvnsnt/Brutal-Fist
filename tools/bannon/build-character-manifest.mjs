#!/usr/bin/env node
/**
 * Build the Brutal Fist character manifest from the Bannon source checkout.
 *
 * HARD RULE: only real GLB files are eligible. Procedural/Three.js-only
 * characters are never promoted into this manifest.
 *
 * The roster record is preserved verbatim for name/bio/stats/attires.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.env.BANNON_SOURCE ?? 'BannonSource');
const rosterPath = path.join(ROOT, 'roster.json');
const modelsRoot = path.join(ROOT, 'assets', 'models');
const outPath = path.resolve('src/data/bannonCharacterManifest.json');

if (!fs.existsSync(rosterPath)) throw new Error(`Missing ${rosterPath}`);
if (!fs.existsSync(modelsRoot)) throw new Error(`Missing ${modelsRoot}`);

const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (/\.glb$/i.test(ent.name)) out.push(p);
  }
  return out;
}

const glbs = walk(modelsRoot);
const byStem = new Map();
for (const file of glbs) {
  const base = path.basename(file, path.extname(file));
  // Prefer an explicitly rigged skinned model over a raw/rigid GLB.
  const key = base.replace(/_rigged$/i, '').toLowerCase();
  const previous = byStem.get(key);
  if (!previous || /_rigged\.glb$/i.test(file)) byStem.set(key, file);
}

const proceduralOnly = new Set([
  'ghost','phantom','demon_x','luna_vega','sami_z','jaxon_ryker','big_bull','cosmic_dust'
]);

const characters = roster
  .map(c => {
    const candidates = [c.id, c.name, c.name.replace(/\s+/g, '_')].map(x => x.toLowerCase());
    const model = candidates.map(k => byStem.get(k)).find(Boolean);
    if (!model || proceduralOnly.has(c.id)) return null;
    const rel = path.relative(ROOT, model).replaceAll(path.sep, '/');
    return {
      id: c.id,
      name: c.name,
      bio: c.bio,
      role: c.role,
      dna: c.dna,
      poise: c.poise,
      hp: c.hp,
      speed: c.speed,
      strength: c.strength,
      physicsScale: c.physicsScale,
      payback: c.payback,
      manager: c.manager,
      attires: c.attires,
      sourceModel: `BannonSource/${rel}`,
      psxModel: `public/models/psx/${c.id}.glb`,
      modelPolicy: 'REAL_GLB_ONLY'
    };
  })
  .filter(Boolean);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({
  schema: 1,
  generatedFrom: 'BannonSource/roster.json + BannonSource/assets/models/**/*.glb',
  policy: {
    realGlbOnly: true,
    proceduralModelsExcluded: true,
    preserveRosterIdentity: true,
    preserveBio: true
  },
  characters
}, null, 2) + '\n');

console.log(`Promoted ${characters.length} real-GLB characters from ${glbs.length} GLB files.`);
