'use client';

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { getAllBannonFighters, type BannonFighterProfile } from '../data/bannonRoster';
import { BANNON_GLB_PLAYABLE_MODELS } from '../data/bannonGlbRoster';
import { runCharacterPipeline } from '../engine/pipeline/CharacterPipeline';
import { AutoRigDetector } from '../engine/locomotion/AutoRigDetector';
import {
  runAnimationIntegrityGate,
  type AnimationIntegrityReport,
  classifyClipSource,
  type ClipSourceType,
} from '../engine/combat/AnimationIntegrityGate';
import { SEMANTIC_STATE_ALIASES } from '../engine/retarget/SemanticStateAliases';

// ── All semantic states to cycle through ─────────────────────────────────────
const SEMANTIC_STATES: string[] = [
  'idle',
  'walk_forward',
  'walk_back',
  'strafe_left',
  'strafe_right',
  'attack_1',
  'attack_2',
  'block',
  'hit_reaction',
  'knockdown',
  'getup',
  'grapple',
];

const CLIP_SOURCE_COLORS: Record<ClipSourceType, string> = {
  AUTHORED_CLIP:            '#22c55e',
  RETARGETED_AUTHORED_CLIP: '#3b82f6',
  PLACEHOLDER_TEST_CLIP:    '#f59e0b',
  MISSING_CLIP:             '#ef4444',
};

const CLIP_SOURCE_LABELS: Record<ClipSourceType, string> = {
  AUTHORED_CLIP:            'AUTHORED',
  RETARGETED_AUTHORED_CLIP: 'RETARGETED',
  PLACEHOLDER_TEST_CLIP:    'PLACEHOLDER',
  MISSING_CLIP:             'MISSING',
};

// ── Normalized result type ────────────────────────────────────────────────────
interface NormalizedResult {
  scene: THREE.Group;
  forwardCorrectionY: number;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
}

// ── Resolve clip name for a semantic state ────────────────────────────────────
function resolveClipForSemanticState(
  semanticState: string,
  availableClips: string[],
): { clipName: string | null; sourceType: ClipSourceType } {
  const aliases = SEMANTIC_STATE_ALIASES[semanticState] ?? [semanticState];

  // Exact match
  let found = availableClips.find(c =>
    aliases.some(a => c.toLowerCase() === a.toLowerCase())
  );
  if (found) {
    return { clipName: found, sourceType: classifyClipSource(found) };
  }

  // Partial match on semantic state
  found = availableClips.find(c =>
    c.toLowerCase().includes(semanticState.replace('_', '').toLowerCase()) ||
    c.toLowerCase().includes(semanticState.toLowerCase())
  );
  if (found) {
    return { clipName: found, sourceType: classifyClipSource(found) };
  }

  // Fallback to idle
  found = availableClips.find(c => c.toLowerCase().includes('idle'));
  if (found) {
    return { clipName: found, sourceType: classifyClipSource(found) };
  }

  return { clipName: availableClips[0] ?? null, sourceType: availableClips[0] ? classifyClipSource(availableClips[0]) : 'MISSING_CLIP' };
}

// ── 3D Character viewer ───────────────────────────────────────────────────────
interface CharacterViewerProps {
  modelUrl: string;
  currentSemanticState: string;
  onReady: (result: NormalizedResult, report: AnimationIntegrityReport) => void;
  onClipChange: (clipName: string | null, sourceType: ClipSourceType) => void;
}

