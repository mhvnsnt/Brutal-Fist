'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { type BannonFighterProfile } from '../data/bannonRoster';
import { GameEngine } from '../engine/GameEngine';
import { getCharacterMoveSet } from '../engine/CharacterMoveSetSystem';
import { getMoveById } from '../engine/BrutalFistMoveCatalog';
import { FighterState, type InputBitmask } from '../types';
import MoveExecutionFeedback from './MoveExecutionFeedback';
import { MobileControls } from './MobileControls';
import dynamic from 'next/dynamic';

const CharacterPortrait3D = dynamic(() => import('./CharacterPortrait3D'), { ssr: false });

interface GameBattleArenaProps {
  p1Fighter: BannonFighterProfile;
  p2Fighter: BannonFighterProfile;
  onMatchEnd?: (winner: 'p1' | 'p2' | 'draw') => void;
  onBack?: () => void;
}

const EMPTY_INPUT: InputBitmask = {
  up: false, down: false, left: false, right: false,
  light: false, heavy: false, guard: false,
  grapple: false, escape: false, pin: false,
};

const FACTION_COLOR: Record<string, string> = {
  alliance:    '#1d4ed8',
  corporate:   '#dc2626',
  chaos:       '#7c3aed',
  independent: '#d97706',
};

export default function GameBattleArena({ p1Fighter, p2Fighter, onMatchEnd, onBack }: GameBattleArenaProps) {
  const engineRef = useRef<GameEngine | null>(null);
  const inputRef = useRef<InputBitmask>({ ...EMPTY_INPUT });
  const rafRef = useRef<number>(0);
  const [frame, setFrame] = useState(0);
  const [p1Health, setP1Health] = useState(p1Fighter.hp);
  const [p2Health, setP2Health] = useState(p2Fighter.hp);
  const [p1State, setP1State] = useState<string>('Neutral');
  const [p2State, setP2State] = useState<string>('Neutral');
  const [p1Animation, setP1Animation] = useState<string>('idle');
  const [p2Animation, setP2Animation] = useState<string>('idle');
  const [ko, setKo] = useState(false);
  const [winner, setWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [roundTimer, setRoundTimer] = useState(99);
  const [hitStopActive, setHitStopActive] = useState(false);
  // Move execution feedback events
  const [feedbackEvents, setFeedbackEvents] = useState<Array<{
    id: number;
    moveId: string;
    moveName: string;
    damage: number;
    isBlocked: boolean;
    isCounter: boolean;
    player: 'p1' | 'p2';
    x: number;
    y: number;
  }>>([]);
  const feedbackIdRef = useRef(0);

  // Build engine with customized move sets
  useEffect(() => {
    // Apply customized move sets to fighters before creating engine
    const p1MoveSet = getCharacterMoveSet(p1Fighter.id);
    const p2MoveSet = getCharacterMoveSet(p2Fighter.id);

    // Create engine — it uses fighter profiles directly
    const engine = new GameEngine(p1Fighter, p2Fighter);

    // Patch engine's move resolution to use customized move sets
    if (p1MoveSet?.isCustomized) {
      const lightMove = getMoveById(p1MoveSet.lightAttack);
      const heavyMove = getMoveById(p1MoveSet.heavyAttack);
      if (lightMove) (engine as any)._p1LightOverride = lightMove;
      if (heavyMove) (engine as any)._p1HeavyOverride = heavyMove;
    }

    engineRef.current = engine;
    setP1Health(p1Fighter.hp);
    setP2Health(p2Fighter.hp);
    setFrame(0);
    setKo(false);
    setWinner(null);
    setRoundTimer(99);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [p1Fighter, p2Fighter]);

  // Game loop
  useEffect(() => {
    let lastTime = 0;
    const FRAME_MS = 1000 / 60;

    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const engine = engineRef.current;
      if (!engine) return;
      if (now - lastTime < FRAME_MS - 1) return;
      lastTime = now;

      const prevP1Health = engine.p1Health;
      const prevP2Health = engine.p2Health;
      const prevP1State = engine.state;
      const prevP2State = engine.p2State;

      engine.tick(inputRef.current);

      // Detect hits for feedback
      const p1Dmg = prevP1Health - engine.p1Health;
      const p2Dmg = prevP2Health - engine.p2Health;

      if (p2Dmg > 0 && engine.currentMove) {
        const move = engine.currentMove;
        const isBlocked = engine.p2State === FighterState.Blockstun;
        const isCounter = prevP2State === FighterState.Startup || prevP2State === FighterState.Active;
        setFeedbackEvents(prev => [...prev.slice(-6), {
          id: ++feedbackIdRef.current,
          moveId: (move as any).id ?? 'hit',
          moveName: (move as any).displayName ?? 'Hit',
          damage: p2Dmg,
          isBlocked,
          isCounter,
          player: 'p1',
          x: 65 + Math.random() * 10,
          y: 20 + Math.random() * 20,
        }]);
      }
      if (p1Dmg > 0 && engine.p2Move) {
        const move = engine.p2Move;
        const isBlocked = engine.state === FighterState.Blockstun;
        const isCounter = prevP1State === FighterState.Startup || prevP1State === FighterState.Active;
        setFeedbackEvents(prev => [...prev.slice(-6), {
          id: ++feedbackIdRef.current,
          moveId: (move as any).id ?? 'hit',
          moveName: (move as any).displayName ?? 'Hit',
          damage: p1Dmg,
          isBlocked,
          isCounter,
          player: 'p2',
          x: 25 + Math.random() * 10,
          y: 20 + Math.random() * 20,
        }]);
      }

      setFrame(engine.currentFrame);
      setP1Health(engine.p1Health);
      setP2Health(engine.p2Health);
      setP1State(engine.state);
      setP2State(engine.p2State);
      setP1Animation(engine.p1Animation);
      setP2Animation(engine.p2Animation);
      setHitStopActive(engine.hitStopFrames > 0);

      if (engine.isMatchOver() && !ko) {
        setKo(true);
        const w = engine.p1Health <= 0 && engine.p2Health <= 0 ? 'draw'
          : engine.p1Health <= 0 ? 'p2' : 'p1';
        setWinner(w);
        cancelAnimationFrame(rafRef.current);
        setTimeout(() => onMatchEnd?.(w), 2500);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ko, onMatchEnd]);

  // Round timer
  useEffect(() => {
    if (ko) return;
    const t = window.setInterval(() => {
      setRoundTimer(prev => {
        if (prev <= 1) {
          // Time out — higher health wins
          const engine = engineRef.current;
          if (engine) {
            const w = engine.p1Health > engine.p2Health ? 'p1'
              : engine.p2Health > engine.p1Health ? 'p2' : 'draw';
            setKo(true);
            setWinner(w);
            cancelAnimationFrame(rafRef.current);
            setTimeout(() => onMatchEnd?.(w), 2500);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [ko, onMatchEnd]);

  // Keyboard input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const i = inputRef.current;
      if (e.key === 'ArrowLeft') i.left = true;
      if (e.key === 'ArrowRight') i.right = true;
      if (e.key === 'ArrowUp') i.up = true;
      if (e.key === 'ArrowDown') i.down = true;
      if (e.key === 'z' || e.key === 'Z') i.light = true;
      if (e.key === 'x' || e.key === 'X') i.heavy = true;
      if (e.key === 'c' || e.key === 'C') i.guard = true;
      if (e.key === 'v' || e.key === 'V') i.grapple = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const i = inputRef.current;
      if (e.key === 'ArrowLeft') i.left = false;
      if (e.key === 'ArrowRight') i.right = false;
      if (e.key === 'ArrowUp') i.up = false;
      if (e.key === 'ArrowDown') i.down = false;
      if (e.key === 'z' || e.key === 'Z') i.light = false;
      if (e.key === 'x' || e.key === 'X') i.heavy = false;
      if (e.key === 'c' || e.key === 'C') i.guard = false;
      if (e.key === 'v' || e.key === 'V') i.grapple = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const p1MaxHealth = p1Fighter.hp;
  const p2MaxHealth = p2Fighter.hp;
  const p1Pct = Math.max(0, Math.min(100, (p1Health / p1MaxHealth) * 100));
  const p2Pct = Math.max(0, Math.min(100, (p2Health / p2MaxHealth) * 100));
  const p1Color = FACTION_COLOR[p1Fighter.factionAlignment];
  const p2Color = FACTION_COLOR[p2Fighter.factionAlignment];

  const getHealthBarColor = (pct: number) => {
    if (pct > 50) return '#facc15';
    if (pct > 25) return '#f97316';
    return '#ef4444';
  };

  const getStateLabel = (state: string, anim: string) => {
    if (state === 'KO') return 'KO';
    if (state === 'Hitstun') return 'HIT';
    if (state === 'Blockstun') return 'BLOCK';
    if (state === 'Startup') return 'ATK';
    if (state === 'Active') return 'ACTIVE';
    if (state === 'Grappled') return 'GRAPPLE';
    return anim.toUpperCase();
  };

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden touch-none select-none font-mono">
      {/* ── Arena background ── */}
      <div className="absolute inset-0">
        {/* Floor */}
        <div className="absolute bottom-0 left-0 right-0 h-[35%]"
          style={{
            background: 'linear-gradient(180deg, #1a1a1a 0%, #111 60%, #0a0a0a 100%)',
            borderTop: '2px solid #333',
          }}
        />
        {/* Arena walls */}
        <div className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 60%, #1c1c1e 0%, #0a0a0a 70%)',
          }}
        />
        {/* Industrial grid lines */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `
            repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px)
          `
        }} />
        {/* Scanlines */}
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)'
        }} />
        {/* Faction color atmosphere */}
        <div className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 25% 50%, ${p1Color}15 0%, transparent 50%), radial-gradient(ellipse at 75% 50%, ${p2Color}15 0%, transparent 50%)`
          }}
        />
      </div>

      {/* ── HUD: Health bars & timer ── */}
      <div className="absolute top-0 left-0 right-0 z-30 px-3 pt-2 pb-1">
        <div className="flex items-center gap-2">
          {/* P1 health bar */}
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[9px] font-black tracking-[0.3em]" style={{ color: p1Color }}>
                {p1Fighter.name.toUpperCase()}
              </span>
              <span className="text-[8px] text-zinc-500">{Math.ceil(p1Health).toLocaleString()}</span>
            </div>
            <div className="h-4 border border-zinc-700 bg-zinc-900 relative overflow-hidden">
              {/* Health fill — grows from left */}
              <div
                className="absolute left-0 top-0 h-full transition-all duration-75"
                style={{
                  width: `${p1Pct}%`,
                  background: getHealthBarColor(p1Pct),
                  boxShadow: `0 0 8px ${getHealthBarColor(p1Pct)}88`,
                }}
              />
              {/* Danger flash */}
              {p1Pct <= 25 && (
                <div className="absolute inset-0 animate-pulse bg-red-500/10" />
              )}
            </div>
            {/* State indicator */}
            <div className="text-[7px] text-zinc-600 tracking-widest h-3">
              {getStateLabel(p1State, p1Animation)}
            </div>
          </div>

          {/* Center: Timer + Round */}
          <div className="flex flex-col items-center shrink-0 w-16">
            <div className="text-[7px] text-zinc-600 tracking-widest">ROUND 1</div>
            <div
              className="text-2xl font-black tabular-nums leading-none"
              style={{
                color: roundTimer <= 10 ? '#ef4444' : '#facc15',
                textShadow: roundTimer <= 10
                  ? '0 0 12px #ef4444' :'0 0 12px #facc15',
              }}
            >
              {String(roundTimer).padStart(2, '0')}
            </div>
            <div className="text-[7px] text-zinc-600 tracking-widest">F{frame}</div>
          </div>

          {/* P2 health bar */}
          <div className="flex-1 flex flex-col gap-0.5">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[8px] text-zinc-500 text-right w-full">{Math.ceil(p2Health).toLocaleString()}</span>
              <span className="text-[9px] font-black tracking-[0.3em] ml-2 whitespace-nowrap" style={{ color: p2Color }}>
                {p2Fighter.name.toUpperCase()}
              </span>
            </div>
            <div className="h-4 border border-zinc-700 bg-zinc-900 relative overflow-hidden">
              {/* Health fill — grows from right */}
              <div
                className="absolute right-0 top-0 h-full transition-all duration-75"
                style={{
                  width: `${p2Pct}%`,
                  background: getHealthBarColor(p2Pct),
                  boxShadow: `0 0 8px ${getHealthBarColor(p2Pct)}88`,
                }}
              />
              {p2Pct <= 25 && (
                <div className="absolute inset-0 animate-pulse bg-red-500/10" />
              )}
            </div>
            <div className="text-[7px] text-zinc-600 tracking-widest h-3 text-right">
              {getStateLabel(p2State, p2Animation)}
            </div>
          </div>
        </div>
      </div>

      {/* ── Fighter 3D portrait panels (faction-colored) ── */}
      <div className="absolute inset-0 flex items-end justify-between z-10 pointer-events-none px-4 pb-[18%]">
        {/* P1 fighter — faction-colored portrait panel */}
        <div
          className="relative flex flex-col items-center"
          style={{
            width: 'clamp(120px, 22vw, 220px)',
            height: 'clamp(180px, 32vw, 320px)',
            opacity: p1State === 'KO' ? 0.4 : 1,
            transition: 'opacity 0.3s',
            transform: p1State === 'Hitstun' ? 'translateX(6px) rotate(2deg)' : 'none',
          }}
        >
          {/* Faction-colored border panel */}
          <div
            className="absolute inset-0 border-2"
            style={{
              borderColor: p1Color,
              boxShadow: `0 0 20px ${p1Color}44, inset 0 0 20px ${p1Color}11`,
              background: `linear-gradient(180deg, #0a0a0a 0%, ${p1Color}18 100%)`,
            }}
          />
          {/* 3D portrait from Bannon repo GLB */}
          <div className="absolute inset-0">
            <CharacterPortrait3D
              modelUrl={p1Fighter.portraitUrl}
              factionColor={p1Color}
              mode="bust"
              flash={hitStopActive}
              flip={false}
            />
          </div>
          {/* Fighter name tag */}
          <div
            className="absolute bottom-0 left-0 right-0 text-center py-0.5 text-[8px] font-black tracking-widest"
            style={{ background: `${p1Color}cc`, color: '#000' }}
          >
            {p1Fighter.name.toUpperCase()}
          </div>
        </div>

        {/* P2 fighter — faction-colored portrait panel */}
        <div
          className="relative flex flex-col items-center"
          style={{
            width: 'clamp(120px, 22vw, 220px)',
            height: 'clamp(180px, 32vw, 320px)',
            opacity: p2State === 'KO' ? 0.4 : 1,
            transition: 'opacity 0.3s',
            transform: p2State === 'Hitstun' ? 'translateX(-6px) rotate(-2deg)' : 'none',
          }}
        >
          {/* Faction-colored border panel */}
          <div
            className="absolute inset-0 border-2"
            style={{
              borderColor: p2Color,
              boxShadow: `0 0 20px ${p2Color}44, inset 0 0 20px ${p2Color}11`,
              background: `linear-gradient(180deg, #0a0a0a 0%, ${p2Color}18 100%)`,
            }}
          />
          {/* 3D portrait from Bannon repo GLB */}
          <div className="absolute inset-0">
            <CharacterPortrait3D
              modelUrl={p2Fighter.portraitUrl}
              factionColor={p2Color}
              mode="bust"
              flash={hitStopActive}
              flip={true}
            />
          </div>
          {/* Fighter name tag */}
          <div
            className="absolute bottom-0 left-0 right-0 text-center py-0.5 text-[8px] font-black tracking-widest"
            style={{ background: `${p2Color}cc`, color: '#000' }}
          >
            {p2Fighter.name.toUpperCase()}
          </div>
        </div>
      </div>

      {/* ── Move Execution Feedback ── */}
      <MoveExecutionFeedback events={feedbackEvents} onExpire={(id) => setFeedbackEvents(prev => prev.filter(e => e.id !== id))} />

      {/* ── KO / Time Out overlay ── */}
      {ko && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
          <div
            className="font-black tracking-widest animate-pulse"
            style={{
              fontSize: 'clamp(4rem, 15vw, 10rem)',
              color: '#facc15',
              textShadow: '0 0 40px #facc15, 0 0 80px #facc1544',
              fontFamily: 'monospace',
            }}
          >
            {roundTimer <= 0 ? 'TIME' : 'K.O.'}
          </div>
          {winner && (
            <div className="mt-4 text-lg font-black tracking-[0.4em] text-white">
              {winner === 'draw' ? 'DRAW' : `${winner === 'p1' ? p1Fighter.name : p2Fighter.name} WINS`}
            </div>
          )}
        </div>
      )}

      {/* ── Hit stop flash ── */}
      {hitStopActive && (
        <div className="absolute inset-0 z-40 pointer-events-none bg-white/5 animate-pulse" />
      )}

      {/* ── Mobile controls ── */}
      {!ko && <MobileControls inputRef={inputRef} />}

      {/* ── Back button ── */}
      {onBack && (
        <button
          onClick={onBack}
          className="absolute top-16 left-3 z-40 text-[8px] text-zinc-700 hover:text-zinc-400 border border-zinc-800 hover:border-zinc-600 px-2 py-1 transition-colors"
        >
          ← BACK
        </button>
      )}

      {/* ── Controls legend ── */}
      <div className="absolute bottom-2 left-3 z-30 text-[7px] text-zinc-700 space-y-0.5 pointer-events-none">
        <div>ARROWS: MOVE · Z: LIGHT · X: HEAVY · C: GUARD · V: GRAPPLE</div>
      </div>
    </div>
  );
}
