'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

interface CharacterPortrait3DProps {
  modelUrl: string;
  factionColor: string;
  /** 'bust' = tight head/chest crop (portrait panels), 'full' = full body (roster slots) */
  mode?: 'bust' | 'full';
  /** Whether to apply a hit-stop brightness flash */
  flash?: boolean;
  /**
   * Flip horizontally for P2 side — rotates 180° on Y so character faces toward P1.
   * @deprecated Use rotationY for precise control. flip=true is equivalent to rotationY=Math.PI.
   * NOTE: This prop is ONLY for portrait display. It has NO effect on in-fight orientation.
   */
  flip?: boolean;
  /**
   * Explicit Y-axis rotation in radians for the character model IN THE PORTRAIT ONLY.
   * This is COMPLETELY DECOUPLED from in-fight rotationY (which is always 0 for P1, Math.PI for P2).
   * Portrait convention:
   *   P1 (left panel):  -0.45 rad → slight right-facing inward angle
   *   P2 (right panel): +0.45 rad → slight left-facing inward angle
   *   Roster grid slots: 0 (face camera)
   */
  rotationY?: number;
}

/**
 * NORMALIZATION CONTRACT (v9 — Universal Box3 + No Manual Nudge):
 *
 * All characters use the same Box3 normalization as FighterMesh:
 *   - Scale to 2.0 units tall
 *   - Offset so bottom of bounding box sits at Y=0
 *   - No character-specific manual offsets
 *   - No child rotation resets (preserves model's original bone orientations)
 *
 * Camera positions are fixed — no nudgeY needed since all models are normalized to Y=0 baseline.
 *
 * PORTRAIT ORIENTATION IS COMPLETELY DECOUPLED FROM IN-FIGHT ORIENTATION:
 *   - Portrait rotationY prop only affects the portrait Canvas rotation
 *   - In-fight rotationY is set by CombatArena3D (0 for P1, Math.PI for P2)
 *   - These two systems never share state
 */

/**
 * Returns the Y nudge for a character.
 * v9: All characters use Box3 normalization — nudgeY is always 0.
 * Kept for API compatibility but always returns 0.
 */
function getYNudge(_modelUrl: string): number {
  return 0;
}

/**
 * Retarget animation clips from the original GLTF scene to a cloned scene.
 */
function retargetClips(
  clips: THREE.AnimationClip[],
  sourceRoot: THREE.Object3D,
  targetRoot: THREE.Object3D
): THREE.AnimationClip[] {
  const targetMap = new Map<string, string>();
  targetRoot.traverse((obj) => targetMap.set(obj.name, obj.uuid));

  return clips.map((clip) => {
    const retargeted = clip.clone();
    retargeted.tracks = clip.tracks.map((track) => {
      const dotIdx = track.name.indexOf('.');
      if (dotIdx === -1) return track.clone();
      const boneName = track.name.slice(0, dotIdx);
      const property = track.name.slice(dotIdx);
      const newTrack = track.clone();
      newTrack.name = `${boneName}${property}`;
      return newTrack;
    });
    return retargeted;
  });
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

/** Fixed camera — all models normalized to Y=0 baseline, so camera targets are fixed */
function FixedCamera({ mode, nudgeY }: { mode: 'bust' | 'full'; nudgeY: number }) {
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
  }, [mode, nudgeY, camera]);
  return null;
}

/**
 * 3-Point Portrait Lighting
 */
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
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const [model, setModel] = useState<{ scene: THREE.Group; nudgeY: number } | null>(null);

  useEffect(() => {
    let active = true;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      modelUrl,
      (gltf) => {
        if (!active) return;
        const cloned = gltf.scene.clone(true);

        // ── Step 1: Measure raw bounding box (pre-scale) ──────────────────────
        const rawBox = new THREE.Box3().setFromObject(cloned);
        const rawSize = rawBox.getSize(new THREE.Vector3());

        // ── Step 2: Compute scale to make model exactly 2.0 units tall ────────
        const scale = rawSize.y > 0 ? 2.0 / rawSize.y : 1;
        cloned.scale.setScalar(scale);

        // ── Step 3: Force matrix world update ─────────────────────────────────
        cloned.updateMatrixWorld(true);

        // ── Step 4: Re-measure bounding box in post-scale world space ─────────
        const scaledBox = new THREE.Box3().setFromObject(cloned);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        // ── Step 5: Center horizontally; floor bottom of bounding box at Y=0 ──
        // CRITICAL: use scaledBox.min.y (not scaledCenter.y) so ALL characters
        // stand on the floor regardless of where their root bone is.
        // Do NOT reset child rotations — that breaks models whose root bone
        // is oriented away from the camera.
        cloned.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

        // ── Step 6: Reset ONLY the root scene rotation (not children) ─────────
        // Resetting children breaks models with non-zero root bone orientations.
        cloned.rotation.set(0, 0, 0);

        // ── Step 7: Apply faction color tint ──────────────────────────────────
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

        // ── Step 8: Idle animation ─────────────────────────────────────────────
        if (gltf.animations && gltf.animations.length > 0) {
          const retargeted = retargetClips(gltf.animations, gltf.scene, cloned);
          mixerRef.current = new THREE.AnimationMixer(cloned);
          const idleClip = selectIdleClip(retargeted);
          const action = mixerRef.current.clipAction(idleClip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.fadeIn(0.3);
          action.play();
        }

        // nudgeY is always 0 in v9 — Box3 normalization handles all characters uniformly
        const nudgeY = 0;

        setModel({ scene: cloned, nudgeY });
      },
      undefined,
      (err) => console.warn('Portrait GLB load failed:', modelUrl, err)
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

  return (
    // OUTER GROUP: holds the Y nudge offset — never touched by the animation mixer
    // rotationY here is PORTRAIT-ONLY — completely separate from in-fight rotation
    <group
      ref={groupRef}
      position={[0, model.nudgeY, 0]}
      rotation={[0, rotationY !== undefined ? rotationY : (flip ? Math.PI : 0), 0]}
    >
      {/* INNER SCENE: animation mixer runs here at Y=0 */}
      <primitive object={model.scene} />
    </group>
  );
}

// Wrapper that passes nudgeY to FixedCamera via a shared state
function PortraitScene({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
  rotationY,
}: CharacterPortrait3DProps) {
  // Compute nudgeY here so FixedCamera can use it
  const nudgeY = getYNudge(modelUrl);

  return (
    <>
      <FixedCamera mode={mode} nudgeY={nudgeY} />
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
      {/* Faction color atmosphere glow behind canvas */}
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
