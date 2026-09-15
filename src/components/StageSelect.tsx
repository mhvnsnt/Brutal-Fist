'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { BRUTAL_FIST_STAGES, resolveStageId, type BrutalFistStageId } from '../data/stageCatalog';

interface StageSelectProps {
  onConfirm: (stageId: Exclude<BrutalFistStageId, 'random'>) => void;
}

function StageGeometry({ stageId }: { stageId: Exclude<BrutalFistStageId, 'random'> }) {
  const urban = stageId === 'urban-night';
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[28, 20]} />
        <meshStandardMaterial color={urban ? '#17151f' : '#272a2f'} roughness={0.92} metalness={urban ? 0.18 : 0.05} />
      </mesh>
      {urban ? (
        <>
          <mesh position={[0, 2.6, -5]}>
            <boxGeometry args={[20, 5.2, 0.35]} />
            <meshStandardMaterial color="#11101a" roughness={0.82} metalness={0.35} />
          </mesh>
          <mesh position={[-5.5, 1.4, -4.6]}>
            <boxGeometry args={[1.4, 2.8, 0.5]} />
            <meshStandardMaterial color="#30223d" emissive="#32175c" emissiveIntensity={0.55} />
          </mesh>
          <mesh position={[4.8, 2.0, -4.4]}>
            <boxGeometry args={[2.8, 4, 0.45]} />
            <meshStandardMaterial color="#241b31" emissive="#4b167d" emissiveIntensity={0.45} />
          </mesh>
        </>
      ) : (
        <>
          <gridHelper args={[20, 20, '#777777', '#303030']} position={[0, 0.012, 0]} />
          <mesh position={[0, 2.4, -6]}>
            <boxGeometry args={[18, 4.8, 0.3]} />
            <meshStandardMaterial color="#15181d" roughness={1} />
          </mesh>
        </>
      )}
    </group>
  );
}

function CinematicPreview({ stageId }: { stageId: Exclude<BrutalFistStageId, 'random'> }) {
  const cameraTarget = useRef(new THREE.Vector3(0, 1.1, 0));
  const target = useMemo(() => new THREE.Vector3(0, 1.1, 0), []);
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    const radius = stageId === 'urban-night' ? 7.6 : 8.8;
    camera.position.set(Math.sin(t * 0.18) * radius, 2.0 + Math.sin(t * 0.42) * 0.55, Math.cos(t * 0.18) * radius);
    camera.lookAt(cameraTarget.current.lerp(target, 0.08));
  });
  return null;
}

export default function StageSelect({ onConfirm }: StageSelectProps) {
  const [selected, setSelected] = useState<BrutalFistStageId>('urban-night');
  const resolved = resolveStageId(selected);
  const stage = BRUTAL_FIST_STAGES.find(item => item.id === selected) ?? BRUTAL_FIST_STAGES[2];

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white font-mono select-none">
      <div className="absolute inset-0 z-0">
        <Canvas dpr={[1, 1.35]} camera={{ position: [0, 2, 8], fov: 42 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
          <fog attach="fog" args={['#08090d', 7, 18]} />
          <ambientLight intensity={0.38} />
          <directionalLight position={[4, 6, 5]} intensity={1.25} />
          <pointLight position={[-4, 3, 2]} intensity={selected === 'urban-night' ? 16 : 5} distance={12} color={selected === 'urban-night' ? '#7138d6' : '#ffffff'} />
          <StageGeometry stageId={resolved} />
          <CinematicPreview stageId={resolved} />
        </Canvas>
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-black/65 via-transparent to-black/85" />
      <header className="pointer-events-none absolute left-0 right-0 top-4 z-20 text-center">
        <div className="inline-block border border-white/25 bg-black/65 px-6 py-2 text-xl md:text-3xl font-black italic tracking-[0.18em]">STAGE SELECT</div>
        <div className="mt-2 text-[8px] tracking-[0.35em] text-white/50">SELECT YOUR BATTLEFIELD</div>
      </header>

      <div className="pointer-events-none absolute left-4 top-1/2 z-20 -translate-y-1/2 max-w-[58%]">
        <div className="text-[9px] tracking-[0.35em] text-white/50">LIVE 3D PREVIEW</div>
        <div className="mt-1 text-3xl md:text-6xl font-black italic" style={{ textShadow: '4px 4px 0 #000' }}>{stage.name}</div>
        <div className="mt-2 max-w-sm text-[9px] leading-relaxed text-white/60">{stage.description}</div>
      </div>

      <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-30 bg-black/78 border-t border-white/15 px-3 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]">
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
          {BRUTAL_FIST_STAGES.map(item => (
            <button key={item.id} onClick={() => setSelected(item.id)} className="relative h-20 w-32 shrink-0 snap-start overflow-hidden border text-left transition-transform active:scale-95" style={{ borderColor: selected === item.id ? item.accent : '#3b3f46', background: selected === item.id ? '#20232a' : '#111318' }}>
              <div className="absolute inset-0 opacity-20" style={{ background: item.id === 'urban-night' ? 'radial-gradient(circle at 70% 30%, #7c3aed, transparent 55%)' : item.id === 'training-grid' ? 'linear-gradient(135deg, #777, #171717)' : 'radial-gradient(circle, #aaa, #111)' }} />
              <div className="absolute bottom-1 left-2 right-2 text-[9px] font-black tracking-wider">{item.name}</div>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="text-[7px] tracking-[0.2em] text-white/35">TAP A STAGE · PREVIEW CAMERA SWEEPS AUTOMATICALLY</div>
          <button onClick={() => onConfirm(resolved)} className="shrink-0 border border-white bg-white px-7 py-2 text-[10px] font-black tracking-[0.25em] text-black active:scale-95">CONFIRM · {stage.shortName}</button>
        </div>
      </div>
    </div>
  );
}
