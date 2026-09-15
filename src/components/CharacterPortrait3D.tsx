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
  /** Flip horizontally for P2 side */
  flip?: boolean;
}

/**
 * Bannon-reference orientation contract:
 * - Models are normalized so their bounding box bottom sits at Y=0
 * - Scale is normalized to 2.0 units tall
 * - Root is centered on X/Z axes
 * - Bannon faces +Z (toward camera) by default — all other models must match this
 * - Bust camera: looks at ~70% of model height (head/chest zone), positioned at Z=3.2 with FOV 28
 * - Full camera: looks at 50% of model height, positioned at Z=4.5 with FOV 40
 * - No auto-rotation — models face forward (Bannon orientation)
 *
 * VERTICAL ALIGNMENT FIX:
 * The camera look-at Y is computed dynamically from the model's actual normalized
 * bounding box height, not a hardcoded value. This ensures all characters (Cody,
 * Cain Elias, Echo, etc.) frame correctly regardless of skeleton root height or
 * bounding box origin in the source GLB.
 */
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
  // Store the normalized model height so camera can frame correctly
  const [normalizedHeight, setNormalizedHeight] = useState<number>(2.0);
  const { camera } = useThree();

  useEffect(() => {
    let active = true;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      modelUrl,
      (gltf) => {
        if (!active) return;
        const cloned = gltf.scene.clone(true);

        // ── Bannon-reference normalization ──────────────────────────────────
        // 1. Compute bounding box of the raw scene
        const box = new THREE.Box3().setFromObject(cloned);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // 2. Normalize scale: 2.0 units tall (Bannon reference height)
        const scale = size.y > 0 ? 2.0 / size.y : 1;
        cloned.scale.setScalar(scale);

        // 3. Center X/Z, lift so bottom sits at Y=0 (Bannon root placement)
        cloned.position.set(
          -center.x * scale,
          -box.min.y * scale,
          -center.z * scale
        );

        // 4. Ensure model faces +Z (Bannon forward direction)
        cloned.rotation.set(0, 0, 0);

        // 5. Compute the actual normalized height AFTER scale+position are applied
        //    so the camera can target the correct vertical zone for this specific model.
        //    We re-measure the bounding box after normalization to get the true height.
        const normalizedBox = new THREE.Box3().setFromObject(cloned);
        const normalizedSize = normalizedBox.getSize(new THREE.Vector3());
        // Store the actual height (should be ~2.0 but may vary due to accessories/props)
        setNormalizedHeight(normalizedSize.y);

        // 6. Apply faction color tint to emissive (subtle, preserves original textures)
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

        // 7. Start idle animation if available
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

  // ── Camera framing — dynamically computed from actual model height ──────────
  // This is the core fix: instead of hardcoding Y=1.4 (which only works for Bannon/Maime),
  // we compute the look-at Y as a fraction of the model's actual normalized height.
  // Bust mode targets the head/upper-chest zone (~72% up from feet).
  // Full mode targets the center of mass (~50% up from feet).
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (mode === 'bust') {
      // Target the head/chest zone: 72% of model height from the floor (Y=0)
      // For a 2.0-unit model this gives Y≈1.44, matching Bannon's reference.
      // For taller/shorter normalized models it scales proportionally.
      const lookAtY = normalizedHeight * 0.72;
      // Camera sits slightly above the look-at point to create a natural bust angle
      const camY = lookAtY + 0.15;
      cam.fov = 28;
      camera.position.set(0, camY, 3.2);
      camera.lookAt(0, lookAtY, 0);
    } else {
      // Full body — center of mass at 50% height
      const lookAtY = normalizedHeight * 0.50;
      const camY = lookAtY;
      cam.fov = 40;
      camera.position.set(0, camY, 4.5);
      camera.lookAt(0, lookAtY, 0);
    }
    cam.updateProjectionMatrix();
  }, [mode, camera, normalizedHeight]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  if (!model) return null;

  return (
    <group
      ref={groupRef}
      scale={flip ? [-1, 1, 1] : [1, 1, 1]}
    >
      <primitive object={model} />
    </group>
  );
}

function PortraitLoadingPlaceholder({ factionColor, initial }: { factionColor: string; initial: string }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'transparent' }}
    >
      <div
        className="font-black text-[4rem] leading-none animate-pulse"
        style={{
          color: factionColor,
          textShadow: `0 0 20px ${factionColor}88`,
          fontFamily: 'monospace',
        }}
      >
        {initial}
      </div>
    </div>
  );
}

export default function CharacterPortrait3D({
  modelUrl,
  factionColor,
  mode = 'bust',
  flash = false,
  flip = false,
}: CharacterPortrait3DProps) {
  const [loaded, setLoaded] = useState(false);

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
        onCreated={() => setLoaded(true)}
      >
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
