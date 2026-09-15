'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FighterMesh } from './FighterMesh';
import { type BannonFighterProfile } from '../data/bannonRoster';

// ── Stage geometry constants ──────────────────────────────────────────────────
const FLOOR_WIDTH = 24;
const FLOOR_DEPTH = 10;
const P1_X = -3.5;
const P2_X = 3.5;
const Z_RANGE = 2.0; // max Z sidestep distance from center

// ── Cinematic phases ──────────────────────────────────────────────────────────
export type CinematicPhase = 'sweep' | 'intro' | 'fight' | 'victory';

// ── VFX particle types ────────────────────────────────────────────────────────
interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'impact' | 'burst' | 'trail';
}

// ── Announcer voice lines (Web Speech API) ────────────────────────────────────
function useAnnouncer(enabled: boolean) {
  const speak = useCallback((text: string, pitch = 0.8, rate = 0.9) => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.pitch = pitch;
    utt.rate = rate;
    utt.volume = 0.85;
    synth.speak(utt);
  }, [enabled]);

  return { speak };
}

// ── Camera sweep for pre-fight cinematic ─────────────────────────────────────
function CinematicCamera({
  phase,
  p1X,
  p2X,
  p1Z,
  p2Z,
  fov,
}: {
  phase: CinematicPhase;
  p1X: number;
  p2X: number;
  p1Z: number;
  p2Z: number;
  fov: number;
}) {
  const { camera } = useThree();
  const sweepAngleRef = useRef(0);
  const phaseTimeRef = useRef(0);

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = fov;
    cam.near = 0.1;
    cam.far = 200;
    cam.updateProjectionMatrix();
  }, [camera, fov]);

  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    phaseTimeRef.current += delta;

    if (phase === 'sweep') {
      // Panoramic sweep around the stage
      sweepAngleRef.current += delta * 0.6;
      const angle = sweepAngleRef.current;
      const radius = 10;
      cam.position.x = Math.sin(angle) * radius;
      cam.position.y = 3.5 + Math.sin(angle * 0.5) * 1.5;
      cam.position.z = Math.cos(angle) * radius * 0.6 + 4;
      cam.lookAt(0, 1.5, 0);
      cam.updateProjectionMatrix();
    } else if (phase === 'intro') {
      // Low dramatic angle looking up at fighters
      const t = Math.min(1, phaseTimeRef.current / 1.5);
      const targetX = 0;
      const targetY = 1.0 + (1 - t) * 2;
      const targetZ = 6 + (1 - t) * 3;
      cam.position.x += (targetX - cam.position.x) * 0.05;
      cam.position.y += (targetY - cam.position.y) * 0.05;
      cam.position.z += (targetZ - cam.position.z) * 0.05;
      cam.lookAt(0, 1.2, 0);
      cam.updateProjectionMatrix();
    } else if (phase === 'fight') {
      // Dynamic midpoint tracking
      const midX = (p1X + p2X) / 2;
      const midZ = (p1Z + p2Z) / 2;
      const dist = Math.sqrt(Math.pow(p2X - p1X, 2) + Math.pow(p2Z - p1Z, 2));
      const targetZ = Math.max(5.5, Math.min(12, dist * 1.1 + 3.5));
      const targetY = 2.2;
      cam.position.x += (midX - cam.position.x) * 0.08;
      cam.position.y += (targetY - cam.position.y) * 0.06;
      cam.position.z += (targetZ + midZ * 0.3 - cam.position.z) * 0.06;
      cam.lookAt(midX, 1.2, midZ * 0.2);
      cam.updateProjectionMatrix();
    } else if (phase === 'victory') {
      // Close-up on winner (P1 side for now — caller can pass winner position)
      const targetX = p1X;
      const targetY = 1.8;
      const targetZ = 3.5;
      cam.position.x += (targetX - cam.position.x) * 0.04;
      cam.position.y += (targetY - cam.position.y) * 0.04;
      cam.position.z += (targetZ - cam.position.z) * 0.04;
      cam.lookAt(p1X, 1.5, 0);
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

// ── Blob shadow under each fighter ───────────────────────────────────────────
function BlobShadow({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <mesh position={[x, 0.005, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[0.45 * scale, 16]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}

// ── Impact particle system (canvas overlay) ───────────────────────────────────
interface VFXOverlayProps {
  particles: Particle[];
  screenFlash: number; // 0-1 intensity
  hitStopActive: boolean;
}

function VFXOverlay({ particles, screenFlash, hitStopActive }: VFXOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Screen flash
    if (screenFlash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${screenFlash * 0.35})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Hit stop chromatic aberration tint
    if (hitStopActive) {
      ctx.fillStyle = 'rgba(255,50,50,0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Particles
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      if (p.type === 'impact') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'burst') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - alpha) * 20, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'trail') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 2);
      }
    }
    ctx.globalAlpha = 1;
  });

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      className="absolute inset-0 w-full h-full pointer-events-none z-20"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}

