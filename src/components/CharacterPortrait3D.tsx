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
 * Bannon-reference orientation contract:
 * - Models are normalized so their bounding box bottom sits at Y=0
 * - Scale is normalized to 2.0 units tall
 * - Root is centered on X/Z axes
 * - All models face +Z (toward camera) after normalization
 * - P2 side: rotate 180° on Y-axis so character faces left (toward P1), NOT X-scale flip
 * - Bust camera: looks at ~72% of model height (head/chest zone), positioned at Z=3.2 with FOV 28
 * - Full camera: looks at 50% of model height, positioned at Z=4.5 with FOV 40
 *
 * VERTICAL ALIGNMENT FIX:
 * normalizedHeight is stored in a ref AND state so the camera effect always
 * reads the latest value immediately after model load without stale closure issues.
 *
 * FACING DIRECTION FIX:
 * P2 uses rotation.y = Math.PI (180° Y-rotation) instead of scale.x = -1.
 * X-scale flip mirrors the geometry (breaks asymmetric characters, reverses normals).
 * Y-rotation correctly turns the character to face the opposite direction without
 * distorting the mesh, matching how Maime frames correctly on the P2 side.
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
  // Store normalized height in both ref (for immediate camera access) and state (for re-render)
  const normalizedHeightRef = useRef<number>(2.0);
  const [normalizedHeight, setNormalizedHeight] = useState<number>(2.0);
  const { camera } = useThree();

  // Apply camera framing whenever mode, normalizedHeight, or camera changes
  const applyCameraFraming = (height: number) => {
    const cam = camera as THREE.PerspectiveCamera;
    if (mode === 'bust') {
      // Target the head/chest zone: 72% of model height from the floor (Y=0)
      // For a 2.0-unit model this gives Y≈1.44, matching Bannon's reference.
      const lookAtY = height * 0.72;
      const camY = lookAtY + 0.15;
      cam.fov = 28;
      camera.position.set(0, camY, 3.2);
      camera.lookAt(0, lookAtY, 0);
    } else {
      // Full body — center of mass at 50% height
      const lookAtY = height * 0.50;
      const camY = lookAtY;
      cam.fov = 40;
      camera.position.set(0, camY, 4.5);
      camera.lookAt(0, lookAtY, 0);
    }
    cam.updateProjectionMatrix();
  };

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

        // 4. Ensure model faces +Z (Bannon forward direction) — no rotation on the mesh itself.
        //    P2 facing is handled by the parent group's Y rotation (see group below).
        cloned.rotation.set(0, 0, 0);

        // 5. Compute the actual normalized height AFTER scale+position are applied
        //    Re-measure bounding box after normalization to get the true height.
        const normalizedBox = new THREE.Box3().setFromObject(cloned);
        const normalizedSize = normalizedBox.getSize(new THREE.Vector3());
        const height = normalizedSize.y;

        // Store in ref immediately so camera framing can use it right away
        normalizedHeightRef.current = height;
        // Apply camera framing immediately with the correct height
        applyCameraFraming(height);
        // Also update state to trigger any dependent re-renders
        setNormalizedHeight(height);

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

  // Re-apply camera framing when mode changes or normalizedHeight updates
  useEffect(() => {
    applyCameraFraming(normalizedHeightRef.current);
  }, [mode, camera, normalizedHeight]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
  });

  if (!model) return null;

  return (
    <group
      ref={groupRef}
      // P2 side: rotate 180° on Y-axis so the character faces toward P1 (left/toward camera from right).
      // This is the correct approach — NOT X-scale flip which mirrors geometry and breaks facing direction
      // for characters whose GLB origin doesn't match Bannon's +Z forward convention.
      // Maime works correctly because this rotation makes all characters face the same direction
      // relative to the portrait camera regardless of their source GLB facing.
      rotation={[0, flip ? Math.PI : 0, 0]}
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
