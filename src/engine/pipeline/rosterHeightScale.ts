/**
 * Only CIPHER_feral.glb is hunched. Keep it at 0.75 (25% under roster height).
 * CIPHER.glb (default / green-mouth) and CIPHER_minion.glb use the universal 1.85m target.
 */
export const ROSTER_HEIGHT_SCALE: Record<string, number> = {
  'CIPHER_feral.glb': 0.75,
};

export function rosterHeightScale(modelUrl: string): number {
  const file = decodeURIComponent(modelUrl.split('/').pop() ?? modelUrl).split('?')[0];
  const scale = ROSTER_HEIGHT_SCALE[file];
  return Number.isFinite(scale) && scale > 0.1 ? scale : 1;
}
