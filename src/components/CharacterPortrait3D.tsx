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

// Inner component that loads and renders the GLB model
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

        // Normalize scale to fit in a 2-unit tall bounding box
        const box = new THREE.Box3().setFromObject(cloned);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = size.y > 0 ? 2.0 / size.y : 1;
        cloned.scale.setScalar(scale);
        cloned.position.set(
          -center.x * scale,
          -box.min.y * scale,
          -center.z * scale
        );

        // Apply faction color tint to emissive
        const color = new THREE.Color(factionColor);
        cloned.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat) => {
            const m = mat as THREE.MeshStandardMaterial;
            m.emissive = color;
            m.emissiveIntensity = 0.08;
            m.needsUpdate = true;
          });
        });

        // Start idle animation if available
        if (gltf.animations.length > 0) {
          mixerRef.current = new THREE.AnimationMixer(cloned);
          const idleClip =
            gltf.animations.find((a) =>
              ['idle', 'Idle', 'neutral', 'Neutral', 'standing'].some((k) =>
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
      (err) => console.warn('Portrait GLB load failed:', err)
    );
    return () => {
      active = false;
      mixerRef.current?.stopAllAction();
      mixerRef.current = null;
    };
  }, [modelUrl, factionColor]);

  // Position camera for bust or full-body framing
  useEffect(() => {
    if (mode === 'bust') {
      // Tight crop: camera looks at upper chest/head area
      (camera as THREE.PerspectiveCamera).fov = 28;
      camera.position.set(0, 1.55, 3.2);
      camera.lookAt(0, 1.4, 0);
    } else {
      // Full body
      (camera as THREE.PerspectiveCamera).fov = 40;
      camera.position.set(0, 1.0, 4.5);
      camera.lookAt(0, 1.0, 0);
    }
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [mode, camera]);

  useFrame((_, delta) => {
    mixerRef.current?.update(delta);
    if (groupRef.current) {
      // Slow idle rotation
      groupRef.current.rotation.y += delta * 0.25;
      if (flip) groupRef.current.rotation.y = Math.PI - groupRef.current.rotation.y + delta * 0.25;
    }
  });

  if (!model) return null;
  return (
    <group ref={groupRef} scale={flip ? [-1, 1, 1] : [1, 1, 1]}>
      <primitive object={model} />
    </group>
  );
}

// Loading placeholder shown while GLB is fetching
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
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[2, 4, 3]} intensity={1.2} />
        <directionalLight
          position={[-2, 2, -1]}
          intensity={0.4}
          color={factionColor}
        />
        <pointLight position={[0, 3, 2]} intensity={0.5} color={factionColor} />

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
