export type BannonGlbRosterEntry = {
  id: string; name: string; model: string; attire?: string;
  rigStatus: "named-part" | "skinned" | "single-mesh-needs-rigready" | "qa-weak" | "qa-fail";
  playableGate: "PASS" | "BLOCKED_QA" | "BLOCKED_RIG";
  source: "CANON_MODELS" | "MODEL_QA" | "BATCH_RERIG";
};

/** HARD BOUNDARY: only actual Bannon character GLBs are catalogued here.
 * Procedural-only/metadata-only records are intentionally absent.
 * A GLB is necessary but not sufficient: rig and measured skin-QA gates apply.
 * There is no attire-count cap.
 */
export const BANNON_GLB_MODELS: readonly BannonGlbRosterEntry[] = [
  {id:"bannon",name:"Bannon",model:"BANNON.glb",rigStatus:"named-part",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"bannon",name:"Bannon",model:"BANNON_muscular.glb",attire:"Muscular alt",rigStatus:"single-mesh-needs-rigready",playableGate:"BLOCKED_RIG",source:"CANON_MODELS"},
  {id:"maime",name:"Maime",model:"MAIME.glb",rigStatus:"named-part",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"maime",name:"Maime",model:"MAIME_tattered.glb",attire:"Tattered",rigStatus:"named-part",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"onyx",name:"Onyx",model:"ONYX.glb",attire:"Chola/Spiked",rigStatus:"single-mesh-needs-rigready",playableGate:"BLOCKED_RIG",source:"CANON_MODELS"},
  {id:"onyx",name:"Onyx",model:"ONYX_corset.glb",attire:"Corset/Vamp",rigStatus:"single-mesh-needs-rigready",playableGate:"BLOCKED_RIG",source:"CANON_MODELS"},
  {id:"onyx",name:"Onyx",model:"ONYX_street.glb",attire:"Street",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"onyx",name:"Onyx",model:"ONYX_straightjacket.glb",attire:"Straightjacket",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_ring.glb",attire:"Ring",rigStatus:"skinned",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_snakeskin.glb",attire:"Snakeskin",rigStatus:"skinned",playableGate:"BLOCKED_QA",source:"CANON_MODELS"},
  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_gear.glb",attire:"Wrestling Gear",rigStatus:"skinned",playableGate:"BLOCKED_QA",source:"CANON_MODELS"},
  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_godwithin.glb",attire:"God Within",rigStatus:"skinned",playableGate:"BLOCKED_QA",source:"BATCH_RERIG"},
  {id:"stick_up",name:"Stick-Up",model:"STICKUP.glb",rigStatus:"skinned",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"cipher",name:"Cipher",model:"CIPHER.glb",rigStatus:"skinned",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"cipher",name:"Cipher",model:"CIPHER_minion.glb",attire:"Minion",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"cipher",name:"Cipher",model:"CIPHER_feral.glb",attire:"Feral",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"echo",name:"Echo",model:"ECHO.glb",rigStatus:"skinned",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"cody",name:"Cody",model:"CODY_sober.glb",attire:"Sober",rigStatus:"skinned",playableGate:"BLOCKED_QA",source:"CANON_MODELS"},
  {id:"cody",name:"Cody",model:"CODY_stressed.glb",attire:"Stressed",rigStatus:"skinned",playableGate:"BLOCKED_QA",source:"CANON_MODELS"},
  {id:"hall_nighter",name:"Hall Nighter",model:"HALL_NIGHTER.glb",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"static",name:"Static",model:"STATIC.glb",attire:"Default",rigStatus:"skinned",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"static",name:"Static",model:"STATIC_alt.glb",attire:"Alt",rigStatus:"skinned",playableGate:"BLOCKED_QA",source:"CANON_MODELS"},

  {id:"viper",name:"Viper",model:"VIPER.glb",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA"},
  {id:"kobra",name:"Kobra",model:"KOBRA.glb",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA"},
  {id:"aaron_ruben",name:"Aaron Ruben",model:"AARON_RUBEN.glb",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA"},
  {id:"hollow",name:"Hollow",model:"HOLLOW.glb",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"edwin_kennedy",name:"Edwin Kennedy",model:"EDWIN_KENNEDY.glb",attire:"Mustached Mogul / attire 1",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"edwin_kennedy",name:"Edwin Kennedy",model:"EDWIN_KENNEDY_unchained.glb",attire:"Unchained / attire 3",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"BATCH_RERIG"},
  {id:"pablo",name:"Pablo",model:"PABLO.glb",attire:"Minotaur Painted / attire 1",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"pablo",name:"Pablo",model:"PABLO_goldenbull.glb",attire:"Golden Bull / attire 2",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"BATCH_RERIG"},
  {id:"pablo",name:"Pablo",model:"PABLO_blackreign.glb",attire:"Black Reign / attire 3",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"BATCH_RERIG"},
  {id:"tyneshia",name:"Tyneshia",model:"TYNESHIA.glb",attire:"Wrestling Gear / attire 1",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"tyneshia",name:"Tyneshia",model:"TYNESHIA_street.glb",attire:"Hall Street Gear / Casual / Manager / attire 2",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"BATCH_RERIG"},
  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX.glb",attire:"attire 1",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX_tights.glb",attire:"Blue Tights / attire 2",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"BATCH_RERIG"},
  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX_trunks.glb",attire:"Blue Trunks / attire 3",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"BATCH_RERIG"},
  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX_suit.glb",attire:"Suit / Casual / Manager / attire 4",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"BATCH_RERIG"},
  {id:"el_toro_de_oro",name:"El Toro de Oro",model:"EL_TORO_DE_ORO.glb",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"stan_combs",name:"Stan Combs",model:"STAN_COMBS_gear.glb",attire:"Ring Gear",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"brutus",name:"Brutus",model:"BRUTUS.glb",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"titan",name:"Titan",model:"TITAN.glb",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"master_sensei",name:"Master Sensei",model:"MASTER_SENSEI.glb",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
  {id:"wreck_patterson",name:"Wreck Patterson",model:"WRECK_PATTERSON.glb",rigStatus:"qa-weak",playableGate:"BLOCKED_QA",source:"MODEL_QA"},
];

export const BANNON_GLB_PLAYABLE_MODELS = BANNON_GLB_MODELS.filter(e => e.playableGate === "PASS");
export const BANNON_GLB_BLOCKED_MODELS = BANNON_GLB_MODELS.filter(e => e.playableGate !== "PASS");
export const BANNON_GLB_FIGHTERS = [...new Set(BANNON_GLB_MODELS.map(e => e.id))];
