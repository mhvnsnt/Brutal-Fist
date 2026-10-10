/**
 * customization/types.ts — the data contract for the Brutal-Fist appearance
 * customizer (Phase 2 port of the AshLanev2 7-item suite).
 *
 * A CustomBuild is everything the player can change about a fighter's LOOK,
 * stored per-fighter and re-applied to the live model whenever it loads
 * (select-screen preview and fight). Skin-tone likeness is LOCKED: no field
 * here may recolor skin. Base meshes/materials/textures are never written —
 * paint lives on decal overlays, accessories hang off bones.
 *
 * The build folds in the select screen's pre-existing per-slot state
 * (PartPaint + GearAddon) so one save covers the whole look.
 */
import type { PartPaint, GearAddon } from '../render/paintMath';

/** One selectable iris color. `hex` is a CSS hex like "#4a2c14". */
export interface EyeColor {
  id: string;
  label: string;
  hex: string;
}

/** Body/face morph dials. All 0..1, 0.5 = the model's authored shape. */
export interface MorphValues {
  /** Arm/chest/thigh girth. */
  muscle: number;
  /** Leg length (feet stay planted — applier re-grounds the model). */
  height: number;
  /** Hip/shoulder width. */
  build: number;
  /** Jaw width / face fullness. */
  jaw: number;
}

export const DEFAULT_MORPHS: MorphValues = {
  muscle: 0.5,
  height: 0.5,
  build: 0.5,
  jaw: 0.5,
};

export const MORPH_KEYS = ['muscle', 'height', 'build', 'jaw'] as const;
export type MorphKey = (typeof MORPH_KEYS)[number];

/**
 * Accessory slots. All ship as PS1-budget PROCEDURAL builders in
 * accessories.ts (no hi-res GLB imports — the PS1 look is intentional and
 * the render profile quantizes to 256px textures / snapped vertices).
 * `facialHair` is scaffolded for a future lane.
 */
export const ACCESSORY_SLOTS = [
  'hair',
  'facialHair',
  'mask',
  'hood',
  'chain',
  'gloves',
  'wristbands',
  'shoes',
] as const;
export type AccessorySlotId = (typeof ACCESSORY_SLOTS)[number];

/**
 * One selectable accessory. Brutal-Fist accessories are procedural builders
 * (PSX_ACCESSORIES in accessories.ts), so there is no GLB file to load —
 * `builder` names the builder function. The attach block is the same
 * contract as the AshLanev2 suite (bone + local offset + euler rotation +
 * uniform scale), and `pendantRotation` is the chain lane's tuning knob
 * (the pendant-orientation fix, ported from feature/chain-pendant-fix).
 */
export interface AccessoryDef {
  /** Stable id, e.g. "chain_gold". */
  id: string;
  label: string;
  slot: AccessorySlotId;
  /** Procedural builder id in accessories.ts. */
  builder: string;
  /** Extra builder ids attached with the same selection (L/R pairs). */
  pairBuilders?: string[];
  /** True when the asset is canon for a character — badged in the UI. */
  canon?: boolean;
  canonNotes?: string;
  attach: {
    /**
     * Bone to hang the accessory from. Exact name preferred; the loader
     * falls back to a case-insensitive pattern match.
     */
    bone: string;
    /** Local offset from the bone origin, in meters. */
    position: [number, number, number];
    /** Local euler rotation, in degrees. */
    rotation: [number, number, number];
    /** Uniform scale. Defaults to 1. */
    scale?: number;
  };
  /**
   * Chain pendant orientation fix: extra euler rotation (degrees XYZ)
   * applied to the pendant sub-mesh BEFORE it hangs, so the pendant faces
   * forward-down instead of swinging sideways on rigs whose neck-bone local
   * axes don't map to world axes. Per-accessory tuning knob.
   */
  pendantRotation?: [number, number, number];
}

/**
 * Face-paint selection. The paint module
 * (src/engine/customization/facepaint/index.ts) is the ONLY import surface.
 * A build stores the selection as a single string: either a canon preset id
 * ("cipher-grin") or serialized FacePaintLayer[].
 */
export type FacePaintSpec = string;

/** The player's full appearance build for one fighter. */
export interface CustomBuild {
  /** Roster id, e.g. "bannon". */
  fighterId: string;
  /** Attire id from bannonGlbRoster, e.g. "Default". */
  attireId: string;
  /** Iris color id from the eye palette, e.g. "brown". "natural" = authored. */
  eyeColor: string;
  morphs: MorphValues;
  /** Accessory def id per slot; null = none. */
  accessories: Record<AccessorySlotId, string | null>;
  /** Face-paint preset id or serialized layers; null = none. */
  facePaint: string | null;
  /** Pre-existing select-screen state, folded into the same save. */
  paint: PartPaint;
  addon: GearAddon;
}

export function defaultBuild(fighterId: string, attireId: string): CustomBuild {
  return {
    fighterId,
    attireId,
    eyeColor: 'natural',
    morphs: { ...DEFAULT_MORPHS },
    accessories: {
      hair: null,
      facialHair: null,
      mask: null,
      hood: null,
      chain: null,
      gloves: null,
      wristbands: null,
      shoes: null,
    },
    facePaint: null,
    paint: {},
    addon: 'none',
  };
}

/** True when the build changes anything from the authored look. */
export function buildIsCustomized(b: CustomBuild): boolean {
  if (b.eyeColor !== 'natural') return true;
  if (b.facePaint) return true;
  if (b.addon !== 'none') return true;
  if (Object.keys(b.paint).length > 0) return true;
  if ((Object.values(b.accessories) as (string | null)[]).some((v) => v)) return true;
  return (Object.keys(DEFAULT_MORPHS) as MorphKey[]).some(
    (k) => Math.abs(b.morphs[k] - 0.5) > 1e-6,
  );
}

/**
 * What the live preview reports about the loaded model: which suite systems
 * the model actually supports. The panel enables/disables sections from
 * this — honest gating, never fake controls.
 */
export interface ModelAnalysis {
  /** Dedicated iris material found (eye palette usable). */
  eyeSupport: boolean;
  /** Morph dials that found bones. */
  morphs: MorphKey[];
  /** Verified face-paint profile for this fighter. */
  facePaint: boolean;
}
