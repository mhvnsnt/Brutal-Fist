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
 *
 * When rigging is missing or broken, provides:
 *   - Detailed diagnostic report
 *   - Instructions for free tools (Mixamo auto-rigger, Blender Rigify)
 *   - Fallback AABB-based hitboxes so combat still works
 *
 * Open-source tools referenced:
 *   - Mixamo Auto-Rigger: https://www.mixamo.com (free, browser-based)
 *   - Blender + Rigify: https://www.blender.org (free, open-source)
 *   - Three.js SkeletonHelper: built-in bone visualization
 */

import * as THREE from 'three';
import { BONE_NAME_ALIASES, type BoneSlot } from './BoneHitboxSystem';

// ── Rig quality levels ────────────────────────────────────────────────────────
export type RigQuality = 'full' | 'partial' | 'none';

// ── Rig convention detected ───────────────────────────────────────────────────
export type RigConvention =
  | 'mixamo'     // mixamorigXxx
  | 'rigify'     // DEF-xxx or ORG-xxx
  | 'blender'    // Armature.Bone naming
  | 'unreal'     // Bip01_xxx or b_xxx
  | 'custom'     // Unknown but has bones
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
    const boneSet = new Set(bones);
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
        recommendation: '❌ No rig detected. Use Mixamo Auto-Rigger (free) to add a skeleton.',
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
}
