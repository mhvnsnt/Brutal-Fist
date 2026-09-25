#!/usr/bin/env node
/**
 * Pulls metadata from every mandatory Brutal Fist source repository and writes
 * a deterministic audit. This is a development/build tool only; the shipped
 * game never fetches GitHub at runtime.
 */
import fs from 'node:fs';
import path from 'node:path';

const sources = [
  ['schwarzerblitz-engine', 'mhvnsnt/SchwarzerblitzEngine', ['README.md']],
  ['grok-v6', 'mhvnsnt/brutalfistgrokversionsix', ['native/source/roster.json']],
  ['grok-v5', 'mhvnsnt/brutalfistgrokversionfive', ['README.md']],
  ['grok-v4', 'mhvnsnt/brutalfistgrokversionfour', ['README.md']],
  ['grok-v3', 'mhvnsnt/brutalfistgrokversionthree', ['native/source/roster.json']],
  ['grok-v2', 'mhvnsnt/brutalfistgrokversiontwo', ['AGENTS.md']],
  ['grok-v1', 'mhvnsnt/brutalfistgrokversion', ['README.md']],
  ['night-sky-engine', 'mhvnsnt/NightSkyEngine', ['README.md']],
  ['combat-rpg', 'mhvnsnt/Combat-RPG-prototype-', ['README.md']],
  ['bannon', 'mhvnsnt/Bannon', ['BANNON_CONTEXT.md']]
];

const root = path.resolve('src/data');
const out = path.join(root, 'sourceAudit.json');
const api = 'https://api.github.com/repos';

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'brutal-fist-source-audit' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
}

const audit = [];
for (const [id, repo, files] of sources) {
  const entry = { id, repo, files: [], status: 'ok' };
  try {
    const repoMeta = await fetchJson(`${api}/${repo}`);
    entry.defaultBranch = repoMeta.default_branch;
    entry.updatedAt = repoMeta.updated_at;
    for (const file of files) {
      try {
        const item = await fetchJson(`${api}/${repo}/contents/${file}`);
        entry.files.push({ path: file, sha: item.sha, size: item.size });
      } catch (error) {
        entry.files.push({ path: file, status: 'missing', error: String(error.message ?? error) });
        entry.status = 'partial';
      }
    }
  } catch (error) {
    entry.status = 'unavailable';
    entry.error = String(error.message ?? error);
  }
  audit.push(entry);
}

fs.mkdirSync(root, { recursive: true });
fs.writeFileSync(out, JSON.stringify({ schema: 1, generatedAt: new Date().toISOString(), sources: audit }, null, 2) + '\n');
console.log(`Audited ${audit.length} Brutal Fist source repositories -> ${out}`);
