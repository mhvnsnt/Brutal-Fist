'use client';

import React, { useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FighterMesh } from './FighterMesh';
import { type BannonFighterProfile } from '../data/bannonRoster';

// ── Stage geometry constants ──────────────────────────────────────────────────
const FLOOR_WIDTH = 24;
const FLOOR_DEPTH = 10;
const P1_X = -3.5;
const P2_X = 3.5;

// ── Dynamic midpoint tracking camera ─────────────────────────────────────────
function MidpointCamera({
  p1X,
  p2X,
}: {
  p1X: number;
  p2X: number;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 55;
    cam.near = 0.1;
    cam.far = 200;
    cam.updateProjectionMatrix();
  }, [camera]);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const midX = (p1X + p2X) / 2;
    const dist = Math.abs(p2X - p1X);
    // Zoom out as fighters spread apart, zoom in as they close
    const targetZ = Math.max(5.5, Math.min(12, dist * 1.1 + 3.5));
    const targetY = 2.2;

    // Smooth camera tracking
    cam.position.x += (midX - cam.position.x) * 0.08;
    cam.position.y += (targetY - cam.position.y) * 0.06;
    cam.position.z += (targetZ - cam.position.z) * 0.06;
    cam.lookAt(midX, 1.2, 0);
    cam.updateProjectionMatrix();
  });

  return null;
}

// ── Arena stage: floor plane + back wall + skybox atmosphere ─────────────────
function ArenaStage({ p1Color, p2Color }: { p1Color: string; p2Color: string }) {
  const floorRef = useRef<THREE.Mesh>(null);

  return (
    <group>
      {/* Floor plane */}
      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[FLOOR_WIDTH, FLOOR_DEPTH]} />
        <meshStandardMaterial
          color="#111111"
          roughness={0.85}
          metalness={0.15}
        />
      </mesh>

      {/* Floor grid lines */}
      <gridHelper
        args={[FLOOR_WIDTH, 24, '#222222', '#1a1a1a']}
        position={[0, 0.002, 0]}
      />

      {/* Center line */}
      <mesh position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.04, FLOOR_DEPTH]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.4} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 3, -FLOOR_DEPTH / 2]} receiveShadow>
        <planeGeometry args={[FLOOR_WIDTH, 8]} />
        <meshStandardMaterial color="#0a0a0a" roughness={1} />
      </mesh>

      {/* Side walls (subtle) */}
      <mesh position={[-FLOOR_WIDTH / 2, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[FLOOR_DEPTH, 8]} />
        <meshStandardMaterial color="#080808" roughness={1} />
      </mesh>
      <mesh position={[FLOOR_WIDTH / 2, 3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[FLOOR_DEPTH, 8]} />
        <meshStandardMaterial color="#080808" roughness={1} />
      </mesh>

      {/* P1 faction glow on floor */}
      <pointLight
        position={[P1_X, 0.5, 0]}
        intensity={1.2}
        color={p1Color}
        distance={4}
        decay={2}
      />
      {/* P2 faction glow on floor */}
      <pointLight
        position={[P2_X, 0.5, 0]}
        intensity={1.2}
        color={p2Color}
        distance={4}
        decay={2}
      />

      {/* Atmospheric fog-like back lighting */}
      <pointLight position={[0, 6, -4]} intensity={0.6} color="#1a1a2e" distance={20} decay={1} />
    </group>
  );
}

