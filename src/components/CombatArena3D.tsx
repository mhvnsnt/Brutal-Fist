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
import {
  createHitEffectPool,
  spawnHitEffect,
  tickHitEffectPoolInPlace,
  sparkWorldY,
  type HitEffectPool,
  type HitEffectType,
  type AttackHeight,
} from '../engine/combat/HitEffectSystem';
import { COMBAT_P1_YAW, COMBAT_P2_YAW, COMBAT_FIGHTER_Y } from '../engine/V7OrientationContract';

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
export type LiveCombatPose = {
  p1x: number; p1y: number; p1z: number;
  p2x: number; p2y: number; p2z: number;
};

function CinematicCamera({
  phase,
  p1X,
  p2X,
  p1Z,
  p2Z,
  fov,
  shakeOffset,
  livePoseRef,
  sparkPoolRef,
}: {
  phase: CinematicPhase;
  p1X: number;
  p2X: number;
  p1Z: number;
  p2Z: number;
  fov: number;
  shakeOffset?: { x: number; y: number };
  livePoseRef?: React.MutableRefObject<LiveCombatPose>;
  sparkPoolRef?: React.MutableRefObject<HitEffectPool>;
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
    const live = livePoseRef?.current;
    const x1 = live?.p1x ?? p1X;
    const x2 = live?.p2x ?? p2X;
    const z1 = live?.p1z ?? p1Z;
    const z2 = live?.p2z ?? p2Z;

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
      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;
      const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(z2 - z1, 2));
      const targetCamZ = Math.max(4.5, Math.min(11, dist * 1.05 + 3.0));
      const targetCamY = 2.0 + dist * 0.05;
      cam.position.x += (midX - cam.position.x) * 0.1;
      cam.position.y += (targetCamY - cam.position.y) * 0.07;
      cam.position.z += (targetCamZ + midZ * 0.25 - cam.position.z) * 0.08;
      const shake = sparkPoolRef?.current.cameraShake;
      if (shake?.active) {
        cam.position.x += shake.offsetX * 0.012;
        cam.position.y += shake.offsetY * 0.012;
      } else if (shakeOffset && (Math.abs(shakeOffset.x) > 0.001 || Math.abs(shakeOffset.y) > 0.001)) {
        cam.position.x += shakeOffset.x * 0.01;
        cam.position.y += shakeOffset.y * 0.01;
      }
      cam.lookAt(midX, 1.1, midZ * 0.15);
      cam.updateProjectionMatrix();
    } else if (phase === 'victory') {
      const targetX = x1;
      const targetY = 1.8;
      const targetZ = 3.5;
      cam.position.x += (targetX - cam.position.x) * 0.04;
      cam.position.y += (targetY - cam.position.y) * 0.04;
      cam.position.z += (targetZ - cam.position.z) * 0.04;
      cam.lookAt(x1, 1.5, 0);
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

// ── Blob shadow under each fighter ───────────────────────────────────────────
function BlobShadow({ slot, scale = 1 }: { slot: React.MutableRefObject<{ x: number; z: number }>; scale?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.position.x = slot.current.x;
    mesh.position.z = slot.current.z;
  });
  return (
    <mesh ref={ref} position={[slot.current.x, 0.005, slot.current.z]} rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
      <circleGeometry args={[0.45, 16]} />
      <meshBasicMaterial color="#000000" transparent opacity={0.55} depthWrite={false} />
    </mesh>
  );
}

function makeSparkTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  if (!g) return new THREE.CanvasTexture(c);
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.22, 'rgba(255,255,255,0.95)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Additive billboards at the contact. Ticked here so they expire in a few frames. */
function WorldHitSparks({ poolRef }: { poolRef: React.MutableRefObject<HitEffectPool> }) {
  const root = useRef<THREE.Group>(null);
  const built = useRef(false);
  const tex = useRef<THREE.CanvasTexture | null>(null);

  useFrame((state, delta) => {
    const holder = root.current;
    if (!holder) return;
    if (!built.current) {
      tex.current = makeSparkTexture();
      const map = tex.current;
      for (let i = 0; i < poolRef.current.slots.length; i++) {
        const g = new THREE.Group();
        const corona = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map, color: '#ffb15a', transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending, toneMapped: false,
          }),
        );
        const core = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.MeshBasicMaterial({
            map, color: '#ffffff', transparent: true, depthWrite: false,
            blending: THREE.AdditiveBlending, toneMapped: false,
          }),
        );
        const streakGroup = new THREE.Group();
        for (let s = 0; s < 6; s++) {
          const streak = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 0.07),
            new THREE.MeshBasicMaterial({
              color: '#fff7ea', transparent: true, depthWrite: false,
              blending: THREE.AdditiveBlending, toneMapped: false,
            }),
          );
          streak.position.x = 0.16;
          streak.rotation.z = (Math.PI * 2 * s) / 6;
          streakGroup.add(streak);
        }
        const light = new THREE.PointLight('#ffb15a', 0, 1.35, 2);
        g.add(corona, core, streakGroup, light);
        g.visible = false;
        holder.add(g);
      }
      built.current = true;
    }

    tickHitEffectPoolInPlace(poolRef.current, delta);
    const cam = state.camera.position;
    const slots = poolRef.current.slots;
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const g = holder.children[i] as THREE.Group | undefined;
      if (!g) continue;
      const light = g.children[3] as THREE.PointLight;
      if (!slot?.active) {
        g.visible = false;
        light.intensity = 0;
        continue;
      }
      g.visible = true;
      g.position.set(slot.worldX, slot.worldY, slot.worldZ);
      g.lookAt(cam.x, cam.y, cam.z);
      const t = slot.maxLife > 0 ? Math.max(0, slot.life / slot.maxLife) : 0;
      const level = slot.attackLevel;
      // Small discs. A 0.95m high sprite covered the chest, so high and mid
      // looked like the same bloom. 1.85 body: head ~1.55, gut 1.05, shin 0.38.
      let sx = 0.26;
      let sy = 0.22;
      if (slot.type === 'block') { sx = 0.32; sy = 0.18; }
      else if (level === 'high') { sx = 0.20; sy = 0.18; }
      else if (level === 'low') { sx = 0.30; sy = 0.14; }
      const pop = 0.7 + (1 - t) * 0.45;
      const corona = g.children[0] as THREE.Mesh;
      const core = g.children[1] as THREE.Mesh;
      const streaks = g.children[2] as THREE.Group;
      corona.scale.set(sx * slot.scale * pop, sy * slot.scale * pop, 1);
      core.scale.set(sx * 0.36 * pop, sy * 0.36 * pop, 1);
      (corona.material as THREE.MeshBasicMaterial).opacity = t;
      (corona.material as THREE.MeshBasicMaterial).color.set(slot.characterColor);
      (core.material as THREE.MeshBasicMaterial).opacity = Math.min(1, t * 1.15);
      streaks.scale.setScalar(0.42 * pop);
      streaks.children.forEach((ch) => {
        const mat = (ch as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = t * 0.8;
        mat.color.set(slot.type === 'block' ? '#b7d4ea' : '#fff7ea');
      });
      const pl = slot.pointLight;
      if (pl && pl.intensity > 0.05) {
        light.color.set(slot.characterColor);
        light.intensity = pl.intensity;
      } else {
        light.intensity = 0;
      }
    }
  });

  return <group ref={root} />;
}

type PoseSlot = { x: number; y: number; z: number; yaw: number };

function trackYaw(base: number, x: number, z: number, ox: number, oz: number) {
  const dx = ox - x;
  const dz = oz - z;
  if (Math.abs(dz) < 0.18 || Math.hypot(dx, dz) < 0.45) return base;
  let delta = Math.atan2(dz, dx) - base;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return base + Math.max(-0.5, Math.min(0.5, delta));
}

