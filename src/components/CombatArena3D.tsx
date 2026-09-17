'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FighterMesh } from './FighterMesh';
import { type BannonFighterProfile } from '../data/bannonRoster';
import { getFighterGlbUrl } from '../data/bannonGlbRoster';
import { TrainingStage } from './TrainingStage';
import { UrbanNightStage } from './UrbanNightStage';
import { ProceduralStage } from './ProceduralStage';
import { type StageId, resolveStageConfig } from '../engine/combat/StageConfig';
import { CHARACTER_BLOOM } from './PostMatchScreen';
import { createHitEffectPool, spawnHitEffect, tickHitEffectPool, getHitEffectRenderData, getActivePointLights, type HitEffectPool, type HitEffectType, type PointLightFlash,  } from '../engine/combat/HitEffectSystem';
import { COMBAT_P1_YAW, COMBAT_P2_YAW, COMBAT_FIGHTER_Y, HIT_FX_WORLD_Y, HIT_FX_SCREEN_Y } from '../engine/V7OrientationContract';

// Stage IDs come from StageConfig — every catalog arena is legal here.


// ── Stage geometry constants ──────────────────────────────────────────────────
const FLOOR_DEPTH = 10;
// Mobile-safe spawn positions — inward to X: ±1.8
const P1_X = -1.8;
const P2_X = 1.8;
const Z_RANGE = 2.0;

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
  shakeOffset,
}: {
  phase: CinematicPhase;
  p1X: number;
  p2X: number;
  p1Z: number;
  p2Z: number;
  fov: number;
  shakeOffset?: { x: number; y: number };
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
      sweepAngleRef.current += delta * 0.6;
      const angle = sweepAngleRef.current;
      const radius = 10;
      cam.position.x = Math.sin(angle) * radius;
      cam.position.y = 3.5 + Math.sin(angle * 0.5) * 1.5;
      cam.position.z = Math.cos(angle) * radius * 0.6 + 4;
      cam.lookAt(0, 1.5, 0);
      cam.updateProjectionMatrix();
    } else if (phase === 'intro') {
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
      const midX = (p1X + p2X) / 2;
      const midZ = (p1Z + p2Z) / 2;
      const dist = Math.sqrt(Math.pow(p2X - p1X, 2) + Math.pow(p2Z - p1Z, 2));
      const targetCamZ = Math.max(4.5, Math.min(11, dist * 1.05 + 3.0));
      const targetCamY = 2.0 + dist * 0.05;
      cam.position.x += (midX - cam.position.x) * 0.1;
      cam.position.y += (targetCamY - cam.position.y) * 0.07;
      cam.position.z += (targetCamZ + midZ * 0.25 - cam.position.z) * 0.08;
      // ── Camera shake from hit effect system ──────────────────────────────
      if (shakeOffset && (Math.abs(shakeOffset.x) > 0.001 || Math.abs(shakeOffset.y) > 0.001)) {
        cam.position.x += shakeOffset.x * 0.01;
        cam.position.y += shakeOffset.y * 0.01;
      }
      cam.lookAt(midX, 1.1, midZ * 0.15);
      cam.updateProjectionMatrix();
    } else if (phase === 'victory') {
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
  screenFlash: number;
  hitStopActive: boolean;
  hitEffectPool?: HitEffectPool;
}

