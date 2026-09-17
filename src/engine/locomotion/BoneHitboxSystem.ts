/**
 * BoneHitboxSystem — Tekken-style bone-parented hitbox spheres
 *
 * Tekken does NOT use a giant pill-shaped hitbox for combat.
 * Collision spheres are parented directly to specific bones in the skeleton:
 *   - RightHand  → fist hitbox (punches)
 *   - LeftHand   → fist hitbox (left punches)
 *   - RightFoot  → kick hitbox (right kicks)
 *   - LeftFoot   → kick hitbox (left kicks)
 *   - Head       → head hitbox (headbutts, also hurtbox)
 *
 * When a punch is thrown, the hitbox sphere travels exactly where the bone goes.
 * This is resolved per-frame by reading the bone's world-space position from the
 * THREE.SkinnedMesh skeleton.
 *
 * Startup / Active / Recovery:
 *   - Startup: hitbox sphere is OFF (bone moving into position)
 *   - Active:  hitbox sphere is ON (frames 11-13 of a 10-frame startup punch)
 *   - Recovery: hitbox sphere is OFF (arm pulling back)
 *
 * Hit Stop (Impact Freeze):
 *   When a heavy attack lands, both fighters' animations are temporarily paused
 *   for HIT_STOP_DURATION_MS milliseconds to give the hit massive weight.
 *   After hit stop, the knockback animation plays.
 */

import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

// ── Bone name lookup table ────────────────────────────────────────────────────
/**
 * Standard humanoid bone name aliases.
 * We search for these in the skeleton to find the right bone.
 * Covers Mixamo, Rigify, and custom naming conventions.
 */
export const BONE_NAME_ALIASES: Record<BoneSlot, string[]> = {
  RightHand: [
    'RightHand', 'mixamorigRightHand', 'Hand_R', 'hand_r', 'R_Hand',
    'RHand', 'right_hand', 'RightWrist', 'Bip01_R_Hand',
  ],
  LeftHand: [
    'LeftHand', 'mixamorigLeftHand', 'Hand_L', 'hand_l', 'L_Hand',
    'LHand', 'left_hand', 'LeftWrist', 'Bip01_L_Hand',
  ],
  RightFoot: [
    'RightFoot', 'mixamorigRightFoot', 'Foot_R', 'foot_r', 'R_Foot',
    'RFoot', 'right_foot', 'RightAnkle', 'Bip01_R_Foot',
  ],
  LeftFoot: [
    'LeftFoot', 'mixamorigLeftFoot', 'Foot_L', 'foot_l', 'L_Foot',
    'LFoot', 'left_foot', 'LeftAnkle', 'Bip01_L_Foot',
  ],
  Head: [
    'Head', 'mixamorigHead', 'head', 'HEAD', 'Bip01_Head',
    'HeadTop_End', 'Neck1', 'neck_01',
  ],
  Hips: [
    'Hips', 'mixamorigHips', 'hips', 'Pelvis', 'pelvis',
    'Root', 'root', 'Bip01_Pelvis', 'Spine', 'spine',
  ],
  Spine: [
    'Spine', 'mixamorigSpine', 'spine', 'Spine1', 'spine_01',
    'Chest', 'chest', 'Bip01_Spine',
  ],
};

export type BoneSlot = 'RightHand' | 'LeftHand' | 'RightFoot' | 'LeftFoot' | 'Head' | 'Hips' | 'Spine';

// ── Hitbox sphere definition ──────────────────────────────────────────────────
export interface BoneHitboxSphere {
  /** Which bone this sphere is parented to */
  boneSlot: BoneSlot;
  /** Sphere radius in world units */
  radius: number;
  /** Local offset from bone origin */
  localOffset: THREE.Vector3;
  /** Damage this sphere deals on contact */
  damage: number;
  /** Attack level for hurtbox region resolution */
  attackLevel: 'high' | 'mid' | 'low';
  /** Whether this sphere is currently active */
  active: boolean;
  /** Current world-space center (updated each frame) */
  worldCenter: THREE.Vector3;
}

// ── Per-attack hitbox configuration ──────────────────────────────────────────
export interface AttackHitboxConfig {
  /** Which bone slots are active during this attack */
  activeBones: BoneSlot[];
  /** Sphere radius for each active bone */
  radius: number;
  /** Attack level */
  attackLevel: 'high' | 'mid' | 'low';
  /** Damage */
  damage: number;
}

export const ATTACK_HITBOX_CONFIGS: Record<string, AttackHitboxConfig> = {
  lightAttack:  { activeBones: ['RightHand'],              radius: 0.18, attackLevel: 'mid',  damage: 80  },
  heavyAttack:  { activeBones: ['RightHand', 'LeftHand'],  radius: 0.22, attackLevel: 'high', damage: 150 },
  CommandThrow: { activeBones: ['RightHand', 'LeftHand'],  radius: 0.30, attackLevel: 'mid',  damage: 220 },
  // Kick variants
  lk_attack:    { activeBones: ['LeftFoot'],               radius: 0.20, attackLevel: 'low',  damage: 90  },
  rk_attack:    { activeBones: ['RightFoot'],              radius: 0.20, attackLevel: 'mid',  damage: 100 },
  // Head attacks
  headbutt:     { activeBones: ['Head'],                   radius: 0.25, attackLevel: 'high', damage: 120 },
};

