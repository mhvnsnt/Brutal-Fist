import { resolveGlbUrl } from './bannonGlbUrl';

export type BannonGlbRosterEntry = {
  id: string; name: string; model: string; attire?: string;
  rigStatus: "named-part" | "skinned" | "single-mesh-needs-rigready" | "qa-weak" | "qa-fail";
  playableGate: "PASS" | "BLOCKED_QA" | "BLOCKED_RIG";
  source: "CANON_MODELS" | "MODEL_QA" | "BATCH_RERIG" | "DRIVE" | "OFFLINE_NAMEDPART_SKIN";
  /** Override URL — local generated files or Drive-only assets */
  overrideUrl?: string;
  /** Measured Mixamo joint count from GLB inspection (0 if unskinned). */
  measuredJoints?: number;
  /** Measured JOINTS_0 primitive count. */
  measuredJoints0?: number;
};

/**
 * HARD BOUNDARY: only actual Bannon character GLBs are catalogued here.
 * Rig status below is from measured inspection of mhvnsnt/Bannon assets/models
 * (2026-09-16): skins + JOINTS_0 + mixamorig:* joints. Named-part/static files
 * are not playable unless a skinned sibling exists.
 *
 * Preference: *_skinned / *_rigged / *_rig28 over named-part or static previews.
 * Canonical playable defaults:
 *   BANNON → BANNON_rigged_ready.glb (hardlink of BANNON_rigged.glb, 58 Mixamo joints)
 *   MAIME  → MAIME_rigged_ready.glb  (hardlink of MAIME_skinned.glb)
 * Named-part BANNON.glb / MAIME.glb are not playable.
 */
