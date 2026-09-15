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
  /** Flip horizontally for P2 side — rotates 180° on Y so character faces toward P1 */
  flip?: boolean;
}

/**
 * NORMALIZATION CONTRACT (v5 — Post-Scale Bounding Box):
 *
 * Root cause of previous failures:
 *   Box3.setFromObject() was called on the raw clone BEFORE scale was applied.
 *   So `center.y * scale` used the pre-scale center, but the model renders in
 *   post-scale space — causing wrong Y offsets for models whose skeleton root
 *   is not at the geometric center of the mesh.
 *
 * Fix:
 *   1. Clone the GLB scene
 *   2. Apply scale.setScalar() to the clone
 *   3. Force updateMatrixWorld(true) so Three.js recomputes all world matrices
 *   4. Re-measure Box3 in post-scale world space
 *   5. Compute offsetY = 1.0 - postScaleCenter.y
 *      (places vertical center at Y=1.0 in all cases)
 *   6. Apply per-character Y nudge from PORTRAIT_Y_NUDGE table for fine-tuning
 *
 * Camera positions (fixed, never change):
 *   - Bust mode:  position=(0, 1.6, 3.2), lookAt=(0, 1.4, 0), FOV=28
 *   - Full mode:  position=(0, 1.0, 4.5), lookAt=(0, 1.0, 0), FOV=40
 */

/**
 * Per-character Y nudge table.
 * Key = substring of the GLB filename (case-insensitive).
 * Value = additional Y offset in world units (positive = move up, negative = move down).
 * Bannon and Maime are the reference — they get 0 nudge.
 * All other characters are tuned relative to them.
 */
const PORTRAIT_Y_NUDGE: Record<string, number> = {
  'bannon':       0,
  'maime':        0,
  'onyx':         0.15,
  'cain_elias':   0.12,
  'cody':         0.18,
  'echo':         0.14,
  'stickup':      0.10,
  'cipher':       0.12,
  'hall_nighter': 0.10,
  'static':       0.10,
  'viper':        0.10,
  'kobra':        0.10,
  'aaron_ruben':  0.10,
  'hollow':       0.10,
  'edwin_kennedy':0.10,
  'pablo':        0.10,
  'tyneshia':     0.10,
  'triple_xxx':   0.10,
  'el_toro':      0.10,
  'stan_combs':   0.10,
  'brutus':       0.10,
  'titan':        0.10,
  'master_sensei':0.10,
  'wreck':        0.10,
};

function getYNudge(modelUrl: string): number {
  const lower = modelUrl.toLowerCase();
  for (const [key, nudge] of Object.entries(PORTRAIT_Y_NUDGE)) {
    if (lower.includes(key)) return nudge;
  }
  return 0.10; // default nudge for unknown models
}

/** Set up the fixed camera once on mount — never changes after that */
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

function PortraitModel({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
}: CharacterPortrait3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const [model, setModel] = useState<THREE.Group | null>(null);

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

        // ── Step 3: Force matrix world update so Box3 sees post-scale coords ──
        // This is the critical fix: without this, Box3 still reads pre-scale
        // world matrices and the center.y * scale math is wrong for models
        // whose skeleton root is offset from the mesh geometric center.
        cloned.updateMatrixWorld(true);

        // ── Step 4: Re-measure bounding box in post-scale world space ─────────
        const scaledBox = new THREE.Box3().setFromObject(cloned);
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        // ── Step 5: Compute Y offset so vertical center lands at Y=1.0 ────────
        // scaledCenter.y is now the true post-scale vertical center.
        // We want: scaledCenter.y + offsetY = 1.0
        const baseOffsetY = 1.0 - scaledCenter.y;

        // ── Step 6: Apply per-character Y nudge for fine-tuning ───────────────
        const nudge = getYNudge(modelUrl);
        const offsetY = baseOffsetY + nudge;

        cloned.position.set(
          -scaledCenter.x,
          offsetY,
          -scaledCenter.z
        );

        // ── Step 7: Reset any source rotation on the mesh ─────────────────────
        cloned.rotation.set(0, 0, 0);

        // ── Step 8: Apply faction color tint ──────────────────────────────────
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

        // ── Step 9: Start idle animation if available ─────────────────────────
        if (gltf.animations.length > 0) {
          mixerRef.current = new THREE.AnimationMixer(cloned);
          const idleClip =
            gltf.animations.find((a) =>
              ['idle', 'Idle', 'neutral', 'Neutral', 'standing', 'bind', 'T-pose', 'TPose'].some((k) =>
                a.name.toLowerCase().includes(k.toLowerCase())
              )
            ) ?? gltf.animations[0];
          const action = mixerRef.current.clipAction(idleClip);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
        }

        setModel(cloned);
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
    <group
      ref={groupRef}
      // P2 side: rotate 180° on Y-axis so the character faces toward P1.
      rotation={[0, flip ? Math.PI : 0, 0]}
    >
      <primitive object={model} />
    </group>
  );
}

export default function CharacterPortrait3D({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
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
        {/* Fixed camera — set once, never recomputed */}
        <FixedCamera mode={mode} />

        {/* Lighting */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[1.5, 3.5, 4]} intensity={1.4} />
        <directionalLight position={[-2, 1.5, 2]} intensity={0.5} color={factionColor} />
        <directionalLight position={[0, 4, -3]} intensity={0.3} color="#ffffff" />
        <pointLight position={[0, 1.2, 2.5]} intensity={0.4} color={factionColor} />

        <Suspense fallback={null}>
          <PortraitModel
            modelUrl={modelUrl}
            factionColor={factionColor}
            mode={mode}
            flash={flash}
            flip={flip}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
