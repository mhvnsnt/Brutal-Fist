/** Maime is the PS1 visual budget. Every playable fighter targets this. */
export const MAIME_TRIANGLE_BUDGET = 18108;
export const MAIME_TEXTURE_PX = 256;
export const MAIME_POLY_LAW =
  'Playable GLBs must sit at Maime\'s ~18,108 triangle / 256px texture budget (PS1 3D). Do not upscale. Decimate over-budget files with tools/psx/decimate-fighter.mjs --tris=18000 --tex=256. Do not rewrite weights to hit the budget.';
