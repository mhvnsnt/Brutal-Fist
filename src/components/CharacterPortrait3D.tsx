'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { SkeletonUtils } from 'three-stdlib';

interface CharacterPortrait3DProps {
  modelUrl: string;
  factionColor: string;
  /** 'bust' = tight head/chest crop (portrait panels), 'full' = full body (roster slots) */
  mode?: 'bust' | 'full';
  /** Whether to apply a hit-stop brightness flash */
  flash?: boolean;
  /**
   * @deprecated Use rotationY for precise control.
   */
  flip?: boolean;
  /**
   * Explicit Y-axis rotation in radians for the character model IN THE PORTRAIT ONLY.
   * COMPLETELY DECOUPLED from in-fight rotationY.
   * Portrait convention:
   *   P1 (left panel):  -0.45 rad → slight right-facing inward angle
   *   P2 (right panel): +0.45 rad → slight left-facing inward angle
   *   Roster grid slots: 0 (face camera)
   */
  rotationY?: number;
}

/**
 * NORMALIZATION CONTRACT (v10 — Universal Box3 + Forward Detection):
 *
 * All characters use the same Box3 normalization as FighterMesh:
 *   - Scale to 2.0 units tall
 *   - Offset so bottom of bounding box sits at Y=0
 *   - No character-specific manual offsets
 *   - Forward direction auto-detected: models facing +Z get 180° Y correction
 *     applied to the inner scene group (not the outer portrait rotation group)
 *
 * PORTRAIT ORIENTATION IS COMPLETELY DECOUPLED FROM IN-FIGHT ORIENTATION.
 */

// ── Forward direction detection (same logic as FighterMesh) ──────────────────
function detectForwardCorrection(scene: THREE.Object3D): number {
  const allBones: THREE.Bone[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Bone).isBone) allBones.push(child as THREE.Bone);
  });

  if (allBones.length > 0) {
    const headBone = allBones.find(b => {
      const n = b.name.toLowerCase();
      return n.includes('head') && !n.includes('headtop') && !n.includes('headend');
    });
    const hipsBone = allBones.find(b => {
      const n = b.name.toLowerCase();
      return n.includes('hip') || n.includes('pelvis') || n.includes('root') || n === 'hips';
    });

    if (headBone && hipsBone) {
      const headPos = new THREE.Vector3();
      const hipsPos = new THREE.Vector3();
      headBone.getWorldPosition(headPos);
      hipsBone.getWorldPosition(hipsPos);

      if (headPos.z - hipsPos.z > 0.05) {
        return Math.PI;
      }
      return 0;
    }
  }

  // FALLBACK: No usable head/hips bones — use bounding-box centroid Z.
  // Most Blender-exported models face +Z by default.
  const meshPositions: THREE.Vector3[] = [];
  scene.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.geometry || !mesh.geometry.attributes.position) return;
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    meshPositions.push(center);
  });

  if (meshPositions.length === 0) return 0;

  const avgZ = meshPositions.reduce((sum, p) => sum + p.z, 0) / meshPositions.length;
  if (avgZ > 0.05) {
    return Math.PI;
  }
  return 0;
}

/** Select the best idle animation clip from available clips */
function selectIdleClip(clips: THREE.AnimationClip[]): THREE.AnimationClip {
  const idleKeywords = ['idle', 'stand', 'neutral', 'ready', 'wait', 'rest', 'bind', 'tpose', 't-pose'];
  for (const keyword of idleKeywords) {
    const found = clips.find((a) => a.name.toLowerCase().includes(keyword));
    if (found) return found;
  }
  return clips[0];
}

/** Fixed camera — all models normalized to Y=0 baseline */
function FixedCamera({ mode }: { mode: 'bust' | 'full' }) {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (mode === 'bust') {
      cam.fov = 28;
      cam.position.set(0, 1.6, 3.2);
      cam.lookAt(0, 1.4, 0);
    } else {
      cam.fov = 40;
      cam.position.set(0, 1.0, 4.5);
      cam.lookAt(0, 1.0, 0);
    }
    cam.updateProjectionMatrix();
  }, [mode, camera]);
  return null;
}

/** 3-Point Portrait Lighting */
function PortraitLighting({ factionColor }: { factionColor: string }) {
  return (
    <>
      <ambientLight intensity={0.25} color="#e8eaf0" />
      <directionalLight position={[2.5, 3.5, 3.0]} intensity={2.2} color="#fff5e8" castShadow={false} />
      <directionalLight position={[-2.0, 2.0, 2.5]} intensity={0.75} color={factionColor} castShadow={false} />
      <directionalLight position={[0.5, 4.0, -3.5]} intensity={1.4} color="#c8d8ff" castShadow={false} />
      <pointLight position={[0, 1.3, 1.8]} intensity={0.3} color={factionColor} distance={4} decay={2} />
    </>
  );
}

