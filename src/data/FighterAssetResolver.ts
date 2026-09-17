/**
 * FighterAssetResolver.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CANONICAL fighter asset resolver — single source of truth for GLB URLs.
 *
 * ALL systems (CharacterSelect, PreCombatValidation, AnimationTestArena,
 * CombatArena3D) MUST resolve fighter GLB URLs through this module.
 *
 * CONTRACT (real files only — never invent missing *_rigged_ready.glb):
 *   BANNON → BANNON_rigged.glb (primary skinned; CDN + public/models mirror)
 *   MAIME  → MAIME_skinned.glb (primary skinned; local/versioneight mirror)
 *   others → best available PASS entry from BANNON_GLB_MODELS
 *
 * Priority order for URL resolution:
 *   1. overrideUrl (Drive / external host)
 *   2. rigStatus === 'skinned' + model ends with '_rigged_ready.glb'
 *   3. rigStatus === 'skinned' + model ends with '_rigged.glb' / '_rigready.glb' / '_skinned.glb'
 *   4. rigStatus === 'skinned' (any skinned entry)
 *   5. first PASS entry
 *   6. fighter.portraitUrl fallback
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { BANNON_GLB_MODELS } from './bannonGlbRoster';
import type { BannonFighterProfile } from './bannonRoster';

/** Prefer combat-ready skinned filenames that actually exist in the bank. */
function pickBestSkinnedEntry<T extends { model: string; rigStatus: string; overrideUrl?: string }>(
  entries: T[],
): T | undefined {
  const skinned = entries.filter((e) => e.rigStatus === 'skinned');
  const bySuffix = (suffix: string) => skinned.find((e) => e.model.endsWith(suffix));
  return (
    bySuffix('_rigged_ready.glb') ||
    bySuffix('_rigged.glb') ||
    bySuffix('_rigready.glb') ||
    bySuffix('_skinned.glb') ||
    skinned[0]
  );
}

const BANNON_RAW = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models';

/**
 * Resolve the canonical GLB URL for a fighter.
 * Returns the best available rigged/skinned GLB URL.
 */
export function resolveFighterGlbUrl(fighter: BannonFighterProfile): string {
  const entries = BANNON_GLB_MODELS.filter(
    (e) => e.id === fighter.id && e.playableGate === 'PASS',
  );

  if (entries.length === 0) {
    return fighter.portraitUrl;
  }

  // 1. overrideUrl on a skinned entry
  const skinnedOverride = entries.find(
    (e) => e.overrideUrl && e.rigStatus === 'skinned',
  );
  if (skinnedOverride?.overrideUrl) return skinnedOverride.overrideUrl;

  // 2–4. best real skinned combat file (rigged_ready → rigged → rigready → skinned)
  const best = pickBestSkinnedEntry(entries);
  if (best) {
    // Prefer local public/models mirror path for files we ship; CDN for Bannon bank.
    if (best.overrideUrl) return best.overrideUrl;
    // MAIME_skinned lives in local/versioneight mirror, not always on Bannon main.
    if (best.model.includes('_skinned') || best.model === 'MAIME_skinned.glb') {
      return `/models/${best.model}`;
    }
    return `${BANNON_RAW}/${best.model}`;
  }

  // 5. first PASS entry
  const first = entries[0];
  return first.overrideUrl ?? `${BANNON_RAW}/${first.model}`;
}

/**
 * Resolve the canonical GLB URL by fighter ID alone (no full profile needed).
 * Returns null if the fighter is not in the roster.
 */
export function resolveFighterGlbUrlById(
  fighterId: string,
  fallbackPortraitUrl?: string,
): string | null {
  const entries = BANNON_GLB_MODELS.filter(
    (e) => e.id === fighterId && e.playableGate === 'PASS',
  );

  if (entries.length === 0) return fallbackPortraitUrl ?? null;

  const skinnedOverride = entries.find(
    (e) => e.overrideUrl && e.rigStatus === 'skinned',
  );
  if (skinnedOverride?.overrideUrl) return skinnedOverride.overrideUrl;

  const best = pickBestSkinnedEntry(entries);
  if (best) {
    if (best.overrideUrl) return best.overrideUrl;
    if (best.model.includes('_skinned') || best.model === 'MAIME_skinned.glb') {
      return `/models/${best.model}`;
    }
    return `${BANNON_RAW}/${best.model}`;
  }

  const first = entries[0];
  return first.overrideUrl ?? `${BANNON_RAW}/${first.model}`;
}

/**
 * Resolve the GLB filename (not full URL) for a fighter.
 * Used by PreCombatValidation to display the model name.
 */
export function resolveFighterGlbFilename(fighterId: string): string {
  const entries = BANNON_GLB_MODELS.filter(
    (e) => e.id === fighterId && e.playableGate === 'PASS',
  );
  if (entries.length === 0) return 'UNKNOWN.glb';

  const best = pickBestSkinnedEntry(entries);
  if (best) return best.model;

  return entries[0].model;
}