function VFXOverlay({ particles, screenFlash, hitStopActive, hitEffectPool }: VFXOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── Screen flash ──────────────────────────────────────────────────────
    const totalFlash = Math.max(screenFlash, hitEffectPool?.screenFlash ?? 0);
    if (totalFlash > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${totalFlash * 0.35})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (hitStopActive) {
      ctx.fillStyle = 'rgba(255,50,50,0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // ── Legacy particles (dust, knockdown) ───────────────────────────────
    for (const p of particles) {
      // CRITICAL: clamp alpha to [0,1] — p.life can exceed p.maxLife on the
      // frame a particle is spawned (delta overshoot) producing alpha > 1,
      // which makes (1 - alpha) negative and causes ctx.arc() to throw
      // IndexSizeError: negative radius.
      const alpha = Math.min(1, Math.max(0, p.life / p.maxLife));
      ctx.globalAlpha = alpha;
      if (p.type === 'impact') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0, p.size * alpha), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'burst') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * 0.5;
        ctx.beginPath();
        // (1 - alpha) is always in [0,1] now that alpha is clamped, so radius >= 0
        ctx.arc(p.x, p.y, Math.max(0, p.size * (1 - alpha) * 20), 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'trail') {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 2);
      }
    }

    // ── AAA 3-layer billboarded hit effects ───────────────────────────────
    if (hitEffectPool) {
      const renderData = getHitEffectRenderData(hitEffectPool);
      for (const effect of renderData) {
        const { screenX, screenY, characterColor, scale, alpha, type, streaks, coreRadius, coronaRadius } = effect;

        ctx.save();
        ctx.translate(screenX, screenY);

        // ── Layer 3: Directional streaks (behind everything) ──────────────
        for (const streak of streaks) {
          ctx.save();
          ctx.rotate(streak.angle);
          ctx.globalAlpha = streak.alpha * alpha;
          ctx.strokeStyle = streak.color;
          ctx.lineWidth = streak.width;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(streak.length, 0);
          ctx.stroke();
          ctx.restore();
        }

        // ── Layer 2: Character color corona ───────────────────────────────
        if (type === 'block') {
          // Block: circular shield spark (pale blue/grey)
          ctx.globalAlpha = alpha * 0.8;
          const safeCoronaBlock = Math.max(0.001, coronaRadius);
          const shieldGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, safeCoronaBlock);
          shieldGrad.addColorStop(0, 'rgba(138,180,212,0.9)');
          shieldGrad.addColorStop(0.5, 'rgba(138,180,212,0.4)');
          shieldGrad.addColorStop(1, 'rgba(138,180,212,0)');
          ctx.fillStyle = shieldGrad;
          ctx.beginPath();
          ctx.arc(0, 0, safeCoronaBlock, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Clean hit / counter-hit: character color corona
          ctx.globalAlpha = alpha * 0.85;
          const safeCorona = Math.max(0.001, coronaRadius);
          const coronaGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, safeCorona);
          const hex = characterColor;
          coronaGrad.addColorStop(0, `${hex}ff`);
          coronaGrad.addColorStop(0.4, `${hex}cc`);
          coronaGrad.addColorStop(1, `${hex}00`);
          ctx.fillStyle = coronaGrad;
          ctx.beginPath();
          ctx.arc(0, 0, safeCorona, 0, Math.PI * 2);
          ctx.fill();
        }

        // ── Layer 1: White-hot core (always pure white, always on top) ────
        ctx.globalAlpha = alpha;
        const safeCore = Math.max(0.001, coreRadius);
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, safeCore);
        coreGrad.addColorStop(0, 'rgba(255,255,255,1)');
        coreGrad.addColorStop(0.6, 'rgba(255,255,255,0.8)');
        coreGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, safeCore, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
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

