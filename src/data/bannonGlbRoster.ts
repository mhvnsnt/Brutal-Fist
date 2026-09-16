export type BannonGlbRosterEntry = {
  id: string; name: string; model: string; attire?: string;
  rigStatus: "named-part" | "skinned" | "single-mesh-needs-rigready" | "qa-weak" | "qa-fail";
  playableGate: "PASS" | "BLOCKED_QA" | "BLOCKED_RIG";
  source: "CANON_MODELS" | "MODEL_QA" | "BATCH_RERIG" | "DRIVE";
  /** Override URL — used when the GLB is not in the Bannon repo (e.g. Google Drive) */
  overrideUrl?: string;
};

/** HARD BOUNDARY: only actual Bannon character GLBs are catalogued here.
 * Procedural-only/metadata-only records are intentionally absent.
 * A GLB is necessary but not sufficient: rig and measured skin-QA gates apply.
 * There is no attire-count cap.
 *
 * NAMING NOTE:
 *   BANNON.glb          = Bannon default / muscular body (canonical)
 *   BANNON_fat.glb      = Bannon fat alt (previously mislabeled BANNON_muscular.glb)
 */
export const BANNON_GLB_MODELS: readonly BannonGlbRosterEntry[] = [
  // ── BANNON ──────────────────────────────────────────────────────────────────
  // rigged_ready.glb is the primary combat entry — output of scripts/rig-static-glbs-cli.mjs
  // BANNON.glb (named-part) remains as fallback for character select portrait only
  {id:"bannon",name:"Bannon",model:"BANNON_rigged_ready.glb",attire:"Default (Rigged)",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"bannon",name:"Bannon",model:"BANNON.glb",attire:"Default (Static fallback)",rigStatus:"named-part",playableGate:"PASS",source:"CANON_MODELS"},
  // RENAMED: was BANNON_muscular.glb — the muscular label was wrong; this is the fat alt
  {id:"bannon",name:"Bannon",model:"BANNON_fat.glb",attire:"Fat alt",rigStatus:"single-mesh-needs-rigready",playableGate:"PASS",source:"CANON_MODELS"},

  // ── MAIME ────────────────────────────────────────────────────────────────────
  // rigged_ready.glb is the primary combat entry — output of scripts/rig-static-glbs-cli.mjs
  {id:"maime",name:"Maime",model:"MAIME_rigged_ready.glb",attire:"Default (Rigged)",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"maime",name:"Maime",model:"MAIME.glb",attire:"Default (Static fallback)",rigStatus:"named-part",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"maime",name:"Maime",model:"MAIME_tattered.glb",attire:"Tattered",rigStatus:"named-part",playableGate:"PASS",source:"CANON_MODELS"},

  // ── ONYX ─────────────────────────────────────────────────────────────────────
  {id:"onyx",name:"Onyx",model:"ONYX_street.glb",attire:"Street",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"onyx",name:"Onyx",model:"ONYX_straightjacket.glb",attire:"Straightjacket",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"onyx",name:"Onyx",model:"ONYX.glb",attire:"Chola/Spiked",rigStatus:"single-mesh-needs-rigready",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"onyx",name:"Onyx",model:"ONYX_corset.glb",attire:"Corset/Vamp",rigStatus:"single-mesh-needs-rigready",playableGate:"PASS",source:"CANON_MODELS"},

  // ── CAIN ELIAS ───────────────────────────────────────────────────────────────
  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_ring.glb",attire:"Ring",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA"},
  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_snakeskin.glb",attire:"Snakeskin",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_gear.glb",attire:"Wrestling Gear",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"cain_elias",name:"Cain Elias",model:"CAIN_ELIAS_godwithin.glb",attire:"God Within",rigStatus:"skinned",playableGate:"PASS",source:"BATCH_RERIG"},

  // ── CIPHER ───────────────────────────────────────────────────────────────────
  {id:"cipher",name:"Cipher",model:"CIPHER.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA"},
  {id:"cipher",name:"Cipher",model:"CIPHER_minion.glb",attire:"Minion",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"cipher",name:"Cipher",model:"CIPHER_feral.glb",attire:"Feral",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},

  // ── STICK-UP ─────────────────────────────────────────────────────────────────
  {id:"stick_up",name:"Stick-Up",model:"STICKUP.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA"},

  // ── ECHO ─────────────────────────────────────────────────────────────────────
  {id:"echo",name:"Echo",model:"ECHO.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA"},

  // ── CODY ─────────────────────────────────────────────────────────────────────
  {id:"cody",name:"Cody",model:"CODY_sober.glb",attire:"Sober",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},
  {id:"cody",name:"Cody",model:"CODY_stressed.glb",attire:"Stressed",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},

  // ── HALL NIGHTER ─────────────────────────────────────────────────────────────
  {id:"hall_nighter",name:"Hall Nighter",model:"HALL_NIGHTER.glb",attire:"Default",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},

  // ── STATIC ───────────────────────────────────────────────────────────────────
  {id:"static",name:"Static",model:"STATIC.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA"},
  {id:"static",name:"Static",model:"STATIC_alt.glb",attire:"Alt",rigStatus:"skinned",playableGate:"PASS",source:"CANON_MODELS"},

  // ── VIPER ────────────────────────────────────────────────────────────────────
  {id:"viper",name:"Viper",model:"VIPER.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA"},

  // ── KOBRA ────────────────────────────────────────────────────────────────────
  {id:"kobra",name:"Kobra",model:"KOBRA.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA"},

  // ── AARON RUBEN ──────────────────────────────────────────────────────────────
  {id:"aaron_ruben",name:"Aaron Ruben",model:"AARON_RUBEN.glb",attire:"Default",rigStatus:"skinned",playableGate:"PASS",source:"MODEL_QA"},

  // ── HOLLOW ───────────────────────────────────────────────────────────────────
  {id:"hollow",name:"Hollow",model:"HOLLOW.glb",attire:"Default",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},

  // ── EDWIN KENNEDY ────────────────────────────────────────────────────────────
  {id:"edwin_kennedy",name:"Edwin Kennedy",model:"EDWIN_KENNEDY.glb",attire:"Mustached Mogul",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},
  {id:"edwin_kennedy",name:"Edwin Kennedy",model:"EDWIN_KENNEDY_unchained.glb",attire:"Unchained",rigStatus:"qa-weak",playableGate:"PASS",source:"BATCH_RERIG"},

  // ── PABLO ────────────────────────────────────────────────────────────────────
  {id:"pablo",name:"Pablo",model:"PABLO.glb",attire:"Minotaur Painted",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},
  {id:"pablo",name:"Pablo",model:"PABLO_goldenbull.glb",attire:"Golden Bull",rigStatus:"qa-weak",playableGate:"PASS",source:"BATCH_RERIG"},
  {id:"pablo",name:"Pablo",model:"PABLO_blackreign.glb",attire:"Black Reign",rigStatus:"qa-weak",playableGate:"PASS",source:"BATCH_RERIG"},

  // ── TYNESHIA ─────────────────────────────────────────────────────────────────
  {id:"tyneshia",name:"Tyneshia",model:"TYNESHIA.glb",attire:"Wrestling Gear",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},
  {id:"tyneshia",name:"Tyneshia",model:"TYNESHIA_street.glb",attire:"Hall Street / Casual",rigStatus:"qa-weak",playableGate:"PASS",source:"BATCH_RERIG"},

  // ── TRIPLE XXX ───────────────────────────────────────────────────────────────
  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX.glb",attire:"Default",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},
  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX_tights.glb",attire:"Blue Tights",rigStatus:"qa-weak",playableGate:"PASS",source:"BATCH_RERIG"},
  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX_trunks.glb",attire:"Blue Trunks",rigStatus:"qa-weak",playableGate:"PASS",source:"BATCH_RERIG"},
  {id:"triple_xxx",name:"Triple XXX",model:"TRIPLE_XXX_suit.glb",attire:"Suit / Manager",rigStatus:"qa-weak",playableGate:"PASS",source:"BATCH_RERIG"},

  // ── EL TORO DE ORO ───────────────────────────────────────────────────────────
  {id:"el_toro_de_oro",name:"El Toro de Oro",model:"EL_TORO_DE_ORO.glb",attire:"Default",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},

  // ── STAN COMBS ───────────────────────────────────────────────────────────────
  {id:"stan_combs",name:"Stan Combs",model:"STAN_COMBS_gear.glb",attire:"Ring Gear",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},

  // ── BRUTUS ───────────────────────────────────────────────────────────────────
  {id:"brutus",name:"Brutus",model:"BRUTUS.glb",attire:"Default",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},

  // ── TITAN ────────────────────────────────────────────────────────────────────
  {id:"titan",name:"Titan",model:"TITAN.glb",attire:"Default",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},

  // ── MASTER SENSEI ────────────────────────────────────────────────────────────
  {id:"master_sensei",name:"Master Sensei",model:"MASTER_SENSEI.glb",attire:"Default",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},

  // ── WRECK PATTERSON ──────────────────────────────────────────────────────────
  {id:"wreck_patterson",name:"Wreck Patterson",model:"WRECK_PATTERSON.glb",attire:"Default",rigStatus:"qa-weak",playableGate:"PASS",source:"MODEL_QA"},

  // ── JAGER ────────────────────────────────────────────────────────────────────
  // Both attires sourced from Google Drive public links.
  // Attire 1: https://drive.google.com/file/d/1RKxHGkgoKe0hZf7a2kObqzKpgqKfkrhl/view
  // Attire 2: second Drive GLB — registered as Alt attire.
  {
    id:"jager",
    name:"Jager",
    model:"JAGER.glb",
    attire:"Default",
    rigStatus:"skinned",
    playableGate:"PASS",
    source:"DRIVE",
    overrideUrl:"https://drive.google.com/uc?export=download&id=1RKxHGkgoKe0hZf7a2kObqzKpgqKfkrhl",
  },
  {
    id:"jager",
    name:"Jager",
    model:"JAGER_alt.glb",
    attire:"Alt",
    rigStatus:"skinned",
    playableGate:"PASS",
    source:"DRIVE",
    // Second attire uses the same Drive file until the second link is provided.
    // Replace this overrideUrl with the second Drive file's direct download URL.
    overrideUrl:"https://drive.google.com/uc?export=download&id=1RKxHGkgoKe0hZf7a2kObqzKpgqKfkrhl",
  },
];

export const BANNON_GLB_PLAYABLE_MODELS = BANNON_GLB_MODELS.filter(e => e.playableGate === "PASS");
export const BANNON_GLB_BLOCKED_MODELS = BANNON_GLB_MODELS.filter(e => e.playableGate !== "PASS");
export const BANNON_GLB_FIGHTERS = [...new Set(BANNON_GLB_MODELS.map(e => e.id))];
