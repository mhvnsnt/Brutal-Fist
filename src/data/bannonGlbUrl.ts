/** Authoritative remote tree for Bannon character GLBs. */
export const BANNON_MODELS_RAW =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models';

/**
 * Same-origin URL for a character GLB.
 *
 * Local `public/models/<file>` wins (Next/Vite static). Missing files rewrite
 * to mhvnsnt/Bannon `assets/models` via next.config / vite proxy so Meshopt
 * GLBs load without a GitHub CORS round-trip. Generated Maime skins live only
 * in public/models and are never fetched from GitHub.
 */
export function resolveGlbUrl(model: string, overrideUrl?: string): string {
  if (overrideUrl) return overrideUrl;
  return `/models/${encodeURIComponent(model)}`;
}

export function bannonGithubModelUrl(model: string): string {
  return `${BANNON_MODELS_RAW}/${encodeURIComponent(model)}`;
}