function CharacterViewerInner({
  modelUrl,
  currentSemanticState,
  onReady,
  onClipChange,
}: CharacterViewerProps) {
  const { scene, animations } = useGLTF(modelUrl);
  const normalizedRef = useRef<NormalizedResult | null>(null);
  const groupRef = useRef<THREE.Group>(null);
  const readyFiredRef = useRef(false);
  const lastStateRef = useRef<string>('');

  useEffect(() => {
    if (!scene) return;
    const report = AutoRigDetector.analyze(scene, animations);
    const result = runCharacterPipeline(scene as THREE.Group, animations, modelUrl, false);
    if (!result) {
      console.error(`[AnimTestArena] BLOCKED — "${modelUrl}" failed pipeline`);
      return;
    }
    normalizedRef.current = {
      scene: result.scene,
      forwardCorrectionY: result.forwardCorrectionY,
      mixer: result.mixer,
      actions: result.actions,
    };

    // Auto-play idle
    const availableClips = Object.keys(result.actions);
    const { clipName } = resolveClipForSemanticState('idle', availableClips);
    if (clipName && result.actions[clipName]) {
      const action = result.actions[clipName];
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.reset().play();
    }

    // Run integrity gate
    const integrityReport = runAnimationIntegrityGate({
      characterName: modelUrl.split('/').pop()?.replace('.glb', '').toUpperCase() ?? 'UNKNOWN',
      clonedScene: result.scene,
      mixer: result.mixer,
      actions: result.actions,
      activeClipName: clipName,
    });

    if (!readyFiredRef.current) {
      readyFiredRef.current = true;
      onReady(normalizedRef.current, integrityReport);
    }

    return () => {
      result.mixer.stopAllAction();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, modelUrl]);

  // ── Respond to semantic state changes ────────────────────────────────────
  useEffect(() => {
    const normalized = normalizedRef.current;
    if (!normalized) return;
    if (currentSemanticState === lastStateRef.current) return;
    lastStateRef.current = currentSemanticState;

    const availableClips = Object.keys(normalized.actions);
    const { clipName, sourceType } = resolveClipForSemanticState(currentSemanticState, availableClips);

    console.log(
      `[AnimTestArena] 🎬 STATE: "${currentSemanticState}" → clip="${clipName ?? 'NONE'}" [${sourceType}]`
    );
    onClipChange(clipName, sourceType);

    if (!clipName || !normalized.actions[clipName]) {
      console.warn(`[AnimTestArena] ⚠️ MISSING_CLIP for semantic state "${currentSemanticState}"`);
      return;
    }

    // Stop all, play new
    const currentAction = Object.values(normalized.actions).find(a => a?.isRunning());
    const nextAction = normalized.actions[clipName];
    const isLoop = ['idle', 'walk_forward', 'walk_back', 'strafe_left', 'strafe_right', 'block'].includes(currentSemanticState);

    nextAction.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
    nextAction.clampWhenFinished = !isLoop;
    nextAction.reset();

    if (currentAction && currentAction !== nextAction) {
      currentAction.crossFadeTo(nextAction, 0.1, true);
      nextAction.play();
    } else {
      nextAction.fadeIn(0.1).play();
    }
  }, [currentSemanticState, onClipChange]);

  useFrame((_, delta) => {
    const normalized = normalizedRef.current;
    if (normalized) {
      normalized.mixer.update(delta);
    }
    if (groupRef.current) {
      groupRef.current.position.set(0, 0, 0);
    }
  });

  const normalized = normalizedRef.current;
  if (!normalized) return null;

  return (
    <group ref={groupRef}>
      <group rotation={[0, normalized.forwardCorrectionY, 0]}>
        <primitive object={normalized.scene} />
      </group>
    </group>
  );
}

function CharacterViewer(props: CharacterViewerProps) {
  return (
    <Suspense fallback={null}>
      <CharacterViewerInner {...props} />
    </Suspense>
  );
}

// ── Main Animation Test Arena ─────────────────────────────────────────────────
interface AnimationTestArenaProps {
  onBack: () => void;
}

export default function AnimationTestArena({ onBack }: AnimationTestArenaProps) {
  const fighters = getAllBannonFighters();
  const uniqueFighters = fighters.filter((f, i, arr) => arr.findIndex(x => x.id === f.id) === i);

  const [selectedFighter, setSelectedFighter] = useState<BannonFighterProfile | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [isAutoCycling, setIsAutoCycling] = useState(false);
  const [cycleInterval, setCycleInterval] = useState(2000);
  const [integrityReport, setIntegrityReport] = useState<AnimationIntegrityReport | null>(null);
  const [currentClipName, setCurrentClipName] = useState<string | null>(null);
  const [currentClipSource, setCurrentClipSource] = useState<ClipSourceType>('MISSING_CLIP');
  const [showLog, setShowLog] = useState(false);
  const autoCycleRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentSemanticState = SEMANTIC_STATES[currentStateIndex];

  // ── Fighter selection ─────────────────────────────────────────────────────
  const handleSelectFighter = useCallback((fighter: BannonFighterProfile) => {
    setSelectedFighter(fighter);
    setIntegrityReport(null);
    setCurrentClipName(null);
    setCurrentClipSource('MISSING_CLIP');
    setCurrentStateIndex(0);

    // Find the best GLB URL for this fighter
    const glbEntry = BANNON_GLB_PLAYABLE_MODELS.find(e => e.id === fighter.id);
    const BANNON_RAW = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models';
    const url = glbEntry?.overrideUrl ?? (glbEntry ? `${BANNON_RAW}/${glbEntry.model}` : fighter.portraitUrl);
    setModelUrl(url);
    console.log(`[AnimTestArena] 🎭 Selected fighter: ${fighter.name} → ${url}`);
  }, []);

  // ── State navigation ──────────────────────────────────────────────────────
  const goToState = useCallback((index: number) => {
    const clamped = ((index % SEMANTIC_STATES.length) + SEMANTIC_STATES.length) % SEMANTIC_STATES.length;
    setCurrentStateIndex(clamped);
    console.log(`[AnimTestArena] ▶️ Semantic state: "${SEMANTIC_STATES[clamped]}" (${clamped + 1}/${SEMANTIC_STATES.length})`);
  }, []);

  const prevState = useCallback(() => goToState(currentStateIndex - 1), [currentStateIndex, goToState]);
  const nextState = useCallback(() => goToState(currentStateIndex + 1), [currentStateIndex, goToState]);

  // ── Auto-cycle ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    if (isAutoCycling && modelUrl) {
      autoCycleRef.current = setInterval(() => {
        setCurrentStateIndex(i => (i + 1) % SEMANTIC_STATES.length);
      }, cycleInterval);
    }
    return () => {
      if (autoCycleRef.current) clearInterval(autoCycleRef.current);
    };
  }, [isAutoCycling, cycleInterval, modelUrl]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') prevState();
      if (e.key === 'ArrowRight' || e.key === 'd') nextState();
      if (e.key === ' ') setIsAutoCycling(v => !v);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prevState, nextState]);

  const handleReady = useCallback((result: NormalizedResult, report: AnimationIntegrityReport) => {
    setIntegrityReport(report);
    console.log(`[AnimTestArena] ✅ Character ready — verdict: ${report.verdict}`);
  }, []);

  const handleClipChange = useCallback((clipName: string | null, sourceType: ClipSourceType) => {
    setCurrentClipName(clipName);
    setCurrentClipSource(sourceType);
  }, []);

  const verdictColor = integrityReport
    ? integrityReport.verdict === 'PASS'      ? '#22c55e'
    : integrityReport.verdict === 'TEST_ONLY' ? '#f59e0b'
    : integrityReport.verdict === 'BLOCKED'? '#ef4444' :'#94a3b8' :'#94a3b8';

  return (
    <div className="fixed inset-0 bg-[#0a0c12] text-white font-mono flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-[#0d1018]">
        <button
          onClick={onBack}
          className="text-xs tracking-widest text-zinc-500 hover:text-white transition-colors border border-zinc-700 px-3 py-1"
        >
          ← BACK
        </button>
        <div className="text-center">
          <div className="text-[10px] tracking-[0.4em] text-zinc-500">ANIMATION TEST ARENA</div>
          <div className="text-xs tracking-widest text-yellow-400">MOVESET CREATION SCENE</div>
        </div>
        <div className="text-[9px] tracking-widest text-zinc-600">
          {SEMANTIC_STATES.length} STATES
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel: fighter select ── */}
        <div className="w-48 border-r border-zinc-800 bg-[#0d1018] overflow-y-auto flex-shrink-0">
          <div className="px-3 py-2 text-[9px] tracking-widest text-zinc-500 border-b border-zinc-800">
            SELECT FIGHTER
          </div>
          {uniqueFighters.map(fighter => (
            <button
              key={fighter.id}
              onClick={() => handleSelectFighter(fighter)}
              className={`w-full text-left px-3 py-2 text-xs border-b border-zinc-900 transition-colors ${
                selectedFighter?.id === fighter.id
                  ? 'bg-yellow-400/10 text-yellow-400 border-l-2 border-l-yellow-400' :'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
              }`}
            >
              <div className="font-bold tracking-wider truncate">{fighter.name.toUpperCase()}</div>
              <div className="text-[9px] text-zinc-600 truncate">{fighter.fightingStyle.split('/')[0]}</div>
            </button>
          ))}
        </div>

        {/* ── Center: 3D viewport ── */}
        <div className="flex-1 relative">
          {!modelUrl ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-zinc-600 text-xs tracking-widest mb-2">SELECT A FIGHTER</div>
                <div className="text-zinc-800 text-[10px]">to begin animation testing</div>
              </div>
            </div>
          ) : (
            <Canvas
              camera={{ position: [0, 1.5, 3.5], fov: 50 }}
              gl={{ antialias: true }}
              style={{ background: '#0a0c12' }}
            >
              <ambientLight intensity={0.6} />
              <directionalLight position={[3, 5, 3]} intensity={1.2} castShadow />
              <directionalLight position={[-3, 3, -3]} intensity={0.4} color="#4466ff" />

              <Grid
                args={[10, 10]}
                cellSize={0.5}
                cellThickness={0.5}
                cellColor="#1a1f2e"
                sectionSize={2}
                sectionThickness={1}
                sectionColor="#2a3050"
                fadeDistance={8}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid
              />

              <CharacterViewer
                modelUrl={modelUrl}
                currentSemanticState={currentSemanticState}
                onReady={handleReady}
                onClipChange={handleClipChange}
              />

              <OrbitControls
                target={[0, 1, 0]}
                minDistance={1.5}
                maxDistance={8}
                enablePan={false}
              />
            </Canvas>
          )}

          {/* ── State name overlay ── */}
          {modelUrl && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 text-center pointer-events-none">
              <div className="text-[10px] tracking-widest text-zinc-500">
                {currentStateIndex + 1} / {SEMANTIC_STATES.length}
              </div>
              <div className="text-2xl font-black tracking-widest text-white mt-1">
                {currentSemanticState.toUpperCase().replace('_', ' ')}
              </div>
              {currentClipName && (
                <div
                  className="mt-1 text-[10px] tracking-wider px-2 py-0.5 rounded"
                  style={{ color: CLIP_SOURCE_COLORS[currentClipSource], background: `${CLIP_SOURCE_COLORS[currentClipSource]}22` }}
                >
                  {CLIP_SOURCE_LABELS[currentClipSource]}: {currentClipName}
                </div>
              )}
              {!currentClipName && (
                <div className="mt-1 text-[10px] tracking-wider text-red-400">
                  ⚠️ MISSING_CLIP — no animation for this state
                </div>
              )}
            </div>
          )}

          {/* ── Navigation controls ── */}
          {modelUrl && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button
                onClick={prevState}
                className="w-10 h-10 bg-zinc-800/90 border border-zinc-700 text-white text-lg hover:bg-zinc-700 transition-colors"
              >
                ←
              </button>
              <button
                onClick={() => setIsAutoCycling(v => !v)}
                className={`px-4 h-10 border text-xs tracking-widest transition-colors ${
                  isAutoCycling
                    ? 'bg-yellow-400/20 border-yellow-400 text-yellow-400' :'bg-zinc-800/90 border-zinc-700 text-zinc-400 hover:text-white'
                }`}
              >
                {isAutoCycling ? '⏸ PAUSE' : '▶ AUTO'}
              </button>
              <button
                onClick={nextState}
                className="w-10 h-10 bg-zinc-800/90 border border-zinc-700 text-white text-lg hover:bg-zinc-700 transition-colors"
              >
                →
              </button>
            </div>
          )}

          {/* ── Cycle speed control ── */}
          {modelUrl && isAutoCycling && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2">
              <span className="text-[9px] text-zinc-500 tracking-widest">SPEED</span>
              {[500, 1000, 2000, 3000].map(ms => (
                <button
                  key={ms}
                  onClick={() => setCycleInterval(ms)}
                  className={`px-2 py-0.5 text-[9px] border transition-colors ${
                    cycleInterval === ms
                      ? 'border-yellow-400 text-yellow-400' :'border-zinc-700 text-zinc-500 hover:text-white'
                  }`}
                >
                  {ms < 1000 ? `${ms}ms` : `${ms / 1000}s`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Right panel: integrity report ── */}
        <div className="w-64 border-l border-zinc-800 bg-[#0d1018] overflow-y-auto flex-shrink-0">
          <div className="px-3 py-2 text-[9px] tracking-widest text-zinc-500 border-b border-zinc-800 flex items-center justify-between">
            <span>INTEGRITY GATE</span>
            {integrityReport && (
              <span
                className="text-[9px] font-bold tracking-widest px-1.5 py-0.5"
                style={{ color: verdictColor, background: `${verdictColor}22` }}
              >
                {integrityReport.verdict}
              </span>
            )}
          </div>

          {!integrityReport ? (
            <div className="px-3 py-4 text-[10px] text-zinc-600">
              {modelUrl ? 'Loading...' : 'Select a fighter'}
            </div>
          ) : (
            <div className="px-3 py-2 space-y-3 text-[10px]">
              {/* Asset counts */}
              <div className="space-y-1">
                <div className="text-[9px] tracking-widest text-zinc-500 mb-1">ASSET</div>
                <Row label="VISIBLE MESHES" value={integrityReport.visibleMeshCount} />
                <Row label="SKINNED MESHES" value={integrityReport.skinnedMeshCount} warn={integrityReport.skinnedMeshCount === 0} />
                <Row label="SKELETON BONES" value={integrityReport.skeletonBoneCount} warn={integrityReport.skeletonBoneCount === 0} />
              </div>

              {/* Clip sources */}
              <div className="space-y-1">
                <div className="text-[9px] tracking-widest text-zinc-500 mb-1">CLIP SOURCES</div>
                <Row label="TOTAL CLIPS" value={integrityReport.animationClipCount} />
                <Row
                  label="AUTHORED"
                  value={integrityReport.authoredClipCount}
                  color={integrityReport.authoredClipCount > 0 ? '#22c55e' : undefined}
                />
                <Row
                  label="RETARGETED"
                  value={integrityReport.retargetedClipCount}
                  color={integrityReport.retargetedClipCount > 0 ? '#3b82f6' : undefined}
                />
                <Row
                  label="PLACEHOLDER"
                  value={integrityReport.placeholderClipCount}
                  color={integrityReport.placeholderClipCount > 0 ? '#f59e0b' : undefined}
                  warn={integrityReport.placeholderClipCount > 0 && integrityReport.authoredClipCount === 0}
                />
                <Row
                  label="MISSING"
                  value={integrityReport.missingClipCount}
                  warn={integrityReport.missingClipCount > 0}
                />
              </div>

              {/* Track resolution */}
              <div className="space-y-1">
                <div className="text-[9px] tracking-widest text-zinc-500 mb-1">TRACKS</div>
                <Row label="TOTAL" value={integrityReport.totalTrackCount} />
                <Row label="RESOLVED" value={integrityReport.resolvedTrackCount} color="#22c55e" />
                <Row label="UNRESOLVED" value={integrityReport.unresolvedTrackCount} warn={integrityReport.unresolvedTrackCount > 0} />
              </div>

              {/* Active clip */}
              <div className="space-y-1">
                <div className="text-[9px] tracking-widest text-zinc-500 mb-1">ACTIVE CLIP</div>
                <div className="text-[10px] break-all" style={{ color: CLIP_SOURCE_COLORS[integrityReport.activeClipSourceType] }}>
                  {integrityReport.activeClipName ?? 'NONE'}
                </div>
                <div className="text-[9px] text-zinc-500">
                  [{CLIP_SOURCE_LABELS[integrityReport.activeClipSourceType]}]
                </div>
              </div>

              {/* Bone travel */}
              <div className="space-y-1">
                <div className="text-[9px] tracking-widest text-zinc-500 mb-1">BONE TRAVEL</div>
                <Row
                  label="MAX DIST"
                  value={`${integrityReport.maxBoneTravelMetres.toFixed(4)}m`}
                  warn={integrityReport.maxBoneTravelMetres < 0.0001}
                />
                <Row
                  label="MAX ROT"
                  value={`${integrityReport.maxBoneRotationDegrees.toFixed(2)}°`}
                  warn={integrityReport.maxBoneRotationDegrees < 0.01}
                />
              </div>

              {/* Mixer */}
              <div className="space-y-1">
                <div className="text-[9px] tracking-widest text-zinc-500 mb-1">MIXER</div>
                <Row
                  label="ROOT = CLONE"
                  value={integrityReport.mixerRootIsVisibleClone ? 'YES ✅' : 'NO ❌'}
                  warn={!integrityReport.mixerRootIsVisibleClone}
                />
              </div>

              {/* Warnings */}
              {integrityReport.warningChecks.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] tracking-widest text-zinc-500 mb-1">WARNINGS</div>
                  {integrityReport.warningChecks.map(w => (
                    <div key={w} className="text-[9px] text-yellow-400">⚠️ {w}</div>
                  ))}
                </div>
              )}

              {/* Failures */}
              {integrityReport.failingChecks.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] tracking-widest text-zinc-500 mb-1">FAILURES</div>
                  {integrityReport.failingChecks.map(f => (
                    <div key={f} className="text-[9px] text-red-400">❌ {f}</div>
                  ))}
                </div>
              )}

              {/* Log toggle */}
              <button
                onClick={() => setShowLog(v => !v)}
                className="w-full text-[9px] tracking-widest text-zinc-500 border border-zinc-700 py-1 hover:text-white hover:border-zinc-500 transition-colors"
              >
                {showLog ? 'HIDE LOG' : 'SHOW LOG'}
              </button>

              {showLog && (
                <div className="bg-black/50 border border-zinc-800 p-2 max-h-48 overflow-y-auto">
                  {integrityReport.logLines.map((line, i) => (
                    <div key={i} className="text-[8px] text-zinc-400 leading-relaxed whitespace-pre-wrap">{line}</div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Semantic state list ── */}
          <div className="border-t border-zinc-800 mt-2">
            <div className="px-3 py-2 text-[9px] tracking-widest text-zinc-500">ALL STATES</div>
            {SEMANTIC_STATES.map((state, i) => (
              <button
                key={state}
                onClick={() => goToState(i)}
                className={`w-full text-left px-3 py-1.5 text-[10px] border-b border-zinc-900 transition-colors ${
                  i === currentStateIndex
                    ? 'bg-yellow-400/10 text-yellow-400' :'text-zinc-500 hover:text-white hover:bg-zinc-800/30'
                }`}
              >
                <span className="text-zinc-700 mr-2">{String(i + 1).padStart(2, '0')}</span>
                {state.toUpperCase().replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Keyboard hint ── */}
      <div className="px-4 py-1.5 border-t border-zinc-800 bg-[#0d1018] flex items-center gap-6 text-[9px] text-zinc-600">
        <span>← → NAVIGATE STATES</span>
        <span>SPACE AUTO-CYCLE</span>
        <span>ORBIT DRAG TO ROTATE</span>
        {integrityReport && (
          <span style={{ color: verdictColor }}>
            VERDICT: {integrityReport.verdict}
            {integrityReport.verdict === 'TEST_ONLY' && ' (placeholder only — not real animation)'}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Helper row component ──────────────────────────────────────────────────────
function Row({
  label,
  value,
  warn = false,
  color,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-600">{label}</span>
      <span
        className="font-bold"
        style={{ color: color ?? (warn ? '#f59e0b' : '#e2e8f0') }}
      >
        {value}
      </span>
    </div>
  );
}
