/**
 * Per-fighter Bannon motion-bank study maps.
 *
 * Pipeline stays universal: it always asks for getFighterMotionClips(id).
 * Empty = no extra fetches. Filled = pull those mocap JSON keys from
 * mhvnsnt/Bannon assets/moves/clips and bind them by clip name + semantic.
 *
 * Clip keys are the real Bannon Euler bank IDs (index.json), not invented names.
 */

export interface FighterMotionClip {
  /** Bannon clips/index.json key */
  key: string;
  /** Semantic combat state this clip should cover when the fighter is loaded */
  semanticState: string;
  /** Why this clip was chosen from tape / move-database study */
  role: string;
}

/**
 * Tarzanian Devil — based on Tarzan Duran (Wildlife / Tarzanian Devil).
 * Sources: Cagematch / IWD (CZW, GCW, JCW, GTS, XPW), owner correction of Jungle Juice.
 *
 * Jungle Juice (locked): Inverted Facelock Toss → Impaler DDT.
 *   Setup: back-to-back inverted facelock / inverted cravate, chin-and-neck hook.
 *   Toss: overhead lever, opponent backflips over the shoulder, lands on feet face-to-face.
 *   Impact: immediate front facelock + lifting implant DDT.
 * Not a catching spinning side slam / Black Hole Slam.
 */
export const TARZANIAN_DEVIL_MOTION: FighterMotionClip[] = [
  { key: 'JUNGLE_JUICE',        semanticState: 'grapple',   role: 'Jungle Juice authored bank clip — inverted facelock toss into impaler DDT' },
  { key: 'DDT',                 semanticState: 'grapple',   role: 'Jungle Juice impact — Impaler / implant DDT' },
  { key: 'HAMMERLOCKDDT',       semanticState: 'grapple',   role: 'Jungle Juice lifting-DDT variant from Bannon bank' },
  { key: 'TZ_TILT_WHIRL_SLAM',  semanticState: 'throw',     role: 'Inverted facelock toss — overhead flip, land face-to-face' },
  { key: 'HAMMERTHROW',         semanticState: 'throw',     role: 'Over-shoulder toss fallback if TZ slam missing' },
  { key: 'HURRICANERANA',       semanticState: 'throw',     role: 'Hurricanrana — lucha headscissors takeover' },
  { key: 'ASSISTEDDIVSENTON',   semanticState: 'signature', role: 'Jungle Bomb — diving senton / Tarzan Scale splash' },
  { key: 'CRUCIFIXPIN',         semanticState: 'counter',   role: 'Driver Counter — mid-air crucifix / sunset-flip flash pin' },
  { key: 'CROTCHCHOP',          semanticState: 'attack_1',  role: 'Knife-edge chop — primary standing strike' },
  { key: 'CROSS_JUMPS',         semanticState: 'attack_2',  role: 'Tarzan Scale — top-rope close / diving crossbody' },
  { key: 'DROP_KICK',           semanticState: 'attack_2',  role: 'Aerial close-distance fallback' },
];

export const FIGHTER_MOTION_MAPS: Record<string, readonly FighterMotionClip[]> = {
  tarzanian_devil: TARZANIAN_DEVIL_MOTION,
};

export function getFighterMotionClips(characterId: string): readonly FighterMotionClip[] {
  if (!characterId) return [];
  const id = characterId.toLowerCase();
  if (FIGHTER_MOTION_MAPS[id]) return FIGHTER_MOTION_MAPS[id];
  for (const key of Object.keys(FIGHTER_MOTION_MAPS)) {
    if (id.includes(key) || key.includes(id)) return FIGHTER_MOTION_MAPS[key];
  }
  return [];
}

/** Resolve a GLB filename (TARZANIAN_DEVIL_skinned.glb) to a roster fighter id. */
export function resolveFighterIdFromModel(modelName: string): string {
  const file = modelName.toLowerCase().replace(/\.glb$/i, '');
  for (const id of Object.keys(FIGHTER_MOTION_MAPS)) {
    if (file.includes(id) || file.replace(/_/g, '').includes(id.replace(/_/g, ''))) return id;
  }
  return '';
}