// ── Arena lighting rig ────────────────────────────────────────────────────────
function ArenaLighting({ p1Color, p2Color }: { p1Color: string; p2Color: string }) {
  return (
    <>
      {/* Ambient base */}
      <ambientLight intensity={0.3} color="#c8d0e0" />

      {/* Key light — overhead center, warm white */}
      <directionalLight
        position={[0, 8, 4]}
        intensity={2.5}
        color="#fff8f0"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Fill light — soft cool from front-left */}
      <directionalLight
        position={[-5, 4, 3]}
        intensity={0.8}
        color="#a0b8ff"
      />

      {/* Rim light — from behind, separates fighters from background */}
      <directionalLight
        position={[0, 5, -6]}
        intensity={1.0}
        color="#ffffff"
      />

      {/* P1 side spot */}
      <spotLight
        position={[P1_X - 2, 6, 2]}
        target-position={[P1_X, 0, 0]}
        intensity={1.5}
        color={p1Color}
        angle={0.4}
        penumbra={0.6}
        distance={12}
        decay={2}
      />

      {/* P2 side spot */}
      <spotLight
        position={[P2_X + 2, 6, 2]}
        target-position={[P2_X, 0, 0]}
        intensity={1.5}
        color={p2Color}
        angle={0.4}
        penumbra={0.6}
        distance={12}
        decay={2}
      />
    </>
  );
}

// ── Fighter position tracker (for camera) ────────────────────────────────────
interface FighterPositionsRef {
  p1X: number;
  p2X: number;
}

function CameraController({ posRef }: { posRef: React.MutableRefObject<FighterPositionsRef> }) {
  return (
    <MidpointCamera
      p1X={posRef.current.p1X}
      p2X={posRef.current.p2X}
    />
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
interface CombatArena3DProps {
  p1Fighter: BannonFighterProfile;
  p2Fighter: BannonFighterProfile;
  p1State: string;
  p2State: string;
  p1Animation: string;
  p2Animation: string;
  p1Color: string;
  p2Color: string;
  hitStopActive: boolean;
  /** Optional skin/cosmetic tint override for P1 */
  p1SkinTint?: string;
  /** Optional skin/cosmetic tint override for P2 */
  p2SkinTint?: string;
}

export default function CombatArena3D({
  p1Fighter,
  p2Fighter,
  p1State,
  p2State,
  p1Animation,
  p2Animation,
  p1Color,
  p2Color,
  hitStopActive,
  p1SkinTint,
  p2SkinTint,
}: CombatArena3DProps) {
  const posRef = useRef<FighterPositionsRef>({ p1X: P1_X, p2X: P2_X });

  // Derive fighter X positions from state (advance on attack, retreat on hit)
  const p1XOffset = p1State === 'Startup' || p1State === 'Active' ? 0.3 : 0;
  const p2XOffset = p2State === 'Startup' || p2State === 'Active' ? -0.3 : 0;
  const p1FinalX = P1_X + p1XOffset;
  const p2FinalX = P2_X + p2XOffset;

  posRef.current.p1X = p1FinalX;
  posRef.current.p2X = p2FinalX;

  return (
    <Canvas
      shadows
      gl={{ antialias: false, alpha: false }}
      style={{ width: '100%', height: '100%', background: '#050505' }}
      camera={{ position: [0, 2.2, 8], fov: 55, near: 0.1, far: 200 }}
    >
      {/* Skybox color */}
      <color attach="background" args={['#050508']} />
      <fog attach="fog" args={['#050508', 18, 40]} />

      <ArenaLighting p1Color={p1Color} p2Color={p2Color} />
      <ArenaStage p1Color={p1Color} p2Color={p2Color} />

      {/* P1 Fighter — faces right (+Z toward camera, toward P2) */}
      <FighterMesh
        state={p1State}
        animation={p1Animation}
        modelUrl={p1Fighter.portraitUrl}
        position={[p1FinalX, 0, 0]}
        facing={1}
        rotationY={0}
        tint={p1SkinTint ?? p1Color}
      />

      {/* P2 Fighter — faces left (rotated 180° to face P1) */}
      <FighterMesh
        state={p2State}
        animation={p2Animation}
        modelUrl={p2Fighter.portraitUrl}
        position={[p2FinalX, 0, 0]}
        facing={-1}
        rotationY={Math.PI}
        tint={p2SkinTint ?? p2Color}
      />

      {/* Dynamic midpoint tracking camera */}
      <MidpointCamera p1X={p1FinalX} p2X={p2FinalX} />

      {/* Hit-stop flash effect */}
      {hitStopActive && (
        <ambientLight intensity={0.8} color="#ffffff" />
      )}
    </Canvas>
  );
}
