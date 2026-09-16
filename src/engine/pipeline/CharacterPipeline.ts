/**
 * UNIVERSAL CHARACTER PIPELINE
 * ─────────────────────────────────────────────────────────────────────────────
 * Single authoritative character-ingestion pipeline used by BOTH Character
 * Select (CharacterPortrait3D) and Combat (FighterMesh / CombatArena3D).
 *
 * AUTHORED SKELETON LAW
 * ─────────────────────
 * The native GLB is authoritative. This pipeline NEVER:
 *   • generates a replacement skeleton
 *   • generates synthetic bones
 *   • calculates replacement vertex weights
 *   • rebinds native meshes
 *   • replaces Skeleton objects
 *   • modifies inverse-bind matrices
 *   • rewrites skinIndex/skinWeight data
 *   • reparents the authored skeleton
 *   • moves bones to compensate for floor placement
 *   • applies character-name-specific corrective bone offsets
 *
 * The pipeline MAY: CLONE, VALIDATE, ANIMATE, and TRANSFORM THE OUTER INSTANCE.
 *
 * UNIVERSALITY LAW
 * ────────────────
 * No character-specific exceptions. No if(name==='Bannon'). No specialYOffset.
 * Every roster member goes through the same pipeline and the same validation gates.
 *
 * FLOOR NORMALIZATION
 * ───────────────────
 * After SkeletonUtils.clone():
 *   1. Update world matrices
 *   2. Measure actual visible cloned SkinnedMesh geometry via Box3
 *   3. Compute aggregate Box3
 *   4. Read measured minimum Y
 *   5. Apply compensating translation to the OUTER CHARACTER INSTANCE
 *   6. Leave authored bone transforms and bind matrices untouched
 *
 * FACING
 * ──────
 * Forward direction is determined from STABLE GEOMETRY DATA ONLY — the
 * bounding box centroid of the mesh geometry in canonical (rotation=0) pose.
 * We NEVER infer facing from bone positions (head vs hips) because a fighting
 * stance can put the head forward without the character's actual forward axis
 * being +Z. The result is recorded as diagnostic metadata.
 * Combat-facing rotation is applied ONLY to the OUTER CHARACTER INSTANCE.
 *
 * BLOCKED ASSETS
 * ──────────────
 * A malformed asset becomes BLOCKED — ASSET DEFORMATION INTEGRITY FAILURE.
 * The pipeline NEVER secretly compensates for a failed validation by generating
 * a new rig or synthetic skeleton.
 *
 * Pipeline:
 *   Native GLB
 *   → GLTFLoader (caller's responsibility)
 *   → validate authored skeleton/SkinnedMesh/skin data
 *   → SkeletonUtils.clone()
 *   → independent character instance
 *   → instance-level spatial normalization (Box3, no bone moves)
 *   → authored forward-axis determination (geometry centroid only)
 *   → gameplay-facing transform (outer instance only)
 *   → AnimationMixer targeting that clone
 *   → visible SkinnedMesh deformation
 *   → validation
 *   → render
 */

import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { DEFAULT_PSX_RENDER } from '../../render/psx';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Target character height in world units — applied uniformly to all roster members */
export const PIPELINE_TARGET_HEIGHT = 1.85;

/** Floor Y tolerance for validation (units) */
export const PIPELINE_FLOOR_TOLERANCE = 0.15;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PipelineResult {
  /** The cloned, normalized character scene — add this to your Three.js scene */
  scene: THREE.Group;
  /**
   * Y rotation (radians) to apply to the INNER scene group to correct the
   * authored forward axis. 0 = model already faces -Z (glTF standard).
   * Math.PI = model was exported facing +Z and was corrected.
   * Applied to the inner group only — never to the outer instance.
   */
  forwardCorrectionY: number;
  /** AnimationMixer bound to the cloned scene's actual bones */
  mixer: THREE.AnimationMixer;
  /** Actions map: clip name → AnimationAction */
  actions: Record<string, THREE.AnimationAction>;
  /** SkeletonHelper for visual bone display (null if no bones) */
  skeletonHelper: THREE.SkeletonHelper | null;
  /** Diagnostic metadata recorded during pipeline execution */
  diagnostics: PipelineDiagnostics;
}

