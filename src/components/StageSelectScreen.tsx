'use client';

import React, { useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { type BannonFighterProfile } from '../data/bannonRoster';
import { TrainingStage } from './TrainingStage';
import { UrbanNightStage } from './UrbanNightStage';
import { type StageId, STAGE_CONFIGS } from '../engine/combat/StageConfig';

// Re-export StageId so existing imports from this file still work
export type { StageId };

// ── Stage UI entry (extends StageConfig with display-only fields) ─────────────
interface StageEntry {
  id: StageId;
  name: string;
  subtitle: string;
  accentColor: string;
  bgColor: string;
  /** Feature badges shown on the card */
  badges: string[];
  /** Short flavour description */
  description: string;
}

const STAGES: StageEntry[] = [
  {
    id: 'random',
    name: 'RANDOM',
    subtitle: 'FATE DECIDES',
    accentColor: '#f59e0b',
    bgColor: '#1c1400',
    badges: [],
    description: 'Let the arena choose your fate.',
  },
  {
    id: 'urban_night',
    name: 'URBAN NIGHT',
    subtitle: 'UNDERGROUND DISTRICT',
    accentColor: '#a855f7',
    bgColor: '#0d0014',
    badges: ['WALLS'],
    description: 'Neon-lit back alleys. Wall splats welcome.',
  },
  {
    id: 'training',
    name: 'TRAINING GRID',
    subtitle: 'VOID ARENA',
    accentColor: '#22d3ee',
    bgColor: '#001418',
    badges: ['WALLS'],
    description: 'Infinite void. Perfect for practice.',
  },
  {
    id: 'dojo',
    name: 'DOJO',
    subtitle: 'ANCIENT TRAINING HALL',
    accentColor: '#f97316',
    bgColor: '#1a0800',
    badges: ['2 LEVELS', 'BREAKABLE'],
    description: 'Slam opponents through the wooden floor to the lower dojo.',
  },
  {
    id: 'wrestling_ring',
    name: 'WRESTLING RING',
    subtitle: 'THE SQUARED CIRCLE',
    accentColor: '#ef4444',
    bgColor: '#1a0000',
    badges: ['RING OUT', 'NO WALLS'],
    description: 'Throw them over the ropes for a ring-out KO.',
  },
  {
    id: 'mma_octagon',
    name: 'MMA OCTAGON',
    subtitle: 'THE CAGE',
    accentColor: '#facc15',
    bgColor: '#0f0f00',
    badges: ['WALLS', 'CAGE'],
    description: 'Eight-sided cage. No escape from wall splats.',
  },
  {
    id: 'steel_cage',
    name: 'STEEL CAGE',
    subtitle: 'NO ESCAPE',
    accentColor: '#94a3b8',
    bgColor: '#0a0a0a',
    badges: ['WALLS', 'CAGE'],
    description: 'Cold steel walls. Every slam echoes.',
  },
  {
    id: 'industrial',
    name: 'INDUSTRIAL',
    subtitle: 'FACTORY FLOOR',
    accentColor: '#f59e0b',
    bgColor: '#0f0800',
    badges: ['2 LEVELS', 'BREAKABLE', 'HAZARD'],
    description: 'Break through the catwalk into molten metal below.',
  },
  {
    id: 'ghetto_streets',
    name: 'GHETTO STREETS',
    subtitle: 'BACK ALLEY BRAWL',
    accentColor: '#84cc16',
    bgColor: '#0a0f00',
    badges: ['RING OUT', 'NO WALLS', 'OPEN'],
    description: 'Open streets. No boundaries. Ring-out anywhere.',
  },
  {
    id: 'junkyard',
    name: 'JUNKYARD',
    subtitle: 'SCRAP METAL GRAVEYARD',
    accentColor: '#78716c',
    bgColor: '#0c0a08',
    badges: ['2 LEVELS', 'BREAKABLE', 'RING OUT'],
    description: 'Crash through scrap piles to the lower yard.',
  },
  {
    id: 'sky_crane',
    name: 'SKY CRANE',
    subtitle: 'HIGH ALTITUDE PLATFORM',
    accentColor: '#38bdf8',
    bgColor: '#00080f',
    badges: ['2 LEVELS', 'BREAKABLE', 'RING OUT'],
    description: 'Narrow crane platform high above the city. One slip = ring-out.',
  },
  {
    id: 'spike_pit',
    name: 'SPIKE PIT',
    subtitle: 'MORTAL HAZARD',
    accentColor: '#dc2626',
    bgColor: '#0f0000',
    badges: ['2 LEVELS', 'BREAKABLE', '⚠ SPIKES'],
    description: 'Slam them through the floor into the spike pit below.',
  },
  {
    id: 'acid_pit',
    name: 'ACID PIT',
    subtitle: 'CORROSIVE DEPTHS',
    accentColor: '#a3e635',
    bgColor: '#030f00',
    badges: ['2 LEVELS', 'BREAKABLE', '☣ ACID'],
    description: 'Break the bridge. Watch them dissolve in the acid pool.',
  },
  {
    id: 'grinder_pit',
    name: 'GRINDER PIT',
    subtitle: 'INDUSTRIAL DEATH TRAP',
    accentColor: '#f97316',
    bgColor: '#0f0500',
    badges: ['2 LEVELS', 'BREAKABLE', '⚙ GRINDER'],
    description: 'Catwalk above spinning industrial grinders. One slam ends it.',
  },
  {
    id: 'gang_brawl',
    name: 'GANG BRAWL',
    subtitle: 'NO RULES — NO WALLS',
    accentColor: '#e879f9',
    bgColor: '#0f0014',
    badges: ['2 LEVELS', 'BREAKABLE', 'RING OUT', 'NO WALLS'],
    description: 'Open streets, multi-level chaos. Anything goes.',
  },
  {
    id: 'subway',
    name: 'SUBWAY',
    subtitle: 'UNDERGROUND TRANSIT',
    accentColor: '#f59e0b',
    bgColor: '#0a0800',
    badges: ['2 LEVELS', '🚇 TRAIN', 'VAULT ESCAPE'],
    description: 'Fight on the platform or the tracks. The train runs on its own schedule — no warnings, just chaos.',
  },
];

const REAL_STAGES: StageId[] = STAGES.filter(s => s.id !== 'random').map(s => s.id);

// ── Cinematic background camera ───────────────────────────────────────────────
function CinematicCamera() {
  const { camera } = useThree();

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const cam = camera as THREE.PerspectiveCamera;

    const orbitRadius = 9;
    const orbitSpeed = 0.18;
    const angle = t * orbitSpeed;

    cam.position.x = Math.sin(angle) * orbitRadius;
    cam.position.z = Math.cos(angle) * orbitRadius * 0.7 + 3;
    cam.position.y = 2.5 + Math.sin(t * 0.35) * 2.2;

    cam.lookAt(0, 1.2, 0);
    cam.fov = 60 + Math.sin(t * 0.22) * 4;
    cam.updateProjectionMatrix();
  });

  return null;
}

