'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { type BannonFighterProfile, BANNON_ROSTER } from '../data/bannonRoster';
import type { DebugOverlaySettings } from '../engine/debug/DebugOverlay';
import { DEFAULT_DEBUG_SETTINGS } from '../engine/debug/DebugOverlay';
import MoveLibraryViewer from './MoveLibraryViewer';

interface PracticeArenaScreenProps {
  onBack: () => void;
}

type Difficulty = 'EASY' | 'NORMAL' | 'HARD' | 'BRUTAL';
type PracticePhase = 'SETUP' | 'FIGHTING' | 'ROUND_END';

interface TrainingLogEntry {
  round: number;
  outcome: 'WIN' | 'LOSS' | 'DRAW';
  playerDmg: number;
  aiDmg: number;
  duration: number; // seconds
  difficulty: Difficulty;
}

const DIFFICULTY_CONFIG: Record<Difficulty, {
  label: string;
  color: string;
  aiAccuracy: number;
  aiAggression: number;
  aiDamageMultiplier: number;
  desc: string;
}> = {
  EASY:   { label: 'EASY',   color: '#22c55e', aiAccuracy: 0.35, aiAggression: 0.3, aiDamageMultiplier: 0.6,  desc: 'Slow AI, low damage. Perfect for learning move timing.' },
  NORMAL: { label: 'NORMAL', color: '#facc15', aiAccuracy: 0.55, aiAggression: 0.5, aiDamageMultiplier: 0.85, desc: 'Balanced AI. Good for practicing combos and spacing.' },
  HARD:   { label: 'HARD',   color: '#f97316', aiAccuracy: 0.75, aiAggression: 0.7, aiDamageMultiplier: 1.1,  desc: 'Aggressive AI with punish windows. Tests your defense.' },
  BRUTAL: { label: 'BRUTAL', color: '#ef4444', aiAccuracy: 0.92, aiAggression: 0.9, aiDamageMultiplier: 1.4,  desc: 'Near-perfect AI. Only for mastery-level preparation.' },
};

const FACTION_COLOR: Record<string, string> = {
  alliance:    '#1d4ed8',
  corporate:   '#dc2626',
  chaos:       '#7c3aed',
  independent: '#d97706',
};

const AI_NAMES = ['SHADOW-7', 'IRON-GHOST', 'VOID-UNIT', 'APEX-DRONE', 'BRUTAL-AI'];

function simulateRound(
  playerFighter: BannonFighterProfile,
  aiFighter: BannonFighterProfile,
  difficulty: Difficulty,
  roundNum: number
): { playerHp: number; aiHp: number; events: string[] } {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  let playerHp = playerFighter.hp;
  let aiHp = aiFighter.hp;
  const events: string[] = [];
  const ticks = 20 + Math.floor(Math.random() * 15);

  for (let t = 0; t < ticks; t++) {
    // Player attacks AI
    if (Math.random() > 0.4) {
      const baseDmg = 8 + Math.random() * (playerFighter.strength * 0.4);
      const blocked = Math.random() < cfg.aiAccuracy * 0.4;
      const dmg = blocked ? baseDmg * 0.2 : baseDmg;
      aiHp = Math.max(0, aiHp - dmg);
      if (!blocked && dmg > 12) events.push(`HIT — ${Math.round(dmg)} DMG`);
      if (blocked) events.push('BLOCKED');
    }
    if (aiHp <= 0) { events.push('K.O.!'); break; }

    // AI attacks player
    if (Math.random() < cfg.aiAggression) {
      const baseDmg = (6 + Math.random() * (aiFighter.strength * 0.35)) * cfg.aiDamageMultiplier;
      const playerBlocks = Math.random() > cfg.aiAccuracy;
      const dmg = playerBlocks ? baseDmg * 0.15 : baseDmg;
      playerHp = Math.max(0, playerHp - dmg);
      if (!playerBlocks && dmg > 10) events.push(`TOOK ${Math.round(dmg)} DMG`);
    }
    if (playerHp <= 0) { events.push('KNOCKED OUT'); break; }
  }

  return { playerHp, aiHp, events: events.slice(0, 6) };
}