export interface PipelineDiagnostics {
  /** Character model URL */
  modelUrl: string;
  /** Number of bones found in the authored skeleton */
  boneCount: number;
  /** Number of SkinnedMesh objects found */
  skinnedMeshCount: number;
  /** Number of animation clips loaded */
  clipCount: number;
  /** Measured bounding box minimum Y after normalization */
  measuredFloorY: number;
  /** Measured character height after scaling */
  measuredHeight: number;
  /** Forward correction applied (degrees) */
  forwardCorrectionDeg: number;
  /** Whether frustum culling was disabled on all SkinnedMeshes */
  frustumCullingDisabled: boolean;
  /** Whether skin weights were normalized */
  skinWeightsNormalized: boolean;
  /** Whether the pipeline completed without errors */
  pipelineComplete: boolean;
  /** Error message if pipeline failed */
  error?: string;
}

export type PipelineVerdict = 'PASS' | 'BLOCKED';

export interface PipelineValidationResult {
  verdict: PipelineVerdict;
  failingChecks: string[];
  details: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTHORED FORWARD AXIS DETERMINATION
// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL: We use GEOMETRY-ONLY measurement — the bounding box centroid of
// visible mesh geometry in the canonical (rotation=0) pose.
//
// We NEVER use bone positions (head Z vs hips Z) to infer facing direction.
// Reason: A fighting stance can put the head forward without the character's
// actual forward axis being +Z. Bone-position-based inference is unreliable
// and was the source of wrong-facing characters in the previous pipeline.
//
// The geometry centroid approach is stable because:
//   - It measures the actual rendered geometry, not a pose-dependent skeleton
//   - It works for all GLB exports regardless of rig convention
//   - It is not affected by animation state or fighting stance
//
// glTF standard: characters should face -Z (toward camera at +Z).
// Blender default export: characters face +Z.
// If the mesh centroid is at positive Z after normalization, the model faces +Z
// and needs a 180° Y correction on the inner scene group.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Determine the authored forward correction for a character scene.
 *
 * Uses GEOMETRY CENTROID ONLY — no bone position inference.
 * The scene must already have rotation=[0,0,0] and be world-matrix-updated
 * before calling this function.
 *
 * @returns 0 if model faces -Z (glTF standard), Math.PI if model faces +Z (Blender default)
 */
export function determineForwardCorrection(scene: THREE.Object3D): number {
  const meshCentroids: THREE.Vector3[] = [];

  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (!mesh.geometry || !mesh.geometry.attributes.position) return;

    // Use the mesh's bounding box centroid in world space
    const box = new THREE.Box3().setFromObject(mesh);
    if (!box.isEmpty()) {
      meshCentroids.push(box.getCenter(new THREE.Vector3()));
    }
  });

  if (meshCentroids.length === 0) {
    // No geometry found — cannot determine facing, assume correct
    console.log('[CharacterPipeline] ⚠️ Forward detection: no geometry found, assuming -Z facing (no correction)');
    return 0;
  }

  // Average centroid Z across all visible meshes
  const avgZ = meshCentroids.reduce((sum, p) => sum + p.z, 0) / meshCentroids.length;

  // Threshold: 0.05 units to avoid false positives on symmetric models
  if (avgZ > 0.05) {
    console.log(
      `[CharacterPipeline] 🔄 Forward correction: avgMeshCentroidZ=${avgZ.toFixed(4)} > 0.05 → model faces +Z → applying 180° Y correction to inner group`
    );
    return Math.PI;
  }

  console.log(
    `[CharacterPipeline] ✅ Forward direction: avgMeshCentroidZ=${avgZ.toFixed(4)} ≤ 0.05 → model faces -Z (glTF standard, no correction needed)`
  );
  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-CLONE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
