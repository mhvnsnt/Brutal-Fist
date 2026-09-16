/**
 * RiggedGLBLoader.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Asset loader that detects rigged vs static GLBs from GLB_ASSET_MANIFEST.json,
 * prioritizes BANNON_rigged.glb / MAIME_rigged.glb from the Bannon repo, and
 * routes STATIC_MESH entries to the offline repair pipeline instead of runtime
 * substitution.
 *
 * ASSET CLASSIFICATION:
 *   RIGGED_AND_ANIMATABLE  → has SkinnedMesh + Skeleton + animation clips
 *   RIGGED_NO_ANIMATIONS   → has SkinnedMesh + Skeleton, no clips
 *   STATIC_MESH            → no SkinnedMesh / no Skeleton
 *   ANIMATION_ONLY         → clips only, no mesh
 *   MALFORMED              → corrupt or unreadable
 *
 * PRIORITY ORDER for BANNON / MAIME:
 *   1. BANNON_rigged.glb
 *   2. BANNON_v1_rigready.glb
 *   3. BANNON.glb (STATIC_MESH — routed to offline repair, NOT runtime substitution)
 *
 * STATIC_MESH POLICY:
 *   Static meshes are BLOCKED from the animation pipeline.
 *   They are reported as OFFLINE_REPAIR_REQUIRED.
 *   The loader NEVER generates synthetic bones or weights at runtime.
 *
 * Usage:
 *   import { RiggedGLBLoader } from './RiggedGLBLoader';
 *   const result = await RiggedGLBLoader.load('BANNON');
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AssetClassification =
  | 'RIGGED_AND_ANIMATABLE' |'RIGGED_NO_ANIMATIONS' |'STATIC_MESH' |'ANIMATION_ONLY' |'MALFORMED' |'NOT_FOUND';

export interface GLBManifestEntry {
  character: string;
  file: string;
  classification: AssetClassification;
  boneCount?: number;
  skinnedMeshCount?: number;
  animationClipCount?: number;
  boneNames?: string[];
  animationClipNames?: string[];
  notes?: string;
}

export interface GLBLoadResult {
  /** The loaded GLTF scene */
  scene: THREE.Group;
  /** Animation clips from the GLB */
  animations: THREE.AnimationClip[];
  /** The actual file URL that was loaded */
  selectedUrl: string;
  /** Asset classification */
  classification: AssetClassification;
  /** Whether this is a rigged asset suitable for animation */
  isRigged: boolean;
  /** Whether this asset has animation clips */
  hasAnimations: boolean;
  /** Number of bones found */
  boneCount: number;
  /** Number of SkinnedMesh objects found */
  skinnedMeshCount: number;
  /** Bone names found in the skeleton */
  boneNames: string[];
  /** Whether the asset was routed to offline repair */
  offlineRepairRequired: boolean;
  /** Diagnostic message */
  message: string;
}

