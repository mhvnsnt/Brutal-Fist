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
 * NORMALIZATION CONTRACT (v4 — Fixed Camera approach):
 *
 * Problem with previous approaches:
 *   - Dynamic camera framing based on bounding box height had race conditions
 *   - applyCameraFraming called in useEffect ran after render with stale values
 *   - Re-measuring bounding box after scale/position on a detached scene was unreliable
 *
 * New approach — Fixed Camera + Center-of-Mass Normalization:
 *   1. Compute bounding box of raw GLB scene
 *   2. Scale model so it is exactly 2.0 units tall
 *   3. Position model so its VERTICAL CENTER sits at Y=1.0 (not bottom at Y=0)
 *      - This means: feet at Y=0, head at Y=2.0, center at Y=1.0
 *      - Camera always looks at Y=1.0 (bust: slightly higher at Y=1.4)
 *   4. Center X/Z axes
 *   5. Camera is FIXED — no dynamic computation, no race conditions
 *
 * Camera positions (fixed, never change):
 *   - Bust mode:  position=(0, 1.6, 3.2), lookAt=(0, 1.4, 0), FOV=28
 *   - Full mode:  position=(0, 1.0, 4.5), lookAt=(0, 1.0, 0), FOV=40
 *
 * P2 facing: rotation.y = Math.PI (180° Y-rotation), NOT scale.x = -1
 */

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

        // ── Step 1: Measure raw bounding box ──────────────────────────────────
        const box = new THREE.Box3().setFromObject(cloned);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // ── Step 2: Scale to exactly 2.0 units tall ───────────────────────────
        const scale = size.y > 0 ? 2.0 / size.y : 1;
        cloned.scale.setScalar(scale);

        // ── Step 3: Position so vertical center = Y=1.0 ──────────────────────
        // After scaling:
        //   - box.min.y * scale = bottom of model in world space (before offset)
        //   - box.max.y * scale = top of model in world space (before offset)
        //   - center.y * scale = vertical center of model (before offset)
        // We want: center.y * scale + offsetY = 1.0
        // So: offsetY = 1.0 - center.y * scale
        // This places feet at Y≈0, center at Y=1.0, head at Y≈2.0
        const offsetY = 1.0 - center.y * scale;
        cloned.position.set(
          -center.x * scale,
          offsetY,
          -center.z * scale
        );

        // ── Step 4: Reset any source rotation on the mesh ─────────────────────
        // P2 facing is handled by the parent group rotation, not the mesh itself
        cloned.rotation.set(0, 0, 0);

        // ── Step 5: Apply faction color tint ─────────────────────────────────
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

        // ── Step 6: Start idle animation if available ─────────────────────────
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
      // Y-rotation correctly turns the character without distorting geometry or reversing normals.
      // Do NOT use scale.x = -1 (mirrors geometry, breaks asymmetric characters).
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

        {/* Lighting — matches Bannon's reference lighting setup */}
        <ambientLight intensity={0.7} />
        {/* Key light — front-top, slightly right */}
        <directionalLight position={[1.5, 3.5, 4]} intensity={1.4} />
        {/* Fill light — left side, faction tinted */}
        <directionalLight
          position={[-2, 1.5, 2]}
          intensity={0.5}
          color={factionColor}
        />
        {/* Rim light — behind, top */}
        <directionalLight position={[0, 4, -3]} intensity={0.3} color="#ffffff" />
        {/* Point light — faction atmosphere at chest level */}
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