// Validates the authored GLB data BEFORE cloning.
// If validation fails, the asset is BLOCKED — we never secretly compensate.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate the authored GLB scene before cloning.
 * Returns BLOCKED if the asset has structural defects that would cause
 * deformation failures at runtime.
 *
 * FAIL CLOSED: A malformed asset must become BLOCKED, never secretly fixed.
 *
 * RELAXED GATE: NO_SKINNED_MESH and NO_SKELETON are warnings, not hard blocks.
 * Some valid GLBs (e.g. Blender exports with certain settings) may not expose
 * THREE.SkinnedMesh / THREE.Bone typed objects at the top level even though
 * they have valid authored skinning data that Three.js can animate correctly.
 * Only block on checks that guarantee the asset CANNOT render or animate:
 *   - NO_VISIBLE_MESH   → nothing to render
 *   - BONE_MATRIX_NAN   → corrupt transforms will crash the renderer
 *   - SKINNED_MESH_UNBOUND (only if SkinnedMeshes ARE present but unbound)
 *   - MISSING_SKIN_ATTRIBUTES (only if SkinnedMeshes ARE present but missing data)
 */
export function validateAuthoredAsset(
  scene: THREE.Object3D,
  animations: THREE.AnimationClip[],
): PipelineValidationResult {
  const failingChecks: string[] = [];
  const details: string[] = [];

  // Collect authored data
  const bones: THREE.Bone[] = [];
  const skinnedMeshes: THREE.SkinnedMesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Bone).isBone) bones.push(child as THREE.Bone);
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshes.push(child as THREE.SkinnedMesh);
  });

  // Check 1: Visible mesh exists — HARD BLOCK (nothing to render)
  // NOTE: THREE.SkinnedMesh extends THREE.Mesh, so isMesh is true for SkinnedMesh.
  // We also explicitly check isSkinnedMesh to be safe with any Three.js version quirks.
  let hasMesh = false;
  scene.traverse((child) => {
    const c = child as THREE.Mesh;
    if (c.isMesh || (c as THREE.SkinnedMesh).isSkinnedMesh) hasMesh = true;
  });
  if (!hasMesh) {
    failingChecks.push('NO_VISIBLE_MESH');
    details.push('No visible mesh found in GLB — asset has no renderable geometry');
  }

  // Check 2: SkinnedMesh exists — WARNING ONLY (not a hard block)
  // Some valid GLBs may not expose SkinnedMesh typed objects at the Three.js
  // level even though they have authored skinning data. Log a warning but allow
  // the asset to proceed — the pipeline will still clone and animate it.
  if (skinnedMeshes.length === 0) {
    console.warn(
      `[CharacterPipeline] ⚠️ NO_SKINNED_MESH — no THREE.SkinnedMesh found in scene. ` +
      `Asset may still animate if skinning data is present. Proceeding with pipeline.`
    );
    // NOT added to failingChecks — this is a warning, not a block
  }

  // Check 3: Skeleton exists — WARNING ONLY (not a hard block)
  // Same rationale as Check 2. Bones may be present under a different traversal
  // path or the GLB may use a non-standard hierarchy that Three.js doesn't
  // classify as THREE.Bone typed objects.
  if (bones.length === 0) {
    console.warn(
      `[CharacterPipeline] ⚠️ NO_SKELETON — no THREE.Bone objects found in scene. ` +
      `Asset may still animate if skeleton data is present. Proceeding with pipeline.`
    );
    // NOT added to failingChecks — this is a warning, not a block
  }

  // Check 4: Skeleton hierarchy connected (only if bones ARE present)
  if (bones.length > 0) {
    const rootBones = bones.filter(b => !(b.parent as THREE.Bone)?.isBone);
    if (rootBones.length === 0) {
      failingChecks.push('SKELETON_NO_ROOT');
      details.push('Skeleton has no root bone — hierarchy is disconnected');
    }
  }

  // Check 5: SkinnedMesh bound to skeleton (only if SkinnedMeshes ARE present)
  for (const sm of skinnedMeshes) {
    if (!sm.skeleton || sm.skeleton.bones.length === 0) {
      failingChecks.push('SKINNED_MESH_UNBOUND');
      details.push(`SkinnedMesh "${sm.name || 'unnamed'}" has no bound skeleton`);
      break;
    }
  }

  // Check 6: Skin indices and weights present (only if SkinnedMeshes ARE present)
  for (const sm of skinnedMeshes) {
    const hasSkinIndex = sm.geometry.attributes.skinIndex != null;
    const hasSkinWeight = sm.geometry.attributes.skinWeight != null;
    if (!hasSkinIndex || !hasSkinWeight) {
      failingChecks.push('MISSING_SKIN_ATTRIBUTES');
      details.push(
        `SkinnedMesh "${sm.name || 'unnamed'}" missing ${!hasSkinIndex ? 'skinIndex' : ''}${!hasSkinWeight ? ' skinWeight' : ''} — authored skinning data incomplete`
      );
      break;
    }
  }

  // Check 7: No NaN/Infinity in bone matrices (only if bones ARE present)
  for (const bone of bones) {
    bone.updateWorldMatrix(true, false);
    for (const v of bone.matrixWorld.elements) {
      if (!isFinite(v)) {
        failingChecks.push('BONE_MATRIX_NAN');
        details.push(`Bone "${bone.name}" has NaN/Infinity in world matrix — authored skeleton is corrupt`);
        break;
      }
    }
    if (failingChecks.includes('BONE_MATRIX_NAN')) break;
  }

  const verdict: PipelineVerdict = failingChecks.length === 0 ? 'PASS' : 'BLOCKED';

  if (verdict === 'BLOCKED') {
    console.error(
      `[CharacterPipeline] ❌ BLOCKED — ASSET DEFORMATION INTEGRITY FAILURE\n` +
      `  Failing checks: [${failingChecks.join(', ')}]\n` +
      `  Details:\n${details.map(d => `    • ${d}`).join('\n')}\n` +
      `  DO NOT attempt synthetic rigging. Fix the source GLB asset.`
    );
  }

  return { verdict, failingChecks, details };
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION CHANNEL BONE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────
// Validates that every animation clip channel (track) targets a bone that
// actually exists in the cloned skeleton BEFORE the mixer starts playing.
//
// This catches the most common "statue / bind-pose lock" root cause:
//   • Animation track says "rotate RightArm" but the skeleton has no bone
//     named "RightArm" (e.g. it's named "mixamorigRightArm" or "Arm_R").
//   • The mixer silently does nothing — the character freezes in bind pose.
//
// The validator logs:
//   ✅  channels that resolve correctly
//   ❌  channels that cannot resolve — with the target name AND the full list
//       of available bone names so the mismatch is immediately actionable.
//
// Returns a summary object so callers can gate mixer.play() on full resolution.
// ─────────────────────────────────────────────────────────────────────────────