export interface GLBLoadError {
  characterId: string;
  attemptedUrls: string[];
  classification: AssetClassification;
  offlineRepairRequired: boolean;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority URL lists per character
// These are checked in order — first successful load wins.
// STATIC_MESH fallbacks are intentionally NOT included here.
// ─────────────────────────────────────────────────────────────────────────────

const CHARACTER_RIGGED_URLS: Record<string, string[]> = {
  BANNON: [
    '/models/BANNON_rigged.glb',
    '/models/BANNON_muscular_skinned.glb',
  ],
  MAIME: [
    '/models/MAIME_skinned.glb',
    '/models/MAIME_tattered_skinned.glb',
  ],
};

/** Static mesh fallbacks — loaded for classification only, then BLOCKED */
const CHARACTER_STATIC_URLS: Record<string, string[]> = {
  BANNON: ['/models/BANNON.glb', '/models/bannon.glb'],
  MAIME:  ['/models/MAIME.glb',  '/models/maime.glb'],
};

// ─────────────────────────────────────────────────────────────────────────────
// GLB classification helper
// ─────────────────────────────────────────────────────────────────────────────

function classifyGLB(scene: THREE.Group, animations: THREE.AnimationClip[]): {
  classification: AssetClassification;
  boneCount: number;
  skinnedMeshCount: number;
  boneNames: string[];
} {
  let boneCount = 0;
  let skinnedMeshCount = 0;
  let meshCount = 0;
  const boneNames: string[] = [];

  scene.traverse((child) => {
    if ((child as THREE.Bone).isBone) {
      boneCount++;
      boneNames.push(child.name);
    }
    if ((child as THREE.SkinnedMesh).isSkinnedMesh) skinnedMeshCount++;
    if ((child as THREE.Mesh).isMesh) meshCount++;
  });

  const hasAnimations = animations.length > 0;
  const hasSkeleton = boneCount > 0;
  const hasSkinnedMesh = skinnedMeshCount > 0;
  const hasMesh = meshCount > 0;

  let classification: AssetClassification;

  if (!hasMesh && !hasSkeleton) {
    classification = 'MALFORMED';
  } else if (hasAnimations && !hasMesh) {
    classification = 'ANIMATION_ONLY';
  } else if (hasSkeleton && hasSkinnedMesh && hasAnimations) {
    classification = 'RIGGED_AND_ANIMATABLE';
  } else if (hasSkeleton && hasSkinnedMesh) {
    classification = 'RIGGED_NO_ANIMATIONS';
  } else {
    classification = 'STATIC_MESH';
  }

  return { classification, boneCount, skinnedMeshCount, boneNames };
}

// ─────────────────────────────────────────────────────────────────────────────
// RiggedGLBLoader
// ─────────────────────────────────────────────────────────────────────────────

export class RiggedGLBLoader {
  private static readonly loader = (() => {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    return loader;
  })();