// ── Stage geometry renderer ───────────────────────────────────────────────────
function StageGeometry({ stageId }: { stageId: StageId }) {
  const resolvedId = stageId === 'random' ? 'urban_night' : stageId;

  // Resolve config for lighting
  const cfg = resolvedId !== 'random' ? STAGE_CONFIGS[resolvedId as Exclude<StageId, 'random'>] : null;
  const ambientColor = cfg?.ambientColor ?? '#1a0030';
  const primaryColor = cfg?.primaryLightColor ?? '#ffffff';
  const fillColor = cfg?.fillLightColor ?? '#334155';
  const ambientIntensity = cfg?.ambientIntensity ?? 0.25;
  const accentColor = cfg?.accentColor ?? '#a855f7';

  if (resolvedId === 'training') {
    return (
      <>
        <ambientLight intensity={0.35} color="#c8d0e0" />
        <directionalLight position={[0, 8, 4]} intensity={2.5} color="#fff8f0" />
        <directionalLight position={[-5, 4, 3]} intensity={0.8} color="#a0b8ff" />
        <directionalLight position={[0, 5, -6]} intensity={1.0} color="#ffffff" />
        <pointLight position={[0, 4, 0]} intensity={1.5} color="#22d3ee" distance={12} decay={2} />
        <TrainingStage p1Color="#22d3ee" p2Color="#22d3ee" />
      </>
    );
  }

  if (resolvedId === 'urban_night') {
    return <UrbanNightStage p1Color="#a855f7" p2Color="#a855f7" />;
  }

  // Generic procedural stage preview for new arenas
  return (
    <>
      <ambientLight intensity={ambientIntensity} color={ambientColor} />
      <directionalLight position={[0, 8, 4]} intensity={2.0} color={primaryColor} />
      <directionalLight position={[-5, 4, 3]} intensity={0.6} color={fillColor} />
      <pointLight position={[0, 3, 0]} intensity={2.0} color={accentColor} distance={14} decay={2} />
      <pointLight position={[4, 2, -2]} intensity={1.0} color={primaryColor} distance={10} decay={2} />
      <pointLight position={[-4, 2, -2]} intensity={1.0} color={fillColor} distance={10} decay={2} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color={ambientColor} roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Floor grid lines */}
      <gridHelper args={[20, 20, accentColor, fillColor]} position={[0, 0, 0]} />

      {/* Accent pillars */}
      {[-4, 4].map((x, i) => (
        <mesh key={i} position={[x, 1.5, -3]}>
          <boxGeometry args={[0.3, 3, 0.3]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.4} />
        </mesh>
      ))}

      {/* Stage name plate glow strip */}
      <mesh position={[0, 0.02, -3.5]}>
        <planeGeometry args={[8, 0.15]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={1.5} />
      </mesh>

      {/* Fog-like background plane */}
      <mesh position={[0, 3, -6]}>
        <planeGeometry args={[20, 10]} />
        <meshStandardMaterial color={ambientColor} transparent opacity={0.6} />
      </mesh>
    </>
  );
}