export default function PracticeArenaScreen({ onBack }: PracticeArenaScreenProps) {
  const [phase, setPhase] = useState<PracticePhase>('SETUP');
  const [selectedFighter, setSelectedFighter] = useState<BannonFighterProfile>(BANNON_ROSTER[0]);
  const [aiFighter, setAiFighter] = useState<BannonFighterProfile>(BANNON_ROSTER[1] ?? BANNON_ROSTER[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>('NORMAL');
  const [round, setRound] = useState(1);
  const [playerHp, setPlayerHp] = useState(100);
  const [aiHp, setAiHp] = useState(100);
  const [maxPlayerHp, setMaxPlayerHp] = useState(100);
  const [maxAiHp, setMaxAiHp] = useState(100);
  const [roundEvents, setRoundEvents] = useState<string[]>([]);
  const [trainingLog, setTrainingLog] = useState<TrainingLogEntry[]>([]);
  const [roundOutcome, setRoundOutcome] = useState<'WIN' | 'LOSS' | 'DRAW' | null>(null);
  const [roundDuration, setRoundDuration] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [aiName] = useState(() => AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)]);
  const roundStartRef = useRef<number>(0);

  // ── Debug overlay settings (practice mode only) ──────────────────────────
  const [showSettings, setShowSettings] = useState(false);
  const [debugSettings, setDebugSettings] = useState<DebugOverlaySettings>(DEFAULT_DEBUG_SETTINGS);
  const [showMoveLibrary, setShowMoveLibrary] = useState(false);

  const cfg = DIFFICULTY_CONFIG[difficulty];

  function startRound() {
    setPhase('FIGHTING');
    setAnimating(true);
    roundStartRef.current = Date.now();
    const pHp = selectedFighter.hp;
    const aHp = aiFighter.hp;
    setPlayerHp(pHp);
    setAiHp(aHp);
    setMaxPlayerHp(pHp);
    setMaxAiHp(aHp);
    setRoundEvents([]);
    setRoundOutcome(null);

    // Simulate over 2.5 seconds with animated HP drain
    const result = simulateRound(selectedFighter, aiFighter, difficulty, round);
    const duration = (Date.now() - roundStartRef.current) / 1000;

    // Animate HP bars
    const steps = 20;
    const pDrop = (pHp - result.playerHp) / steps;
    const aDrop = (aHp - result.aiHp) / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      setPlayerHp(prev => Math.max(result.playerHp, prev - pDrop));
      setAiHp(prev => Math.max(result.aiHp, prev - aDrop));
      if (step >= steps) {
        clearInterval(interval);
        setPlayerHp(result.playerHp);
        setAiHp(result.aiHp);
        setRoundEvents(result.events);
        setAnimating(false);

        const outcome: 'WIN' | 'LOSS' | 'DRAW' =
          result.aiHp <= 0 && result.playerHp > 0 ? 'WIN'
          : result.playerHp <= 0 && result.aiHp > 0 ? 'LOSS'
          : result.playerHp > result.aiHp ? 'WIN'
          : result.aiHp > result.playerHp ? 'LOSS' :'DRAW';

        setRoundOutcome(outcome);
        setRoundDuration(Math.round(2.5 + Math.random() * 8));
        setPhase('ROUND_END');

        // Log entry — NO stat penalties in practice mode
        setTrainingLog(prev => [{
          round,
          outcome,
          playerDmg: Math.round(aHp - result.aiHp),
          aiDmg: Math.round(pHp - result.playerHp),
          duration: Math.round(2.5 + Math.random() * 8),
          difficulty,
        }, ...prev].slice(0, 20));
      }
    }, 120);
  }

  function nextRound() {
    setRound(r => r + 1);
    setPhase('FIGHTING');
    startRound();
  }

  function resetSession() {
    setRound(1);
    setPhase('SETUP');
    setRoundOutcome(null);
    setRoundEvents([]);
  }

  const winCount = trainingLog.filter(e => e.outcome === 'WIN').length;
  const lossCount = trainingLog.filter(e => e.outcome === 'LOSS').length;
  const avgDmg = trainingLog.length > 0
    ? Math.round(trainingLog.reduce((s, e) => s + e.playerDmg, 0) / trainingLog.length)
    : 0;

  if (showMoveLibrary) {
    return <MoveLibraryViewer onClose={() => setShowMoveLibrary(false)} />;
  }

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
              {/* Settings button */}
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
            Practice against AI opponents at any difficulty. Wins and losses here do not affect your tournament record or rank points.
          </div>
        </div>

        {/* ── SETTINGS PANEL (practice mode only) ── */}
        {showSettings && (
          <div className="mb-5 border border-yellow-900/50 bg-yellow-900/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-[9px] tracking-[0.3em] text-yellow-400 font-black">PRACTICE SETTINGS</div>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[8px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
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

              {/* Per-fighter toggles */}
              {debugSettings.enabled && (
                <div className="pl-3 border-l border-zinc-800 space-y-2">
                  <div className="text-[7px] tracking-widest text-zinc-600 mb-1">PER-FIGHTER</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showP1: !s.showP1 }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{
                        borderColor: debugSettings.showP1 ? '#1d4ed8' : '#27272a',
                        color: debugSettings.showP1 ? '#1d4ed8' : '#52525b',
                      }}
                    >
                      P1 {debugSettings.showP1 ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showP2: !s.showP2 }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{
                        borderColor: debugSettings.showP2 ? '#dc2626' : '#27272a',
                        color: debugSettings.showP2 ? '#dc2626' : '#52525b',
                      }}
                    >
                      P2 {debugSettings.showP2 ? '●' : '○'}
                    </button>
                  </div>

                  {/* Layer toggles */}
                  <div className="text-[7px] tracking-widest text-zinc-600 mb-1">LAYERS</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showFrameWindows: !s.showFrameWindows }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{
                        borderColor: debugSettings.showFrameWindows ? '#facc15' : '#27272a',
                        color: debugSettings.showFrameWindows ? '#facc15' : '#52525b',
                      }}
                    >
                      FRAME WINDOWS {debugSettings.showFrameWindows ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showAABB: !s.showAABB }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{
                        borderColor: debugSettings.showAABB ? '#22c55e' : '#27272a',
                        color: debugSettings.showAABB ? '#22c55e' : '#52525b',
                      }}
                    >
                      AABB GEOMETRY {debugSettings.showAABB ? '●' : '○'}
                    </button>
                    <button
                      onClick={() => setDebugSettings(s => ({ ...s, showImpactMarkers: !s.showImpactMarkers }))}
                      className="border px-2 py-1 text-[7px] font-black transition-all"
                      style={{
                        borderColor: debugSettings.showImpactMarkers ? '#ef4444' : '#27272a',
                        color: debugSettings.showImpactMarkers ? '#ef4444' : '#52525b',
                      }}
                    >
                      IMPACT MARKERS {debugSettings.showImpactMarkers ? '●' : '○'}
                    </button>
                  </div>

                  {/* Color legend */}
                  <div className="flex gap-3 text-[6px] mt-1">
                    <span style={{ color: '#facc15' }}>■ STARTUP</span>
                    <span style={{ color: '#22c55e' }}>■ ACTIVE</span>
                    <span style={{ color: '#ef4444' }}>■ RECOVERY</span>
                  </div>
                </div>
              )}
            </div>

            {/* Move Library button */}
            <div className="pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowMoveLibrary(true)}
                className="w-full border border-purple-900 py-2.5 text-[8px] font-black tracking-widest text-purple-400 hover:border-purple-700 hover:text-purple-300 transition-all bg-purple-900/10"
              >
                📋 VIEW MOVE LIBRARY — GLB ANIMATION MANIFEST
              </button>
              <div className="mt-1 text-[7px] text-zinc-600">
                Schwarzerblitz / Tekken research clips normalized to frame-data metadata
              </div>
            </div>
          </div>
        )}

        {/* ── SETUP PHASE ── */}
        {phase === 'SETUP' && (
          <div className="space-y-5">

            {/* Fighter select */}
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
                      style={{
                        borderColor: isSelected ? fColor : '#27272a',
                        background: isSelected ? `${fColor}12` : 'transparent',
                      }}
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

            {/* AI opponent select */}
            <div>
              <div className="text-[8px] tracking-[0.3em] text-zinc-500 mb-2">AI OPPONENT FIGHTER</div>
              <div className="grid grid-cols-2 gap-1.5">
                {BANNON_ROSTER.slice(0, 6).map(fighter => {
                  const fColor = FACTION_COLOR[fighter.factionAlignment];
                  const isSelected = aiFighter.id === fighter.id;
                  return (
                    <button
                      key={fighter.id}
                      onClick={() => setAiFighter(fighter)}
                      className="border p-3 text-left transition-all"
                      style={{
                        borderColor: isSelected ? fColor : '#27272a',
                        background: isSelected ? `${fColor}12` : 'transparent',
                      }}
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

            {/* Difficulty */}
            <div>
              <div className="text-[8px] tracking-[0.3em] text-zinc-500 mb-2">AI DIFFICULTY</div>
              <div className="grid grid-cols-4 gap-1">
                {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(d => {
                  const dc = DIFFICULTY_CONFIG[d];
                  const isSelected = difficulty === d;
                  return (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className="border py-3 text-center transition-all"
                      style={{
                        borderColor: isSelected ? dc.color : '#27272a',
                        background: isSelected ? `${dc.color}12` : 'transparent',
                      }}
                    >
                      <div className="text-[9px] font-black" style={{ color: isSelected ? dc.color : '#52525b' }}>
                        {dc.label}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-[8px] text-zinc-600 border border-zinc-900 px-3 py-2"
                style={{ borderLeftColor: cfg.color, borderLeftWidth: 2 }}>
                {cfg.desc}
              </div>
            </div>

            {/* Session stats if any */}
            {trainingLog.length > 0 && (
              <div className="border border-zinc-900 p-3">
                <div className="text-[8px] tracking-widest text-zinc-600 mb-2">SESSION STATS</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-lg font-black text-green-400">{winCount}</div>
                    <div className="text-[7px] text-zinc-600">WINS</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-red-400">{lossCount}</div>
                    <div className="text-[7px] text-zinc-600">LOSSES</div>
                  </div>
                  <div>
                    <div className="text-lg font-black text-yellow-400">{avgDmg}</div>
                    <div className="text-[7px] text-zinc-600">AVG DMG</div>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={startRound}
              className="w-full border py-4 text-sm font-black tracking-widest transition-all"
              style={{ borderColor: cfg.color, color: cfg.color, background: `${cfg.color}10` }}
            >
              START PRACTICE ROUND {round} — {difficulty}
            </button>
          </div>
        )}

        {/* ── FIGHTING PHASE ── */}
        {phase === 'FIGHTING' && (
          <div className="space-y-4">
            <div className="text-center text-[9px] tracking-widest text-zinc-500 mb-2">
              ROUND {round} · {difficulty} AI
            </div>

            {/* Arena viewport */}
            <div className="border border-zinc-800 bg-zinc-950 relative overflow-hidden" style={{ height: 180 }}>
              {/* Floor grid */}
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'linear-gradient(#27272a 1px, transparent 1px), linear-gradient(90deg, #27272a 1px, transparent 1px)',
                backgroundSize: '30px 30px',
              }} />
              {/* Center line */}
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-zinc-700 opacity-30" />

              {/* Player fighter */}
              <div className="absolute bottom-6 left-1/4 transform -translate-x-1/2 text-center">
                <div className="text-2xl" style={{ filter: `drop-shadow(0 0 8px ${FACTION_COLOR[selectedFighter.factionAlignment]})` }}>
                  🥊
                </div>
                <div className="text-[7px] font-black mt-1" style={{ color: FACTION_COLOR[selectedFighter.factionAlignment] }}>
                  {selectedFighter.name.toUpperCase().slice(0, 6)}
                </div>
              </div>

              {/* AI fighter */}
              <div className="absolute bottom-6 right-1/4 transform translate-x-1/2 text-center">
                <div className="text-2xl" style={{ filter: `drop-shadow(0 0 8px ${FACTION_COLOR[aiFighter.factionAlignment]})` }}>
                  🤖
                </div>
                <div className="text-[7px] font-black mt-1" style={{ color: FACTION_COLOR[aiFighter.factionAlignment] }}>
                  {aiName}
                </div>
              </div>

              {/* Animating indicator */}
              {animating && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-yellow-400 text-xs font-black tracking-widest animate-pulse">FIGHT!</div>
                </div>
              )}
            </div>

            {/* HP bars */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[8px] mb-1">
                  <span className="font-black" style={{ color: FACTION_COLOR[selectedFighter.factionAlignment] }}>
                    {selectedFighter.name.toUpperCase()}
                  </span>
                  <span className="text-zinc-500">{Math.round(playerHp)} / {maxPlayerHp}</span>
                </div>
                <div className="h-3 bg-zinc-900 border border-zinc-800">
                  <div
                    className="h-full transition-all duration-150"
                    style={{
                      width: `${(playerHp / maxPlayerHp) * 100}%`,
                      background: playerHp > maxPlayerHp * 0.5 ? '#22c55e' : playerHp > maxPlayerHp * 0.25 ? '#facc15' : '#ef4444',
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[8px] mb-1">
                  <span className="font-black text-zinc-400">{aiName}</span>
                  <span className="text-zinc-500">{Math.round(aiHp)} / {maxAiHp}</span>
                </div>
                <div className="h-3 bg-zinc-900 border border-zinc-800">
                  <div
                    className="h-full transition-all duration-150"
                    style={{
                      width: `${(aiHp / maxAiHp) * 100}%`,
                      background: '#ef4444',
                    }}
                  />
                </div>
              </div>
            </div>

            {animating && (
              <div className="text-center text-[8px] text-zinc-600 animate-pulse">SIMULATING COMBAT...</div>
            )}
          </div>
        )}

        {/* ── ROUND END PHASE ── */}
        {phase === 'ROUND_END' && roundOutcome && (
          <div className="space-y-4">
            {/* Outcome banner */}
            <div
              className="border p-5 text-center"
              style={{
                borderColor: roundOutcome === 'WIN' ? '#22c55e' : roundOutcome === 'LOSS' ? '#ef4444' : '#facc15',
                background: roundOutcome === 'WIN' ? 'rgba(34,197,94,0.08)' : roundOutcome === 'LOSS' ? 'rgba(239,68,68,0.08)' : 'rgba(250,204,21,0.08)',
              }}
            >
              <div className="text-[9px] tracking-widest text-zinc-500 mb-1">ROUND {round} RESULT</div>
              <div
                className="text-3xl font-black tracking-widest"
                style={{ color: roundOutcome === 'WIN' ? '#22c55e' : roundOutcome === 'LOSS' ? '#ef4444' : '#facc15' }}
              >
                {roundOutcome === 'WIN' ? 'VICTORY' : roundOutcome === 'LOSS' ? 'DEFEAT' : 'DRAW'}
              </div>
              <div className="mt-2 text-[8px] text-zinc-600">
                {roundOutcome === 'WIN' ?'Good execution. Study what worked and repeat it.'
                  : roundOutcome === 'LOSS' ?'Analyze the damage taken. Adjust your approach.' :'Evenly matched. Push harder next round.'}
              </div>
              <div className="mt-1 text-[7px] text-green-700 font-black">NO RANK POINTS AFFECTED · PRACTICE MODE</div>
            </div>

            {/* Round stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="border border-zinc-900 py-3">
                <div className="text-lg font-black text-green-400">{trainingLog[0]?.playerDmg ?? 0}</div>
                <div className="text-[7px] text-zinc-600">DMG DEALT</div>
              </div>
              <div className="border border-zinc-900 py-3">
                <div className="text-lg font-black text-red-400">{trainingLog[0]?.aiDmg ?? 0}</div>
                <div className="text-[7px] text-zinc-600">DMG TAKEN</div>
              </div>
              <div className="border border-zinc-900 py-3">
                <div className="text-lg font-black text-zinc-400">{roundDuration}s</div>
                <div className="text-[7px] text-zinc-600">DURATION</div>
              </div>
            </div>

            {/* Combat events */}
            {roundEvents.length > 0 && (
              <div className="border border-zinc-900 p-3">
                <div className="text-[8px] tracking-widest text-zinc-600 mb-2">COMBAT LOG</div>
                <div className="space-y-1">
                  {roundEvents.map((ev, i) => (
                    <div key={i} className="text-[8px] text-zinc-400">· {ev}</div>
                  ))}
                </div>
              </div>
            )}

            {/* HP bars final state */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-[8px] mb-1">
                  <span style={{ color: FACTION_COLOR[selectedFighter.factionAlignment] }}>{selectedFighter.name.toUpperCase()}</span>
                  <span className="text-zinc-500">{Math.round(playerHp)} HP remaining</span>
                </div>
                <div className="h-2 bg-zinc-900">
                  <div className="h-full" style={{
                    width: `${(playerHp / maxPlayerHp) * 100}%`,
                    background: playerHp > maxPlayerHp * 0.5 ? '#22c55e' : '#facc15',
                  }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[8px] mb-1">
                  <span className="text-zinc-400">{aiName}</span>
                  <span className="text-zinc-500">{Math.round(aiHp)} HP remaining</span>
                </div>
                <div className="h-2 bg-zinc-900">
                  <div className="h-full bg-red-500" style={{ width: `${(aiHp / maxAiHp) * 100}%` }} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={nextRound}
                className="border py-3 text-[9px] font-black tracking-widest transition-all"
                style={{ borderColor: cfg.color, color: cfg.color, background: `${cfg.color}10` }}
              >
                NEXT ROUND →
              </button>
              <button
                onClick={resetSession}
                className="border border-zinc-700 py-3 text-[9px] font-black tracking-widest text-zinc-400 hover:border-zinc-500 transition-all"
              >
                CHANGE SETUP
              </button>
            </div>

            {/* Training log */}
            {trainingLog.length > 1 && (
              <div>
                <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-2">TRAINING LOG</div>
                <div className="space-y-1">
                  {trainingLog.slice(0, 8).map((entry, i) => (
                    <div key={i} className="flex items-center gap-3 border border-zinc-900 px-3 py-1.5">
                      <div className="text-[7px] text-zinc-600 w-12">RND {entry.round}</div>
                      <div
                        className="text-[8px] font-black w-12"
                        style={{ color: entry.outcome === 'WIN' ? '#22c55e' : entry.outcome === 'LOSS' ? '#ef4444' : '#facc15' }}
                      >
                        {entry.outcome}
                      </div>
                      <div className="flex-1 text-[7px] text-zinc-600">
                        +{entry.playerDmg} / -{entry.aiDmg} · {entry.duration}s
                      </div>
                      <div className="text-[7px]" style={{ color: DIFFICULTY_CONFIG[entry.difficulty].color }}>
                        {entry.difficulty}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
