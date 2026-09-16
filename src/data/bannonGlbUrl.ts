/** Authoritative remote tree for Bannon character GLBs. */
export const BANNON_MODELS_RAW =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models';

/**
 * Named-part / contract names rewritten to files that actually load.
 * BANNON_rigged_ready.glb is the canonical logical name; the bytes live in
 * BANNON_rigged.glb (local public/models + mhvnsnt/Bannon assets/models).
 * Fetching *_rigged_ready.glb without this rewrite 404s and blanks Character Select.
 */
const PLAYABLE_GLB_ALIASES: Record<string, string> = {
  'BANNON.glb': 'BANNON_rigged.glb',
  'bannon.glb': 'BANNON_rigged.glb',
  'BANNON_rigged_ready.glb': 'BANNON_rigged.glb',
  'MAIME.glb': 'MAIME_skinned.glb',
  'maime.glb': 'MAIME_skinned.glb',
  'MAIME_rigged_ready.glb': 'MAIME_skinned.glb',
};

/**
 * Same-origin URL for a character GLB.
 *
 * Local `public/models/<file>` wins (Next/Vite static). Missing files rewrite
 * to mhvnsnt/Bannon `assets/models` via next.config / vite proxy so Meshopt
 * GLBs load without a GitHub CORS round-trip. Generated Maime skins live only
 * in public/models and are never fetched from GitHub.
 *
 * BANNON.glb / MAIME.glb (named-part) and *_rigged_ready.glb (logical contract)
 * are rewritten to the skinned files that actually exist, so Character Select
 * and Combat cannot 404 or silently load a static mesh.
 */
export function resolveGlbUrl(model: string, overrideUrl?: string): string {
  const requested = (overrideUrl ?? model).replace(/^\/models\//, '');
  const decoded = decodeURIComponent(requested);
  const file = PLAYABLE_GLB_ALIASES[decoded] ?? decoded;
  if (file !== decoded) {
    console.log(`[canonicalGlb] ${decoded} → /models/${file}`);
  }
  return `/models/${encodeURIComponent(file)}`;
}

export function bannonGithubModelUrl(model: string): string {
  return `${BANNON_MODELS_RAW}/${encodeURIComponent(model)}`;
}
