import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { FighterMesh } from './FighterMesh';

interface PSXCanvasProps {
  fighterState: string;
  modelUrl: string | null;
}

export function PSXCanvas({ fighterState, modelUrl }: PSXCanvasProps) {
  return (
    <div className="w-full h-full bg-slate-900 border-2 border-slate-700 relative overflow-hidden">
      {/* Scanline overlay for retro effect */}
      <div className="absolute inset-0 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjIiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4xNSIvPjwvc3ZnPg==')] z-10" />
      
      <Canvas
        dpr={0.5} // Force lower resolution for chunky pixels
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
        }}
      >
        <OrthographicCamera makeDefault position={[0, 1.5, 5]} zoom={50} />
        {/* Unshaded materials used in FighterMesh to mimic PSX Gouraud/baked lighting */}
        <FighterMesh state={fighterState} modelUrl={modelUrl} />
        
        {/* Ground drop shadow (fake) */}
        <mesh position={[0, -0.49, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1, 16]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.4} />
        </mesh>

        <gridHelper args={[10, 10, '#334455', '#223344']} position={[0, -0.5, 0]} />
      </Canvas>
    </div>
  );
}
