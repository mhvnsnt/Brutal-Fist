/**
 * AutoRigDetector — Open-source rigging utility for GLB models
 *
 * Detects whether a GLB model has a valid humanoid rig and provides
 * diagnostic information + auto-correction where possible.
 *
 * Supports:
 *   - Mixamo rigs (mixamorigXxx naming)
 *   - Rigify rigs (DEF-xxx naming)
 *   - Blender default humanoid (Armature > Bone naming)
 *   - Custom rigs (fuzzy name matching)
 *   - T-pose detection (checks if model is in bind pose)
 *   - Root bone floor-zero validation
 *   - Procedural synthetic rig generation for bone-less models
 *
 * When rigging is missing or broken, provides:
 *   - Detailed diagnostic report
 *   - Instructions for free tools (Mixamo auto-rigger, Blender Rigify)
 *   - Fallback AABB-based hitboxes so combat still works
 *   - Procedural synthetic skeleton built from mesh bounding box
 *
 * Open-source tools referenced:
 *   - Mixamo Auto-Rigger: https://www.mixamo.com (free, browser-based)
 *   - Blender + Rigify: https://www.blender.org (free, open-source)
 *   - Three.js SkeletonHelper: built-in bone visualization
 *   - Schwarzerblitz engine: github.com/AndreaOrru/schwarzerblitz-engine
 *   - mhvnsnt/BrutalfistbaseofTekken3Recompiled animation namespace
 */

import * as THREE from 'three';
import { BONE_NAME_ALIASES, type BoneSlot } from './BoneHitboxSystem';

// ── Rig quality levels ────────────────────────────────────────────────────────
export type RigQuality = 'full' | 'partial' | 'none' | 'synthetic';

// ── Rig convention detected ───────────────────────────────────────────────────
export type RigConvention =
  | 'mixamo'     // mixamorigXxx
  | 'rigify'     // DEF-xxx or ORG-xxx
  | 'blender'    // Armature.Bone naming
  | 'unreal'     // Bip01_xxx or b_xxx
  | 'custom'     // Unknown but has bones
  | 'synthetic'  // Procedurally generated from AABB
  | 'none';      // No bones found

// ── Rig diagnostic report ─────────────────────────────────────────────────────
export interface RigDiagnosticReport {
  /** Overall rig quality */
  quality: RigQuality;
  /** Detected naming convention */
  convention: RigConvention;
  /** Total bones found */
  totalBones: number;
  /** Whether a root bone at floor zero was found */
  hasRootAtFloor: boolean;
  /** Root bone name if found */
  rootBoneName: string | null;
  /** Root bone world Y position */
  rootBoneY: number | null;
  /** Whether the model appears to be in T-pose (bind pose) */
  isInTPose: boolean;
  /** Which critical bones were found */
  foundBones: Partial<Record<BoneSlot, string>>;
  /** Which critical bones are missing */
  missingBones: BoneSlot[];
  /** Whether animations are present */
  hasAnimations: boolean;
  /** Animation clip names */
  animationClips: string[];
  /** Whether the model has skinned meshes */
  hasSkinnedMesh: boolean;
  /** Recommended action */
  recommendation: string;
  /** Step-by-step fix instructions */
  fixInstructions: string[];
  /** Whether a synthetic rig was generated */
  isSynthetic?: boolean;
}

// ── Procedural rig result ─────────────────────────────────────────────────────
export interface ProceduralRigResult {
  /** The root bone of the synthetic skeleton */
  rootBone: THREE.Bone;
  /** All generated bones keyed by slot name */
  bones: Map<string, THREE.Bone>;
  /** The skeleton object */
  skeleton: THREE.Skeleton;
  /** Whether the rig was successfully attached to the mesh */
  attached: boolean;
}

// ── Critical bones required for combat ───────────────────────────────────────
const CRITICAL_BONES: BoneSlot[] = ['RightHand', 'LeftHand', 'RightFoot', 'LeftFoot', 'Head', 'Hips'];