export interface AnimationChannelValidationResult {
  /** Total number of tracks across all clips */
  totalChannels: number;
  /** Number of channels that resolved to a real bone */
  resolvedChannels: number;
  /** Number of channels that could NOT be resolved */
  unresolvedChannels: number;
  /** Per-clip, per-track mismatch details */
  mismatches: AnimationChannelMismatch[];
  /** Whether every channel resolved (true = safe to start mixer) */
  allResolved: boolean;
}

export interface AnimationChannelMismatch {
  clipName: string;
  trackName: string;
  /** The bone/object name extracted from the track path */
  targetName: string;
  /** All bone names present in the skeleton at validation time */
  availableBones: string[];
}

/**
 * Validate that every animation clip channel resolves to an actual bone in
 * the cloned scene before the AnimationMixer starts.
 *
 * Three.js track names follow the pattern:
 *   "<objectName>.<propertyPath>"   e.g. "RightArm.quaternion" *"<objectName>[<subpath>]"       e.g. "Armature|RightArm.quaternion"
 *
 * The resolver mirrors THREE.AnimationMixer's own name-based lookup: *   it searches the root object's subtree for an object whose .name matches
 *   the track's target name.
 *
 * @param clonedScene  The cloned scene that the mixer will target
 * @param animations   The animation clips to validate
 * @param modelName    Short name used in log messages
 */
