'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { SkeletonUtils } from 'three-stdlib';
import { normalizeClonedFighter, PIPELINE_TARGET_HEIGHT } from '../engine/pipeline/CharacterPipeline';
import { isCollapsedNamedPartRig } from '../engine/pipeline/namedPartRig';

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
   * COMPLETELY DECOUPLED from in-fight rotationY. Never baked into the GLB.
   * Viewport slot math (applied by CharacterSelect, same for every fighter):
   *   P1:  Math.PI / 4   → 45° inward to the right
   *   P2: -Math.PI / 4   → 45° inward to the left
   * Base GLB loads at 0° on all axes before this slot rotation is applied.
   */
  rotationY?: number;
  /** HQ 2D card (Tekken-style). Shown behind 3D, or alone if the GLB is a collapsed named-part rig. */
  cardUrl?: string;
}

/**
 * NORMALIZATION CONTRACT:
 * Character Select uses the same normalizeClonedFighter() as combat:
 *   - Zero root rotation first
 *   - Uniform scale to PIPELINE_TARGET_HEIGHT from mesh AABB
 *   - ADD floor/center offset (never SET — Mixamo hip-root must survive)
 *   - Rest-pose limb-axis facing, not mesh centroid
 * Slot rotation (P1 π/4, P2 −π/4) is applied on an OUTER group only.
 */

// ── Forward direction detection (delegated to CharacterPipeline) ──────────────
// REMOVED: local detectForwardCorrection using head/hips bone position heuristic.
// The pose-based heuristic was banned because a fighting stance can put the head
// forward without the character's actual forward axis being +Z.
// CharacterPipeline.determineForwardCorrection() uses GEOMETRY CENTROID ONLY.
// Both Character Select and Combat now use the same authoritative implementation.

/** Select the best idle animation clip from available clips */
function selectIdleClip(clips: THREE.AnimationClip[]): THREE.AnimationClip {
  const idleKeywords = ['idle', 'stand', 'neutral', 'ready', 'wait', 'rest', 'bind', 'tpose', 't-pose'];
  for (const keyword of idleKeywords) {
    const found = clips.find((a) => a.name.toLowerCase().includes(keyword));
    if (found) return found;
  }
  return clips[0];
}

/** Fixed camera — fighters are floor-snapped to Y=0 at PIPELINE_TARGET_HEIGHT. */
function FixedCamera({ mode }: { mode: 'bust' | 'full' }) {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const h = PIPELINE_TARGET_HEIGHT;
    if (mode === 'bust') {
      // Mid-thigh → head, object-position: bottom. Feet stay at Y=0.
      cam.fov = 30;
      cam.position.set(0, h * 0.62, h * 1.9);
      cam.lookAt(0, h * 0.55, 0);
    } else {
      cam.fov = 34;
      cam.position.set(0, h * 0.5, h * 2.45);
      cam.lookAt(0, h * 0.42, 0);
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

        cloned.traverse((child) => {
          if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
            (child as THREE.SkinnedMesh).frustumCulled = false;
          }
        });

        const { forwardCorrectionY } = normalizeClonedFighter(cloned, PIPELINE_TARGET_HEIGHT);

        if (isCollapsedNamedPartRig(cloned)) {
          console.warn('[Portrait] collapsed named-part rig — 3D skipped (would explode). Card art only.', modelUrl);
          setModel(null);
          return;
        }

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

        if (gltf.animations && gltf.animations.length > 0) {
          mixerRef.current = new THREE.AnimationMixer(cloned);
          const idleClip = selectIdleClip(gltf.animations);
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
  cardUrl,
}: CharacterPortrait3DProps) {
  return (
    <div className="relative w-full h-full flex items-end justify-center">
      {cardUrl && (
        <img
          src={cardUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-contain object-bottom pointer-events-none"
          style={{ imageRendering: 'auto' }}
        />
      )}
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
          objectFit: 'contain',
          objectPosition: 'bottom center',
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
