/**
 * Tekken-style character card art. Each fighter can have multiple 2D arts;
 * the player picks which one fills the select-grid square.
 *
 *   likeness — HQ art built from GLB/canon tells (default when present)
 *   concept  — first-pass 128px drawings, archived, still selectable
 *   pixel    — same concept, nearest-scaled (PS1 crunch)
 */

const STORAGE_KEY = 'bf-card-art-v1';

export type CardArtKind = 'likeness' | 'concept' | 'pixel';

export interface CardArtOption {
  kind: CardArtKind;
  label: string;
  src: string;
}

const LIKENESS_IDS = new Set([
  'bannon', 'maime', 'onyx', 'stick_up', 'cain_elias',
  'finxsse', 'tarzanian_devil', 'tyneshia',
]);

export function getCardArtOptions(fighterId: string): CardArtOption[] {
  const concept = `/concept-art/portraits-v1/${fighterId}.png`;
  const pixel = `/portraits/${fighterId}.png`;
  const opts: CardArtOption[] = [];
  if (LIKENESS_IDS.has(fighterId)) {
    opts.push({ kind: 'likeness', label: 'LIKENESS', src: `/portraits/likeness/${fighterId}.png` });
  }
  opts.push({ kind: 'concept', label: 'CONCEPT', src: concept });
  opts.push({ kind: 'pixel', label: 'PIXEL', src: pixel });
  return opts;
}

function readMap(): Record<string, CardArtKind> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, CardArtKind>;
  } catch {
    return {};
  }
}

export function getSelectedCardArtKind(fighterId: string): CardArtKind {
  const stored = readMap()[fighterId];
  if (stored) return stored;
  return LIKENESS_IDS.has(fighterId) ? 'likeness' : 'concept';
}

export function getSelectedCardArtSrc(fighterId: string): string {
  const kind = getSelectedCardArtKind(fighterId);
  const opt = getCardArtOptions(fighterId).find((o) => o.kind === kind);
  return opt?.src ?? `/portraits/${fighterId}.png`;
}

export function setSelectedCardArtKind(fighterId: string, kind: CardArtKind): void {
  if (typeof window === 'undefined') return;
  const map = readMap();
  map[fighterId] = kind;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function cycleCardArt(fighterId: string): CardArtKind {
  const opts = getCardArtOptions(fighterId);
  const cur = getSelectedCardArtKind(fighterId);
  const i = opts.findIndex((o) => o.kind === cur);
  const next = opts[(i + 1) % opts.length].kind;
  setSelectedCardArtKind(fighterId, next);
  return next;
}
