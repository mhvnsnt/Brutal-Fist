/**
 * Tekken-style character card art. Default grid face is always the HQ likeness.
 * CARD cycles LIKENESS / CONCEPT / PIXEL. Cache-bust so old 128px is not sticky.
 */

const STORAGE_KEY = 'bf-card-art-v2';
const CACHE_BUST = 'v2';

export type CardArtKind = 'likeness' | 'concept' | 'pixel';

export interface CardArtOption {
  kind: CardArtKind;
  label: string;
  src: string;
}

export function getCardArtOptions(fighterId: string): CardArtOption[] {
  return [
    { kind: 'likeness', label: 'LIKENESS', src: `/portraits/likeness/${fighterId}.png?${CACHE_BUST}` },
    { kind: 'concept', label: 'CONCEPT', src: `/concept-art/portraits-v1/${fighterId}.png` },
    { kind: 'pixel', label: 'PIXEL', src: `/concept-art/portraits-v1/${fighterId}.png` },
  ];
}

function readMap(): Record<string, CardArtKind> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, CardArtKind>;
  } catch {
    return {};
  }
}

export function getSelectedCardArtKind(_fighterId: string): CardArtKind {
  const stored = readMap()[_fighterId];
  if (stored === 'concept' || stored === 'pixel' || stored === 'likeness') return stored;
  return 'likeness';
}

export function getSelectedCardArtSrc(fighterId: string): string {
  const kind = getSelectedCardArtKind(fighterId);
  const opt = getCardArtOptions(fighterId).find((o) => o.kind === kind);
  return opt?.src ?? `/portraits/likeness/${fighterId}.png?${CACHE_BUST}`;
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
