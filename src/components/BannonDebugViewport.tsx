'use client';

/**
 * BannonDebugViewport.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Debug viewport for the moveset creation menu.
 *
 * Shows live Mixamo-skeleton bone rotations with quaternion-track
 * visualization, per-bone angular travel, and vertex-position deltas
 * as a single character plays a converted Bannon Euler clip on its
 * cloned skeleton — side-by-side Euler source vs. quaternion output.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  Suspense,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { isBannonEulerFormat, convertBannonEulerClip } from '../engine/retarget/BannonEulerMotionAdapter';
import { runCharacterPipeline } from '../engine/pipeline/CharacterPipeline';
import { BANNON_GLB_PLAYABLE_MODELS } from '../data/bannonGlbRoster';
import type { BannonFighterProfile } from '../data/bannonRoster';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface BoneDebugEntry {
  boneName: string;
  /** Current quaternion (live, from skeleton) */
  quatX: number;
  quatY: number;
  quatZ: number;
  quatW: number;
  /** Euler source values (rx/ry/rz) at the same frame */
  eulerRx: number;
  eulerRy: number;
  eulerRz: number;
  /** Cumulative angular travel in radians since clip start */
  angularTravel: number;
  /** Whether this bone has a quaternion track in the converted clip */
  hasTrack: boolean;
}

export interface VertexDeltaEntry {
  meshName: string;
  /** Max vertex displacement since clip start (metres) */
  maxDelta: number;
  /** Mean vertex displacement since clip start (metres) */
  meanDelta: number;
  /** Number of vertices sampled */
  vertexCount: number;
}