// ── Feature badge pill ────────────────────────────────────────────────────────
function Badge({ label, accentColor }: { label: string; accentColor: string }) {
  return (
    <span
      className="text-[6px] font-black tracking-wider px-1 py-0.5 border leading-none"
      style={{ borderColor: `${accentColor}66`, color: accentColor, background: `${accentColor}18` }}
    >
      {label}
    </span>
  );
}

// ── Thumbnail card ────────────────────────────────────────────────────────────
function StageThumbnail({
  stage,
  isSelected,
  onTap,
}: {
  stage: StageEntry;
  isSelected: boolean;
  onTap: () => void;
}) {
  return (
    <button
      onClick={onTap}
      className="relative flex-shrink-0 w-28 h-20 border-2 transition-all duration-200 active:scale-95 overflow-hidden"
      style={{
        borderColor: isSelected ? stage.accentColor : '#3f3f46',
        background: stage.bgColor,
        boxShadow: isSelected ? `0 0 18px ${stage.accentColor}55` : 'none',
      }}
    >
      {/* Scanline texture */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)',
        }}
      />

      {/* Stage icon / label */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full gap-1 px-1">
        {stage.id === 'random' ? (
          <div className="text-2xl font-black" style={{ color: stage.accentColor }}>
            ?
          </div>
        ) : (
          <div
            className="w-8 h-8 rounded-sm opacity-70"
            style={{
              background: `radial-gradient(circle at 40% 40%, ${stage.accentColor}44, ${stage.bgColor})`,
              border: `1px solid ${stage.accentColor}44`,
            }}
          />
        )}
        <div
          className="text-[7px] font-black tracking-widest text-center leading-tight"
          style={{ color: isSelected ? stage.accentColor : '#a1a1aa' }}
        >
          {stage.name}
        </div>
      </div>

      {/* Selected indicator bar */}
      {isSelected && (
        <div
          className="absolute bottom-0 left-0 right-0 h-0.5"
          style={{ background: stage.accentColor }}
        />
      )}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface StageSelectScreenProps {
  p1Fighter: BannonFighterProfile;
  p2Fighter: BannonFighterProfile;
  onConfirm: (stageId: StageId) => void;
  onBack: () => void;
}

export default function StageSelectScreen({
  p1Fighter,
  p2Fighter,
  onConfirm,
  onBack,
}: StageSelectScreenProps) {
  const [selectedIdx, setSelectedIdx] = useState(1); // default: urban_night
  const [confirming, setConfirming] = useState(false);

  const selectedStage = STAGES[selectedIdx];

  const handleConfirm = useCallback(() => {
    if (confirming) return;
    setConfirming(true);
    const finalId: StageId =
      selectedStage.id === 'random'
        ? REAL_STAGES[Math.floor(Math.random() * REAL_STAGES.length)]
        : selectedStage.id;
    setTimeout(() => onConfirm(finalId), 600);
  }, [confirming, selectedStage, onConfirm]);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden font-mono select-none">
      {/* ── LIVE 3D BACKGROUND CANVAS ── */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 3, 9], fov: 60 }}
          gl={{ antialias: false, powerPreference: 'low-power' }}
          dpr={[1, 1.5]}
        >
          <CinematicCamera />
          <StageGeometry stageId={selectedStage.id} />
        </Canvas>
      </div>

      {/* ── DARK VIGNETTE OVERLAY ── */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.75) 100%)',
        }}
      />

      {/* ── CONFIRM FLASH ── */}
      {confirming && (
        <div className="absolute inset-0 z-50 bg-white animate-ping opacity-30 pointer-events-none" />
      )}

      {/* ── TOP HEADER ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-safe pt-4">
        <button
          onClick={onBack}
          className="text-[9px] tracking-[0.4em] text-zinc-500 hover:text-white transition-colors border border-zinc-800 px-3 py-1.5 bg-black/60"
        >
          ← BACK
        </button>
        <div className="text-[8px] tracking-[0.5em] text-zinc-600">SELECT STAGE</div>
        <div className="text-[8px] tracking-widest text-zinc-700 text-right">
          <span className="text-zinc-500">{p1Fighter.name.toUpperCase()}</span>
          <span className="text-zinc-700 mx-1">VS</span>
          <span className="text-zinc-500">{p2Fighter.name.toUpperCase()}</span>
        </div>
      </div>

      {/* ── STAGE INFO OVERLAY (center) ── */}
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none px-6">
        <div
          className="text-[9px] tracking-[0.6em] mb-2 transition-all duration-300"
          style={{ color: selectedStage.accentColor }}
        >
          {selectedStage.subtitle}
        </div>
        <div
          className="text-4xl md:text-5xl font-black tracking-[0.12em] transition-all duration-300 drop-shadow-2xl mb-3"
          style={{
            color: '#ffffff',
            textShadow: `0 0 40px ${selectedStage.accentColor}88, 0 2px 0 rgba(0,0,0,0.8)`,
          }}
        >
          {selectedStage.name}
        </div>

        {/* Description */}
        {selectedStage.description && (
          <div
            className="text-[9px] tracking-wider text-center max-w-xs mb-3 opacity-70"
            style={{ color: selectedStage.accentColor }}
          >
            {selectedStage.description}
          </div>
        )}

        {/* Feature badges */}
        {selectedStage.badges.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {selectedStage.badges.map((b) => (
              <Badge key={b} label={b} accentColor={selectedStage.accentColor} />
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM UI PANEL ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-safe">
        {/* Gradient fade up */}
        <div
          className="h-24 pointer-events-none"
          style={{
            background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.92))',
          }}
        />

        <div className="bg-black/90 px-4 pt-3 pb-6">
          {/* Thumbnail row */}
          <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {STAGES.map((stage, idx) => (
              <StageThumbnail
                key={stage.id}
                stage={stage}
                isSelected={idx === selectedIdx}
                onTap={() => setSelectedIdx(idx)}
              />
            ))}
          </div>

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={confirming}
            className="w-full py-4 font-black tracking-[0.3em] text-sm transition-all duration-200 active:scale-95 border-2 mt-1"
            style={{
              borderColor: confirming ? '#52525b' : selectedStage.accentColor,
              color: confirming ? '#52525b' : selectedStage.accentColor,
              background: confirming
                ? 'rgba(0,0,0,0.4)'
                : `${selectedStage.accentColor}18`,
              boxShadow: confirming ? 'none' : `0 0 20px ${selectedStage.accentColor}33`,
            }}
          >
            {confirming ? 'LOADING ARENA...' : '▶ CONFIRM STAGE'}
          </button>
        </div>
      </div>
    </div>
  );
}