// ── Arena stage ───────────────────────────────────────────────────────────────
function ArenaStage({ p1Color, p2Color }: { p1Color: string; p2Color: string }) {
  return (
    <group>
      {/* Floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[FLOOR_WIDTH, FLOOR_DEPTH]} />
        <meshStandardMaterial color="#111111" roughness={0.85} metalness={0.15} />
      </mesh>
      {/* Floor grid */}
      <gridHelper args={[FLOOR_WIDTH, 24, '#222222', '#1a1a1a']} position={[0, 0.002, 0]} />
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
      {/* Side walls */}
      <mesh position={[-FLOOR_WIDTH / 2, 3, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[FLOOR_DEPTH, 8]} />
        <meshStandardMaterial color="#080808" roughness={1} />
      </mesh>
      <mesh position={[FLOOR_WIDTH / 2, 3, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[FLOOR_DEPTH, 8]} />
        <meshStandardMaterial color="#080808" roughness={1} />
      </mesh>
      {/* Faction floor glows */}
      <pointLight position={[P1_X, 0.5, 0]} intensity={1.2} color={p1Color} distance={4} decay={2} />
      <pointLight position={[P2_X, 0.5, 0]} intensity={1.2} color={p2Color} distance={4} decay={2} />
      <pointLight position={[0, 6, -4]} intensity={0.6} color="#1a1a2e" distance={20} decay={1} />
    </group>
  );
}

// ── Arena lighting ────────────────────────────────────────────────────────────
function ArenaLighting({ p1Color, p2Color }: { p1Color: string; p2Color: string }) {
  return (
    <>
      <ambientLight intensity={0.3} color="#c8d0e0" />
      <directionalLight
        position={[0, 8, 4]} intensity={2.5} color="#fff8f0"
        castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}
      />
      <directionalLight position={[-5, 4, 3]} intensity={0.8} color="#a0b8ff" />
      <directionalLight position={[0, 5, -6]} intensity={1.0} color="#ffffff" />
      <spotLight
        position={[P1_X - 2, 6, 2]}
        intensity={1.5} color={p1Color} angle={0.4} penumbra={0.6} distance={12} decay={2}
      />
      <spotLight
        position={[P2_X + 2, 6, 2]}
        intensity={1.5} color={p2Color} angle={0.4} penumbra={0.6} distance={12} decay={2}
      />
    </>
  );
}

// ── Intro animation overlay (2D cinematic bars + text) ────────────────────────
function IntroOverlay({
  phase,
  p1Name,
  p2Name,
}: {
  phase: CinematicPhase;
  p1Name: string;
  p2Name: string;
}) {
  if (phase !== 'sweep' && phase !== 'intro') return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {/* Cinematic letterbox bars */}
      <div className="absolute top-0 left-0 right-0 h-[12%] bg-black" />
      <div className="absolute bottom-0 left-0 right-0 h-[12%] bg-black" />

      {phase === 'sweep' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-[9px] tracking-[0.6em] text-zinc-500 animate-pulse">LOADING ARENA</div>
            <div className="mt-2 text-2xl font-black tracking-widest text-white">BRUTAL FIST</div>
          </div>
        </div>
      )}

      {phase === 'intro' && (
        <div className="absolute inset-0 flex items-end justify-between px-8 pb-[14%]">
          <div className="text-left">
            <div className="text-[8px] tracking-[0.4em] text-zinc-500">PLAYER 1</div>
            <div className="text-2xl font-black tracking-widest text-white animate-pulse">
              {p1Name.toUpperCase()}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black tracking-[0.3em] text-yellow-400">VS</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] tracking-[0.4em] text-zinc-500">PLAYER 2</div>
            <div className="text-2xl font-black tracking-widest text-white animate-pulse">
              {p2Name.toUpperCase()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Victory cinematic overlay ─────────────────────────────────────────────────
function VictoryOverlay({
  phase,
  winnerName,
}: {
  phase: CinematicPhase;
  winnerName?: string;
}) {
  if (phase !== 'victory' || !winnerName) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      <div className="absolute top-0 left-0 right-0 h-[12%] bg-black" />
      <div className="absolute bottom-0 left-0 right-0 h-[12%] bg-black" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="text-[9px] tracking-[0.6em] text-zinc-400">WINNER</div>
        <div
          className="text-4xl font-black tracking-widest text-yellow-400"
          style={{ textShadow: '0 0 40px #facc15, 0 0 80px #facc1544' }}
        >
          {winnerName.toUpperCase()}
        </div>
        <div className="text-sm tracking-[0.4em] text-white mt-1">WINS</div>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export interface CombatArena3DProps {
  p1Fighter: BannonFighterProfile;
  p2Fighter: BannonFighterProfile;
  p1State: string;
  p2State: string;
  p1Animation: string;
  p2Animation: string;
  p1Color: string;
  p2Color: string;
  hitStopActive: boolean;
  p1SkinTint?: string;
  p2SkinTint?: string;
  /** Z-axis positions for sidestepping */
  p1Z?: number;
  p2Z?: number;
  /** Cinematic phase control */
  cinematicPhase?: CinematicPhase;
  /** Winner name for victory pose */
  winnerName?: string;
  /** Camera FOV override */
  cameraFov?: number;
  /** Whether announcer is enabled */
  announcerEnabled?: boolean;
  /** Damage event to trigger VFX — increment to fire */
  damageEvent?: { count: number; player: 'p1' | 'p2'; damage: number; isCounter: boolean; factionColor: string };
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
  p1Z = 0,
  p2Z = 0,
  cinematicPhase = 'fight',
  winnerName,
  cameraFov = 55,
  announcerEnabled = true,
  damageEvent,
}: CombatArena3DProps) {
  // ── Particles state ──────────────────────────────────────────────────────────
  const [particles, setParticles] = useState<Particle[]>([]);
  const [screenFlash, setScreenFlash] = useState(0);
  const particleIdRef = useRef(0);
  const flashRafRef = useRef<number>(0);
  const prevDamageEventRef = useRef<typeof damageEvent>(undefined);

  // ── Announcer ────────────────────────────────────────────────────────────────
  const { speak } = useAnnouncer(announcerEnabled);

  // Announce phase changes
  useEffect(() => {
    if (cinematicPhase === 'intro') {
      const t1 = setTimeout(() => speak('Round 1', 0.7, 0.85), 800);
      const t2 = setTimeout(() => speak('Fight!', 0.65, 1.0), 2200);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (cinematicPhase === 'victory' && winnerName) {
      const t = setTimeout(() => speak(`${winnerName} wins!`, 0.7, 0.9), 400);
      return () => clearTimeout(t);
    }
  }, [cinematicPhase, winnerName, speak]);

  // ── VFX: spawn particles on damage ──────────────────────────────────────────
  useEffect(() => {
    if (!damageEvent) return;
    if (prevDamageEventRef.current?.count === damageEvent.count) return;
    prevDamageEventRef.current = damageEvent;

    const { player, damage, isCounter, factionColor } = damageEvent;
    const baseX = player === 'p2' ? 0.65 : 0.35;
    const screenX = baseX * 800 + (Math.random() - 0.5) * 80;
    const screenY = 200 + Math.random() * 120;

    const newParticles: Particle[] = [];

    // Impact sparks
    for (let i = 0; i < 12; i++) {
      newParticles.push({
        id: ++particleIdRef.current,
        x: screenX,
        y: screenY,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 3,
        life: 0.6 + Math.random() * 0.4,
        maxLife: 0.6 + Math.random() * 0.4,
        color: isCounter ? '#ff6600' : '#ffffff',
        size: 3 + Math.random() * 4,
        type: 'impact',
      });
    }

    // Faction-colored burst ring
    newParticles.push({
      id: ++particleIdRef.current,
      x: screenX,
      y: screenY,
      vx: 0,
      vy: 0,
      life: 0.5,
      maxLife: 0.5,
      color: factionColor,
      size: damage > 300 ? 30 : 18,
      type: 'burst',
    });

    // Knockback trail (heavy hits)
    if (damage > 200) {
      for (let i = 0; i < 6; i++) {
        newParticles.push({
          id: ++particleIdRef.current,
          x: screenX + (player === 'p2' ? i * 12 : -i * 12),
          y: screenY + i * 4,
          vx: player === 'p2' ? 2 : -2,
          vy: -1,
          life: 0.4,
          maxLife: 0.4,
          color: factionColor,
          size: 4 - i * 0.5,
          type: 'trail',
        });
      }
    }

    setParticles(prev => [...prev.slice(-40), ...newParticles]);

    // Screen flash
    setScreenFlash(damage > 300 ? 0.8 : 0.4);
    cancelAnimationFrame(flashRafRef.current);
    const fadeFlash = () => {
      setScreenFlash(prev => {
        if (prev < 0.02) return 0;
        flashRafRef.current = requestAnimationFrame(fadeFlash);
        return prev * 0.82;
      });
    };
    flashRafRef.current = requestAnimationFrame(fadeFlash);

    // Announcer counter hit
    if (isCounter) {
      speak('Counter hit!', 0.75, 1.1);
    }
  }, [damageEvent, speak]);

  // Particle tick
  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles(prev => {
        const next = prev
          .map(p => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + 0.3,
            life: p.life - 0.016,
          }))
          .filter(p => p.life > 0);
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [particles.length]);

  // Derive fighter X positions from state
  const p1XOffset = p1State === 'Startup' || p1State === 'Active' ? 0.3 : 0;
  const p2XOffset = p2State === 'Startup' || p2State === 'Active' ? -0.3 : 0;
  const p1FinalX = P1_X + p1XOffset;
  const p2FinalX = P2_X + p2XOffset;

  // Clamp Z sidestep
  const p1FinalZ = Math.max(-Z_RANGE, Math.min(Z_RANGE, p1Z));
  const p2FinalZ = Math.max(-Z_RANGE, Math.min(Z_RANGE, p2Z));

  return (
    <div className="relative w-full h-full">
      <Canvas
        shadows
        gl={{ antialias: false, alpha: false }}
        style={{ width: '100%', height: '100%', background: '#050505' }}
        camera={{ position: [0, 2.2, 8], fov: cameraFov, near: 0.1, far: 200 }}
      >
        <color attach="background" args={['#050508']} />
        <fog attach="fog" args={['#050508', 18, 40]} />

        <ArenaLighting p1Color={p1Color} p2Color={p2Color} />
        <ArenaStage p1Color={p1Color} p2Color={p2Color} />

        {/* Blob shadows */}
        <BlobShadow x={p1FinalX} z={p1FinalZ} scale={p1State === 'KO' ? 0.7 : 1} />
        <BlobShadow x={p2FinalX} z={p2FinalZ} scale={p2State === 'KO' ? 0.7 : 1} />

        {/* P1 Fighter */}
        <FighterMesh
          state={p1State}
          animation={p1Animation}
          modelUrl={p1Fighter.portraitUrl}
          position={[p1FinalX, 0, p1FinalZ]}
          facing={1}
          rotationY={0}
          tint={p1SkinTint ?? p1Color}
        />

        {/* P2 Fighter */}
        <FighterMesh
          state={p2State}
          animation={p2Animation}
          modelUrl={p2Fighter.portraitUrl}
          position={[p2FinalX, 0, p2FinalZ]}
          facing={-1}
          rotationY={Math.PI}
          tint={p2SkinTint ?? p2Color}
        />

        {/* Cinematic camera */}
        <CinematicCamera
          phase={cinematicPhase}
          p1X={p1FinalX}
          p2X={p2FinalX}
          p1Z={p1FinalZ}
          p2Z={p2FinalZ}
          fov={cameraFov}
        />

        {/* Hit-stop ambient flash */}
        {hitStopActive && <ambientLight intensity={0.8} color="#ffffff" />}
      </Canvas>

      {/* 2D VFX overlay */}
      <VFXOverlay
        particles={particles}
        screenFlash={screenFlash}
        hitStopActive={hitStopActive}
      />

      {/* Cinematic intro overlay */}
      <IntroOverlay
        phase={cinematicPhase}
        p1Name={p1Fighter.name}
        p2Name={p2Fighter.name}
      />

      {/* Victory cinematic overlay */}
      <VictoryOverlay phase={cinematicPhase} winnerName={winnerName} />
    </div>
  );
}