function PoseSync({
  livePoseRef,
  p1Slot,
  p2Slot,
  fallback,
}: {
  livePoseRef?: React.MutableRefObject<LiveCombatPose>;
  p1Slot: React.MutableRefObject<PoseSlot>;
  p2Slot: React.MutableRefObject<PoseSlot>;
  fallback: { p1x: number; p1y: number; p1z: number; p2x: number; p2y: number; p2z: number };
}) {
  useFrame(() => {
    const live = livePoseRef?.current;
    const p1x = live?.p1x ?? fallback.p1x;
    const p2x = live?.p2x ?? fallback.p2x;
    const p1z = Math.max(-Z_RANGE, Math.min(Z_RANGE, live?.p1z ?? fallback.p1z));
    const p2z = Math.max(-Z_RANGE, Math.min(Z_RANGE, live?.p2z ?? fallback.p2z));
    const p1y = COMBAT_FIGHTER_Y + (live?.p1y ?? fallback.p1y);
    const p2y = COMBAT_FIGHTER_Y + (live?.p2y ?? fallback.p2y);
    p1Slot.current.x = p1x;
    p1Slot.current.y = p1y;
    p1Slot.current.z = p1z;
    p1Slot.current.yaw = trackYaw(COMBAT_P1_YAW, p1x, p1z, p2x, p2z);
    p2Slot.current.x = p2x;
    p2Slot.current.y = p2y;
    p2Slot.current.z = p2z;
    p2Slot.current.yaw = trackYaw(COMBAT_P2_YAW, p2x, p2z, p1x, p1z);
  });
  return null;
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

// ── Main export ───────────────────────────────────────────────────────────────
export interface CombatArena3DProps {
  p1Fighter: BannonFighterProfile;
  p2Fighter: BannonFighterProfile;
  p1State: string;
  p2State: string;
  p1Animation: string;
  p2Animation: string;
  /** Bank clip for the committed attack. Null while walking or idle. */
  p1AttackClip?: string | null;
  p2AttackClip?: string | null;
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
  /** Updated every sim frame. Meshes read this in useFrame, not via React. */
  livePoseRef?: React.MutableRefObject<LiveCombatPose>;
  cinematicPhase?: CinematicPhase;
  winnerName?: string;
  cameraFov?: number;
  announcerEnabled?: boolean;
  damageEvent?: {
    count: number;
    player: 'p1' | 'p2';
    damage: number;
    isCounter: boolean;
    factionColor: string;
    attackLevel?: AttackHeight;
    blocked?: boolean;
    effect?: HitEffectType;
    worldX?: number;
    worldY?: number;
    worldZ?: number;
    heat?: boolean;
  };
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
  p1AttackClip = null,
  p2AttackClip = null,
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
  livePoseRef,
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
  const sparkPoolRef = useRef<HitEffectPool>(createHitEffectPool());
  const p1Pose = useRef<PoseSlot>({ x: p1XProp, y: COMBAT_FIGHTER_Y + p1YProp, z: p1Z, yaw: COMBAT_P1_YAW });
  const p2Pose = useRef<PoseSlot>({ x: p2XProp, y: COMBAT_FIGHTER_Y + p2YProp, z: p2Z, yaw: COMBAT_P2_YAW });
  const particleIdRef = useRef(0);
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

  // World sparks. Height is the attack level. Life is a few frames, ticked
  // inside the canvas so they cannot freeze on the overlay.
  useEffect(() => {
    if (!damageEvent) return;
    if (prevDamageEventRef.current?.count === damageEvent.count) return;
    prevDamageEventRef.current = damageEvent;

    const level = damageEvent.attackLevel ?? 'mid';
    const live = livePoseRef?.current;
    const victimIsP1 = damageEvent.player === 'p1';
    const worldX = damageEvent.worldX ?? (victimIsP1 ? (live?.p1x ?? p1XProp) : (live?.p2x ?? p2XProp));
    const worldZ = damageEvent.worldZ ?? (victimIsP1 ? (live?.p1z ?? p1Z) : (live?.p2z ?? p2Z));
    const air = victimIsP1 ? (live?.p1y ?? p1YProp) : (live?.p2y ?? p2YProp);
    const worldY = damageEvent.worldY ?? sparkWorldY(level, air);
    const effectType: HitEffectType = damageEvent.effect
      ?? (damageEvent.blocked ? 'block' : damageEvent.isCounter ? 'counter_hit' : 'clean_hit');

    spawnHitEffect(sparkPoolRef.current, {
      type: effectType,
      screenX: 0,
      screenY: 0,
      worldX,
      worldY,
      worldZ,
      attackLevel: level,
      attackAngle: victimIsP1 ? 0 : Math.PI,
      damage: damageEvent.damage,
      heat: damageEvent.heat,
    });
  }, [damageEvent, livePoseRef, p1XProp, p2XProp, p1YProp, p2YProp, p1Z, p2Z]);

  useEffect(() => {
    if (!wallSplatEvent) return;
    if (prevWallSplatEventRef.current?.count === wallSplatEvent.count) return;
    prevWallSplatEventRef.current = wallSplatEvent;
    const live = livePoseRef?.current;
    const victimIsP1 = wallSplatEvent.player === 'p1';
    spawnHitEffect(sparkPoolRef.current, {
      type: 'wall_splat',
      screenX: 0,
      screenY: 0,
      worldX: victimIsP1 ? (live?.p1x ?? p1XProp) : (live?.p2x ?? p2XProp),
      worldY: sparkWorldY('mid', victimIsP1 ? live?.p1y : live?.p2y),
      worldZ: victimIsP1 ? (live?.p1z ?? p1Z) : (live?.p2z ?? p2Z),
      attackLevel: 'mid',
      attackAngle: wallSplatEvent.wall === 'left' ? 0 : Math.PI,
      damage: 80,
    });
  }, [wallSplatEvent, livePoseRef, p1XProp, p2XProp, p1Z, p2Z]);

  useEffect(() => {
    if (!heatBurstEvent) return;
    if (prevHeatBurstEventRef.current?.count === heatBurstEvent.count) return;
    prevHeatBurstEventRef.current = heatBurstEvent;
    const live = livePoseRef?.current;
    const isP1 = heatBurstEvent.player === 'p1';
    const worldX = isP1 ? (live?.p1x ?? p1XProp) : (live?.p2x ?? p2XProp);
    const worldZ = isP1 ? (live?.p1z ?? p1Z) : (live?.p2z ?? p2Z);
    const air = isP1 ? (live?.p1y ?? 0) : (live?.p2y ?? 0);
    spawnHitEffect(sparkPoolRef.current, {
      type: 'clean_hit',
      screenX: 0,
      screenY: 0,
      worldX,
      worldY: sparkWorldY('mid', air),
      worldZ,
      attackLevel: 'mid',
      heat: true,
      damage: 40,
    });
  }, [heatBurstEvent, livePoseRef, p1XProp, p2XProp, p1Z, p2Z]);

  useEffect(() => {
    if (!rageArtEvent) return;
    if (prevRageArtEventRef.current?.count === rageArtEvent.count) return;
    prevRageArtEventRef.current = rageArtEvent;
    const live = livePoseRef?.current;
    const isP1 = rageArtEvent.player === 'p1';
    const worldX = isP1 ? (live?.p1x ?? p1XProp) : (live?.p2x ?? p2XProp);
    const worldZ = isP1 ? (live?.p1z ?? p1Z) : (live?.p2z ?? p2Z);
    const air = isP1 ? (live?.p1y ?? 0) : (live?.p2y ?? 0);
    spawnHitEffect(sparkPoolRef.current, {
      type: 'counter_hit',
      screenX: 0,
      screenY: 0,
      worldX,
      worldY: sparkWorldY('mid', air),
      worldZ,
      attackLevel: 'mid',
      heat: true,
      damage: 80,
    });
    setScreenFlash(0.28);
  }, [rageArtEvent, livePoseRef, p1XProp, p2XProp, p1Z, p2Z]);

  useEffect(() => {
    if (screenFlash <= 0.02) return;
    const id = window.setInterval(() => {
      setScreenFlash((s) => (s > 0.04 ? s * 0.55 : 0));
    }, 32);
    return () => window.clearInterval(id);
  }, [screenFlash > 0.02]);

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

  const p1FinalX = p1XProp;
  const p2FinalX = p2XProp;
  const p1FinalZ = Math.max(-Z_RANGE, Math.min(Z_RANGE, p1Z));
  const p2FinalZ = Math.max(-Z_RANGE, Math.min(Z_RANGE, p2Z));
  const p1RotationY = trackYaw(COMBAT_P1_YAW, p1FinalX, p1FinalZ, p2FinalX, p2FinalZ);
  const p2RotationY = trackYaw(COMBAT_P2_YAW, p2FinalX, p2FinalZ, p1FinalX, p1FinalZ);

  // ── Stage-specific fog / clear color (training + urban_night stay locked) ─
  const stageCfg = resolveStageConfig(stageId);
  const fogColor = stageId === 'urban_night' || stageId === 'training' ? '#050508' : stageCfg.bgColor;
  const bgColor = stageId === 'urban_night' ? '#030305' : stageId === 'training' ? '#050508' : stageCfg.bgColor;

  return (
    <div className="relative w-full h-full">
      <Canvas
        shadows={false}
        dpr={[1, 1.25]}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
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
        <BlobShadow slot={p1Pose} scale={p1State === 'KO' ? 0.7 : 1} />
        <BlobShadow slot={p2Pose} scale={p2State === 'KO' ? 0.7 : 1} />

        <PoseSync
          livePoseRef={livePoseRef}
          p1Slot={p1Pose}
          p2Slot={p2Pose}
          fallback={{ p1x: p1FinalX, p1y: p1YProp, p1z: p1FinalZ, p2x: p2FinalX, p2y: p2YProp, p2z: p2FinalZ }}
        />
        <WorldHitSparks poolRef={sparkPoolRef} />

        {/* Combat: P1 yaw 0 (face +X / P2), P2 yaw π (face −X / P1). Not ±90 — that was back-to-cam / face-to-cam. */}
        <FighterMesh
          state={p1State}
          animation={p1Animation}
          attackClip={p1AttackClip}
          characterId={p1Fighter.id}
          modelUrl={getFighterGlbUrl(p1Fighter.id, p1Fighter.model) ?? p1Fighter.portraitUrl}
          position={[p1FinalX, COMBAT_FIGHTER_Y + p1YProp, p1FinalZ]}
          facing={1}
          rotationY={p1RotationY}
          tint={p1SkinTint ?? p1Color}
          paint={p1Fighter.paint}
          addon={p1Fighter.addon}
          animationTrigger={p1AnimTrigger}
          locomotionVelocity={p1LocomotionVelocity}
          poseSlot={p1Pose}
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
          attackClip={p2AttackClip}
          characterId={p2Fighter.id}
          modelUrl={getFighterGlbUrl(p2Fighter.id, p2Fighter.model) ?? p2Fighter.portraitUrl}
          position={[p2FinalX, COMBAT_FIGHTER_Y + p2YProp, p2FinalZ]}
          facing={-1}
          rotationY={p2RotationY}
          tint={p2SkinTint ?? p2Color}
          paint={p2Fighter.paint}
          addon={p2Fighter.addon}
          animationTrigger={p2AnimTrigger}
          locomotionVelocity={p2LocomotionVelocity}
          poseSlot={p2Pose}
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
          livePoseRef={livePoseRef}
          sparkPoolRef={sparkPoolRef}
        />

        {hitStopActive && <ambientLight intensity={0.8} color="#ffffff" />}
      </Canvas>

      <VFXOverlay
        particles={particles}
        screenFlash={screenFlash}
        hitStopActive={hitStopActive}
      />
      <IntroOverlay phase={cinematicPhase} p1Name={p1Fighter.name} p2Name={p2Fighter.name} />
      <VictoryOverlay phase={cinematicPhase} winnerName={winnerName} />
    </div>
  );
}