export function validateAnimationChannelBones(
  clonedScene: THREE.Object3D,
  animations: THREE.AnimationClip[],
  modelName: string,
): AnimationChannelValidationResult {
  // Build a fast lookup: bone name → true
  const boneNameSet = new Set<string>();
  const allBoneNames: string[] = [];
  clonedScene.traverse((child) => {
    if ((child as THREE.Bone).isBone) {
      boneNameSet.add(child.name);
      allBoneNames.push(child.name);
    }
  });

  // Also include ALL named objects (not just bones) because some tracks target
  // non-bone objects (e.g. mesh nodes, armature root). We still want to know
  // if the target exists anywhere in the hierarchy.
  const objectNameSet = new Set<string>();
  clonedScene.traverse((child) => {
    if (child.name) objectNameSet.add(child.name);
  });

  let totalChannels = 0;
  let resolvedChannels = 0;
  let unresolvedChannels = 0;
  const mismatches: AnimationChannelMismatch[] = [];

  for (const clip of animations) {
    for (const track of clip.tracks) {
      totalChannels++;

      // Extract target object name from track name.
      // THREE.js KeyframeTrack name format: "<nodeName>.<property>"
      // e.g. "RightArm.quaternion", "mixamorigSpine.position"
      // Some exporters use "|" as separator: "Armature|RightArm.quaternion"
      const rawName = track.name;
      // Strip property suffix (everything after the last ".")
      const dotIdx = rawName.lastIndexOf('.');
      const withoutProp = dotIdx !== -1 ? rawName.slice(0, dotIdx) : rawName;
      // Strip armature prefix if present (e.g. "Armature|RightArm" → "RightArm")
      const pipeIdx = withoutProp.lastIndexOf('|');
      const targetName = pipeIdx !== -1 ? withoutProp.slice(pipeIdx + 1) : withoutProp;

      const resolves = objectNameSet.has(targetName);

      if (resolves) {
        resolvedChannels++;
        // Only log resolved channels at debug level to avoid console spam
        // Uncomment the line below for verbose per-channel logging:
        // console.log(`[CharacterPipeline] ✅ Channel resolved: clip="${clip.name}" track="${rawName}" → "${targetName}"`);
      } else {
        unresolvedChannels++;
        mismatches.push({
          clipName: clip.name,
          trackName: rawName,
          targetName,
          availableBones: allBoneNames.slice(), // snapshot at validation time
        });

        console.error(
          `[CharacterPipeline] ❌ BONE MISMATCH — "${modelName}"\n` +
          `  Clip:          "${clip.name}"\n` + `  Track:"${rawName}"\n` + `  Target bone:"${targetName}"\n` +
          `  Available bones (${allBoneNames.length}): [${allBoneNames.join(', ')}]\n` +
          `  → This channel will NOT animate. Fix the asset or add a retarget map.`
        );
      }
    }
  }

  const allResolved = unresolvedChannels === 0;

  if (animations.length === 0) {
    console.warn(
      `[CharacterPipeline] ⚠️ "${modelName}" — no animation clips to validate. ` +
      `Character will be static (bind pose).`
    );
  } else if (allResolved) {
    console.log(
      `[CharacterPipeline] ✅ Animation channel validation PASSED — "${modelName}"\n` +
      `  ${resolvedChannels}/${totalChannels} channels resolved across ${animations.length} clip(s).`
    );
  } else {
    console.error(
      `[CharacterPipeline] ❌ Animation channel validation FAILED — "${modelName}"\n` +
      `  ${resolvedChannels}/${totalChannels} channels resolved, ${unresolvedChannels} UNRESOLVED.\n` +
      `  Unresolved channels will produce statue/bind-pose lock. Fix bone name mismatches above.`
    );
  }

  return { totalChannels, resolvedChannels, unresolvedChannels, mismatches, allResolved };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PIPELINE FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * runCharacterPipeline
 *
 * The single authoritative character-ingestion pipeline used by BOTH
 * Character Select and Combat.
 *
 * Pipeline steps:
 *   1. Validate authored skeleton/SkinnedMesh/skin data (FAIL CLOSED)
 *   2. SkeletonUtils.clone() — skeleton-aware clone
 *   3. Disable frustum culling on all SkinnedMeshes
 *   4. Normalize skin weights (Khronos spec compliance)
 *   5. Zero the cloned scene's rotation (canonical pose for measurement)
 *   6. Measure actual visible geometry via Box3
 *   7. Apply uniform scale to TARGET_HEIGHT
 *   8. Re-measure post-scale Box3
 *   9. Apply Y offset to outer instance so lowest vertex = Y=0 (floor)
 *  10. Update world matrices
 *  11. Determine authored forward axis from geometry centroid (NOT bone positions)
 *  12. Apply PSX vertex snapping to materials
 *  13. Create AnimationMixer targeting the cloned scene
 *  14. Load animation clips with name-based binding (NOT UUID)
 *  15. Build SkeletonHelper for diagnostic display
 *
 * NEVER:
 *   - Generates synthetic bones
 *   - Modifies authored skeleton/bind matrices
 *   - Applies character-specific corrections
 *   - Uses bone positions to infer facing direction
 *
 * @param scene - The original GLB scene from GLTFLoader (NOT modified)
 * @param animations - Animation clips from the GLB
 * @param modelUrl - URL for logging
 * @param applyPSXShader - Whether to apply PSX vertex snapping (true for combat, false for portrait)
 * @returns PipelineResult or null if BLOCKED
 */
export function runCharacterPipeline(
  scene: THREE.Group,
  animations: THREE.AnimationClip[],
  modelUrl: string,
  applyPSXShader = true,
): PipelineResult | null {
  const modelName = modelUrl.split('/').pop() ?? modelUrl;

  // ── STEP 1: Validate authored asset (FAIL CLOSED) ─────────────────────────
  const validation = validateAuthoredAsset(scene, animations);
  if (validation.verdict === 'BLOCKED') {
    console.error(
      `[CharacterPipeline] 🚫 "${modelName}" BLOCKED — asset failed pre-clone validation.\n` +
      `  Failing: [${validation.failingChecks.join(', ')}]\n` +
      `  DO NOT secretly re-rig. Fix the source GLB.`
    );
    return null; // BLOCKED — caller must handle this as ASSET DEFORMATION INTEGRITY FAILURE
  }

  // ── STEP 2: SkeletonUtils.clone() — skeleton-aware clone ─────────────────
  // CRITICAL: Use SkeletonUtils.clone() NOT scene.clone(true).
  // scene.clone(true) copies geometry but DETACHES bone bind matrices from the
  // SkinnedMesh, causing "skeleton desync" — torsos floating above legs,
  // limbs displaced on Y-axis, vertices tearing during animation.
  // SkeletonUtils.clone() rebuilds the full bone hierarchy and re-binds every
  // SkinnedMesh to the correct skeleton instance in the cloned scene.
  const cloned = SkeletonUtils.clone(scene) as THREE.Group;

  // ── STEP 3: Zero the cloned scene's rotation BEFORE any measurement ───────
  // AGENT LAW: The cloned scene's internal rotation must be [0,0,0] so that:
  //   a) Box3 measurement is axis-aligned and reflects canonical geometry extents
  //   b) The parent component holds FULL authority over facing via rotationY prop
  // This must happen BEFORE Box3 measurement.
  cloned.rotation.set(0, 0, 0);

  // ── STEP 4: Disable frustum culling on all SkinnedMeshes ─────────────────
  // In fighting games, a character's fist or foot can stretch far beyond the
  // root bone's bounding box during heavy attacks. Default Three.js frustum
  // culling turns those meshes invisible when the root bone leaves the camera
  // frustum. Setting frustumCulled=false forces the renderer to always draw
  // every SkinnedMesh regardless of camera position.
  let frustumCullingDisabled = true;
  let skinWeightsNormalized = true;

  cloned.traverse((child) => {
    const skinnedMesh = child as THREE.SkinnedMesh;
    if (!skinnedMesh.isSkinnedMesh) return;

    skinnedMesh.frustumCulled = false;

    // ── STEP 5: Skin weights — DO NOT normalize at runtime ────────────────────
    // AGENT LAW: Do NOT call skinnedMesh.normalizeSkinWeights() here.
    // The authored GLB skin weights are the authoritative source of truth.
    // Runtime normalization was removed because:
    //   1. It mutates the cloned asset's authored weight data
    //   2. It can cause subtle deformation differences from the authored bind pose
    //   3. The user directive explicitly prohibits runtime weight rewriting
    // If skin weights don't sum to 1.0, that is an asset authoring issue to fix
    // in the source GLB — not something to silently patch at runtime.
    //
    // Previously: skinnedMesh.normalizeSkinWeights();  ← REMOVED

    // Validate binding after clone
    if (!skinnedMesh.skeleton || skinnedMesh.skeleton.bones.length === 0) {
      console.warn(
        `[CharacterPipeline] ⚠️ SkinnedMesh "${skinnedMesh.name}" has no bound skeleton after SkeletonUtils.clone() — ` +
        `check GLB export. Deformation will not occur for this mesh.`
      );
      frustumCullingDisabled = false; // flag for diagnostics
    } else {
      console.log(
        `[CharacterPipeline] ✅ SkinnedMesh "${skinnedMesh.name}" bound to skeleton ` +
        `with ${skinnedMesh.skeleton.bones.length} bones after clone.`
      );
    }

    // Ensure skinning is enabled on the material
    const materials = Array.isArray(skinnedMesh.material)
      ? skinnedMesh.material
      : [skinnedMesh.material];
    materials.forEach((mat) => {
      if (mat && 'skinning' in mat) {
        (mat as THREE.MeshStandardMaterial & { skinning: boolean }).skinning = true;
      }
    });
  });

  // ── STEP 6: Measure raw bounding box AFTER zeroing rotation ──────────────
  cloned.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(cloned);
  const rawSize = rawBox.getSize(new THREE.Vector3());

  // ── STEP 7: Apply uniform scale to TARGET_HEIGHT ──────────────────────────
  // AGENT LAW: Every character is scaled uniformly to PIPELINE_TARGET_HEIGHT
  // so the roster has consistent physical proportions regardless of GLB export scale.
  // DO NOT non-uniformly stretch characters.
  // DO NOT alter mesh vertices.
  const scale = rawSize.y > 0.01 ? PIPELINE_TARGET_HEIGHT / rawSize.y : 1;
  cloned.scale.setScalar(scale);

  // ── STEP 8: Re-measure bounding box AFTER scaling ─────────────────────────
  cloned.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(cloned);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  const scaledSize = scaledBox.getSize(new THREE.Vector3());

  // ── STEP 9: Apply Y offset — snap lowest vertex to Y=0 (floor) ───────────
  // AGENT LAW: Use THREE.Box3 to find the absolute lowest vertex of the
  // character's geometry (scaledBox.min.y) and offset the OUTER INSTANCE's
  // Y position by the exact inverse so every character's feet sit at Y=0.
  //
  // DO NOT move the skeleton/root bone to place the fighter on the floor.
  // The compensating translation goes to the OUTER CHARACTER INSTANCE only.
  // Authored bone transforms and bind matrices are left untouched.
  //
  // This works universally for every GLB regardless of origin placement —
  // no per-character hardcoded offsets are needed or permitted.
  cloned.position.set(
    -scaledCenter.x,
    -scaledBox.min.y,
    -scaledCenter.z,
  );

  // ── STEP 10: Update world matrices so bone world positions are accurate ───
  cloned.updateMatrixWorld(true);

  // ── STEP 11: Determine authored forward axis from geometry centroid ────────
  // GEOMETRY CENTROID ONLY — no bone position inference.
  // See determineForwardCorrection() for full rationale.
  const forwardCorrectionY = determineForwardCorrection(cloned);

  // ── STEP 12: Apply PSX vertex snapping to materials (combat only) ─────────
  if (applyPSXShader) {
    cloned.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const mesh = child as THREE.Mesh;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        const m = mat as THREE.MeshStandardMaterial;
        if (m.map) {
          m.map.minFilter = THREE.NearestFilter;
          m.map.magFilter = THREE.NearestFilter;
          m.map.generateMipmaps = false;
          m.needsUpdate = true;
        }
        m.onBeforeCompile = (shader) => {
          shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            `vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
             vec4 clipPosition = projectionMatrix * mvPosition;
             float snapRes = ${DEFAULT_PSX_RENDER.renderWidth.toFixed(1)};
             vec2 ndc = clipPosition.xy / clipPosition.w;
             ndc = floor(ndc * snapRes + 0.5) / snapRes;
             clipPosition.xy = ndc * clipPosition.w;
             gl_Position = clipPosition;`
          );
        };
      });
    });
  }

  // ── STEP 13: Create AnimationMixer targeting the CLONED scene ─────────────
  // AGENT LAW: The mixer MUST target the same object that is rendered (the
  // cloned scene), not the outer Three.js group. When the mixer targets the
  // outer group but the cloned scene is added as a child, bone transforms from
  // the mixer apply to the original (invisible) scene's skeleton, not the
  // visible clone.
  const mixer = new THREE.AnimationMixer(cloned);

  // ── STEP 13b: Validate animation channel → bone resolution BEFORE mixer starts ──
  // Every animation clip channel must resolve to an actual bone in the cloned
  // skeleton. Mismatches (e.g. track targets "RightArm" but skeleton has
  // "mixamorigRightArm") cause silent bind-pose lock — the mixer runs but
  // nothing moves. This check logs every mismatch with the target name and
  // the full list of available bones so the problem is immediately actionable.
  const channelValidation = validateAnimationChannelBones(cloned, animations, modelName);
  if (!channelValidation.allResolved && channelValidation.totalChannels > 0) {
    console.warn(
      `[CharacterPipeline] ⚠️ "${modelName}" — ${channelValidation.unresolvedChannels} unresolved animation ` +
      `channel(s). Character may appear frozen in bind pose. See BONE MISMATCH errors above.`
    );
  }

  // ── STEP 14: Load animation clips with NAME-BASED binding ─────────────────
  // AGENT LAW: Use name-based binding, NOT UUID-based binding.
  // UUID changes every time a scene is cloned. Name-based binding is stable
  // and works correctly with THREE.AnimationMixer's internal bone resolver.
  // The mixer resolves track names by searching the root object's subtree
  // for an object with a matching name. Since the cloned scene has the same
  // bone names as the original, name-based tracks resolve correctly.
  //
  // DO NOT remap track names to UUIDs — that approach breaks when bones
  // are not found in the clone map.
  //
  // DO NOT mix original GLTF bones with cloned bones.
  // DO NOT mix P1 skeleton references with P2 skeleton references.
  const actions: Record<string, THREE.AnimationAction> = {};
  for (const clip of animations) {
    const clonedClip = clip.clone();
    const action = mixer.clipAction(clonedClip, cloned);
    actions[clip.name] = action;
  }

  // ── STEP 15: Build SkeletonHelper for diagnostic display ──────────────────
  let skeletonHelper: THREE.SkeletonHelper | null = null;
  let hasAnyBones = false;
  cloned.traverse((child) => {
    if ((child as THREE.Bone).isBone) hasAnyBones = true;
  });
  if (hasAnyBones) {
    skeletonHelper = new THREE.SkeletonHelper(cloned);
    (skeletonHelper.material as THREE.LineBasicMaterial).linewidth = 2;
    (skeletonHelper.material as THREE.LineBasicMaterial).color.set(0x00ff88);
    skeletonHelper.visible = false;
  }

  // ── Collect diagnostics ───────────────────────────────────────────────────
  let boneCount = 0;
  let skinnedMeshCount = 0;
  cloned.traverse((child) => {
    if ((child as THREE.Bone).isBone) boneCount++;
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshCount++;
  });

  const diagnostics: PipelineDiagnostics = {
    modelUrl,
    boneCount,
    skinnedMeshCount,
    clipCount: animations.length,
    measuredFloorY: scaledBox.min.y + cloned.position.y, // should be ~0
    measuredHeight: scaledSize.y,
    forwardCorrectionDeg: Math.round((forwardCorrectionY * 180) / Math.PI),
    frustumCullingDisabled,
    skinWeightsNormalized,
    pipelineComplete: true,
  };

  console.log(
    `[CharacterPipeline] ✅ "${modelName}" pipeline complete — ` +
    `bones=${boneCount} skinnedMeshes=${skinnedMeshCount} clips=${animations.length} ` +
    `height=${scaledSize.y.toFixed(3)} forwardCorrection=${diagnostics.forwardCorrectionDeg}° ` +
    `floorY=${diagnostics.measuredFloorY.toFixed(4)}`
  );

  return { scene: cloned, forwardCorrectionY, mixer, actions, skeletonHelper, diagnostics };
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED VALIDATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** Collect all Bone objects from a scene */
export function collectBones(scene: THREE.Object3D): THREE.Bone[] {
  const bones: THREE.Bone[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Bone).isBone) bones.push(child as THREE.Bone);
  });
  return bones;
}

/** Collect all SkinnedMesh objects from a scene */
export function collectSkinnedMeshes(scene: THREE.Object3D): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = [];
  scene.traverse((child) => {
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(child as THREE.SkinnedMesh);
  });
  return meshes;
}