// ── Root bone floor threshold ─────────────────────────────────────────────────
/** Root bone Y must be within this distance of 0 to be considered "at floor" */
const ROOT_FLOOR_THRESHOLD = 0.15;

/**
 * AutoRigDetector — analyzes a loaded GLB scene for rig quality.
 */
export class AutoRigDetector {
  /**
   * Analyze a loaded GLB scene and return a full diagnostic report.
   */
  static analyze(
    scene: THREE.Object3D,
    animations: THREE.AnimationClip[],
  ): RigDiagnosticReport {
    const allBones: THREE.Bone[] = [];
    let hasSkinnedMesh = false;

    // Collect all bones
    scene.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        allBones.push(child as THREE.Bone);
      }
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
        hasSkinnedMesh = true;
        const sm = child as THREE.SkinnedMesh;
        if (sm.skeleton) {
          sm.skeleton.bones.forEach(b => {
            if (!allBones.includes(b)) allBones.push(b);
          });
        }
      }
    });

    const totalBones = allBones.length;
    const convention = this.detectConvention(allBones);
    const foundBones: Partial<Record<BoneSlot, string>> = {};
    const missingBones: BoneSlot[] = [];

    // Map critical bones
    for (const slot of CRITICAL_BONES) {
      const aliases = BONE_NAME_ALIASES[slot];
      let found: THREE.Bone | null = null;

      for (const alias of aliases) {
        const bone = allBones.find(b =>
          b.name === alias || b.name.toLowerCase() === alias.toLowerCase()
        );
        if (bone) { found = bone; break; }
      }

      // Fuzzy fallback
      if (!found) {
        const slotLower = slot.toLowerCase();
        found = allBones.find(b => b.name.toLowerCase().includes(slotLower)) ?? null;
      }

      if (found) {
        foundBones[slot] = found.name;
      } else {
        missingBones.push(slot);
      }
    }

    // Root bone detection
    const rootBone = this.findRootBone(allBones);
    let rootBoneY: number | null = null;
    let hasRootAtFloor = false;

    if (rootBone) {
      const worldPos = new THREE.Vector3();
      rootBone.getWorldPosition(worldPos);
      rootBoneY = worldPos.y;
      hasRootAtFloor = Math.abs(rootBoneY) <= ROOT_FLOOR_THRESHOLD;
    }

    // T-pose detection: check if arm bones are roughly horizontal
    const isInTPose = this.detectTPose(allBones);

    // Quality assessment
    const criticalFound = CRITICAL_BONES.filter(b => foundBones[b]).length;
    let quality: RigQuality;
    if (totalBones === 0 || !hasSkinnedMesh) {
      quality = 'none';
    } else if (criticalFound >= 4 && hasRootAtFloor) {
      quality = 'full';
    } else if (criticalFound >= 2 || totalBones >= 10) {
      quality = 'partial';
    } else {
      quality = 'none';
    }

    const { recommendation, fixInstructions } = this.buildRecommendation(
      quality, convention, missingBones, hasRootAtFloor, animations.length > 0
    );

    const report: RigDiagnosticReport = {
      quality,
      convention,
      totalBones,
      hasRootAtFloor,
      rootBoneName: rootBone?.name ?? null,
      rootBoneY,
      isInTPose,
      foundBones,
      missingBones,
      hasAnimations: animations.length > 0,
      animationClips: animations.map(a => a.name),
      hasSkinnedMesh,
      recommendation,
      fixInstructions,
    };

    console.log(
      `[AutoRig] 🔍 "${scene.name || 'model'}" — quality=${quality} convention=${convention} ` +
      `bones=${totalBones} found=${criticalFound}/${CRITICAL_BONES.length} ` +
      `rootAtFloor=${hasRootAtFloor} tpose=${isInTPose}`
    );

    return report;
  }

  /**
   * Build a procedural synthetic humanoid skeleton from a mesh's bounding box.
   *
   * AGENT LAW: This is the automatic rigging path for bone-less models.
   * When a model has no bones/skinned mesh, we generate a synthetic skeleton
   * using standard humanoid proportions derived from the mesh AABB.
   * The skeleton uses Mixamo-compatible bone names so animation clips from
   * Mixamo, Schwarzerblitz, and Tekken repos can be retargeted onto it.
   *
   * Bone positions are derived from the AABB using standard human proportions:
   *   - Hips: 52% of height
   *   - Spine: 62% of height
   *   - Chest: 72% of height
   *   - Neck: 82% of height
   *   - Head: 90% of height
   *   - Shoulders: 72% height, ±25% width
   *   - Upper arms: 72% height, ±40% width
   *   - Forearms: 60% height, ±50% width
   *   - Hands: 48% height, ±55% width
   *   - Upper legs: 38% height, ±15% width
   *   - Lower legs: 20% height, ±15% width
   *   - Feet: 2% height, ±15% width
   */
  static buildSyntheticRig(scene: THREE.Object3D): ProceduralRigResult {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    const h = size.y;
    const w = size.x;
    const baseY = box.min.y;

    // Helper: create a named bone at a local position
    const makeBone = (name: string): THREE.Bone => {
      const bone = new THREE.Bone();
      bone.name = name;
      return bone;
    };

    // ── Create all bones ──────────────────────────────────────────────────────
    const hips       = makeBone('mixamorigHips');
    const spine      = makeBone('mixamorigSpine');
    const spine1     = makeBone('mixamorigSpine1');
    const spine2     = makeBone('mixamorigSpine2');
    const neck       = makeBone('mixamorigNeck');
    const head       = makeBone('mixamorigHead');
    const headTop    = makeBone('mixamorigHeadTop_End');

    const leftShoulder  = makeBone('mixamorigLeftShoulder');
    const leftArm       = makeBone('mixamorigLeftArm');
    const leftForeArm   = makeBone('mixamorigLeftForeArm');
    const leftHand      = makeBone('mixamorigLeftHand');

    const rightShoulder = makeBone('mixamorigRightShoulder');
    const rightArm      = makeBone('mixamorigRightArm');
    const rightForeArm  = makeBone('mixamorigRightForeArm');
    const rightHand     = makeBone('mixamorigRightHand');

    const leftUpLeg  = makeBone('mixamorigLeftUpLeg');
    const leftLeg    = makeBone('mixamorigLeftLeg');
    const leftFoot   = makeBone('mixamorigLeftFoot');
    const leftToeBase = makeBone('mixamorigLeftToeBase');

    const rightUpLeg  = makeBone('mixamorigRightUpLeg');
    const rightLeg    = makeBone('mixamorigRightLeg');
    const rightFoot   = makeBone('mixamorigRightFoot');
    const rightToeBase = makeBone('mixamorigRightToeBase');

    // ── Set local positions (relative to parent bone) ─────────────────────────
    // Hips at 52% height from floor
    hips.position.set(center.x, baseY + h * 0.52, center.z);

    // Spine chain (relative to hips)
    spine.position.set(0, h * 0.10, 0);
    spine1.position.set(0, h * 0.08, 0);
    spine2.position.set(0, h * 0.08, 0);
    neck.position.set(0, h * 0.08, 0);
    head.position.set(0, h * 0.06, 0);
    headTop.position.set(0, h * 0.10, 0);

    // Left arm chain (relative to spine2)
    leftShoulder.position.set(-w * 0.12, 0, 0);
    leftArm.position.set(-w * 0.12, 0, 0);
    leftForeArm.position.set(-w * 0.12, -h * 0.12, 0);
    leftHand.position.set(-w * 0.10, -h * 0.12, 0);

    // Right arm chain (relative to spine2)
    rightShoulder.position.set(w * 0.12, 0, 0);
    rightArm.position.set(w * 0.12, 0, 0);
    rightForeArm.position.set(w * 0.12, -h * 0.12, 0);
    rightHand.position.set(w * 0.10, -h * 0.12, 0);

    // Left leg chain (relative to hips)
    leftUpLeg.position.set(-w * 0.12, -h * 0.02, 0);
    leftLeg.position.set(0, -h * 0.22, 0);
    leftFoot.position.set(0, -h * 0.22, 0);
    leftToeBase.position.set(0, -h * 0.04, w * 0.08);

    // Right leg chain (relative to hips)
    rightUpLeg.position.set(w * 0.12, -h * 0.02, 0);
    rightLeg.position.set(0, -h * 0.22, 0);
    rightFoot.position.set(0, -h * 0.22, 0);
    rightToeBase.position.set(0, -h * 0.04, w * 0.08);

    // ── Build hierarchy ───────────────────────────────────────────────────────
    hips.add(spine);
    spine.add(spine1);
    spine1.add(spine2);
    spine2.add(neck);
    neck.add(head);
    head.add(headTop);

    spine2.add(leftShoulder);
    leftShoulder.add(leftArm);
    leftArm.add(leftForeArm);
    leftForeArm.add(leftHand);

    spine2.add(rightShoulder);
    rightShoulder.add(rightArm);
    rightArm.add(rightForeArm);
    rightForeArm.add(rightHand);

    hips.add(leftUpLeg);
    leftUpLeg.add(leftLeg);
    leftLeg.add(leftFoot);
    leftFoot.add(leftToeBase);

    hips.add(rightUpLeg);
    rightUpLeg.add(rightLeg);
    rightLeg.add(rightFoot);
    rightFoot.add(rightToeBase);

    // ── Create skeleton ───────────────────────────────────────────────────────
    const allBones = [
      hips, spine, spine1, spine2, neck, head, headTop,
      leftShoulder, leftArm, leftForeArm, leftHand,
      rightShoulder, rightArm, rightForeArm, rightHand,
      leftUpLeg, leftLeg, leftFoot, leftToeBase,
      rightUpLeg, rightLeg, rightFoot, rightToeBase,
    ];

    const skeleton = new THREE.Skeleton(allBones);

    // ── Attach to scene ───────────────────────────────────────────────────────
    let attached = false;
    scene.add(hips);
    hips.updateMatrixWorld(true);
    skeleton.calculateInverses();

    // Try to convert static Meshes to SkinnedMeshes with proper skin weights
    // so the synthetic skeleton actually deforms the visible geometry.
    //
    // AGENT LAW: For each vertex in the mesh, we assign it to the nearest bone
    // using a simple distance-based weight assignment. This gives basic but
    // visually correct deformation for humanoid models without a rig.
    scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) return; // Already skinned

      const mesh = child as THREE.Mesh;
      const geometry = mesh.geometry;
      if (!geometry || !geometry.attributes.position) return;

      const posAttr = geometry.attributes.position;
      const vertexCount = posAttr.count;

      // Build skin indices and weights arrays (4 bones per vertex)
      const skinIndices = new Float32Array(vertexCount * 4);
      const skinWeights = new Float32Array(vertexCount * 4);

      // Get world positions of all bones for distance calculation
      const boneWorldPositions = allBones.map(bone => {
        const wp = new THREE.Vector3();
        bone.getWorldPosition(wp);
        return wp;
      });

      const vPos = new THREE.Vector3();
      const meshWorldMatrix = mesh.matrixWorld;

      for (let i = 0; i < vertexCount; i++) {
        vPos.fromBufferAttribute(posAttr, i);
        vPos.applyMatrix4(meshWorldMatrix);

        // Find the 2 nearest bones by distance
        const distances = boneWorldPositions.map((bp, bIdx) => ({
          idx: bIdx,
          dist: vPos.distanceTo(bp),
        }));
        distances.sort((a, b) => a.dist - b.dist);

        // RUNTIME INVARIANT (PR #14/#15): Use up to 4 influences per vertex.
        // Three.js SkinnedMesh enforces a maximum of 4 bone influences per vertex
        // on the WebGL path. Using 4 (not 2) produces smoother deformation and
        // matches the Khronos glTF spec for JOINTS_0/WEIGHTS_0 attributes.
        // Weights are inverse-distance weighted and normalized to sum to 1.0.
        const influenceCount = Math.min(4, distances.length);
        const nearest = distances.slice(0, influenceCount);
        const totalInvDist = nearest.reduce((sum, d) => sum + (d.dist > 0 ? 1 / d.dist : 1e6), 0);

        for (let j = 0; j < influenceCount; j++) {
          skinIndices[i * 4 + j] = nearest[j].idx;
          skinWeights[i * 4 + j] = nearest[j].dist > 0
            ? (1 / nearest[j].dist) / totalInvDist
            : 1.0;
        }
        // Zero-fill remaining slots beyond influenceCount
        for (let j = influenceCount; j < 4; j++) {
          skinIndices[i * 4 + j] = 0;
          skinWeights[i * 4 + j] = 0;
        }
      }

      geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndices, 4));
      geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeights, 4));

      // Convert Mesh to SkinnedMesh in-place
      const skinnedMesh = new THREE.SkinnedMesh(geometry, mesh.material);
      skinnedMesh.name = mesh.name;
      skinnedMesh.position.copy(mesh.position);
      skinnedMesh.rotation.copy(mesh.rotation);
      skinnedMesh.scale.copy(mesh.scale);
      skinnedMesh.matrix.copy(mesh.matrix);
      skinnedMesh.matrixWorld.copy(mesh.matrixWorld);

      // Bind the skeleton to the skinned mesh
      skinnedMesh.bind(skeleton, skinnedMesh.matrixWorld);

      // RUNTIME INVARIANT (PR #14/#15): Normalize skin weights after binding.
      // Ensures all per-vertex weights sum to 1.0 per the Khronos glTF spec.
      // Without this, inverse-distance weights that don't sum exactly to 1
      // produce stretched/displaced geometry during animation.
      skinnedMesh.normalizeSkinWeights();

      // Replace the original mesh in the parent
      if (mesh.parent) {
        mesh.parent.add(skinnedMesh);
        mesh.parent.remove(mesh);
      }

      attached = true;
      console.log(`[AutoRig] 🔗 Converted "${mesh.name || 'mesh'}" to SkinnedMesh with ${vertexCount} vertices`);
    });

    // Build bone map
    const boneMap = new Map<string, THREE.Bone>();
    for (const bone of allBones) {
      boneMap.set(bone.name, bone);
    }

    console.log(
      `[AutoRig] 🦴 Built synthetic rig for "${scene.name || 'model'}" — ` +
      `${allBones.length} bones, height=${h.toFixed(2)}, width=${w.toFixed(2)}, attached=${attached}`
    );

    return { rootBone: hips, bones: boneMap, skeleton, attached };
  }

  /**
   * Detect the naming convention used by the rig.
   */
  private static detectConvention(bones: THREE.Bone[]): RigConvention {
    if (bones.length === 0) return 'none';

    const names = bones.map(b => b.name);

    if (names.some(n => n.startsWith('mixamorig'))) return 'mixamo';
    if (names.some(n => n.startsWith('DEF-') || n.startsWith('ORG-'))) return 'rigify';
    if (names.some(n => n.startsWith('Bip01') || n.startsWith('b_'))) return 'unreal';
    if (names.some(n => n.includes('Armature') || n === 'Bone')) return 'blender';
    if (bones.length > 0) return 'custom';
    return 'none';
  }

  /**
   * Find the root bone (lowest in hierarchy, near floor).
   */
  private static findRootBone(bones: THREE.Bone[]): THREE.Bone | null {
    if (bones.length === 0) return null;

    // Look for explicit root/hips names first
    const rootAliases = BONE_NAME_ALIASES['Hips'];
    for (const alias of rootAliases) {
      const bone = bones.find(b =>
        b.name === alias || b.name.toLowerCase() === alias.toLowerCase()
      );
      if (bone) return bone;
    }

    // Find bone with no parent bone (top of hierarchy)
    const rootBones = bones.filter(b => !b.parent || !(b.parent as THREE.Bone).isBone);
    if (rootBones.length > 0) return rootBones[0];

    return bones[0];
  }

  /**
   * Detect if the model is in T-pose by checking arm bone orientations.
   * In T-pose, upper arm bones should be roughly horizontal (Y rotation near 0).
   */
  private static detectTPose(bones: THREE.Bone[]): boolean {
    const armBoneNames = ['UpperArm', 'upperarm', 'Arm', 'arm', 'Shoulder', 'shoulder'];
    const armBones = bones.filter(b =>
      armBoneNames.some(n => b.name.toLowerCase().includes(n.toLowerCase()))
    );

    if (armBones.length === 0) return false; // Can't determine

    // Check if arm bones have near-zero local rotation (T-pose)
    const nearZeroRotations = armBones.filter(b => {
      const euler = new THREE.Euler().setFromQuaternion(b.quaternion);
      return Math.abs(euler.x) < 0.3 && Math.abs(euler.z) < 0.3;
    });

    return nearZeroRotations.length >= armBones.length * 0.6;
  }

  /**
   * Build recommendation and fix instructions based on diagnostic results.
   */
  private static buildRecommendation(
    quality: RigQuality,
    convention: RigConvention,
    missingBones: BoneSlot[],
    hasRootAtFloor: boolean,
    hasAnimations: boolean,
  ): { recommendation: string; fixInstructions: string[] } {
    if (quality === 'full' && hasAnimations) {
      return {
        recommendation: '✅ Rig is combat-ready. Bone hitboxes fully operational.',
        fixInstructions: [],
      };
    }

    if (quality === 'none') {
      return {
        recommendation: '⚠️ No rig detected. Synthetic rig generated automatically from mesh AABB. For best results, use Mixamo Auto-Rigger (free) to add a proper skeleton.',
        fixInstructions: [
          '1. Go to https://www.mixamo.com (free Adobe account required)',
          '2. Click "Upload Character" and upload your GLB/FBX/OBJ file',
          '3. Mixamo will auto-detect your mesh and apply a humanoid rig',
          '4. Place the chin marker on the chin, wrists on wrists, groin on groin',
          '5. Click "Next" — Mixamo auto-rigs your character in ~30 seconds',
          '6. Download as FBX (with skin) then convert to GLB using:',
          '   - Online: https://products.aspose.app/3d/conversion/fbx-to-glb',
          '   - Blender: File > Import FBX > Export GLTF 2.0',
          '7. Place the GLB in public/models/ and update bannonGlbRoster.ts',
          '',
          'NOTE: A synthetic rig has been auto-generated from the mesh bounding box.',
          'This provides AABB-level hitboxes and basic animation support.',
          'For full bone-parented hitboxes and proper animation, use Mixamo.',
        ],
      };
    }

    const instructions: string[] = [];

    if (!hasRootAtFloor) {
      instructions.push(
        '⚠️ Root bone is not at floor zero. In Blender:',
        '   - Select the Armature > Edit Mode',
        '   - Select the root/hips bone',
        '   - Set its head Y position to 0 (floor level)',
        '   - The root should sit between the character\'s feet',
      );
    }

    if (missingBones.length > 0) {
      instructions.push(
        `⚠️ Missing bones: ${missingBones.join(', ')}`,
        'Options to fix:',
        '  A) Re-rig with Mixamo (recommended — free, automatic):',
        '     https://www.mixamo.com',
        '  B) In Blender, rename existing bones to match Mixamo convention:',
        `     ${missingBones.map(b => `${b} → mixamorig${b}`).join(', ')}`,
        '  C) The engine will use AABB fallback hitboxes for missing bones',
        '     (combat still works, just less precise)',
      );
    }

    if (!hasAnimations) {
      instructions.push(
        '⚠️ No animation clips found in GLB.',
        'To add animations:',
        '  A) Mixamo: After rigging, browse animations and download with skin',
        '  B) Blender: Import animation FBX files and bake to the rig',
        '  C) Mixamo animation packs: https://www.mixamo.com/#/?page=1&type=Motion%2CMotionPack',
        '  Recommended clips for Brutal Fist:',
        '    - Idle, Walk Forward, Walk Backward',
        '    - Jab, Cross, Hook (for lightAttack)',
        '    - Uppercut, Spinning Kick (for heavyAttack)',
        '    - Hit Reaction, Knockdown, Get Up',
        '    - Crouch, Guard/Block',
        '    - Victory Pose, Taunt',
        '    - Strafe Left, Strafe Right',
      );
    }

    const recommendation = quality === 'partial'
      ? `⚠️ Partial rig (${missingBones.length} bones missing). AABB fallback active for missing bones.`
      : '❌ Rig needs repair. See fix instructions.';

    return { recommendation, fixInstructions: instructions };
  }

  /**
   * Normalize root bone to floor zero.
   * Adjusts the entire skeleton so the root bone sits at Y=0.
   * Call this after loading a GLB if hasRootAtFloor is false.
   */
  static normalizeRootToFloor(scene: THREE.Object3D): void {
    const allBones: THREE.Bone[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Bone).isBone) allBones.push(child as THREE.Bone);
    });

    const rootBone = this.findRootBone(allBones);
    if (!rootBone) return;

    const worldPos = new THREE.Vector3();
    rootBone.getWorldPosition(worldPos);

    if (Math.abs(worldPos.y) > ROOT_FLOOR_THRESHOLD) {
      // Offset the entire scene so root bone lands at Y=0
      scene.position.y -= worldPos.y;
      scene.updateMatrixWorld(true);
      console.log(`[AutoRig] 🔧 Normalized root bone to floor: offset Y by ${(-worldPos.y).toFixed(4)}`);
    }
  }

  /**
   * Retarget animation clips from a source scene to a target scene with a synthetic rig.
   *
   * When a model has no rig and we build a synthetic skeleton, the original animation
   * clips (if any) reference bone names that don't exist in the synthetic rig.
   * This method remaps track names from the source clip to the nearest matching
   * bone in the synthetic rig using fuzzy name matching.
   *
   * For models with NO original animations, this returns an empty array — the
   * caller should use Mixamo clips or the idle/walk fallback.
   */
  static retargetClipsToSyntheticRig(
    clips: THREE.AnimationClip[],
    syntheticBones: Map<string, THREE.Bone>,
  ): THREE.AnimationClip[] {
    if (clips.length === 0 || syntheticBones.size === 0) return [];

    const syntheticBoneNames = Array.from(syntheticBones.keys());

    return clips.map(clip => {
      const retargetedTracks: THREE.KeyframeTrack[] = [];

      for (const track of clip.tracks) {
        // Track name format: "boneName.property" or ".property"
        const dotIdx = track.name.lastIndexOf('.');
        if (dotIdx === -1) {
          retargetedTracks.push(track);
          continue;
        }

        const boneName = track.name.substring(0, dotIdx);
        const property = track.name.substring(dotIdx); // includes the dot

        // Find the best matching synthetic bone
        const matchedBone = this.findBestBoneMatch(boneName, syntheticBoneNames);
        if (!matchedBone) {
          // No match — skip this track
          continue;
        }

        // Clone the track with the new bone name
        const newTrackName = matchedBone + property;
        let newTrack: THREE.KeyframeTrack;

        if (track instanceof THREE.QuaternionKeyframeTrack) {
          newTrack = new THREE.QuaternionKeyframeTrack(newTrackName, track.times as any, track.values as any);
        } else if (track instanceof THREE.VectorKeyframeTrack) {
          newTrack = new THREE.VectorKeyframeTrack(newTrackName, track.times as any, track.values as any);
        } else {
          newTrack = track.clone();
          (newTrack as any).name = newTrackName;
        }

        retargetedTracks.push(newTrack);
      }

      if (retargetedTracks.length === 0) return clip;

      return new THREE.AnimationClip(clip.name, clip.duration, retargetedTracks);
    });
  }

  /**
   * Find the best matching bone name from a list of candidates.
   * Uses exact match first, then partial substring match, then Mixamo prefix strip.
   */
  private static findBestBoneMatch(sourceName: string, candidates: string[]): string | null {
    // 1. Exact match
    const exact = candidates.find(c => c === sourceName);
    if (exact) return exact;

    // 2. Case-insensitive exact
    const ciExact = candidates.find(c => c.toLowerCase() === sourceName.toLowerCase());
    if (ciExact) return ciExact;

    // 3. Strip Mixamo prefix from source and try again
    const stripped = sourceName.replace(/^mixamorig/i, '');
    if (stripped !== sourceName) {
      const strippedMatch = candidates.find(c =>
        c.toLowerCase() === stripped.toLowerCase() ||
        c.toLowerCase().includes(stripped.toLowerCase())
      );
      if (strippedMatch) return strippedMatch;
    }

    // 4. Partial substring match (source contains candidate or vice versa)
    const partial = candidates.find(c => {
      const cl = c.toLowerCase();
      const sl = sourceName.toLowerCase();
      return cl.includes(sl) || sl.includes(cl);
    });
    if (partial) return partial;

    // 5. Semantic slot matching (e.g. "RightHand" → "mixamorigRightHand")
    const semanticMap: Record<string, string[]> = {
      'hips': ['mixamorigHips', 'Hips', 'pelvis'],
      'spine': ['mixamorigSpine', 'Spine'],
      'head': ['mixamorigHead', 'Head'],
      'lefthand': ['mixamorigLeftHand', 'LeftHand'],
      'righthand': ['mixamorigRightHand', 'RightHand'],
      'leftfoot': ['mixamorigLeftFoot', 'LeftFoot'],
      'rightfoot': ['mixamorigRightFoot', 'RightFoot'],
    };
    const sl = sourceName.toLowerCase().replace(/[^a-z]/g, '');
    for (const [key, aliases] of Object.entries(semanticMap)) {
      if (sl.includes(key)) {
        let found = candidates.find(c => aliases.some(a => c === a));
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Build a procedural idle animation clip for a synthetic rig.
   * Creates a subtle breathing/idle sway using the spine and head bones.
   * This ensures bone-less models have at least one visible animation.
   */
  static buildProceduralIdleClip(syntheticBones: Map<string, THREE.Bone>): THREE.AnimationClip {
    const duration = 2.0; // 2-second loop
    const fps = 30;
    const frameCount = duration * fps;
    const times: number[] = [];
    for (let i = 0; i <= frameCount; i++) {
      times.push(i / fps);
    }

    const tracks: THREE.KeyframeTrack[] = [];

    // Spine breathing sway (subtle X rotation)
    const spineBone = syntheticBones.get('mixamorigSpine');
    if (spineBone) {
      const spineValues: number[] = [];
      for (const t of times) {
        const breathe = Math.sin(t * Math.PI) * 0.015; // subtle forward lean
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(breathe, 0, 0));
        spineValues.push(q.x, q.y, q.z, q.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(
        'mixamorigSpine.quaternion',
        times,
        spineValues,
      ));
    }

    // Head subtle nod
    const headBone = syntheticBones.get('mixamorigHead');
    if (headBone) {
      const headValues: number[] = [];
      for (const t of times) {
        const nod = Math.sin(t * Math.PI) * 0.02;
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(nod, 0, 0));
        headValues.push(q.x, q.y, q.z, q.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(
        'mixamorigHead.quaternion',
        times,
        headValues,
      ));
    }

    // Hips subtle vertical bob
    const hipsBone = syntheticBones.get('mixamorigHips');
    if (hipsBone) {
      const hipPos = new THREE.Vector3();
      hipsBone.getWorldPosition(hipPos);
      const hipsValues: number[] = [];
      for (const t of times) {
        const bob = Math.sin(t * Math.PI * 2) * 0.008;
        hipsValues.push(hipPos.x, hipPos.y + bob, hipPos.z);
      }
      tracks.push(new THREE.VectorKeyframeTrack(
        'mixamorigHips.position',
        times,
        hipsValues,
      ));
    }

    return new THREE.AnimationClip('idle', duration, tracks);
  }
}
