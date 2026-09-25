# Open source used by Brutal Fist

Libraries in this repo, and the stubs they are not allowed to paper over.

## Libraries

| Package | Where | What it actually does |
|---|---|---|
| `three` | combat, select | Skinned meshes, materials, bone-parented add-ons |
| `@react-three/fiber` `@react-three/drei` | scenes | Canvas and GLTF load (meshopt + draco on) |
| `meshoptimizer` | `scripts/audit-rigs.mjs` | Decodes `EXT_meshopt_compression` so joint and weight counts are real |
| `@gltf-transform/core` `@gltf-transform/extensions` `@gltf-transform/functions` | `scripts/audit-rigs.mjs` | Reads skins, inverse binds, and weight sums. Does not rewrite a GLB unless weights are off |
| `culori` | `src/engine/render/paintMath.ts` | OKLCH lightness floor so a paint swatch tints cloth instead of crushing it black |

## Paint and add-ons (measured)

- Maime’s skinned GLBs are named parts: legs, torso, head, arms, boots. Those chunks can be tinted separately. He is male. Jeans and Tattered are the only two playable outfits.
- Every other playable fighter is **one mesh and one texture**. Cloth paint multiplies dark saturated pixels. Metal paint shifts low-saturation gray (mask, chains). Skin highlights are left alone. This is not a new garment.
- Visor, mouth plate, and wrist tape are boxes parented to the head or hand bones. They are not costumes and they are not in the Bannon GLBs.
- A different mask that already exists is an attire: Titan Unmasked, Jager Beard. Unskinned files are still not wearable.

## Stubs — do not treat these as done

| Stub | Status |
|---|---|
| `FighterMesh` `tint` | Passed faction color and never applied. Still not applied. A faction wash would dye the whole atlas. Use `paint`. |
| Procedural clips in `BannonClipJsonAdapter` | `TEST_ONLY` placeholders. Combat plays the authored `/public/motion` bank. |
| `src/lib/supabase/client.ts` | Offline stub. Ranked cloud is not wired. Auth stays off. |
| `BANNON_GLB_SOURCE_INVENTORY` incoming files | Evidence only. Not playable until a skinned sibling exists. |
| Weight rewrite at runtime | Forbidden. `CharacterPipeline` does not call `normalizeSkinWeights`. The auditor found 0 vertices off by more than 0.02. |
| Separate clothes, hats, or swappable masks inside a single atlas | Not in the files. Do not invent a mesh and call it a Bannon attire. |
