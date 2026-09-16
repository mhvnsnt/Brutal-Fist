import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { FighterMesh } from './FighterMesh';
import { DEFAULT_PSX_RENDER } from '../render/psx';
import type { BrutalFistStageId } from '../data/stageCatalog';

interface PSXCanvasProps {
  fighterState: string; opponentState: string; fighterAnimation?: string; opponentAnimation?: string;
  modelUrl: string | null; opponentModelUrl: string | null;
  p1X: number; p1Z: number; p2X: number; p2Z: number; p1Facing?: 1 | -1; p2Facing?: 1 | -1;
  stageId?: Exclude<BrutalFistStageId, 'random'>;
}

function StageEnvironment({ stageId }: { stageId: Exclude<BrutalFistStageId, 'random'> }) {
  const urban = stageId === 'urban-night';
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 14]} />
        <meshStandardMaterial color={urban ? '#17151f' : '#252933'} roughness={1} flatShading />
      </mesh>
      {!urban && <gridHelper args={[18, 18, '#4a5360', '#303640']} position={[0, 0.012, 0]} />}
      <mesh position={[0, 3.1, -7]}>
        <boxGeometry args={[22, 6.2, 0.35]} />
        <meshStandardMaterial color={urban ? '#11101a' : '#15181d'} roughness={1} />
      </mesh>
      {urban && <>
        <mesh position={[-5, 2.1, -6.7]}><boxGeometry args={[2, 4.2, 0.4]} /><meshStandardMaterial color="#30223d" emissive="#32175c" emissiveIntensity={0.55} /></mesh>
        <mesh position={[5, 2.4, -6.5]}><boxGeometry args={[3, 4.8, 0.4]} /><meshStandardMaterial color="#241b31" emissive="#4b167d" emissiveIntensity={0.45} /></mesh>
      </>}
    </group>
  );
}

export function PSXCanvas({ fighterState, opponentState, fighterAnimation, opponentAnimation, modelUrl, opponentModelUrl, p1X, p1Z, p2X, p2Z, p1Facing, p2Facing, stageId = 'urban-night' }: PSXCanvasProps) {
  const resolvedP1Facing: 1 | -1 = p1Facing ?? 1;
  const resolvedP2Facing: 1 | -1 = p2Facing ?? -1;
  const midX = (p1X + p2X) * 0.5;
  const midZ = (p1Z + p2Z) * 0.5;
  const separation = Math.max(4.8, Math.min(7.5, Math.hypot(p2X - p1X, p2Z - p1Z) + 3.0));
  const urban = stageId === 'urban-night';

  // +Z is the canonical mesh-forward basis. Rotating +pi/2/-pi/2 maps each fighter
  // onto the +X/-X battle line without per-character mirroring or scale hacks.
  const p1RotationY = resolvedP1Facing === 1 ? Math.PI / 2 : -Math.PI / 2;
  const p2RotationY = resolvedP2Facing === -1 ? -Math.PI / 2 : Math.PI / 2;

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <Canvas dpr={1} shadows gl={{ antialias: false, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.setPixelRatio(1); gl.setSize(DEFAULT_PSX_RENDER.renderWidth, DEFAULT_PSX_RENDER.renderHeight, false); }} camera={{ position: [0, 1.35, 7], fov: 34 }} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}>
        <PerspectiveCamera makeDefault position={[midX, 1.35, separation + midZ * 0.15]} fov={34} />
        <color attach="background" args={[urban ? '#08070d' : '#10131a']} />
        <fog attach="fog" args={[urban ? '#08070d' : '#10131a', 10, 26]} />
        <ambientLight intensity={urban ? 0.65 : 1.45} />
        <directionalLight position={[3, 5, 6]} intensity={urban ? 2.3 : 3.0} />
        {urban && <pointLight position={[-4, 3, 1]} intensity={13} distance={14} color="#7138d6" />}
        <StageEnvironment stageId={stageId} />
        <FighterMesh state={fighterState} animation={fighterAnimation} modelUrl={modelUrl} position={[p1X, 0, p1Z]} facing={resolvedP1Facing} rotationY={p1RotationY} tint="#d9d9d9" />
        <FighterMesh state={opponentState} animation={opponentAnimation} modelUrl={opponentModelUrl} position={[p2X, 0, p2Z]} facing={resolvedP2Facing} rotationY={p2RotationY} tint="#7d8796" />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px)] bg-[size:100%_4px]" />
    </div>
  );
}
