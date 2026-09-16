'use client';

import React, { useState } from 'react';
import { type BannonFighterProfile, BANNON_ROSTER } from '../data/bannonRoster';
import type { DebugOverlaySettings } from '../engine/debug/DebugOverlay';
import { DEFAULT_DEBUG_SETTINGS } from '../engine/debug/DebugOverlay';
import MoveLibraryViewer from './MoveLibraryViewer';
import dynamic from 'next/dynamic';
import type { StageId } from './StageSelectScreen';

const GameBattleArena = dynamic(() => import('./GameBattleArena'), { ssr: false });

interface PracticeArenaScreenProps {
  onBack: () => void;
}

type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'BRUTAL';

const DIFFICULTY_CONFIG: Record<Difficulty, {
  label: string;
  color: string;
  desc: string;
}> = {
  EASY:   { label: 'EASY',   color: '#22c55e', desc: 'Slow AI, low damage. Perfect for learning move timing.' },
  NORMAL: { label: 'NORMAL', color: '#facc15', desc: 'Balanced AI. Good for practicing combos and spacing.' },
  HARD:   { label: 'HARD',   color: '#f97316', desc: 'Aggressive AI with punish windows. Tests your defense.' },
  BRUTAL: { label: 'BRUTAL', color: '#ef4444', desc: 'Near-perfect AI. Only for mastery-level preparation.' },
};

const FACTION_COLOR: Record<string, string> = {
  alliance:    '#1d4ed8',
  corporate:   '#dc2626',
  chaos:       '#7c3aed',
  independent: '#d97706',
};

// ── Available stages for practice mode ───────────────────────────────────────
interface StageOption {
  id: StageId;
  label: string;
  desc: string;
  color: string;
  isDefault?: boolean;
}

const PRACTICE_STAGES: StageOption[] = [
  {
    id: 'training',
    label: 'TRAINING ARENA',
    desc: 'Default practice stage. Clean floor, no distractions.',
    color: '#22c55e',
    isDefault: true,
  },
  {
    id: 'urban_night',
    label: 'URBAN NIGHT',
    desc: 'City rooftop at night. Same engine as ranked matches.',
    color: '#3b82f6',
  },
];