// ── Hit Stop constants ────────────────────────────────────────────────────────
/**
 * Hit Stop duration in milliseconds.
 * When a heavy attack lands, both fighters' animations freeze for this duration.
 * Light attacks: shorter freeze. Heavy/special: longer freeze.
 */
export const HIT_STOP_DURATIONS: Record<string, number> = {
  lightAttack:  80,   // ~5 frames at 60fps
  heavyAttack:  140,  // ~8 frames at 60fps — massive sense of weight
  CommandThrow: 180,  // ~11 frames — throw impact
  special:      200,  // ~12 frames — special move impact
};
export const HIT_STOP_DEFAULT_MS = 80;

// ── BoneHitboxSystem ──────────────────────────────────────────────────────────
export class BoneHitboxSystem {
  private boneMap = new Map<BoneSlot, THREE.Bone | null>();
  private activeSpheres: BoneHitboxSphere[] = [];
  private hitRegisteredThisSwing = false;

  // Hit stop state
  private hitStopActive = false;
  private hitStopTimer = 0;
  private hitStopDuration = 0;

  // Root bone tracking for root motion
  private rootBone: THREE.Bone | null = null;
  private prevRootWorldPos = new THREE.Vector3();
  private rootBoneInitialized = false;

  /**
   * Initialize bone map from a skinned mesh skeleton.
   * Call once after the GLB model is loaded.
   */
  initFromSkeleton(object: THREE.Object3D): void {
    this.boneMap.clear();
    this.rootBone = null;

    // Collect all bones from the scene
    const allBones: THREE.Bone[] = [];
    object.traverse((child) => {
      if ((child as THREE.Bone).isBone) {
        allBones.push(child as THREE.Bone);
      }
    });

    if (allBones.length === 0) {
      // Try SkinnedMesh skeleton
      object.traverse((child) => {
        const sm = child as THREE.SkinnedMesh;
        if (sm.isSkinnedMesh && sm.skeleton) {
          sm.skeleton.bones.forEach(b => allBones.push(b));
        }
      });
    }

    console.log(`[BoneHitbox] 🦴 Found ${allBones.length} bones in skeleton`);

    // Map each slot to the best matching bone
    for (const slot of Object.keys(BONE_NAME_ALIASES) as BoneSlot[]) {
      const aliases = BONE_NAME_ALIASES[slot];
      let found: THREE.Bone | null = null;

      for (const alias of aliases) {
        const bone = allBones.find(b =>
          b.name === alias ||
          b.name.toLowerCase() === alias.toLowerCase()
        );
        if (bone) { found = bone; break; }
      }

      // Fuzzy fallback — partial name match
      if (!found) {
        const slotLower = slot.toLowerCase();
        found = allBones.find(b => b.name.toLowerCase().includes(slotLower)) ?? null;
      }

      this.boneMap.set(slot, found);
      if (found) {
        console.log(`[BoneHitbox] ✅ ${slot} → "${found.name}"`);
      } else {
        console.warn(`[BoneHitbox] ⚠️ ${slot} → NOT FOUND (will use AABB fallback)`);
      }
    }

    // Root bone = Hips or first bone in hierarchy
    this.rootBone = this.boneMap.get('Hips') ?? allBones[0] ?? null;
    if (this.rootBone) {
      console.log(`[BoneHitbox] 🎯 Root bone: "${this.rootBone.name}"`);
    }

    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      const geom = mesh.geometry as THREE.BufferGeometry & {
        computeBoundsTree?: typeof computeBoundsTree;
        disposeBoundsTree?: typeof disposeBoundsTree;
        boundsTree?: unknown;
      };
      if (geom.boundsTree) return;
      geom.computeBoundsTree = computeBoundsTree;
      geom.disposeBoundsTree = disposeBoundsTree;
      geom.computeBoundsTree();
    });
    console.log('[BoneHitbox] 📦 three-mesh-bvh bounds trees built for combat meshes');
  }

  /**
   * Activate hitbox spheres for an attack.
   * Called when the animation enters the Active window.
   */
  activateAttack(attackKey: string): void {
    const config = ATTACK_HITBOX_CONFIGS[attackKey] ?? ATTACK_HITBOX_CONFIGS.lightAttack;
    this.hitRegisteredThisSwing = false;

    this.activeSpheres = config.activeBones.map(slot => ({
      boneSlot: slot,
      radius: config.radius,
      localOffset: new THREE.Vector3(0, 0, 0),
      damage: config.damage,
      attackLevel: config.attackLevel,
      active: true,
      worldCenter: new THREE.Vector3(),
    }));

    console.log(`[BoneHitbox] ⚡ Activated hitboxes for "${attackKey}": [${config.activeBones.join(', ')}]`);
  }

  /**
   * Deactivate all hitbox spheres.
   * Called when the animation exits the Active window.
   */
  deactivateAll(): void {
    this.activeSpheres = [];
    this.hitRegisteredThisSwing = false;
  }

  /**
   * Update sphere world positions from bone transforms.
   * Must be called every frame AFTER the animation mixer updates.
   */
  update(dt: number): void {
    // Update hit stop timer
    if (this.hitStopActive) {
      this.hitStopTimer -= dt * 1000; // convert to ms
      if (this.hitStopTimer <= 0) {
        this.hitStopActive = false;
        console.log('[BoneHitbox] ✅ Hit stop ended');
      }
    }

    // Update sphere world positions from bones
    for (const sphere of this.activeSpheres) {
      const bone = this.boneMap.get(sphere.boneSlot);
      if (bone) {
        bone.getWorldPosition(sphere.worldCenter);
        sphere.worldCenter.add(sphere.localOffset);
      }
    }

    // Track root bone world position for root motion
    if (this.rootBone) {
      const worldPos = new THREE.Vector3();
      this.rootBone.getWorldPosition(worldPos);

      if (!this.rootBoneInitialized) {
        this.prevRootWorldPos.copy(worldPos);
        this.rootBoneInitialized = true;
      }
    }
  }

  /**
   * Get root bone world position delta since last frame.
   * Used for root motion pass-through.
   */
  getRootBoneDelta(): { dx: number; dz: number; hasMotion: boolean } {
    if (!this.rootBone) return { dx: 0, dz: 0, hasMotion: false };

    const worldPos = new THREE.Vector3();
    this.rootBone.getWorldPosition(worldPos);

    const dx = worldPos.x - this.prevRootWorldPos.x;
    const dz = worldPos.z - this.prevRootWorldPos.z;
    this.prevRootWorldPos.copy(worldPos);

    const hasMotion = Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001;
    return { dx, dz, hasMotion };
  }

  /**
   * Check if any active hitbox sphere overlaps with an opponent's position.
   * Uses sphere-vs-capsule test for the opponent's body.
   *
   * @param opponentX - Opponent root X
   * @param opponentZ - Opponent root Z
   * @param opponentHeight - Opponent capsule height (default 1.85)
   * @param opponentRadius - Opponent capsule radius (default 0.3)
   */
  checkCollision(
    opponentX: number,
    opponentZ: number,
    opponentHeight = 1.85,
    opponentRadius = 0.3,
  ): { hit: boolean; sphere: BoneHitboxSphere | null } {
    if (this.hitRegisteredThisSwing || this.activeSpheres.length === 0) {
      return { hit: false, sphere: null };
    }

    for (const sphere of this.activeSpheres) {
      if (!sphere.active) continue;

      // Opponent capsule center at mid-height
      const capCenterY = opponentHeight * 0.5;
      const dx = sphere.worldCenter.x - opponentX;
      const dz = sphere.worldCenter.z - opponentZ;
      const dy = sphere.worldCenter.y - capCenterY;

      // Simplified sphere-vs-cylinder: check XZ distance + Y range
      const xzDist = Math.sqrt(dx * dx + dz * dz);
      const inXZ = xzDist < sphere.radius + opponentRadius;
      const inY = sphere.worldCenter.y >= -0.1 && sphere.worldCenter.y <= opponentHeight + 0.1;

      if (inXZ && inY) {
        this.hitRegisteredThisSwing = true;
        console.log(
          `[BoneHitbox] 💥 HIT! bone=${sphere.boneSlot} ` +
          `pos=(${sphere.worldCenter.x.toFixed(2)},${sphere.worldCenter.y.toFixed(2)},${sphere.worldCenter.z.toFixed(2)}) ` +
          `xzDist=${xzDist.toFixed(3)} r=${sphere.radius}`
        );
        return { hit: true, sphere };
      }
    }

    return { hit: false, sphere: null };
  }

  /**
   * Trigger hit stop freeze.
   * Both fighters' animation mixers should pause for hitStopMs.
   */
  triggerHitStop(attackKey: string): number {
    const duration = HIT_STOP_DURATIONS[attackKey] ?? HIT_STOP_DEFAULT_MS;
    this.hitStopActive = true;
    this.hitStopTimer = duration;
    this.hitStopDuration = duration;
    console.log(`[BoneHitbox] ❄️ Hit stop: ${duration}ms for "${attackKey}"`);
    return duration;
  }

  get isHitStopActive(): boolean {
    return this.hitStopActive;
  }

  get hitStopProgress(): number {
    if (!this.hitStopActive || this.hitStopDuration <= 0) return 1;
    return 1 - this.hitStopTimer / this.hitStopDuration;
  }

  /** Get all active sphere positions for debug visualization */
  getActiveSpheres(): BoneHitboxSphere[] {
    return this.activeSpheres.filter(s => s.active);
  }

  /** Get bone map status for debug overlay */
  getBoneMapStatus(): Record<string, string> {
    const status: Record<string, string> = {};
    for (const [slot, bone] of this.boneMap.entries()) {
      status[slot] = bone ? bone.name : 'NOT FOUND';
    }
    return status;
  }

  reset(): void {
    this.deactivateAll();
    this.hitStopActive = false;
    this.hitStopTimer = 0;
    this.rootBoneInitialized = false;
  }
}
