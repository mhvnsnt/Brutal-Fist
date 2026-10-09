/**
 * customization/persistence.ts — save/load the player's appearance builds.
 *
 * Port of the AshLanev2 suite's persistence.ts: versioned envelope
 * { schemaVersion, updatedAt, data }, forward-only migrations, localStorage
 * backend with an idb-keyval fast path when installed (same optional-dep
 * pattern — a literal import would fail the production build when the
 * package is absent).
 *
 * Builds are keyed by roster fighter id. One build per fighter.
 */
import { defaultBuild, type CustomBuild } from './types';

const SCHEMA_VERSION = 1;
const STORE_KEY = 'brutalfist:customizer:builds';
const BACKUP_KEY = 'brutalfist:customizer:builds:backup';

interface Envelope {
  schemaVersion: number;
  updatedAt: number;
  data: Record<string, CustomBuild>;
}

type KV = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
};

let kvPromise: Promise<KV> | null = null;

const IDB_KEYVAL_SPEC = 'idb-keyval';

function backend(): Promise<KV> {
  if (!kvPromise) {
    kvPromise = import(/* @vite-ignore */ IDB_KEYVAL_SPEC)
      .then((m) => ({
        get: m.get as KV['get'],
        set: m.set as KV['set'],
      }))
      .catch(() => ({
        get: async (key: string) => {
          const raw = localStorage.getItem(key);
          return raw ? (JSON.parse(raw) as unknown) : undefined;
        },
        set: async (key: string, value: unknown) => {
          localStorage.setItem(key, JSON.stringify(value));
        },
      }));
  }
  return kvPromise;
}

type Migration = (data: Record<string, CustomBuild>) => Record<string, CustomBuild>;

/** Forward-only. Add a new entry (never edit old ones) when the schema changes. */
const MIGRATIONS: Record<number, Migration> = {
  // v1 is the first schema — no migrations yet.
};

function migrate(envelope: Envelope): Envelope {
  if (envelope.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Customizer builds are from a newer game version (v${envelope.schemaVersion} > v${SCHEMA_VERSION})`,
    );
  }
  let { schemaVersion, data } = envelope;
  let d = data;
  while (schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[schemaVersion];
    if (!step) throw new Error(`No migration path from customizer builds v${schemaVersion}`);
    d = step(d);
    schemaVersion++;
  }
  return { ...envelope, schemaVersion, data: d };
}

function sanitize(raw: unknown): Record<string, CustomBuild> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, CustomBuild> = {};
  for (const [fighterId, b] of Object.entries(raw as Record<string, unknown>)) {
    if (!b || typeof b !== 'object') continue;
    const bb = b as Partial<CustomBuild>;
    const base = defaultBuild(fighterId, typeof bb.attireId === 'string' ? bb.attireId : '');
    out[fighterId] = {
      ...base,
      ...bb,
      fighterId,
      morphs: { ...base.morphs, ...(bb.morphs ?? {}) },
      accessories: { ...base.accessories, ...(bb.accessories ?? {}) },
      paint: { ...(bb.paint ?? {}) },
      addon: bb.addon ?? 'none',
    };
  }
  return out;
}

/** Load every saved build, keyed by fighter id. Never throws. */
export async function loadAllBuilds(): Promise<Record<string, CustomBuild>> {
  try {
    const kv = await backend();
    const raw = (await kv.get(STORE_KEY)) as Envelope | undefined;
    if (!raw || typeof raw.schemaVersion !== 'number') return {};
    const migrated = migrate(structuredClone(raw));
    if (migrated.schemaVersion !== raw.schemaVersion) {
      await kv.set(STORE_KEY, migrated);
    }
    return sanitize(migrated.data);
  } catch (e) {
    console.error('Customizer builds unreadable:', e);
    return {};
  }
}

/** Load the saved build for one fighter, or null when the player never saved one. */
export async function loadBuild(fighterId: string): Promise<CustomBuild | null> {
  const all = await loadAllBuilds();
  return all[fighterId] ?? null;
}

/** Save (or overwrite) the build for one fighter. Keeps the previous store as backup. */
export async function saveBuild(build: CustomBuild): Promise<void> {
  const kv = await backend();
  const all = await loadAllBuilds();
  all[build.fighterId] = structuredClone(build);
  const envelope: Envelope = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: Date.now(),
    data: all,
  };
  const prev = await kv.get(STORE_KEY);
  if (prev) await kv.set(BACKUP_KEY, prev);
  await kv.set(STORE_KEY, envelope);
}

/** Delete the saved build for one fighter (revert to authored). */
export async function deleteBuild(fighterId: string): Promise<void> {
  const kv = await backend();
  const all = await loadAllBuilds();
  if (!(fighterId in all)) return;
  delete all[fighterId];
  const envelope: Envelope = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: Date.now(),
    data: all,
  };
  const prev = await kv.get(STORE_KEY);
  if (prev) await kv.set(BACKUP_KEY, prev);
  await kv.set(STORE_KEY, envelope);
}

/** Broadcast so other tabs/select instances refresh. */
export function notifyBuildsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('bf-customizer-builds'));
  }
}
