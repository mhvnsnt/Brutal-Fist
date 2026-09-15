#!/usr/bin/env node
/**
 * Strict Bannon roster gate for Brutal Fist.
 *
 * HARD RULE: NO GLB = NO CHARACTER.
 * Every discovered Bannon GLB must be explicitly classified. A filename match
 * alone is never sufficient to promote a fighter: owner/variant classification
 * must come from the authoritative mapping file. Unknown GLBs fail closed.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.env.BANNON_SOURCE ?? 'BannonSource');
const rosterPath = path.join(root, 'roster.json');
const modelRoot = path.join(root, 'assets', 'models');
const mappingPath = path.resolve(process.env.BANNON_GLB_MAP ?? 'src/data/bannonGlbRoster.ts');

if (!fs.existsSync(rosterPath)) throw new Error(`Missing ${rosterPath}`);
if (!fs.existsSync(modelRoot)) throw new Error(`Missing ${modelRoot}`);
if (!fs.existsSync(mappingPath)) throw new Error(`Missing authoritative GLB map ${mappingPath}`);

const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf8'));
const mappingText = fs.readFileSync(mappingPath, 'utf8');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, out);
    else if (/\.glb$/i.test(entry.name)) out.push(file);
  }
  return out;
}

const files = walk(modelRoot).sort();
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const relModel = file => file.replace(root + path.sep, 'BannonSource/').replaceAll(path.sep, '/');

// Parse the committed TypeScript map conservatively. This is intentionally a
// text-level inventory gate; the generated runtime manifest remains JSON.
const mapEntries = [];
const entryRe = /\{id:"([^"]+)",name:"([^"]+)",model:"([^"]+)",(?:(?:attire:"([^"]+)"),)?rigStatus:"([^"]+)",playableGate:"([^"]+)",source:"([^"]+)"\}/g;
for (const match of mappingText.matchAll(entryRe)) {
  mapEntries.push({ id: match[1], name: match[2], model: match[3], attire: match[4], rigStatus: match[5], playableGate: match[6], source: match[7] });
}

const mappedByModel = new Map(mapEntries.map(entry => [normalize(entry.model), entry]));
const rosterById = new Map(roster.map(character => [normalize(character.id), character]));

const inventory = files.map(file => {
  const filename = path.basename(file);
  const map = mappedByModel.get(normalize(filename));
  if (!map) {
    return {
      model: relModel(file),
      classification: 'UNMAPPED_GLB',
      playableGate: 'BLOCKED_RIG',
      reason: 'GLB_DISCOVERED_BUT_NOT_EXPLICITLY_CLASSIFIED'
    };
  }

  const character = rosterById.get(normalize(map.id));
  return {
    model: relModel(file),
    id: map.id,
    name: map.name,
    attire: map.attire,
    rigStatus: map.rigStatus,
    playableGate: map.playableGate,
    source: map.source,
    rosterDataPresent: Boolean(character),
    classification: map.playableGate === 'PASS' ? 'GLB_PLAYABLE' : 'GLB_BLOCKED'
  };
});

const unmapped = inventory.filter(row => row.classification === 'UNMAPPED_GLB');
if (unmapped.length) {
  console.error('BANNON GLB GATE FAILED: every discovered GLB must be explicitly mapped.');
  console.error(JSON.stringify(unmapped, null, 2));
  process.exit(2);
}

const duplicateModels = mapEntries.filter((entry, index, all) => all.findIndex(other => normalize(other.model) === normalize(entry.model)) !== index);
if (duplicateModels.length) {
  throw new Error(`Duplicate GLB map entries: ${duplicateModels.map(row => row.model).join(', ')}`);
}

const playable = inventory.filter(row => row.classification === 'GLB_PLAYABLE');
const blocked = inventory.filter(row => row.classification === 'GLB_BLOCKED');
const fighterIds = [...new Set(inventory.map(row => row.id))];

const out = {
  schema: 4,
  policy: {
    realGlbOnly: true,
    noProceduralFallback: true,
    noGlbNoCharacter: true,
    everyDiscoveredGlbMustBeMapped: true,
    filenameMatchIsNotProof: true,
    attireCountUnbounded: true
  },
  inventory,
  playable,
  blocked,
  fighterIds,
  scannedGlbs: files.length,
  mappedGlbs: inventory.length,
  unmappedGlbs: unmapped.length
};

fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/bannonCharacterManifest.json', JSON.stringify(out, null, 2) + '\n');

console.log(JSON.stringify({
  scannedGlbs: files.length,
  mappedGlbs: inventory.length,
  playable: playable.length,
  blocked: blocked.length,
  fighters: fighterIds.length,
  unmappedGlbs: unmapped.length
}, null, 2));
