/**
 * Evidence-only inventory of Bannon GLBs discovered in the current Drive-sync manifest.
 *
 * HARD RULE: this file is NOT a playable roster. Entries here are source evidence only.
 * A discovered GLB must still be banked/mapped, rigged, skin-QA'd, rest-pose validated and
 * explicitly promoted before it can appear in BANNON_GLB_PLAYABLE_MODELS.
 *
 * NO GLB = NO CHARACTER. Conversely, a GLB alone does not grant PLAYABLE status.
 */
export type BannonGlbSourceEvidence = {
  owner: string;
  filename: string;
  sourcePath: string;
  status: "INCOMING_VERIFIED" | "BANKED" | "TRUNCATED" | "PROP";
  variant?: string;
  notes?: string;
};

export const BANNON_GLB_SOURCE_INVENTORY: readonly BannonGlbSourceEvidence[] = [
  // Bannon variants observed in the 2026-09-15 Drive-sync manifest.
  { owner: "bannon", filename: "BANNON_alt_rigready (1).glb", sourcePath: "assets/models/incoming/BANNON_alt_rigready (1).glb", status: "INCOMING_VERIFIED", variant: "alt rigready" },
  { owner: "bannon", filename: "BANNON_masked_rigready.glb", sourcePath: "assets/models/incoming/BANNON_masked_rigready.glb", status: "INCOMING_VERIFIED", variant: "masked" },
  { owner: "bannon", filename: "BANNON_v1_clean.glb", sourcePath: "assets/models/incoming/BANNON_v1_clean.glb", status: "INCOMING_VERIFIED", variant: "v1 clean" },
  { owner: "bannon", filename: "BANNON_v1_rigready.glb", sourcePath: "assets/models/incoming/BANNON_v1_rigready.glb", status: "INCOMING_VERIFIED", variant: "v1 rigready" },
  { owner: "bannon", filename: "BANNON_v2_split.glb", sourcePath: "assets/models/incoming/BANNON_v2_split.glb", status: "INCOMING_VERIFIED", variant: "v2 split" },
  { owner: "bannon", filename: "BANNON_v3_split.glb", sourcePath: "assets/models/incoming/BANNON_v3_split.glb", status: "INCOMING_VERIFIED", variant: "v3 split" },
  { owner: "bannon", filename: "BANNON_alt_rigready.glb", sourcePath: "assets/models/incoming/BANNON_alt_rigready.glb", status: "TRUNCATED", variant: "alt rigready", notes: "Drive-sync manifest marks this upload truncated; do not promote." },

  // Additional character GLBs observed in the current manifest; bank_map provides exact
  // authoritative owner/output mapping for the entries that have been normalized.
  { owner: "cipher", filename: "CIPHER (Blackheart Lio Rush feral black sludge psycho maniac).glb", sourcePath: "assets/models/incoming/CIPHER (Blackheart Lio Rush feral black sludge psycho maniac).glb", status: "INCOMING_VERIFIED", variant: "feral / Blackheart" },
  { owner: "cipher", filename: "CIPHER(The god within mode addition teamed with onyx as a minion for onyx) (Blackheart Lio Rush inspired).glb", sourcePath: "assets/models/incoming/CIPHER(The god within mode addition teamed with onyx as a minion for onyx) (Blackheart Lio Rush inspired).glb", status: "BANKED", variant: "God Within / Minion", notes: "bank_map -> CIPHER_minion.glb" },
  { owner: "cain_elias", filename: "Cain Elias 2 ring and entrance and cutscenes gear from book versions, street gear and sometimes ring gear.glb", sourcePath: "assets/models/incoming/Cain Elias 2 ring and entrance and cutscenes gear from book versions, street gear and sometimes ring gear.glb", status: "INCOMING_VERIFIED", variant: "ring / entrance / cutscene / street" },
  { owner: "cain_elias", filename: "Cain Elias 3 snakeskin pants pimp ring and street attire inspired by snakeskin pants undertaker.glb", sourcePath: "assets/models/incoming/Cain Elias 3 snakeskin pants pimp ring and street attire inspired by snakeskin pants undertaker.glb", status: "INCOMING_VERIFIED", variant: "snakeskin / pimp / ring / street" },
  { owner: "echo", filename: "ECHO (teamed with onyx and cipher in god within mode , inspired by shotzi Blackheart vs Lio Rush Blackheart).glb", sourcePath: "assets/models/incoming/ECHO (teamed with onyx and cipher in god within mode , inspired by shotzi Blackheart vs Lio Rush Blackheart).glb", status: "INCOMING_VERIFIED", variant: "God Within team appearance" },
  { owner: "edwin_kennedy", filename: "Edwin Kennedy (Unchained (he's wearing chains) attire 3).glb", sourcePath: "assets/models/incoming/Edwin Kennedy (Unchained (he's wearing chains) attire 3).glb", status: "BANKED", variant: "Unchained / attire 3", notes: "bank_map -> EDWIN_KENNEDY_unchained.glb" },
  { owner: "edwin_kennedy", filename: "Edwin Kennedy ring attire 1 (Mustached Mogul).glb", sourcePath: "assets/models/incoming/Edwin Kennedy ring attire 1 (Mustached Mogul).glb", status: "BANKED", variant: "Mustached Mogul / attire 1", notes: "bank_map -> EDWIN_KENNEDY.glb" },
  { owner: "hollow", filename: "HOLLOW (based off super dragon, needs super dragon personality and moves, teamed with ONYX, static, echo, cipher, god within mode appearances too).glb", sourcePath: "assets/models/incoming/HOLLOW (based off super dragon, needs super dragon personality and moves, teamed with ONYX, static, echo, cipher, god within mode appearances too).glb", status: "BANKED", variant: "Super Dragon-inspired / God Within", notes: "bank_map -> HOLLOW.glb" },
  { owner: "maime", filename: "MAIME_v1_clean.glb", sourcePath: "assets/models/incoming/MAIME_v1_clean.glb", status: "INCOMING_VERIFIED", variant: "v1 clean" },
  { owner: "maime", filename: "MAIME_v1_rigready.glb", sourcePath: "assets/models/incoming/MAIME_v1_rigready.glb", status: "INCOMING_VERIFIED", variant: "v1 rigready" },
  { owner: "cody", filename: "Cody sober.glb", sourcePath: "assets/models/incoming/Cody sober.glb", status: "INCOMING_VERIFIED", variant: "Sober" },
  { owner: "cody", filename: "Cody stressedandcoked.glb", sourcePath: "assets/models/incoming/Cody stressedandcoked.glb", status: "INCOMING_VERIFIED", variant: "Stressed" },
  { owner: "pablo", filename: "Pablo (the Golden Bull attire, not to be confused with El Toro de oro, those are two different characters) attire 2 gold.glb", sourcePath: "assets/models/incoming/Pablo (the Golden Bull attire, not to be confused with El Toro de oro, those are two different characters) attire 2 gold.glb", status: "BANKED", variant: "Golden Bull / attire 2", notes: "bank_map -> PABLO_goldenbull.glb; explicitly distinct from El Toro de Oro" },

  // GitHub assets/models — measured Mixamo-skinned but no BANNON_ROSTER identity.
  { owner: "tarzanian_devil", filename: "TARZANIAN_DEVIL_skinned.glb", sourcePath: "assets/models/TARZANIAN_DEVIL_skinned.glb", status: "BANKED", variant: "skinned Mixamo", notes: "58 Mixamo joints / JOINTS_0=1. No authored fighter profile — not promoted." },
  { owner: "npc", filename: "NPC_FINXSSE.glb", sourcePath: "assets/models/NPC_FINXSSE.glb", status: "INCOMING_VERIFIED", notes: "Measured Mixamo-skinned (58 joints / JOINTS_0=1). NPC mesh, not a roster fighter." },

  // Props are intentionally tracked separately and can never promote to fighters.
  { owner: "prop", filename: "Barbwire_baseball_bat.glb", sourcePath: "assets/models/incoming/Barbwire_baseball_bat.glb", status: "PROP", notes: "bank_map -> props/weapons/barbwire_bat.glb" },
];

export const BANNON_GLB_SOURCE_FIGHTER_EVIDENCE = BANNON_GLB_SOURCE_INVENTORY.filter(e => e.owner !== "prop" && e.status !== "TRUNCATED");
export const BANNON_GLB_SOURCE_PROPS = BANNON_GLB_SOURCE_INVENTORY.filter(e => e.status === "PROP");
