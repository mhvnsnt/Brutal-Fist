# Character Customizer — Brutal-Fist appearance suite

The in-menu character customization system, ported from the AshLanev2
7-item suite (Phase 2, Track 1 — shared "MDickie variants" universe: same
models, same characters, same canon). It lives **inside the character
select screen** — extending the existing attire strip + paint/add-on bars,
not a parallel menu — and applies live to the 3D portrait preview
(`CharacterPortrait3D`) and into fights (`FighterMesh` via `CombatArena3D`).

## Player flow

1. Character select → pick a fighter (P1/P2 portrait column).
2. Below the existing PAINT / ADD-ON bar, open **APPEARANCE**.
3. Change eyes, face paint, gear, body — every control applies to the live
   3D portrait instantly.
4. **SAVE BUILD** persists it per fighter (localStorage, versioned).
   **RESET** restores the authored look. Saved builds auto-load on select
   and ride into the fight on FIGHT!.

## PS1 budget (intentional look — do not "upgrade")

Brutal-Fist's PS1 look is deliberate (render profile: 320×240, vertex snap,
nearest filtering, 256px textures). Every suite asset respects it:

- **Accessories are procedural builders** (`accessories.ts`) — a handful of
  boxes/cones/spheres, flat-shaded, parented to bones like the existing
  visor/mouthplate/wristtape add-ons. No hi-res GLB imports, nothing to
  decimate; the budget is PS1 by construction.
- **Eye iris textures** are 256px procedural canvases (match the profile's
  textureSize).
- **Face-paint decal** paints at 512px (pattern PNGs are small white-alpha
  sprites, tinted at paint time).

## Modules (`src/engine/customization/`)

| File | Owns |
|---|---|
| `types.ts` | `CustomBuild` schema, accessory defs, morph/eye types, `ModelAnalysis` |
| `eyeColors.ts` | Iris palette + procedural iris textures + material application |
| `morphs.ts` | Procedural bone-scale morphs (muscle / height / build / jaw) |
| `accessories.ts` | `PSX_ACCESSORIES` manifest + procedural builders + bone attach |
| `facepaintAdapter.ts` | Bridge to the paint module (real contract, `./facepaint/index.ts`) |
| `facepaint/` | Decal-based layered face paint (decal/painter/patterns/presets/profiles/regions/picker) |
| `persistence.ts` | Versioned save/load of builds (`brutalfist:customizer:builds`) |
| `applyBuild.ts` | Single entry point: applies a full build to a live character root |

`src/components/AppearancePanel.tsx` is the select-screen UI. `CharacterSelect`
owns the per-slot build state; `CharacterPortrait3D` applies it live
(`appearance` prop) and reports the `ModelAnalysis`; `FighterMesh` applies it
fight-side (`customBuild` prop via `CombatArena3D`).

## The 7 suite items

1. **Chain pendant orientation fix** — `pendantRotation` (degrees XYZ) on each
   chain def in `accessories.ts`: rotates the pendant sub-mesh before it
   hangs, so the pendant faces forward-down on the cast's Mixamo necks.
   Per-chain tuning knob, same concept as the AshLanev2 chain lane.
2. **Masks** — `mask_eyeband` (domino band), `mask_plate` (face plate with eye
   slit). No canon flags: none reproduce a canon likeness (Hollow's Super
   Dragon mask is NOT these — never badge them canon).
3. **Gloves / wrist pads / shoes / hoods** — boxing + MMA gloves, wrist tape +
   spiked bands, combat + wrestling boots (L/R pairs), hood-up. All
   procedural, bone-parented.
4. **Face paint system** — decal-mesh layered paint (`facepaint/`), 12
   patterns, 6 regions, per-layer color/opacity, erase blend. Canon presets
   `cipher-grin` / `onyx-clown` / `echo-stitched` (locked 🔒, same canon as
   AshLanev2) + custom layer builder. Per-fighter profiles gate availability
   honestly; base skin is never written (skin-tone lock is structural).
5. **Hairstyles** — flat-top, mohawk, dreads, buzz, long. Procedural,
   head-bone parented.
6. **Eye color customization** — 12-color iris palette via cloned iris
   materials + procedural iris textures. **Cast survey 2026-10-09: no
   dedicated iris material on any current model** (single-material GLBs bake
   eyes into the body texture; Maime's 15 materials have none either) — the
   palette disables with an honest note, never a skin tint. The system stays
   wired for future iris-material models.
7. **Full in-menu customizer with live preview** — the APPEARANCE section in
   the select screen, live on the existing 3D portrait (idle-animated bust),
   with save/reset and fight-side application.

## Morphs

Procedural bone scaling (the cast ships zero morph targets). Patterns are
tuned for the cast's Mixamo rigs (`mixamorig:` and packed `mixamorigX`
forms); `supportedMorphs()` enables only dials that found bones, so the jaw
dial (no jaw bone on Mixamo rigs) stays honestly disabled. Applies reset to
base first (idempotent, never stacks); the applier re-grounds feet to the
pre-morph floor plane dynamically — never a hardcoded per-character offset
(AGENTS.md LAW 2).

## Skin-tone likeness lock (binding)

- Paint exists only on the decal mesh + its own canvas texture. The
  character's base mesh/material/texture are never written.
- Eye colors touch only dedicated iris materials (none on the current cast).
- Part paint multiplies authored albedo (the pre-existing system); it never
  recolors skin regions — cloth/metal slots only.

## Gender / canon locks (binding)

- Never invent characters, names, factions, or based-on relationships.
- Pronouns: `src/data/canonPronouns.ts` is authoritative (Maime is he/him).
- Canon presets are locked — custom paint is built from layers, never by
  editing presets.

## QC checklist

- [ ] `npm run typecheck` passes; `vite build` passes.
- [ ] APPEARANCE section renders in both P1/P2 columns; opens/closes.
- [ ] Live preview: accessories attach at the right bones with no clipping
      (hair/mask/hood on head, chain on neck w/ pendant forward-down,
      gloves on hands, wristbands on forearms, boots on feet).
- [ ] Face paint: all 3 canon presets render on cipher/onyx/echo; custom
      layers apply; CLEAR hides paint; base skin pixels unchanged.
- [ ] Morph sliders offered only for detected bones; muscle visibly thickens
      arms; feet stay planted.
- [ ] Eye palette honestly disabled on the current cast (baked eyes).
- [ ] Save → reselect → build restores; Reset → authored look.
- [ ] FIGHT! carries the build into the arena (FighterMesh applies it).
- [ ] PS1 look preserved: accessories read as low-poly at 320×240.