function PortraitModel({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
  rotationY,
}: CharacterPortrait3DProps) {
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const [model, setModel] = useState<{ scene: THREE.Group; forwardCorrectionY: number } | null>(null);

  useEffect(() => {
    let active = true;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      modelUrl,
      (gltf) => {
        if (!active) return;
        // CRITICAL FIX: Use SkeletonUtils.clone() instead of gltf.scene.clone(true).
        // gltf.scene.clone(true) detaches SkinnedMesh bind matrices from the skeleton,
        // causing skeleton desync when animation plays. SkeletonUtils.clone() preserves
        // the full bone hierarchy and re-binds every SkinnedMesh to the correct skeleton.
        const cloned = SkeletonUtils.clone(gltf.scene) as THREE.Group;

        // Disable frustum culling on all SkinnedMeshes
        cloned.traverse((child) => {
          if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
            (child as THREE.SkinnedMesh).frustumCulled = false;
            (child as THREE.SkinnedMesh).normalizeSkinWeights();
          }
        });

        // ── Step 1: Measure raw bounding box (pre-scale) ──────────────────────
        cloned.updateMatrixWorld(true);
        const rawBox = new THREE.Box3().setFromObject(cloned);
        const rawSize = rawBox.getSize(new THREE.Vector3());

        // ── Step 2: Scale to 2.0 units tall ───────────────────────────────────
        const scale = rawSize.y > 0 ? 2.0 / rawSize.y : 1;
        cloned.scale.setScalar(scale);

        // ── Step 3: Force matrix world update ─────────────────────────────────
        cloned.updateMatrixWorld(true);

        // ── Step 4: Re-measure bounding box in post-scale world space ─────────
        const scaledBox = new THREE.Box3().setFromObject(cloned);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        // ── Step 5: Center horizontally; floor bottom of bounding box at Y=0 ──
        cloned.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

        // ── Step 6: Reset ONLY the root scene rotation (not children) ─────────
        cloned.rotation.set(0, 0, 0);

        // ── Step 7: Force update so bone world positions are accurate ──────────
        cloned.updateMatrixWorld(true);

        // ── Step 8: Detect forward direction ──────────────────────────────────
        const forwardCorrectionY = detectForwardCorrection(cloned);

        // ── Step 9: Apply faction color tint ──────────────────────────────────
        const color = new THREE.Color(factionColor);
        cloned.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat) => {
            const m = mat as THREE.MeshStandardMaterial;
            if (m.isMeshStandardMaterial) {
              m.emissive = color;
              m.emissiveIntensity = 0.06;
              m.needsUpdate = true;
            }
          });
        });

        // ── Step 10: Idle animation — mixer bound to CLONED scene ─────────────
        // AGENT LAW: AnimationMixer must target the cloned scene (the rendered object),
        // not the original gltf.scene. Use name-based track binding (not UUID) so
        // the mixer resolves bones by name in the cloned hierarchy.
        if (gltf.animations && gltf.animations.length > 0) {
          mixerRef.current = new THREE.AnimationMixer(cloned);
          const idleClip = selectIdleClip(gltf.animations);

          // Clone the clip — do NOT remap to UUIDs.
          // THREE.AnimationMixer resolves track names by searching the root subtree
          // for objects with matching names. Since cloned has the same bone names
          // as the original, name-based tracks resolve correctly without UUID remapping.
          const clonedClip = idleClip.clone();
          const action = mixerRef.current.clipAction(clonedClip, cloned);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.fadeIn(0.3);
          action.play();
        }

        setModel({ scene: cloned, forwardCorrectionY });
      },
      undefined,
      (err) => console.warn('[Portrait] GLB load failed:', modelUrl, err)
    );
    return () => {
      active = false;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
  }, [modelUrl, factionColor]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  if (!model) return null;

  // Portrait rotation = explicit rotationY prop (or flip fallback) + forward correction
  // The forward correction is applied to the inner group so it doesn't interfere
  // with the portrait's intentional inward-facing angle.
  const portraitRotY = rotationY !== undefined ? rotationY : (flip ? Math.PI : 0);

  return (
    // OUTER GROUP: portrait orientation (inward angle for P1/P2 panels)
    <group rotation={[0, portraitRotY, 0]}>
      {/* INNER GROUP: forward correction — makes +Z-facing models face -Z */}
      <group rotation={[0, model.forwardCorrectionY, 0]}>
        <primitive object={model.scene} />
      </group>
    </group>
  );
}

function PortraitScene({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
  rotationY,
}: CharacterPortrait3DProps) {
  return (
    <>
      <FixedCamera mode={mode} />
      <PortraitLighting factionColor={factionColor} />
      <Suspense fallback={null}>
        <PortraitModel
          modelUrl={modelUrl}
          factionColor={factionColor}
          mode={mode}
          flash={flash}
          flip={flip}
          rotationY={rotationY}
        />
      </Suspense>
    </>
  );
}

export default function CharacterPortrait3D({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
  rotationY,
}: CharacterPortrait3DProps) {
  return (
    <div className="relative w-full h-full">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 80%, ${factionColor}22 0%, transparent 70%)`,
        }}
      />
      <Canvas
        gl={{ antialias: false, alpha: true }}
        style={{
          width: '100%',
          height: '100%',
          filter: flash ? 'brightness(1.8)' : undefined,
          transition: 'filter 0.05s',
        }}
      >
        <PortraitScene
          modelUrl={modelUrl}
          factionColor={factionColor}
          mode={mode}
          flash={flash}
          flip={flip}
          rotationY={rotationY}
        />
      </Canvas>
    </div>
  );
}
