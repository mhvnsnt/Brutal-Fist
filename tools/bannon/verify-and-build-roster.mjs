#!/usr/bin/env node
/**
 * Strict Bannon roster gate for Brutal Fist.
 *
 * HARD RULE: NO GLB = NO CHARACTER.
 * Only real, existing Bannon character GLBs are eligible. Procedural-only,
 * metadata-only, prop, manager, NPC, placeholder and fallback records never
 * become fighter records. Excluded records intentionally contain no fighter
 * data so downstream systems cannot accidentally leak them into the game.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.env.BANNON_SOURCE ?? 'BannonSource');
const rosterPath = path.join(root, 'roster.json');
const modelRoot = path.join(root, 'assets', 'models');

if (!fs.existsSync(rosterPath)) throw new Error(`Missing ${rosterPath}`);
if (!fs.existsSync(modelRoot)) throw new Error(`Missing ${modelRoot}`);

const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, out);
    else if (/\.glb$/i.test(entry.name)) out.push(file);
  }
  return out;
}

const files = walk(modelRoot);
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const models = new Map();

for (const file of files) {
  const stem = path.basename(file, '.glb');
  const key = normalize(stem.replace(/_rigged$/i, ''));
  const score = /_rigged\.glb$/i.test(file) ? 2 : 1;
  const previous = models.get(key);
  if (!previous || score > previous.score) models.set(key, { file, score });
}

const rows = roster.map(character => {
  const keys = [character.id, character.name].map(normalize);
  const hit = keys.map(key => models.get(key)).find(Boolean);

  if (!hit) {
    return {
      id: character.id,
      name: character.name,
      status: 'MISSING_ASSET',
      modelPolicy: 'NO_GLB_NO_CHARACTER'
    };
  }

  return {
    id: character.id,
    name: character.name,
    bio: character.bio,
    role: character.role,
    dna: character.dna,
    poise: character.poise,
    hp: character.hp,
    speed: character.speed,
    strength: character.strength,
    physicsScale: character.physicsScale,
    payback: character.payback,
    manager: character.manager,
    attires: character.attires,
    status: 'GLB_BACKED',
    model: hit.file.replace(root + path.sep, 'BannonSource/'),
    modelPolicy: 'REAL_GLB_ONLY'
  };
});

const eligible = rows.filter(row => row.status === 'GLB_BACKED');
const excluded = rows.filter(row => row.status !== 'GLB_BACKED');

const out = {
  schema: 3,
  policy: {
    realGlbOnly: true,
    noProceduralFallback: true,
    noGlbNoCharacter: true,
    excludedRowsCarryNoFighterData: true,
    attireCountUnbounded: true
  },
  eligible,
  excluded,
  scannedGlbs: files.length
};

fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/bannonCharacterManifest.json', JSON.stringify(out, null, 2) + '\n');

console.log(JSON.stringify({
  scannedGlbs: files.length,
  eligible: eligible.length,
  excluded: excluded.length
}, null, 2));
