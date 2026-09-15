#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.env.BANNON_SOURCE ?? 'BannonSource');
const candidates = [
  path.join(ROOT, 'assets', 'moves', 'clips_available.json'),
  path.join(ROOT, 'assets', 'moves', 'authored_clips.json')
];

const sources = candidates.filter(fs.existsSync);
const clips = new Map();

for (const file of sources) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const list = Array.isArray(data) ? data : Object.entries(data.clips ?? {}).map(([id, value]) => ({ id, ...value }));
  for (const clip of list) {
    const id = String(clip.id ?? clip.name ?? clip.key ?? '').trim();
    if (id) clips.set(id.toLowerCase(), { id, source: file.replace(ROOT + path.sep, 'BannonSource/') });
  }
}

const out = {
  schema: 1,
  policy: 'REAL_ANIMATION_DATA_FIRST',
  sources: sources.map(x => x.replace(ROOT + path.sep, 'BannonSource/')),
  clips: [...clips.values()].sort((a,b) => a.id.localeCompare(b.id))
};

const outPath = path.resolve('src/data/bannonAnimationManifest.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
console.log(`Indexed ${out.clips.length} Bannon animation records.`);