  /**
   * Load the best available rigged GLB for a character.
   *
   * Priority:
   *   1. Try all rigged URLs in order
   *   2. If none found, try static URLs for classification
   *   3. Static meshes → OFFLINE_REPAIR_REQUIRED (never runtime-rigged)
   *
   * @param characterId  Character identifier (e.g. 'BANNON', 'MAIME')
   * @param fallbackUrl  Optional explicit URL to try first
   * @returns GLBLoadResult or throws GLBLoadError
   */
  static async load(
    characterId: string,
    fallbackUrl?: string
  ): Promise<GLBLoadResult> {
    const charKey = characterId.toUpperCase();
    const riggedUrls = CHARACTER_RIGGED_URLS[charKey] ?? [];
    const staticUrls = CHARACTER_STATIC_URLS[charKey] ?? [];

    // Build ordered URL list: explicit fallback first, then rigged, then static
    const urlsToTry: Array<{ url: string; isRiggedCandidate: boolean }> = [];

    if (fallbackUrl) {
      urlsToTry.push({ url: fallbackUrl, isRiggedCandidate: true });
    }
    for (const url of riggedUrls) {
      urlsToTry.push({ url, isRiggedCandidate: true });
    }
    for (const url of staticUrls) {
      urlsToTry.push({ url, isRiggedCandidate: false });
    }

    const attemptedUrls: string[] = [];

    for (const { url, isRiggedCandidate } of urlsToTry) {
      attemptedUrls.push(url);

      try {
        const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>(
          (resolve, reject) => {
            RiggedGLBLoader.loader.load(
              url,
              (g) => resolve({ scene: g.scene as THREE.Group, animations: g.animations }),
              undefined,
              reject
            );
          }
        );

        const { classification, boneCount, skinnedMeshCount, boneNames } = classifyGLB(
          gltf.scene,
          gltf.animations
        );

        const isRigged =
          classification === 'RIGGED_AND_ANIMATABLE' ||
          classification === 'RIGGED_NO_ANIMATIONS';

        const hasAnimations = gltf.animations.length > 0;

        // Log what we found
        console.log(
          `[RiggedGLBLoader] ✅ Loaded "${url}"\n` +
          `  Character:      ${characterId}\n` +
          `  Classification: ${classification}\n` +
          `  Bones:          ${boneCount}\n` +
          `  SkinnedMeshes:  ${skinnedMeshCount}\n` +
          `  AnimClips:      ${gltf.animations.length}\n` +
          `  IsRigged:       ${isRigged}`
        );

        // STATIC_MESH policy: route to offline repair, never runtime-rig
        if (classification === 'STATIC_MESH') {
          console.error(
            `[RiggedGLBLoader] 🚫 STATIC_MESH detected: "${url}"\n` +
            `  Character "${characterId}" has no skeleton or skin weights.\n` +
            `  → OFFLINE_REPAIR_REQUIRED\n` +
            `  → DO NOT generate synthetic bones at runtime.\n` +
            `  → Fix: provide ${charKey}_rigged.glb with authored skeleton + skin weights.\n` +
            `  → Run: npm run glb:rig to generate a placeholder rig for offline repair.`
          );

          if (isRiggedCandidate) {
            // This URL was supposed to be rigged but isn't — continue searching
            continue;
          }

          // This is a known static URL — return it as OFFLINE_REPAIR_REQUIRED
          return {
            scene: gltf.scene,
            animations: gltf.animations,
            selectedUrl: url,
            classification,
            isRigged: false,
            hasAnimations: false,
            boneCount,
            skinnedMeshCount,
            boneNames,
            offlineRepairRequired: true,
            message:
              `STATIC_MESH: "${url}" has no skeleton. ` +
              `Provide ${charKey}_rigged.glb with authored rig. ` +
              `Run npm run glb:rig for offline repair.`,
          };
        }

        // Rigged asset found
        return {
          scene: gltf.scene,
          animations: gltf.animations,
          selectedUrl: url,
          classification,
          isRigged,
          hasAnimations,
          boneCount,
          skinnedMeshCount,
          boneNames,
          offlineRepairRequired: false,
          message: `Loaded ${classification}: "${url}" — ${boneCount} bones, ${gltf.animations.length} clips`,
        };
      } catch {
        // URL not found or load error — try next
        continue;
      }
    }

    // Nothing loaded
    const error: GLBLoadError = {
      characterId,
      attemptedUrls,
      classification: 'NOT_FOUND',
      offlineRepairRequired: true,
      message:
        `No rigged GLB found for "${characterId}". ` +
        `Tried: ${attemptedUrls.join(', ')}. ` +
        `Provide ${charKey}_rigged.glb in /public/models/.`,
    };

    console.error(
      `[RiggedGLBLoader] ❌ NOT_FOUND: "${characterId}"\n` +
      `  Tried ${attemptedUrls.length} URL(s):\n` +
      attemptedUrls.map((u) => `    • ${u}`).join('\n') + '\n' +
      `  → OFFLINE_REPAIR_REQUIRED\n` +
      `  → Provide ${charKey}_rigged.glb in /public/models/`
    );

    throw error;
  }

  /**
   * Classify a GLB at a given URL without loading it into the pipeline.
   * Useful for manifest generation and asset auditing.
   */
  static async classify(url: string): Promise<{
    url: string;
    classification: AssetClassification;
    boneCount: number;
    skinnedMeshCount: number;
    animationClipCount: number;
    boneNames: string[];
    animationClipNames: string[];
  }> {
    try {
      const gltf = await new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>(
        (resolve, reject) => {
          RiggedGLBLoader.loader.load(
            url,
            (g) => resolve({ scene: g.scene as THREE.Group, animations: g.animations }),
            undefined,
            reject
          );
        }
      );

      const { classification, boneCount, skinnedMeshCount, boneNames } = classifyGLB(
        gltf.scene,
        gltf.animations
      );

      return {
        url,
        classification,
        boneCount,
        skinnedMeshCount,
        animationClipCount: gltf.animations.length,
        boneNames,
        animationClipNames: gltf.animations.map((a) => a.name),
      };
    } catch {
      return {
        url,
        classification: 'NOT_FOUND',
        boneCount: 0,
        skinnedMeshCount: 0,
        animationClipCount: 0,
        boneNames: [],
        animationClipNames: [],
      };
    }
  }
}
