/**
 * FighterAssetResolver.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * CANONICAL fighter asset resolver — single source of truth for GLB URLs.
 *
 * ALL systems (CharacterSelect, PreCombatValidation, AnimationTestArena,
 * CombatArena3D) MUST resolve fighter GLB URLs through this module.
 *
 * CONTRACT:
 *   BANNON → "/models/BANNON_rigged_ready.glb"  (primary, skinned)
 *   MAIME  → "/models/MAIME_rigged_ready.glb"   (primary, skinned)
 *   others → best available PASS entry from BANNON_GLB_MODELS
 *
 * Priority order for URL resolution:
 *   1. overrideUrl (Drive / external host)
 *   2. rigStatus === 'skinned' + model ends with '_rigged_ready.glb'
 *   3. rigStatus === 'skinned' (any skinned entry)
 *   4. first PASS entry
 *   5. fighter.portraitUrl fallback
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { BANNON_GLB_MODELS } from './bannonGlbRoster';
import type { BannonFighterProfile } from './bannonRoster';

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

  // 2. rigged_ready skinned entry (no override needed — served from Bannon repo)
  const riggedReady = entries.find(
    (e) => e.rigStatus === 'skinned' && e.model.endsWith('_rigged_ready.glb'),
  );
  if (riggedReady) {
    return riggedReady.overrideUrl ?? `${BANNON_RAW}/${riggedReady.model}`;
  }

  // 3. any skinned entry
  const anySkinned = entries.find((e) => e.rigStatus === 'skinned');
  if (anySkinned) {
    return anySkinned.overrideUrl ?? `${BANNON_RAW}/${anySkinned.model}`;
  }

  // 4. first PASS entry
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

  // Same priority as resolveFighterGlbUrl
  const skinnedOverride = entries.find(
    (e) => e.overrideUrl && e.rigStatus === 'skinned',
  );
  if (skinnedOverride?.overrideUrl) return skinnedOverride.overrideUrl;

  const riggedReady = entries.find(
    (e) => e.rigStatus === 'skinned' && e.model.endsWith('_rigged_ready.glb'),
  );
  if (riggedReady) {
    return riggedReady.overrideUrl ?? `${BANNON_RAW}/${riggedReady.model}`;
  }

  const anySkinned = entries.find((e) => e.rigStatus === 'skinned');
  if (anySkinned) {
    return anySkinned.overrideUrl ?? `${BANNON_RAW}/${anySkinned.model}`;
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

  const riggedReady = entries.find(
    (e) => e.rigStatus === 'skinned' && e.model.endsWith('_rigged_ready.glb'),
  );
  if (riggedReady) return riggedReady.model;

  const anySkinned = entries.find((e) => e.rigStatus === 'skinned');
  if (anySkinned) return anySkinned.model;

  return entries[0].model;
}