export default function PracticeArenaScreen({ onBack }: PracticeArenaScreenProps) {
  const [phase, setPhase] = useState<'SETUP' | 'FIGHTING'>('SETUP');
  const [selectedFighter, setSelectedFighter] = useState<BannonFighterProfile>(BANNON_ROSTER[0]);
  const [aiFighter, setAiFighter] = useState<BannonFighterProfile>(BANNON_ROSTER[1] ?? BANNON_ROSTER[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [selectedStage, setSelectedStage] = useState<StageId>('training');
  const [showSettings, setShowSettings] = useState(false);
  const [debugSettings, setDebugSettings] = useState<DebugOverlaySettings>(DEFAULT_DEBUG_SETTINGS);
  const [showMoveLibrary, setShowMoveLibrary] = useState(false);
  const [sessionWins, setSessionWins] = useState(0);
  const [sessionLosses, setSessionLosses] = useState(0);

  const cfg = DIFFICULTY_CONFIG[difficulty];

  if (showMoveLibrary) {
    return <MoveLibraryViewer onClose={() => setShowMoveLibrary(false)} />;
  }

  // ── FIGHTING PHASE: delegate entirely to GameBattleArena ─────────────────
  if (phase === 'FIGHTING') {
    return (
      <GameBattleArena
        p1Fighter={selectedFighter}
        p2Fighter={aiFighter}
        isPracticeMode
        debugSettings={debugSettings}
        stageId={selectedStage}
        roundLabel={`PRACTICE · ${difficulty} · ${PRACTICE_STAGES.find(s => s.id === selectedStage)?.label ?? selectedStage.toUpperCase()}`}
        onMatchEnd={(winner) => {
          if (winner === 'p1') setSessionWins(w => w + 1);
          else if (winner === 'p2') setSessionLosses(l => l + 1);
          setPhase('SETUP');
        }}
        onBack={() => setPhase('SETUP')}
      />
    );
  }

  // ── SETUP PHASE ───────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-[#080a10] text-white font-mono overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-5">
          <button onClick={onBack} className="text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors mb-3">
            ← BACK
          </button>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] tracking-[0.5em] text-zinc-500">TRAINING MODE</div>
              <div className="text-3xl font-black tracking-widest">PRACTICE ARENA</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(s => !s)}
                className="border px-3 py-1.5 text-[8px] font-black tracking-widest transition-all"
                style={{
                  borderColor: showSettings ? '#facc15' : '#27272a',
                  color: showSettings ? '#facc15' : '#52525b',
                  background: showSettings ? '#facc1512' : 'transparent',
                }}
              >
                ⚙ SETTINGS
              </button>
              <div className="border border-green-900 bg-green-900/20 px-3 py-1.5 text-right">
                <div className="text-[7px] text-green-700">NO STAT PENALTY</div>
                <div className="text-[9px] font-black text-green-400">SAFE ZONE</div>
              </div>
            </div>
          </div>
          <div className="mt-1 h-px bg-zinc-800" />
          <div className="mt-2 text-[8px] text-zinc-600">
            Full combat arena — same engine as ranked matches. Wins and losses here do not affect your tournament record or rank points.
          </div>
        </div>

        {/* Session stats */}
        {(sessionWins > 0 || sessionLosses > 0) && (
          <div className="mb-4 border border-zinc-900 p-3 flex gap-6 items-center">
            <div className="text-[7px] tracking-widest text-zinc-600">SESSION</div>
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-lg font-black text-green-400">{sessionWins}</div>
                <div className="text-[7px] text-zinc-600">WINS</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-black text-red-400">{sessionLosses}</div>
                <div className="text-[7px] text-zinc-600">LOSSES</div>
              </div>
            </div>
          </div>
        )}

        {/* ── STAGE SELECT ── */}
        <div className="mb-5">
          <div className="text-[8px] tracking-[0.3em] text-zinc-500 mb-2">SELECT STAGE</div>
          <div className="grid grid-cols-2 gap-1.5">
            {PRACTICE_STAGES.map(stage => {
              const isSelected = selectedStage === stage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => setSelectedStage(stage.id)}
                  className="border p-3 text-left transition-all relative"
                  style={{
                    borderColor: isSelected ? stage.color : '#27272a',
                    background: isSelected ? `${stage.color}12` : 'transparent',
                  }}
                >
                  {stage.isDefault && (
                    <div className="absolute top-1.5 right-1.5 text-[5px] tracking-widest px-1 py-0.5"
                      style={{ color: stage.color, background: `${stage.color}20` }}>
                      DEFAULT
                    </div>
                  )}
                  <div className="text-[10px] font-black" style={{ color: isSelected ? stage.color : '#a1a1aa' }}>
                    {stage.label}
                  </div>
                  <div className="text-[7px] text-zinc-600 mt-0.5">{stage.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── SETTINGS PANEL ── */}
        {showSettings && (
          <div className="mb-5 border border-yellow-900/50 bg-yellow-900/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[9px] tracking-[0.3em] text-yellow-400 font-black">PRACTICE SETTINGS</div>
              <button onClick={() => setShowSettings(false)} className="text-[8px] text-zinc-500 hover:text-zinc-300 transition-colors">
                ✕ CLOSE
              </button>
            </div>

            {/* Debug overlay master toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-black text-zinc-300">DEBUG OVERLAY</div>
                  <div className="text-[7px] text-zinc-600 mt-0.5">Frame windows, AABB geometry, impact markers</div>
                </div>
                <button
                  onClick={() => setDebugSettings(s => ({ ...s, enabled: !s.enabled }))}
                  className="border px-3 py-1.5 text-[8px] font-black tracking-widest transition-all"
                  style={{
                    borderColor: debugSettings.enabled ? '#22c55e' : '#27272a',
                    color: debugSettings.enabled ? '#22c55e' : '#52525b',
                    background: debugSettings.enabled ? '#22c55e12' : 'transparent',
                  }}
                >
                  {debugSettings.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {debugSettings.enabled && (
                <div className="pl-3 border-l border-zinc-800 space-y-2">
                  <div className="text-[7px] tracking-widest text-zinc-600 mb-1">PER-FIGHTER</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showP1: !s.showP1 }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{ borderColor: debugSettings.showP1 ? '#1d4ed8' : '#27272a', color: debugSettings.showP1 ? '#1d4ed8' : '#52525b' }}
                    >
                      P1 {debugSettings.showP1 ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showP2: !s.showP2 }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{ borderColor: debugSettings.showP2 ? '#dc2626' : '#27272a', color: debugSettings.showP2 ? '#dc2626' : '#52525b' }}
                    >
                      P2 {debugSettings.showP2 ? '●' : '○'}
                    </button>
                  </div>

                  <div className="text-[7px] tracking-widest text-zinc-600 mb-1">LAYERS</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showFrameWindows: !s.showFrameWindows }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{ borderColor: debugSettings.showFrameWindows ? '#facc15' : '#27272a', color: debugSettings.showFrameWindows ? '#facc15' : '#52525b' }}
                    >
                      FRAME WINDOWS {debugSettings.showFrameWindows ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showAABB: !s.showAABB }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{ borderColor: debugSettings.showAABB ? '#22c55e' : '#27272a', color: debugSettings.showAABB ? '#22c55e' : '#52525b' }}
                    >
                      AABB {debugSettings.showAABB ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showImpactMarkers: !s.showImpactMarkers }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{ borderColor: debugSettings.showImpactMarkers ? '#f97316' : '#27272a', color: debugSettings.showImpactMarkers ? '#f97316' : '#52525b' }}
                    >
                      IMPACT {debugSettings.showImpactMarkers ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showRigState: !s.showRigState }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{ borderColor: debugSettings.showRigState ? '#a3e635' : '#27272a', color: debugSettings.showRigState ? '#a3e635' : '#52525b' }}
                    >
                      RIG STATE {debugSettings.showRigState ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showHurtboxRegions: !s.showHurtboxRegions }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{ borderColor: debugSettings.showHurtboxRegions ? '#a78bfa' : '#27272a', color: debugSettings.showHurtboxRegions ? '#a78bfa' : '#52525b' }}
                    >
                      HURTBOXES {debugSettings.showHurtboxRegions ? '●' : '○'}
                    </button>
                  </div>

                  {/* Rig state legend */}
                  {debugSettings.showRigState && (
                    <div className="mt-1 p-2 bg-zinc-900/60 border border-zinc-800 space-y-1">
                      <div className="text-[6px] tracking-widest text-zinc-500">RIG STATE LEGEND</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[6px]">
                        <span style={{ color: '#a3e635' }}>● CLIP — active animation</span>
                        <span style={{ color: '#22d3ee' }}>● FRAME — current/total</span>
                        <span style={{ color: '#facc15' }}>● SPEED — playback rate</span>
                        <span style={{ color: '#f97316' }}>● XFADE — crossfade progress</span>
                      </div>
                    </div>
                  )}

                  {/* Hurtbox region legend */}
                  {debugSettings.showHurtboxRegions && (
                    <div className="mt-1 p-2 bg-zinc-900/60 border border-zinc-800 space-y-1">
                      <div className="text-[6px] tracking-widest text-zinc-500">HURTBOX REGIONS</div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[6px]">
                        <span style={{ color: '#a78bfa' }}>■ HEAD ×1.5</span>
                        <span style={{ color: '#60a5fa' }}>■ TORSO ×1.0</span>
                        <span style={{ color: '#34d399' }}>■ ARMS ×0.8</span>
                        <span style={{ color: '#fbbf24' }}>■ LEGS ×0.7</span>
                        <span style={{ color: '#ef4444' }}>■ HIT</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Move Library */}
            <div className="pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowMoveLibrary(true)}
                className="w-full border border-purple-900 py-2.5 text-[8px] font-black tracking-widest text-purple-400 hover:border-purple-700 hover:text-purple-300 transition-all bg-purple-900/10"
              >
                📋 VIEW MOVE LIBRARY — GLB ANIMATION MANIFEST
              </button>
            </div>
          </div>
        )}

        {/* Fighter select */}
        <div className="space-y-5">
          <div>
            <div className="text-[8px] tracking-[0.3em] text-zinc-500 mb-2">SELECT YOUR FIGHTER</div>
            <div className="grid grid-cols-2 gap-1.5">
              {BANNON_ROSTER.slice(0, 6).map(fighter => {
                const fColor = FACTION_COLOR[fighter.factionAlignment];
                const isSelected = selectedFighter.id === fighter.id;
                return (
                  <button
                    key={fighter.id}
                    onClick={() => setSelectedFighter(fighter)}
                    className="border p-3 text-left transition-all"
                    style={{ borderColor: isSelected ? fColor : '#27272a', background: isSelected ? `${fColor}12` : 'transparent' }}
                  >
                    <div className="text-[10px] font-black" style={{ color: isSelected ? fColor : '#a1a1aa' }}>
                      {fighter.name.toUpperCase()}
                    </div>
                    <div className="text-[7px] text-zinc-600 mt-0.5">{fighter.fightingStyle.split('.')[0]}</div>
                    <div className="flex gap-2 mt-1.5">
                      <span className="text-[7px] text-zinc-500">STR {fighter.strength}</span>
                      <span className="text-[7px] text-zinc-500">SPD {fighter.speed}</span>
                      <span className="text-[7px] text-zinc-500">HP {fighter.hp}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Fighter select */}
          <div>
            <div className="text-[8px] tracking-[0.3em] text-zinc-500 mb-2">SELECT OPPONENT</div>
            <div className="grid grid-cols-2 gap-1.5">
              {BANNON_ROSTER.slice(0, 6).map(fighter => {
                const fColor = FACTION_COLOR[fighter.factionAlignment];
                const isSelected = aiFighter.id === fighter.id;
                return (
                  <button
                    key={fighter.id}
                    onClick={() => setAiFighter(fighter)}
                    className="border p-3 text-left transition-all"
                    style={{ borderColor: isSelected ? fColor : '#27272a', background: isSelected ? `${fColor}12` : 'transparent' }}
                  >
                    <div className="text-[10px] font-black" style={{ color: isSelected ? fColor : '#a1a1aa' }}>
                      {fighter.name.toUpperCase()}
                    </div>
                    <div className="text-[7px] text-zinc-600 mt-0.5">{fighter.fightingStyle.split('.')[0]}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <div className="text-[8px] tracking-[0.3em] text-zinc-500 mb-2">DIFFICULTY</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(d => {
                const dc = DIFFICULTY_CONFIG[d];
                const isSelected = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    className="border p-3 text-left transition-all"
                    style={{ borderColor: isSelected ? dc.color : '#27272a', background: isSelected ? `${dc.color}12` : 'transparent' }}
                  >
                    <div className="text-[10px] font-black" style={{ color: isSelected ? dc.color : '#a1a1aa' }}>
                      {dc.label}
                    </div>
                    <div className="text-[7px] text-zinc-600 mt-0.5">{dc.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={() => setPhase('FIGHTING')}
            className="w-full border border-yellow-700 py-4 text-[10px] font-black tracking-[0.4em] text-yellow-400 hover:bg-yellow-900/20 transition-all"
          >
            ▶ START PRACTICE
          </button>
        </div>
      </div>
    </div>
  );
}