interface LiveDebugFrame {
  timeSeconds: number;
  bones: BoneDebugEntry[];
  vertexDeltas: VertexDeltaEntry[];
  totalAngularTravel: number;
  clipName: string;
  clipSourceType: 'EULER_SOURCE' | 'QUATERNION_OUTPUT' | 'NONE';
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BANNON_INDEX_URL =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/index.json';
const BANNON_CLIP_BASE =
  'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/';

const SEMANTIC_STATES = [
  'idle',
  'walk_forward',
  'attack_1',
  'attack_2',
  'block',
  'hit_reaction',
  'knockdown',
  'getup',
];

const MAX_BONE_ROWS = 20;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function quatToEulerDeg(q: THREE.Quaternion): { x: number; y: number; z: number } {
  const e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return {
    x: (e.x * 180) / Math.PI,
    y: (e.y * 180) / Math.PI,
    z: (e.z * 180) / Math.PI,
  };
}

function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

function formatRad(r: number): string {
  return r.toFixed(3) + ' rad';
}

function formatDeg(d: number): string {
  return d.toFixed(1) + '°';
}

function formatMetres(m: number): string {
  return m < 0.001 ? (m * 1000).toFixed(3) + ' mm' : m.toFixed(4) + ' m';
}

// ─────────────────────────────────────────────────────────────────────────────
// Vertex delta sampler (CPU skinning approximation via bone world positions)
// ─────────────────────────────────────────────────────────────────────────────

function sampleVertexDeltas(
  scene: THREE.Group,
  restPositions: Map<string, THREE.Vector3>,
): VertexDeltaEntry[] {
  const results: VertexDeltaEntry[] = [];

  scene.traverse(obj => {
    if (!(obj instanceof THREE.SkinnedMesh)) return;
    const geo = obj.geometry;
    if (!geo.attributes.position) return;

    const posAttr = geo.attributes.position;
    const count = Math.min(posAttr.count, 256); // sample up to 256 verts
    let maxDelta = 0;
    let sumDelta = 0;

    const worldPos = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      worldPos.fromBufferAttribute(posAttr, i);
      obj.localToWorld(worldPos);

      const key = `${obj.name}:${i}`;
      const rest = restPositions.get(key);
      if (rest) {
        const d = worldPos.distanceTo(rest);
        if (d > maxDelta) maxDelta = d;
        sumDelta += d;
      } else {
        restPositions.set(key, worldPos.clone());
      }
    }

    results.push({
      meshName: obj.name || 'SkinnedMesh',
      maxDelta,
      meanDelta: count > 0 ? sumDelta / count : 0,
      vertexCount: count,
    });
  });

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D Scene component — runs inside Canvas
// ─────────────────────────────────────────────────────────────────────────────

interface SceneProps {
  modelUrl: string;
  clipJson: unknown | null;
  semanticState: string;
  onFrame: (frame: LiveDebugFrame) => void;
  side: 'euler' | 'quaternion';
}

function DebugScene({ modelUrl, clipJson, semanticState, onFrame, side }: SceneProps) {
  const pipelineRef = useRef<{
    scene: THREE.Group;
    mixer: THREE.AnimationMixer;
    actions: Record<string, THREE.AnimationAction>;
    skeleton: THREE.Skeleton | null;
  } | null>(null);
  const restPositionsRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const prevQuatsRef = useRef<Map<string, THREE.Quaternion>>(new Map());
  const angularTravelRef = useRef<Map<string, number>>(new Map());
  const clipNameRef = useRef<string>('');
  const loadedUrlRef = useRef<string>('');
  const loadedClipRef = useRef<unknown>(null);
  const loadedStateRef = useRef<string>('');

  // Load pipeline when modelUrl changes
  useEffect(() => {
    if (!modelUrl || modelUrl === loadedUrlRef.current) return;
    loadedUrlRef.current = modelUrl;
    restPositionsRef.current.clear();
    prevQuatsRef.current.clear();
    angularTravelRef.current.clear();

    const loader = new THREE.ObjectLoader();
    // Use GLTFLoader via pipeline
    import('three/examples/jsm/loaders/GLTFLoader.js').then(({ GLTFLoader }) => {
      const gltfLoader = new GLTFLoader();
      gltfLoader.load(
        modelUrl,
        gltf => {
          runCharacterPipeline(
            gltf.scene as THREE.Group,
            gltf.animations,
            modelUrl,
            false,
          ).then(result => {
            if (!result) return;

            // Find skeleton
            let skeleton: THREE.Skeleton | null = null;
            result.scene.traverse(obj => {
              if (obj instanceof THREE.SkinnedMesh && obj.skeleton && !skeleton) {
                skeleton = obj.skeleton;
              }
            });

            pipelineRef.current = {
              scene: result.scene,
              mixer: result.mixer,
              actions: result.actions,
              skeleton,
            };

            // Reset travel
            restPositionsRef.current.clear();
            prevQuatsRef.current.clear();
            angularTravelRef.current.clear();
          });
        },
        undefined,
        err => console.error('[BannonDebugViewport] GLB load error', err),
      );
    });
  }, [modelUrl]);

  // Apply clip when clipJson or semanticState changes
  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;
    if (clipJson === loadedClipRef.current && semanticState === loadedStateRef.current) return;
    loadedClipRef.current = clipJson;
    loadedStateRef.current = semanticState;

    // Reset travel measurements
    prevQuatsRef.current.clear();
    angularTravelRef.current.clear();

    if (!clipJson || !isBannonEulerFormat(clipJson)) {
      // Try existing actions
      const keys = Object.keys(pipeline.actions);
      const match = keys.find(k => k.toLowerCase().includes(semanticState.replace('_', '')))
        ?? keys.find(k => k.toLowerCase().includes('idle'))
        ?? keys[0];
      if (match) {
        Object.values(pipeline.actions).forEach(a => a?.stop());
        const action = pipeline.actions[match];
        action.setLoop(THREE.LoopRepeat, Infinity).reset().play();
        clipNameRef.current = match;
      }
      return;
    }

    // Convert Euler clip and inject into mixer
    const result = convertBannonEulerClip(clipJson, semanticState);
    const clip = result.clip;
    clipNameRef.current = clip.name;

    Object.values(pipeline.actions).forEach(a => a?.stop());
    const action = pipeline.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity).reset().play();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipJson, semanticState]);

  useFrame((_, delta) => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;

    pipeline.mixer.update(delta);

    // Collect bone debug data
    const bones: BoneDebugEntry[] = [];
    let totalTravel = 0;

    if (pipeline.skeleton) {
      pipeline.skeleton.bones.forEach(bone => {
        const q = bone.quaternion;
        const key = bone.name;

        // Angular travel
        const prev = prevQuatsRef.current.get(key);
        let travel = angularTravelRef.current.get(key) ?? 0;
        if (prev) {
          const dot = Math.min(1.0, Math.abs(prev.dot(q)));
          travel += 2 * Math.acos(dot);
          angularTravelRef.current.set(key, travel);
        }
        prevQuatsRef.current.set(key, q.clone());
        totalTravel += travel;

        // Euler source approximation (back-convert from quat for display)
        const eulerBack = new THREE.Euler().setFromQuaternion(q, 'XYZ');

        bones.push({
          boneName: bone.name,
          quatX: q.x,
          quatY: q.y,
          quatZ: q.z,
          quatW: q.w,
          eulerRx: eulerBack.x,
          eulerRy: eulerBack.y,
          eulerRz: eulerBack.z,
          angularTravel: travel,
          hasTrack: true,
        });
      });
    }

    // Vertex deltas
    const vertexDeltas = sampleVertexDeltas(pipeline.scene, restPositionsRef.current);

    onFrame({
      timeSeconds: pipeline.mixer.time,
      bones: bones.slice(0, MAX_BONE_ROWS),
      vertexDeltas,
      totalAngularTravel: totalTravel,
      clipName: clipNameRef.current,
      clipSourceType: side === 'euler' ? 'EULER_SOURCE' : 'QUATERNION_OUTPUT',
    });
  });

  const pipeline = pipelineRef.current;
  if (!pipeline) return null;

  return (
    <group>
      <primitive object={pipeline.scene} />
    </group>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bone table
// ─────────────────────────────────────────────────────────────────────────────

function BoneTable({ bones, label, color }: { bones: BoneDebugEntry[]; label: string; color: string }) {
  return (
    <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
      <div
        className="text-[9px] tracking-widest font-bold px-2 py-1 border-b border-zinc-800"
        style={{ color }}
      >
        {label}
      </div>
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-[8px] font-mono border-collapse">
          <thead>
            <tr className="text-zinc-600 border-b border-zinc-900">
              <th className="text-left px-1 py-0.5 w-28">BONE</th>
              <th className="text-right px-1 py-0.5">QX</th>
              <th className="text-right px-1 py-0.5">QY</th>
              <th className="text-right px-1 py-0.5">QZ</th>
              <th className="text-right px-1 py-0.5">QW</th>
              <th className="text-right px-1 py-0.5">RX°</th>
              <th className="text-right px-1 py-0.5">RY°</th>
              <th className="text-right px-1 py-0.5">RZ°</th>
              <th className="text-right px-1 py-0.5 w-16">∠ TRAVEL</th>
            </tr>
          </thead>
          <tbody>
            {bones.map((b, i) => {
              const travelDeg = radToDeg(b.angularTravel);
              const isActive = b.angularTravel > 0.01;
              return (
                <tr
                  key={b.boneName}
                  className={`border-b border-zinc-900/50 ${i % 2 === 0 ? 'bg-zinc-950/30' : ''}`}
                >
                  <td
                    className="px-1 py-0.5 truncate max-w-[7rem]"
                    style={{ color: isActive ? '#e2e8f0' : '#52525b' }}
                    title={b.boneName}
                  >
                    {b.boneName.replace('mixamorig', '').replace('Hips', 'Hips')}
                  </td>
                  <td className="text-right px-1 py-0.5 text-zinc-400">{b.quatX.toFixed(3)}</td>
                  <td className="text-right px-1 py-0.5 text-zinc-400">{b.quatY.toFixed(3)}</td>
                  <td className="text-right px-1 py-0.5 text-zinc-400">{b.quatZ.toFixed(3)}</td>
                  <td className="text-right px-1 py-0.5 text-zinc-300">{b.quatW.toFixed(3)}</td>
                  <td className="text-right px-1 py-0.5 text-blue-400">{formatDeg(radToDeg(b.eulerRx))}</td>
                  <td className="text-right px-1 py-0.5 text-blue-400">{formatDeg(radToDeg(b.eulerRy))}</td>
                  <td className="text-right px-1 py-0.5 text-blue-400">{formatDeg(radToDeg(b.eulerRz))}</td>
                  <td
                    className="text-right px-1 py-0.5 font-bold"
                    style={{ color: isActive ? '#f59e0b' : '#3f3f46' }}
                  >
                    {formatDeg(travelDeg)}
                  </td>
                </tr>
              );
            })}
            {bones.length === 0 && (
              <tr>
                <td colSpan={9} className="px-2 py-3 text-zinc-700 text-center">
                  No skeleton data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vertex delta panel
// ─────────────────────────────────────────────────────────────────────────────

function VertexDeltaPanel({ deltas, label, color }: { deltas: VertexDeltaEntry[]; label: string; color: string }) {
  return (
    <div className="border-t border-zinc-800 px-2 py-1.5">
      <div className="text-[9px] tracking-widest mb-1" style={{ color }}>
        {label} — VERTEX Δ
      </div>
      {deltas.length === 0 ? (
        <div className="text-[8px] text-zinc-700">No skinned meshes</div>
      ) : (
        deltas.map(d => (
          <div key={d.meshName} className="flex items-center gap-3 text-[8px] font-mono mb-0.5">
            <span className="text-zinc-500 truncate w-24" title={d.meshName}>{d.meshName}</span>
            <span className="text-zinc-400">{d.vertexCount}v</span>
            <span className="text-yellow-400">max {formatMetres(d.maxDelta)}</span>
            <span className="text-zinc-500">mean {formatMetres(d.meanDelta)}</span>
            {d.maxDelta < 0.0001 && (
              <span className="text-red-500 text-[7px]">⚠ NO DEFORM</span>
            )}
            {d.maxDelta >= 0.0001 && (
              <span className="text-green-500 text-[7px]">✓ DEFORMING</span>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Quaternion track bar (visual)
// ─────────────────────────────────────────────────────────────────────────────

function QuatTrackBar({ bones }: { bones: BoneDebugEntry[] }) {
  const maxTravel = useMemo(() => Math.max(...bones.map(b => b.angularTravel), 0.001), [bones]);
  const top10 = useMemo(
    () => [...bones].sort((a, b) => b.angularTravel - a.angularTravel).slice(0, 10),
    [bones],
  );

  return (
    <div className="px-2 py-1.5 border-t border-zinc-800">
      <div className="text-[9px] tracking-widest text-purple-400 mb-1">QUAT TRACK TRAVEL (TOP 10)</div>
      <div className="space-y-0.5">
        {top10.map(b => {
          const pct = (b.angularTravel / maxTravel) * 100;
          return (
            <div key={b.boneName} className="flex items-center gap-2">
              <span className="text-[8px] text-zinc-500 w-24 truncate font-mono">
                {b.boneName.replace('mixamorig', '')}
              </span>
              <div className="flex-1 h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-100"
                  style={{
                    width: `${pct}%`,
                    background: pct > 50 ? '#a855f7' : pct > 20 ? '#7c3aed' : '#4c1d95',
                  }}
                />
              </div>
              <span className="text-[8px] text-purple-400 w-12 text-right font-mono">
                {formatRad(b.angularTravel)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Clip index loader
// ─────────────────────────────────────────────────────────────────────────────

interface ClipIndexEntry {
  name: string;
  file: string;
  semanticState?: string;
  hasQuaternion?: boolean;
}

async function loadClipIndex(): Promise<ClipIndexEntry[]> {
  try {
    const res = await fetch(BANNON_INDEX_URL);
    if (!res.ok) return [];
    const data = await res.json();
    if (Array.isArray(data)) return data as ClipIndexEntry[];
    if (data && Array.isArray(data.clips)) return data.clips as ClipIndexEntry[];
    return [];
  } catch {
    return [];
  }
}

async function loadClipJson(file: string): Promise<unknown | null> {
  try {
    const url = file.startsWith('http') ? file : `${BANNON_CLIP_BASE}${file}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main BannonDebugViewport
// ─────────────────────────────────────────────────────────────────────────────

export interface BannonDebugViewportProps {
  fighter: BannonFighterProfile | null;
  onClose?: () => void;
}

export default function BannonDebugViewport({ fighter, onClose }: BannonDebugViewportProps) {
  const [semanticState, setSemanticState] = useState<string>('idle');
  const [clipIndex, setClipIndex] = useState<ClipIndexEntry[]>([]);
  const [clipJson, setClipJson] = useState<unknown | null>(null);
  const [loadingClip, setLoadingClip] = useState(false);
  const [eulerFrame, setEulerFrame] = useState<LiveDebugFrame | null>(null);
  const [quatFrame, setQuatFrame] = useState<LiveDebugFrame | null>(null);
  const [activeTab, setActiveTab] = useState<'bones' | 'vertex' | 'tracks'>('bones');
  const [showSideBySide, setShowSideBySide] = useState(true);

  const modelUrl = useMemo(() => {
    if (!fighter) return null;
    const BANNON_RAW = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models';
    const glbEntry = BANNON_GLB_PLAYABLE_MODELS.find(e => e.id === fighter.id);
    return glbEntry?.overrideUrl ?? (glbEntry ? `${BANNON_RAW}/${glbEntry.model}` : fighter.portraitUrl ?? null);
  }, [fighter]);

  // Load clip index on mount
  useEffect(() => {
    loadClipIndex().then(setClipIndex);
  }, []);

  // Load clip when semantic state changes
  useEffect(() => {
    if (clipIndex.length === 0) return;

    const preferred = clipIndex.find(
      c => c.semanticState === semanticState && c.hasQuaternion === false,
    ) ?? clipIndex.find(
      c => c.name?.toLowerCase().includes(semanticState.replace('_', '').toLowerCase()),
    );

    if (!preferred?.file) {
      setClipJson(null);
      return;
    }

    setLoadingClip(true);
    loadClipJson(preferred.file).then(json => {
      setClipJson(json);
      setLoadingClip(false);
    });
  }, [semanticState, clipIndex]);

  const handleEulerFrame = useCallback((frame: LiveDebugFrame) => {
    setEulerFrame(frame);
  }, []);

  const handleQuatFrame = useCallback((frame: LiveDebugFrame) => {
    setQuatFrame(frame);
  }, []);

  const isEuler = clipJson ? isBannonEulerFormat(clipJson) : false;

  // Summary stats
  const eulerTotalTravel = eulerFrame?.totalAngularTravel ?? 0;
  const quatTotalTravel = quatFrame?.totalAngularTravel ?? 0;
  const eulerMaxVertex = useMemo(
    () => Math.max(...(eulerFrame?.vertexDeltas.map(d => d.maxDelta) ?? [0])),
    [eulerFrame],
  );
  const quatMaxVertex = useMemo(
    () => Math.max(...(quatFrame?.vertexDeltas.map(d => d.maxDelta) ?? [0])),
    [quatFrame],
  );

  if (!fighter) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-xs font-mono tracking-widest">
        SELECT A FIGHTER TO OPEN DEBUG VIEWPORT
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#080a10] text-white font-mono overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-[#0d1018] shrink-0">
        <div className="flex items-center gap-3">
          <div className="text-[9px] tracking-[0.3em] text-zinc-500">BANNON DEBUG VIEWPORT</div>
          <div className="text-[9px] text-yellow-400 tracking-wider">{fighter.name.toUpperCase()}</div>
          {loadingClip && (
            <div className="text-[8px] text-zinc-600 animate-pulse">loading clip…</div>
          )}
          {!loadingClip && clipJson && (
            <div className={`text-[8px] px-1.5 py-0.5 rounded ${isEuler ? 'bg-orange-900/40 text-orange-400' : 'bg-blue-900/40 text-blue-400'}`}>
              {isEuler ? 'EULER RX/RY/RZ' : 'QUATERNION'}
            </div>
          )}
          {!loadingClip && !clipJson && (
            <div className="text-[8px] text-red-500">NO CLIP</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSideBySide(v => !v)}
            className={`text-[8px] tracking-widest px-2 py-0.5 border transition-colors ${
              showSideBySide
                ? 'border-yellow-600 text-yellow-400 bg-yellow-900/20' :'border-zinc-700 text-zinc-500 hover:text-white'
            }`}
          >
            SIDE-BY-SIDE
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="text-[8px] tracking-widest px-2 py-0.5 border border-zinc-700 text-zinc-500 hover:text-white transition-colors"
            >
              ✕ CLOSE
            </button>
          )}
        </div>
      </div>

      {/* ── Semantic state selector ── */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-800 bg-[#0d1018] shrink-0 overflow-x-auto">
        <span className="text-[8px] text-zinc-600 tracking-widest mr-1 shrink-0">STATE:</span>
        {SEMANTIC_STATES.map(s => (
          <button
            key={s}
            onClick={() => setSemanticState(s)}
            className={`px-2 py-0.5 text-[8px] tracking-wider border transition-colors whitespace-nowrap ${
              semanticState === s
                ? 'border-yellow-500 text-yellow-400 bg-yellow-900/20' :'border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-600'
            }`}
          >
            {s.toUpperCase().replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* ── Summary bar ── */}
      <div className="flex items-center gap-4 px-3 py-1 border-b border-zinc-900 bg-[#0a0c12] shrink-0 text-[8px] font-mono">
        <div className="flex items-center gap-1.5">
          <span className="text-orange-500">EULER SRC</span>
          <span className="text-zinc-600">∠</span>
          <span className="text-orange-300">{formatRad(eulerTotalTravel)}</span>
          <span className="text-zinc-700 mx-1">|</span>
          <span className="text-zinc-500">vtx Δ</span>
          <span className={eulerMaxVertex > 0.0001 ? 'text-green-400' : 'text-red-500'}>
            {formatMetres(eulerMaxVertex)}
          </span>
        </div>
        <div className="text-zinc-700">→</div>
        <div className="flex items-center gap-1.5">
          <span className="text-purple-400">QUAT OUT</span>
          <span className="text-zinc-600">∠</span>
          <span className="text-purple-300">{formatRad(quatTotalTravel)}</span>
          <span className="text-zinc-700 mx-1">|</span>
          <span className="text-zinc-500">vtx Δ</span>
          <span className={quatMaxVertex > 0.0001 ? 'text-green-400' : 'text-red-500'}>
            {formatMetres(quatMaxVertex)}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-zinc-600">t =</span>
          <span className="text-zinc-400">{(eulerFrame?.timeSeconds ?? 0).toFixed(2)}s</span>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── 3D Viewports ── */}
        <div className={`flex flex-col ${showSideBySide ? 'w-1/2' : 'w-2/3'} border-r border-zinc-800`}>
          {showSideBySide ? (
            <div className="flex flex-1 overflow-hidden">
              {/* Euler source viewport */}
              <div className="flex-1 relative border-r border-zinc-900">
                <div className="absolute top-1 left-1 z-10 text-[8px] text-orange-400 bg-black/70 px-1.5 py-0.5 tracking-widest">
                  EULER SOURCE
                </div>
                {modelUrl ? (
                  <Canvas
                    camera={{ position: [0, 1.5, 3], fov: 50 }}
                    gl={{ antialias: false }}
                    style={{ background: '#080a10', width: '100%', height: '100%' }}
                  >
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[2, 4, 2]} intensity={1} />
                    <Suspense fallback={null}>
                      <DebugScene
                        modelUrl={modelUrl}
                        clipJson={clipJson}
                        semanticState={semanticState}
                        onFrame={handleEulerFrame}
                        side="euler"
                      />
                    </Suspense>
                    <OrbitControls target={[0, 1, 0]} enablePan={false} />
                  </Canvas>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-700 text-[9px]">
                    NO MODEL
                  </div>
                )}
              </div>

              {/* Quaternion output viewport */}
              <div className="flex-1 relative">
                <div className="absolute top-1 left-1 z-10 text-[8px] text-purple-400 bg-black/70 px-1.5 py-0.5 tracking-widest">
                  QUAT OUTPUT
                </div>
                {modelUrl ? (
                  <Canvas
                    camera={{ position: [0, 1.5, 3], fov: 50 }}
                    gl={{ antialias: false }}
                    style={{ background: '#080a10', width: '100%', height: '100%' }}
                  >
                    <ambientLight intensity={0.5} />
                    <directionalLight position={[2, 4, 2]} intensity={1} />
                    <Suspense fallback={null}>
                      <DebugScene
                        modelUrl={modelUrl}
                        clipJson={clipJson}
                        semanticState={semanticState}
                        onFrame={handleQuatFrame}
                        side="quaternion"
                      />
                    </Suspense>
                    <OrbitControls target={[0, 1, 0]} enablePan={false} />
                  </Canvas>
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-700 text-[9px]">
                    NO MODEL
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Single viewport */
            <div className="flex-1 relative">
              <div className="absolute top-1 left-1 z-10 text-[8px] text-yellow-400 bg-black/70 px-1.5 py-0.5 tracking-widest">
                LIVE — {semanticState.toUpperCase().replace('_', ' ')}
              </div>
              {modelUrl ? (
                <Canvas
                  camera={{ position: [0, 1.5, 3.5], fov: 50 }}
                  gl={{ antialias: true }}
                  style={{ background: '#080a10', width: '100%', height: '100%' }}
                >
                  <ambientLight intensity={0.6} />
                  <directionalLight position={[3, 5, 3]} intensity={1.2} />
                  <Suspense fallback={null}>
                    <DebugScene
                      modelUrl={modelUrl}
                      clipJson={clipJson}
                      semanticState={semanticState}
                      onFrame={frame => { handleEulerFrame(frame); handleQuatFrame(frame); }}
                      side="quaternion"
                    />
                  </Suspense>
                  <OrbitControls target={[0, 1, 0]} enablePan={false} />
                </Canvas>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-700 text-[9px]">
                  NO MODEL URL
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Data panel ── */}
        <div className={`${showSideBySide ? 'w-1/2' : 'w-1/3'} flex flex-col overflow-hidden`}>

          {/* Tab bar */}
          <div className="flex border-b border-zinc-800 shrink-0">
            {(['bones', 'vertex', 'tracks'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-1.5 text-[8px] tracking-widest transition-colors ${
                  activeTab === tab
                    ? 'text-yellow-400 border-b border-yellow-500 bg-yellow-900/10' :'text-zinc-600 hover:text-zinc-300'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'bones' && (
              <div className="flex flex-1 overflow-hidden">
                {showSideBySide ? (
                  <>
                    <BoneTable
                      bones={eulerFrame?.bones ?? []}
                      label="EULER SOURCE"
                      color="#f97316"
                    />
                    <div className="w-px bg-zinc-800 shrink-0" />
                    <BoneTable
                      bones={quatFrame?.bones ?? []}
                      label="QUAT OUTPUT"
                      color="#a855f7"
                    />
                  </>
                ) : (
                  <BoneTable
                    bones={quatFrame?.bones ?? []}
                    label="LIVE BONE ROTATIONS"
                    color="#a855f7"
                  />
                )}
              </div>
            )}

            {activeTab === 'vertex' && (
              <div className="flex-1 overflow-y-auto">
                {showSideBySide ? (
                  <>
                    <VertexDeltaPanel
                      deltas={eulerFrame?.vertexDeltas ?? []}
                      label="EULER SOURCE"
                      color="#f97316"
                    />
                    <VertexDeltaPanel
                      deltas={quatFrame?.vertexDeltas ?? []}
                      label="QUAT OUTPUT"
                      color="#a855f7"
                    />
                  </>
                ) : (
                  <VertexDeltaPanel
                    deltas={quatFrame?.vertexDeltas ?? []}
                    label="LIVE"
                    color="#a855f7"
                  />
                )}
              </div>
            )}

            {activeTab === 'tracks' && (
              <div className="flex-1 overflow-y-auto">
                <QuatTrackBar bones={quatFrame?.bones ?? []} />
                {showSideBySide && (
                  <>
                    <div className="border-t border-zinc-800 mt-1 pt-1 px-2">
                      <div className="text-[9px] tracking-widest text-orange-400 mb-1">EULER SOURCE TRAVEL</div>
                    </div>
                    <QuatTrackBar bones={eulerFrame?.bones ?? []} />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Vertex delta footer always visible */}
          {activeTab === 'bones' && (
            <div className="shrink-0 border-t border-zinc-800">
              <VertexDeltaPanel
                deltas={quatFrame?.vertexDeltas ?? []}
                label="QUAT OUTPUT"
                color="#a855f7"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-3 py-1 border-t border-zinc-900 bg-[#0a0c12] flex items-center gap-4 text-[8px] text-zinc-600 shrink-0">
        <span>CLIP: {eulerFrame?.clipName || '—'}</span>
        <span>FORMAT: {isEuler ? 'BANNON_EULER_RX_RY_RZ → QUAT' : clipJson ? 'QUATERNION' : 'NONE'}</span>
        <span>BONES: {eulerFrame?.bones.length ?? 0}</span>
        <span>
          DEFORM:{' '}
          <span className={quatMaxVertex > 0.0001 ? 'text-green-400' : 'text-red-500'}>
            {quatMaxVertex > 0.0001 ? 'MEASURED' : 'NOT DETECTED'}
          </span>
        </span>
      </div>
    </div>
  );
}
