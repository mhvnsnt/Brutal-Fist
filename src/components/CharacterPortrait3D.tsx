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
 * NORMALIZATION CONTRACT (v6 — Universal Root Bone Offset):
 *
 * Root cause of systemic floor-sink for all non-Bannon/Maime characters:
 *   Their skeleton root bones are zeroed at absolute floor level (Y=0),
 *   while Bannon and Maime have their roots sitting higher (pelvis/waist).
 *   After bounding-box centering, the fixed camera still aims too low for
 *   floor-rooted characters because their geometric center is at their feet,
 *   not their torso.
 *
 * Fix (v6):
 *   All characters except Bannon and Maime receive a universal +1.15 Y offset
 *   on top of the bounding-box centering. This is the normalized-space
 *   equivalent of +100–120 cm in a 180–190 cm character (55–63% of height),
 *   scaled to the 2.0-unit normalized height used in this scene.
 *
 *   Bannon and Maime are the reference baseline — they receive 0 extra offset.
 *
 * Camera positions (fixed, never change):
 *   - Bust mode:  position=(0, 1.6, 3.2), lookAt=(0, 1.4, 0), FOV=28
 *   - Full mode:  position=(0, 1.0, 4.5), lookAt=(0, 1.0, 0), FOV=40
 */

/**
 * Per-character Y nudge table.
 * Key = substring of the GLB filename (case-insensitive).
 * Value = additional Y offset in world units (positive = move up).
 *
 * Bannon and Maime are the reference — 0 offset.
 * All other characters get +1.15 (≈ +100–120 cm in normalized 2-unit space)
 * to correct the systemic root-bone floor-level mismatch.
 */
const PORTRAIT_Y_NUDGE: Record<string, number> = {
  'bannon':        0,
  'maime':         0,
  'onyx':          1.15,
  'cain_elias':    1.15,
  'cody':          1.15,
  'echo':          1.15,
  'stickup':       1.15,
  'cipher':        1.15,
  'hall_nighter':  1.15,
  'static':        1.15,
  'viper':         1.15,
  'kobra':         1.15,
  'aaron_ruben':   1.15,
  'hollow':        1.15,
  'edwin_kennedy': 1.15,
  'pablo':         1.15,
  'tyneshia':      1.15,
  'triple_xxx':    1.15,
  'el_toro':       1.15,
  'stan_combs':    1.15,
  'brutus':        1.15,
  'titan':         1.15,
  'master_sensei': 1.15,
  'wreck':         1.15,
};

function getYNudge(modelUrl: string): number {
  const lower = modelUrl.toLowerCase();
  for (const [key, nudge] of Object.entries(PORTRAIT_Y_NUDGE)) {
    if (lower.includes(key)) return nudge;
  }
  // Default: apply the universal root-bone correction for any unknown character
  // that is not Bannon or Maime
  return 1.15;
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

        // ── Step 7: Reset source rotation on root AND all top-level children ──
        // Ensures every character starts from the same neutral facing direction.
        // The group wrapper's rotation (flip ? Math.PI : 0) is the sole control
        // for P1/P2 facing — no per-character overrides allowed.
        cloned.rotation.set(0, 0, 0);
        cloned.children.forEach((child) => {
          child.rotation.set(0, 0, 0);
        });

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
