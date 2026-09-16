# Skeletal animation pipeline (what that tearing is called)

This is the conversation you could not find. Logged so every agent can find it.

## The umbrella term

**Skeletal animation pipeline** / **character deformation**.

It is the math between the static mesh (skin) and the animation data (bones moving).

| What you see | Name | Cause |
|---|---|---|
| Torso floating, limbs detached | **Skeleton desync / bind-matrix corruption** | Clone without `SkeletonUtils`, or runtime re-rig fighting the GLB |
| Joints twisted the wrong way | **Transform-space mismatch / retarget error** | Local bone rotation mixed with world facing |
| Spikes / stretched skin | **Weight-paint failure** | Vertex weighted to the wrong bone, or >4 influences (WebGL cap) |
| Body parts vanish mid-punch | **Frustum culling** | Engine hides a mesh whose root AABB left the camera |

## How Tekken / Schwarzerblitz / Night Sky do it

They do **not** re-rig in the game engine. Bind pose is baked in Blender/DCC.

1. **Immutable bind pose** — bone hierarchy is a constant.
2. **Dumb meshes** — skin follows weights. No thinking.
3. **Mixer → bones → skin** — combat state only talks to the skeleton.

Brutal Fist law (`CharacterPipeline.ts`):

- The **only** allowed skeleton op is `SkeletonUtils.clone(gltf.scene)`.
- Do not rewrite weights, bind matrices, or joints at runtime.
- `frustumCulled = false` on every SkinnedMesh.
- Mixer targets the **cloned scene root**.
- Facing is an outer-group rotation, never a bone hack.

4-bone limit and Normalize All belong in the **GLB export**, not in React.
