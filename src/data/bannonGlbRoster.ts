export type BannonGlbRosterEntry = {
  id: string;
  name: string;
  model: string;
  attire?: string;
  rigStatus: "named-part" | "skinned" | "single-mesh-needs-rigready";
};

/**
 * HARD ROSTER BOUNDARY.
 *
 * This list is sourced only from Bannon/assets/models/CANON_MODELS.md.
 * A Bannon character does not enter Brutal Fist merely because it exists in
 * roster.json or has a procedural model.
 *
 * Only entries with an actual GLB model identity are eligible for this
 * manifest. "single-mesh-needs-rigready" means the GLB exists but must pass
 * the rig/animation gate before it becomes match-playable.
 */
export const BANNON_GLB_MODELS: readonly BannonGlbRosterEntry[] = [
  { id: "bannon", name: "Bannon", model: "BANNON.glb", rigStatus: "named-part" },
  { id: "bannon", name: "Bannon", model: "BANNON_muscular.glb", attire: "Muscular alt", rigStatus: "single-mesh-needs-rigready" },
  { id: "maime", name: "Maime", model: "MAIME.glb", rigStatus: "named-part" },
  { id: "maime", name: "Maime", model: "MAIME_tattered.glb", attire: "Tattered", rigStatus: "named-part" },
  { id: "onyx", name: "Onyx", model: "ONYX.glb", attire: "Chola/Spiked", rigStatus: "single-mesh-needs-rigready" },
  { id: "onyx", name: "Onyx", model: "ONYX_corset.glb", attire: "Corset/Vamp", rigStatus: "single-mesh-needs-rigready" },
  { id: "cain_elias", name: "Cain Elias", model: "CAIN_ELIAS_ring.glb", attire: "Ring", rigStatus: "skinned" },
  { id: "cain_elias", name: "Cain Elias", model: "CAIN_ELIAS_snakeskin.glb", attire: "Snakeskin", rigStatus: "skinned" },
  { id: "stick_up", name: "Stick-Up", model: "STICKUP.glb", rigStatus: "skinned" },
  { id: "cipher", name: "Cipher", model: "CIPHER.glb", rigStatus: "skinned" },
  { id: "echo", name: "Echo", model: "ECHO.glb", rigStatus: "skinned" },
  { id: "onyx", name: "Onyx", model: "ONYX_street.glb", attire: "Street", rigStatus: "skinned" },
  { id: "cody", name: "Cody", model: "CODY_sober.glb", attire: "Sober", rigStatus: "skinned" },
  { id: "cody", name: "Cody", model: "CODY_stressed.glb", attire: "Stressed", rigStatus: "skinned" },
  { id: "onyx", name: "Onyx", model: "ONYX_straightjacket.glb", attire: "Straightjacket", rigStatus: "skinned" },
  { id: "cipher", name: "Cipher", model: "CIPHER_minion.glb", attire: "Minion", rigStatus: "skinned" },
  { id: "cipher", name: "Cipher", model: "CIPHER_feral.glb", attire: "Feral", rigStatus: "skinned" },
  { id: "cain_elias", name: "Cain Elias", model: "CAIN_ELIAS_gear.glb", attire: "Wrestling Gear", rigStatus: "skinned" },
  { id: "hall_nighter", name: "Hall Nighter", model: "HALL_NIGHTER.glb", rigStatus: "skinned" },
  { id: "static", name: "Static", model: "STATIC.glb", attire: "Default", rigStatus: "skinned" },
  { id: "static", name: "Static", model: "STATIC_alt.glb", attire: "Alt", rigStatus: "skinned" },
];

export const BANNON_GLB_PLAYABLE_MODELS = BANNON_GLB_MODELS.filter(
  (entry) => entry.rigStatus === "named-part" || entry.rigStatus === "skinned",
);

/**
 * Procedural-only Bannon records are intentionally not represented here.
 * Character Select must consume this manifest, never roster.json directly.
 */
