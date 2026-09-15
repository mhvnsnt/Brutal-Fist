import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { FighterMesh } from './FighterMesh';
import { DEFAULT_PSX_RENDER } from '../render/psx';

interface PSXCanvasProps {
  fighterState: string;
  opponentState: string;
  fighterAnimation?: string;
  opponentAnimation?: string;
  modelUrl: string | null;
  p1X: number;
  p1Z: number;
  p2X: number;
  p2Z: number;
  p1Facing?: 1 | -1;
  p2Facing?: 1 | -1;
}

export function PSXCanvas({ fighterState, opponentState, fighterAnimation, opponentAnimation, modelUrl, p1X, p1Z, p2X, p2Z, p1Facing, p2Facing }: PSXCanvasProps) {
  const resolvedP1Facing: 1 | -1 = p1Facing ?? (p1X < p2X ? 1 : -1);
  const resolvedP2Facing: 1 | -1 = p2Facing ?? (p2X < p1X ? 1 : -1);
  const midX = (p1X + p2X) * 0.5;
  const midZ = (p1Z + p2Z) * 0.5;
  const separation = Math.max(2.8, Math.min(6.8, Math.hypot(p2X - p1X, p2Z - p1Z) + 2.4));

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      <Canvas dpr={1} shadows gl={{ antialias: false, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.setPixelRatio(1); gl.setSize(DEFAULT_PSX_RENDER.renderWidth, DEFAULT_PSX_RENDER.renderHeight, false); }} camera={{ position: [0, 3.1, 10], fov: 38 }} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}>
        <PerspectiveCamera makeDefault position={[midX, 3.0, separation + midZ * 0.25]} fov={38} />
        <color attach="background" args={['#10131a']} />
        <fog attach="fog" args={['#10131a', 11, 28]} />
        <ambientLight intensity={1.8} />
        <directionalLight position={[3, 8, 6]} intensity={3.5} castShadow />
        <directionalLight position={[-6, 4, -2]} intensity={1.2} />

        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[16, 9]} />
            <meshStandardMaterial color="#252933" roughness={1} flatShading />
          </mesh>
          <gridHelper args={[16, 16, '#4a5360', '#303640']} position={[0, 0.012, 0]} />

          <FighterMesh state={fighterState} animation={fighterAnimation} modelUrl={modelUrl} position={[p1X, 0, p1Z]} facing={resolvedP1Facing} tint="#d9d9d9" />
          <FighterMesh state={opponentState} animation={opponentAnimation} modelUrl={modelUrl} position={[p2X, 0, p2Z]} facing={resolvedP2Facing} tint="#7d8796" />
        </group>
      </Canvas>
      <div className="pointer-events-none absolute inset-0 opacity-20 bg-[linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px)] bg-[size:100%_4px]" />
    </div>
  );
}