export const BANNON_GLB_MODELS: readonly BannonGlbRosterEntry[] = [
  {id:"bannon",name:"Bannon",model:"BANNON_rigged_ready.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"bannon",name:"Bannon",model:"BANNON_rigged.glb",attire:"Mixamo source",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"bannon",name:"Bannon",model:"BANNON_muscular_skinned.glb",attire:"Muscular alt",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},

  {id:"maime",name:"Maime",model:"MAIME_rigged_ready.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"OFFLINE_NAMEDPART_SKIN",overrideUrl:"/models/MAIME_skinned.glb",measuredJoints:22,measuredJoints0:15},
  {id:"maime",name:"Maime",model:"MAIME_skinned.glb",attire:"Skinned source",rigStatus:"skinned",playableGate:"PASS",source:"OFFLINE_NAMEDPART_SKIN",overrideUrl:"/models/MAIME_skinned.glb",measuredJoints:22,measuredJoints0:15},
  {id:"maime",name:"Maime",model:"MAIME_tattered_skinned.glb",attire:"Tattered",rigStatus:"skinned",playableGate:"PASS",source:"OFFLINE_NAMEDPART_SKIN",overrideUrl:"/models/MAIME_tattered_skinned.glb",measuredJoints:22,measuredJoints0:14},

  {id:"onyx",name:"Onyx",model:"ONYX_street.glb",attire:"Street",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"onyx",name:"Onyx",model:"ONYX_straightjacket.glb",attire:"Straightjacket",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"onyx",name:"Onyx",model:"ONYX_skinned.glb",attire:"Chola/Spiked",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"onyx",name:"Onyx",model:"ONYX_corset_skinned.glb",attire:"Corset/Vamp",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},

  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_ring.glb",attire:"Ring",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},
  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_snakeskin.glb",attire:"Snakeskin",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_gear.glb",attire:"Wrestling Gear",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_godwithin.glb",attire:"God Within",rigStatus:"skinned",playableGate:"PASS",source:"BATCH_RERIG",measuredJoints:58,measuredJoints0:1},

  {id:"cipher",name:"Cipher",model:"CIPHER.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},
  {id:"cipher",name:"Cipher",model:"CIPHER_minion.glb",attire:"Minion",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"cipher",name:"Cipher",model:"CIPHER_feral.glb",attire:"Feral",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},

  {id:"stick_up",name:"Stick-Up",model:"STICKUP.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},

  {id:"echo",name:"Echo",model:"ECHO.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},

  {id:"cody",name:"Cody",model:"CODY_sober.glb",attire:"Sober",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"cody",name:"Cody",model:"CODY_stressed.glb",attire:"Stressed",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"cody",name:"Cody",model:"CODY_gear_skinned.glb",attire:"Wrestling Gear",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},

  {id:"hall_nighter",name:"Hall Nighter",model:"HALL_NIGHTER.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},

  {id:"static",name:"Static",model:"STATIC.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},
  {id:"static",name:"Static",model:"STATIC_alt.glb",attire:"Alt",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},

  {id:"viper",name:"Viper",model:"VIPER.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},

  {id:"kobra",name:"Kobra",model:"KOBRA.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},

  {id:"aaron_ruben",name:"Aaron Ruben",model:"AARON_RUBEN.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},

  {id:"hollow",name:"Hollow",model:"HOLLOW.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},

  {id:"edwin_kennedy",name:"Edwin Kennedy",model:"EDWIN_KENNEDY.glb",attire:"Mustached Mogul",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},
  {id:"edwin_kennedy",name:"Edwin Kennedy",model:"EDWIN_KENNEDY_unchained_rig28.glb",attire:"Unchained",rigStatus:"skinned",playableGate:"PASS",source:"BATCH_RERIG",measuredJoints:58,measuredJoints0:1},

  {id:"pablo",name:"Pablo",model:"PABLO.glb",attire:"Minotaur Painted",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},
  {id:"pablo",name:"Pablo",model:"PABLO_goldenbull.glb",attire:"Golden Bull",rigStatus:"skinned",playableGate:"PASS",source:"BATCH_RERIG",measuredJoints:58,measuredJoints0:1},
  {id:"pablo",name:"Pablo",model:"PABLO_blackreign.glb",attire:"Black Reign",rigStatus:"skinned",playableGate:"PASS",source:"BATCH_RERIG",measuredJoints:58,measuredJoints0:1},

  {id:"tyneshia",name:"Tyneshia",model:"TYNESHIA.glb",attire:"Wrestling Gear",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},
  {id:"tyneshia",name:"Tyneshia",model:"TYNESHIA_street.glb",attire:"Hall Street / Casual",rigStatus:"skinned",playableGate:"PASS",source:"BATCH_RERIG",measuredJoints:58,measuredJoints0:1},

  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},
  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX_tights.glb",attire:"Blue Tights",rigStatus:"skinned",playableGate:"PASS",source:"BATCH_RERIG",measuredJoints:58,measuredJoints0:1},
  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX_trunks.glb",attire:"Blue Trunks",rigStatus:"skinned",playableGate:"PASS",source:"BATCH_RERIG",measuredJoints:58,measuredJoints0:1},
  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX_suit.glb",attire:"Suit / Manager",rigStatus:"skinned",playableGate:"PASS",source:"BATCH_RERIG",measuredJoints:58,measuredJoints0:1},

  {id:"el_toro_de_oro",name:"El Toro de Oro",model:"EL_TORO_DE_ORO.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},

  {id:"stan_combs",name:"Stan Combs",model:"STAN_COMBS_gear.glb",attire:"Ring Gear",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},

  {id:"brutus",name:"Brutus",model:"BRUTUS.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},

  {id:"titan",name:"Titan",model:"TITAN.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},
  {id:"titan",name:"Titan",model:"TITAN_unmasked.glb",attire:"Unmasked",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"titan",name:"Titan",model:"TITAN_white.glb",attire:"White",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},

  {id:"master_sensei",name:"Master Sensei",model:"MASTER_SENSEI.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},
  {id:"master_sensei",name:"Master Sensei",model:"MASTER_SENSEI_rose.glb",attire:"Rose",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},

  {id:"wreck_patterson",name:"Wreck Patterson",model:"WRECK_PATTERSON.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA",measuredJoints:58,measuredJoints0:1},
  {id:"wreck_patterson",name:"Wreck Patterson",model:"WRECK_PATTERSON_attire2.glb",attire:"Attire 2",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"wreck_patterson",name:"Wreck Patterson",model:"WRECK_PATTERSON_attire3.glb",attire:"Attire 3",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"wreck_patterson",name:"Wreck Patterson",model:"WRECK_PATTERSON_godwithin.glb",attire:"God Within",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},

  {id:"jager",name:"Jager",model:"JAGER.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"jager",name:"Jager",model:"JAGER_beard.glb",attire:"Beard",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},

  {id:"finxsse",name:"Finxsse",model:"NPC_FINXSSE.glb",attire:"NPC",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},

  {id:"tarzanian_devil",name:"Tarzanian Devil",model:"TARZANIAN_DEVIL_skinned.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS",measuredJoints:58,measuredJoints0:1},
  {id:"tarzanian_devil",name:"Tarzanian Devil",model:"TARZANIAN_DEVIL_dec_rig28.glb",attire:"Decimated",rigStatus:"skinned",playableGate:"PASS",source:"BATCH_RERIG",measuredJoints:58,measuredJoints0:1},
];

export const BANNON_GLB_PLAYABLE_MODELS = BANNON_GLB_MODELS.filter(e => e.playableGate === "PASS");
export const BANNON_GLB_BLOCKED_MODELS = BANNON_GLB_MODELS.filter(e => e.playableGate !== "PASS");
export const BANNON_GLB_FIGHTERS = [...new Set(BANNON_GLB_MODELS.map(e => e.id))];

export function getGlbEntryForFighter(fighterId: string, model?: string): BannonGlbRosterEntry | undefined {
  if (model) {
    const exact = BANNON_GLB_MODELS.find(e => e.id === fighterId && e.model === model);
    if (exact) return exact;
    const aliased = model.replace(/\.glb$/i, '_rigged_ready.glb');
    const ready = BANNON_GLB_MODELS.find(e => e.id === fighterId && e.model === aliased);
    if (ready) return ready;
  }
  return BANNON_GLB_MODELS.find(e => e.id === fighterId);
}

export function getFighterGlbUrl(fighterId: string, model?: string): string | null {
  const entry = getGlbEntryForFighter(fighterId, model);
  if (!entry) return null;
  return resolveGlbUrl(entry.model, entry.overrideUrl);
}

export function getPlayableAttires(fighterId: string): readonly BannonGlbRosterEntry[] {
  return BANNON_GLB_MODELS.filter(e => e.id === fighterId && e.playableGate === 'PASS');
}