// ── Training stage lighting ───────────────────────────────────────────────────
function TrainingLighting({ p1Color, p2Color }: { p1Color: string; p2Color: string }) {
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

// ── Intro animation overlay ───────────────────────────────────────────────────
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

// ── Per-character hit bloom config ────────────────────────────────────────────
// Each fighter emits their own color/style on impact — Tekken-style
function getCharacterHitBloom(fighterId: string, factionColor: string) {
  const bloom = CHARACTER_BLOOM[fighterId] ?? CHARACTER_BLOOM.default;
  return bloom.primary ?? factionColor;
}

// ── Dust particle burst on knockdown ─────────────────────────────────────────
function spawnKnockdownDust(
  screenX: number,
  screenY: number,
  particleIdRef: React.MutableRefObject<number>,
): Particle[] {
  const dust: Particle[] = [];
  // Ground-level dust cloud — 16 particles spreading outward
  for (let i = 0; i < 16; i++) {
    const angle = (Math.PI * i) / 8; // spread in semicircle upward
    const speed = 2 + Math.random() * 5;
    dust.push({
      id: ++particleIdRef.current,
      x: screenX + (Math.random() - 0.5) * 30,
      y: screenY,
      vx: Math.cos(angle) * speed,
      vy: -Math.abs(Math.sin(angle) * speed) - 1, // always upward
      life: 0.8 + Math.random() * 0.5,
      maxLife: 0.8 + Math.random() * 0.5,
      color: '#c4a882', // dust/sand color
      size: 5 + Math.random() * 8,
      type: 'impact',
    });
  }
  // Larger slow-rising dust puffs
  for (let i = 0; i < 5; i++) {
    dust.push({
      id: ++particleIdRef.current,
      x: screenX + (Math.random() - 0.5) * 50,
      y: screenY,
      vx: (Math.random() - 0.5) * 2,
      vy: -0.5 - Math.random() * 1.5,
      life: 1.2 + Math.random() * 0.6,
      maxLife: 1.2 + Math.random() * 0.6,
      color: '#a89070',
      size: 14 + Math.random() * 12,
      type: 'burst',
    });
  }
  return dust;
}

// ── AAA Hit Effect Pool (replaces old spawnCharacterBloom) ───────────────────
// Pre-allocated pool of 5 slots — no new mesh creation on every hit
const hitEffectPoolRef = { current: createHitEffectPool() };

// ── Point light flash component (Three.js) ────────────────────────────────────
function HitPointLights({ lights }: { lights: PointLightFlash[] }) {
  return (
    <>
      {lights.map((light, i) => (
        <pointLight
          key={i}
          position={[light.x, light.y, light.z]}
          color={light.color}
          intensity={light.intensity}
          distance={4}
          decay={2}
        />
      ))}
    </>
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
  p1Z?: number;
  p2Z?: number;
  /** Dynamic world-space X positions driven by LocomotionSystem */
  p1X?: number;
  p2X?: number;
  p1Y?: number;
  p2Y?: number;
  cinematicPhase?: CinematicPhase;
  winnerName?: string;
  cameraFov?: number;
  announcerEnabled?: boolean;
  damageEvent?: { count: number; player: 'p1' | 'p2'; damage: number; isCounter: boolean; factionColor: string };
  /** Knockdown event — triggers dust particle burst */
  knockdownEvent?: { count: number; player: 'p1' | 'p2' };
  /** Stage selection — defaults to 'urban_night' */
  stageId?: StageId;
  /** Animation trigger counters — increment to force re-trigger on repeated same-key attacks */
  p1AnimTrigger?: number;
  p2AnimTrigger?: number;
  /** Locomotion velocity from FighterStateMachine — used for velocity-gated animation blending */
  p1LocomotionVelocity?: { forward: number; strafe: number };
  p2LocomotionVelocity?: { forward: number; strafe: number };
  /** Callbacks to receive bone hitbox system references from FighterMesh */
  onP1BoneHitboxReady?: (system: import('../engine/locomotion/BoneHitboxSystem').BoneHitboxSystem) => void;
  onP2BoneHitboxReady?: (system: import('../engine/locomotion/BoneHitboxSystem').BoneHitboxSystem) => void;
  /** Wall-splat event — triggers wall-splat VFX */
  wallSplatEvent?: { count: number; player: 'p1' | 'p2'; wall: 'left' | 'right' };
  /** Heat Burst activation event */
  heatBurstEvent?: { count: number; player: 'p1' | 'p2' };
  /** Rage Art cinematic event */
  rageArtEvent?: { count: number; player: 'p1' | 'p2' };
  /** Camera shake offset from hit effect system */
  cameraShakeOffset?: { x: number; y: number };
  /**
   * AGENT LAW: Callback fired when either fighter fails the 14-point
   * deformation integrity test on combat entry. The parent component
   * MUST freeze combat when this fires.
   *
   * @param player - 'p1' or 'p2'
   * @param characterName - The character whose test failed
   * @param failingChecks - The IDs of the failing checks
   */
  onDeformationBlocked?: (player: 'p1' | 'p2', characterName: string, failingChecks: string[]) => void;
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
  p1X: p1XProp = P1_X,
  p2X: p2XProp = P2_X,
  p1Y: p1YProp = 0,
  p2Y: p2YProp = 0,
  cinematicPhase = 'fight',
  winnerName,
  cameraFov = 55,
  announcerEnabled = true,
  damageEvent,
  knockdownEvent,
  stageId = 'urban_night',
  p1AnimTrigger = 0,
  p2AnimTrigger = 0,
  p1LocomotionVelocity,
  p2LocomotionVelocity,
  onP1BoneHitboxReady,
  onP2BoneHitboxReady,
  wallSplatEvent,
  heatBurstEvent,
  rageArtEvent,
  cameraShakeOffset,
  onDeformationBlocked,
}: CombatArena3DProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [screenFlash, setScreenFlash] = useState(0);
  const [hitEffectPool, setHitEffectPool] = useState<HitEffectPool>(() => createHitEffectPool());
  const particleIdRef = useRef(0);
  const flashRafRef = useRef<number>(0);
  const hitEffectRafRef = useRef<number>(0);
  const prevDamageEventRef = useRef<typeof damageEvent>(undefined);
  const prevKnockdownEventRef = useRef<typeof knockdownEvent>(undefined);
  const prevWallSplatEventRef = useRef<typeof wallSplatEvent>(undefined);
  const prevHeatBurstEventRef = useRef<typeof heatBurstEvent>(undefined);
  const prevRageArtEventRef = useRef<typeof rageArtEvent>(undefined);

  const { speak } = useAnnouncer(announcerEnabled);

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

  // ── Knockdown dust effect ─────────────────────────────────────────────────
  useEffect(() => {
    if (!knockdownEvent) return;
    if (prevKnockdownEventRef.current?.count === knockdownEvent.count) return;
    prevKnockdownEventRef.current = knockdownEvent;

    const { player } = knockdownEvent;
    const baseX = player === 'p1' ? 0.3 : 0.7;
    const screenX = baseX * 800;
    const screenY = 340; // near floor level

    const dustParticles = spawnKnockdownDust(screenX, screenY, particleIdRef);
    setParticles(prev => [...prev.slice(-50), ...dustParticles]);
  }, [knockdownEvent]);

  // ── AAA hit effect pool tick ──────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      setHitEffectPool(prev => {
        const next = tickHitEffectPool(prev);
        const hasActive = next.slots.some(s => s.active) || next.cameraShake.active || next.screenFlash > 0.01;
        if (hasActive) hitEffectRafRef.current = requestAnimationFrame(tick);
        return next;
      });
    };
    return () => cancelAnimationFrame(hitEffectRafRef.current);
  }, []);

  // ── Per-character bloom hit effect on every damage event ─────────────────
  // This is the core Tekken-style per-character color bloom — fires on every
  // clean hit, block, and counter-hit. NEVER remove this effect.
  useEffect(() => {
    if (!damageEvent) return;
    if (prevDamageEventRef.current?.count === damageEvent.count) return;
    prevDamageEventRef.current = damageEvent;

    const { player, damage, isCounter, factionColor } = damageEvent;
    // Attacker is the opposite player
    const attackerFighter = player === 'p2' ? p1Fighter : p2Fighter;
    const bloomColor = getCharacterHitBloom(attackerFighter.id, factionColor);

    // Screen-space position near the hit recipient
    const baseX = player === 'p1' ? 0.28 : 0.72;
    const screenX = baseX * 800;
    const screenY = HIT_FX_SCREEN_Y + Math.random() * 80;

    // World-space position near the fighter torso
    const worldX = player === 'p1' ? -1.5 : 1.5;

    const effectType: HitEffectType = isCounter ? 'counter_hit' : 'clean_hit';

    setHitEffectPool(prev => spawnHitEffect(prev, {
      type: effectType,
      screenX,
      screenY,
      worldX,
      worldY: HIT_FX_WORLD_Y,
      worldZ: 0,
      characterColor: bloomColor,
      attackAngle: player === 'p1' ? Math.PI : 0,
      damage,
    }));

    hitEffectRafRef.current = requestAnimationFrame(() => {
      setHitEffectPool(prev => tickHitEffectPool(prev));
    });
  }, [damageEvent, p1Fighter, p2Fighter]);

  // ── Wall-splat VFX ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!wallSplatEvent) return;
    if (prevWallSplatEventRef.current?.count === wallSplatEvent.count) return;
    prevWallSplatEventRef.current = wallSplatEvent;

    const { player, wall } = wallSplatEvent;
    const baseX = player === 'p1' ? (wall === 'left' ? 0.05 : 0.95) : (wall === 'left' ? 0.05 : 0.95);
    const screenX = baseX * 800;
    const screenY = HIT_FX_SCREEN_Y + 20 + Math.random() * 80;
    const attackerFighter = player === 'p2' ? p1Fighter : p2Fighter;
    const bloomColor = getCharacterHitBloom(attackerFighter.id, '#ffffff');

    setHitEffectPool(prev => spawnHitEffect(prev, {
      type: 'wall_splat',
      screenX, screenY,
      worldX: wall === 'left' ? -4.5 : 4.5,
      worldY: HIT_FX_WORLD_Y,
      worldZ: 0,
      characterColor: bloomColor,
      attackAngle: wall === 'left' ? 0 : Math.PI,
      damage: 150,
    }));
    hitEffectRafRef.current = requestAnimationFrame(() => {
      setHitEffectPool(prev => tickHitEffectPool(prev));
    });
  }, [wallSplatEvent, p1Fighter, p2Fighter]);

  // ── Heat Burst activation VFX ─────────────────────────────────────────────
  useEffect(() => {
    if (!heatBurstEvent) return;
    if (prevHeatBurstEventRef.current?.count === heatBurstEvent.count) return;
    prevHeatBurstEventRef.current = heatBurstEvent;

    const { player } = heatBurstEvent;
    const screenX = player === 'p1' ? 0.3 * 800 : 0.7 * 800;
    const screenY = HIT_FX_SCREEN_Y;
    const fighter = player === 'p1' ? p1Fighter : p2Fighter;
    const bloomColor = getCharacterHitBloom(fighter.id, '#ff8800');

    // Spawn multiple sparks for Heat Burst activation
    setHitEffectPool(prev => {
      let pool = prev;
      for (let i = 0; i < 3; i++) {
        pool = spawnHitEffect(pool, {
          type: 'counter_hit',
          screenX: screenX + (Math.random() - 0.5) * 60,
          screenY: screenY + (Math.random() - 0.5) * 40,
          worldX: player === 'p1' ? -1.8 : 1.8,
          worldY: HIT_FX_WORLD_Y + 0.3,
          worldZ: 0,
          characterColor: bloomColor,
          attackAngle: Math.random() * Math.PI * 2,
          damage: 200,
        });
      }
      return pool;
    });
    hitEffectRafRef.current = requestAnimationFrame(() => {
      setHitEffectPool(prev => tickHitEffectPool(prev));
    });
  }, [heatBurstEvent, p1Fighter, p2Fighter]);

  // ── Rage Art cinematic VFX ────────────────────────────────────────────────
  useEffect(() => {
    if (!rageArtEvent) return;
    if (prevRageArtEventRef.current?.count === rageArtEvent.count) return;
    prevRageArtEventRef.current = rageArtEvent;

    const { player } = rageArtEvent;
    const screenX = player === 'p1' ? 0.3 * 800 : 0.7 * 800;
    const fighter = player === 'p1' ? p1Fighter : p2Fighter;
    const bloomColor = getCharacterHitBloom(fighter.id, '#ff0000');

    // Massive Rage Art spark burst
    setHitEffectPool(prev => {
      let pool = prev;
      for (let i = 0; i < 5; i++) {
        pool = spawnHitEffect(pool, {
          type: 'counter_hit',
          screenX: screenX + (Math.random() - 0.5) * 120,
          screenY: HIT_FX_SCREEN_Y - 30 + Math.random() * 200,
          worldX: player === 'p1' ? -1.8 : 1.8,
          worldY: HIT_FX_WORLD_Y + Math.random() * 0.8,
          worldZ: 0,
          characterColor: bloomColor,
          attackAngle: Math.random() * Math.PI * 2,
          damage: 400,
        });
      }
      return pool;
    });
    setScreenFlash(1.0);
    hitEffectRafRef.current = requestAnimationFrame(() => {
      setHitEffectPool(prev => tickHitEffectPool(prev));
    });
  }, [rageArtEvent, p1Fighter, p2Fighter]);

  useEffect(() => {
    if (particles.length === 0) return;
    const interval = setInterval(() => {
      setParticles(prev => {
        const next = prev
          .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.3, life: p.life - 0.016 }))
          .filter(p => p.life > 0);
        return next;
      });
    }, 16);
    return () => clearInterval(interval);
  }, [particles.length]);

  const p1XOffset = p1State === 'Startup' || p1State === 'Active' ? 0.3 : 0;
  const p2XOffset = p2State === 'Startup' || p2State === 'Active' ? -0.3 : 0;
  const p1FinalX = p1XProp + p1XOffset;
  const p2FinalX = p2XProp + p2XOffset;
  const p1FinalZ = Math.max(-Z_RANGE, Math.min(Z_RANGE, p1Z));
  const p2FinalZ = Math.max(-Z_RANGE, Math.min(Z_RANGE, p2Z));

  // Schwarzerblitz / Tekken: X fighting lane. P1 +90° faces P2, P2 −90° faces P1.
  // Camera at +Z is the 3/4. Select yaw is not used. No rest-align to camera.
  const p1RotationY = COMBAT_P1_YAW;
  const p2RotationY = COMBAT_P2_YAW;

  // ── Stage-specific fog / clear color (training + urban_night stay locked) ─
  const stageCfg = resolveStageConfig(stageId);
  const fogColor = stageId === 'urban_night' || stageId === 'training' ? '#050508' : stageCfg.bgColor;
  const bgColor = stageId === 'urban_night' ? '#030305' : stageId === 'training' ? '#050508' : stageCfg.bgColor;

  return (
    <div className="relative w-full h-full">
      <Canvas
        shadows={false}
        gl={{ antialias: false, alpha: false }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: bgColor }}
        camera={{ position: [0, 2.2, 7], fov: cameraFov, near: 0.1, far: 200 }}
      >
        <color attach="background" args={[bgColor]} />
        {/* FogExp2 for urban night — dense smoggy atmosphere */}
        {stageId === 'urban_night' ? (
          <fogExp2 attach="fog" args={[fogColor, 0.028]} />
        ) : stageId === 'training' ? (
          <fog attach="fog" args={[fogColor, 18, 40]} />
        ) : (
          <fog attach="fog" args={[fogColor, 28, 70]} />
        )}

        {/* ── Stage switch ── */}
        {stageId === 'urban_night' ? (
          <UrbanNightStage p1Color={p1Color} p2Color={p2Color} />
        ) : stageId === 'training' ? (
          <>
            <TrainingLighting p1Color={p1Color} p2Color={p2Color} />
            <TrainingStage p1Color={p1Color} p2Color={p2Color} />
          </>
        ) : (
          <ProceduralStage stageId={stageId} p1Color={p1Color} p2Color={p2Color} />
        )}

        {/* Blob shadows */}
        <BlobShadow x={p1FinalX} z={p1FinalZ} scale={p1State === 'KO' ? 0.7 : 1} />
        <BlobShadow x={p2FinalX} z={p2FinalZ} scale={p2State === 'KO' ? 0.7 : 1} />

        {/* ── AAA Point light flashes at impact coordinates ── */}
        <HitPointLights lights={getActivePointLights(hitEffectPool)} />

        {/* Combat: P1 yaw 0 (face +X / P2), P2 yaw π (face −X / P1). Not ±90 — that was back-to-cam / face-to-cam. */}
        <FighterMesh
          state={p1State}
          animation={p1Animation}
          modelUrl={getFighterGlbUrl(p1Fighter.id, p1Fighter.model) ?? p1Fighter.portraitUrl}
          position={[p1FinalX, COMBAT_FIGHTER_Y + p1YProp, p1FinalZ]}
          facing={1}
          rotationY={p1RotationY}
          tint={p1SkinTint ?? p1Color}
          animationTrigger={p1AnimTrigger}
          locomotionVelocity={p1LocomotionVelocity}
          hitStopActive={hitStopActive}
          onBoneHitboxReady={onP1BoneHitboxReady}
          onDeformationBlocked={(characterName, failingChecks) => {
            // AGENT LAW: Log combat freeze — no UI, backend only
            console.error(
              `[CombatArena3D] 🚫 P1 DEFORMATION BLOCKED — ${characterName} | ` +
              `Failing: [${failingChecks.join(', ')}] | Combat frozen.`
            );
            onDeformationBlocked?.('p1', characterName, failingChecks);
          }}
        />

        {/* P2 faces P1 */}
        <FighterMesh
          state={p2State}
          animation={p2Animation}
          modelUrl={getFighterGlbUrl(p2Fighter.id, p2Fighter.model) ?? p2Fighter.portraitUrl}
          position={[p2FinalX, COMBAT_FIGHTER_Y + p2YProp, p2FinalZ]}
          facing={-1}
          rotationY={p2RotationY}
          tint={p2SkinTint ?? p2Color}
          animationTrigger={p2AnimTrigger}
          locomotionVelocity={p2LocomotionVelocity}
          hitStopActive={hitStopActive}
          onBoneHitboxReady={onP2BoneHitboxReady}
          onDeformationBlocked={(characterName, failingChecks) => {
            // AGENT LAW: Log combat freeze — no UI, backend only
            console.error(
              `[CombatArena3D] 🚫 P2 DEFORMATION BLOCKED — ${characterName} | ` +
              `Failing: [${failingChecks.join(', ')}] | Combat frozen.`
            );
            onDeformationBlocked?.('p2', characterName, failingChecks);
          }}
        />

        <CinematicCamera
          phase={cinematicPhase}
          p1X={p1FinalX}
          p2X={p2FinalX}
          p1Z={p1FinalZ}
          p2Z={p2FinalZ}
          fov={cameraFov}
          shakeOffset={cameraShakeOffset}
        />

        {hitStopActive && <ambientLight intensity={0.8} color="#ffffff" />}
      </Canvas>

      <VFXOverlay
        particles={particles}
        screenFlash={screenFlash}
        hitStopActive={hitStopActive}
        hitEffectPool={hitEffectPool}
      />
      <IntroOverlay phase={cinematicPhase} p1Name={p1Fighter.name} p2Name={p2Fighter.name} />
      <VictoryOverlay phase={cinematicPhase} winnerName={winnerName} />
    </div>
  );
}
