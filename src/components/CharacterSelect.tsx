'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getAllBannonFighters, getBannonFighter, type BannonFighterProfile } from '../data/bannonRoster';
import { getCharacterMoveSet } from '../engine/CharacterMoveSetSystem';
import dynamic from 'next/dynamic';

const MoveSetCustomizer = dynamic(() => import('./MoveSetCustomizer'), { ssr: false });
const CharacterPortrait3D = dynamic(() => import('./CharacterPortrait3D'), { ssr: false });

interface CharacterSelectProps {
  onSelectP1?: (fighter: BannonFighterProfile) => void;
  onSelectP2?: (fighter: BannonFighterProfile) => void;
  onStartMatch?: (p1: BannonFighterProfile, p2: BannonFighterProfile) => void;
}

const FACTION_COLOR: Record<string, string> = {
  alliance:    '#1d4ed8',
  corporate:   '#dc2626',
  chaos:       '#7c3aed',
  independent: '#d97706',
};

const FACTION_BG: Record<string, string> = {
  alliance:    'from-blue-950 to-blue-900',
  corporate:   'from-red-950 to-red-900',
  chaos:       'from-purple-950 to-purple-900',
  independent: 'from-yellow-950 to-yellow-900',
};

// Fighter initial letter as big portrait placeholder
function FighterPortrait({
  fighter,
  slot,
  active,
}: {
  fighter: BannonFighterProfile | null;
  slot: 'P1' | 'P2';
  active: boolean;
}) {
  const isP1 = slot === 'P1';

  if (!fighter) {
    // Silhouette / waiting state
    return (
      <div className={`relative flex flex-col items-center justify-end h-full w-full overflow-hidden ${isP1 ? 'items-start' : 'items-end'}`}>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950" />
        {/* Scanline overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)'
        }} />
        {/* Silhouette */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full w-full gap-3">
          <div className="w-28 h-40 md:w-40 md:h-56 bg-zinc-800 rounded-sm opacity-60"
            style={{ clipPath: 'polygon(20% 0%, 80% 0%, 100% 15%, 100% 85%, 80% 100%, 20% 100%, 0% 85%, 0% 15%)' }}
          />
          <div className="text-zinc-500 font-mono text-xs tracking-[0.3em] animate-pulse">
            {isP1 ? 'SELECT FIGHTER' : 'PUSH P2 START'}
          </div>
        </div>
        {/* Slot label */}
        <div className={`absolute top-3 ${isP1 ? 'left-3' : 'right-3'} z-20`}>
          <span className={`font-mono text-xs font-black tracking-[0.3em] px-2 py-1 border ${isP1 ? 'border-blue-600 text-blue-400 bg-blue-950/60' : 'border-red-600 text-red-400 bg-red-950/60'}`}>
            {slot}
          </span>
        </div>
      </div>
    );
  }

  const factionBg = FACTION_BG[fighter.factionAlignment];
  const factionColor = FACTION_COLOR[fighter.factionAlignment];

  return (
    <div className={`relative flex flex-col items-center justify-end h-full w-full overflow-hidden`}>
      {/* Faction-colored backdrop */}
      <div className={`absolute inset-0 bg-gradient-to-b ${factionBg}`} />
      {/* Scanline overlay */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)'
      }} />
      {/* Animated glow pulse */}
      <div className="absolute inset-0 animate-pulse opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${factionColor}55 0%, transparent 70%)` }}
      />

      {/* 3D Character bust portrait from Bannon repo GLB */}
      <div className="absolute inset-0 z-10">
        <CharacterPortrait3D
          modelUrl={fighter.portraitUrl}
          factionColor={factionColor}
          mode="bust"
          // PORTRAIT ORIENTATION — completely decoupled from in-fight orientation.
          // P1 (left panel): slight inward right angle. P2 (right panel): slight inward left angle.
          // These values NEVER change regardless of which character is selected.
          // In-fight: P1=rotationY:0, P2=rotationY:Math.PI — set in CombatArena3D, not here.
          rotationY={isP1 ? -0.45 : Math.PI}
        />
      </div>

      {/* Role label at bottom */}
      <div className="relative z-20 w-full flex justify-center pb-2 pointer-events-none">
        <div className="text-zinc-400 font-mono text-[9px] tracking-[0.25em] uppercase bg-black/50 px-2 py-0.5">
          {fighter.role.split('/')[0].trim()}
        </div>
      </div>

      {/* Slot label */}
      <div className={`absolute top-3 ${isP1 ? 'left-3' : 'right-3'} z-30`}>
        <span className={`font-mono text-xs font-black tracking-[0.3em] px-2 py-1 border ${isP1 ? 'border-blue-500 text-blue-300 bg-blue-950/80' : 'border-red-500 text-red-300 bg-red-950/80'}`}>
          {slot}
        </span>
      </div>
      {/* Active selection pulse ring */}
      {active && (
        <div className="absolute inset-0 z-20 pointer-events-none border-2 animate-pulse"
          style={{ borderColor: factionColor }}
        />
      )}
    </div>
  );
}

// Single character slot in the roster grid
function RosterSlot({
  fighter,
  p1Selected,
  p2Selected,
  cursorOn,
  onClick,
}: {
  fighter: BannonFighterProfile;
  p1Selected: boolean;
  p2Selected: boolean;
  cursorOn: boolean;
  onClick: () => void;
}) {
  const factionColor = FACTION_COLOR[fighter.factionAlignment];
  const moveSet = useMemo(() => getCharacterMoveSet(fighter.id), [fighter.id]);
  const isCustomized = moveSet?.isCustomized ?? false;

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center w-full aspect-square border transition-all duration-100 overflow-hidden group
        ${cursorOn ? 'scale-105 z-10' : 'scale-100'}
        ${p1Selected ? 'border-blue-500' : p2Selected ? 'border-red-500' : 'border-zinc-700 hover:border-zinc-500'}
      `}
      style={{
        background: cursorOn
          ? `linear-gradient(135deg, ${factionColor}33 0%, #18181b 100%)`
          : 'linear-gradient(135deg, #1c1c1e 0%, #18181b 100%)',
        boxShadow: cursorOn ? `0 0 16px ${factionColor}66` : undefined,
      }}
    >
      {/* Scanlines */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)'
      }} />

      {/* 3D character portrait from Bannon repo GLB */}
      <div className="absolute inset-0 z-0">
        <CharacterPortrait3D
          modelUrl={fighter.portraitUrl}
          factionColor={factionColor}
          mode="full"
        />
      </div>

      {/* Name label overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/70 py-0.5">
        <div className="text-[7px] font-mono text-zinc-300 tracking-widest truncate w-full text-center px-1">
          {fighter.name.toUpperCase()}
        </div>
      </div>

      {/* P1/P2 badge */}
      {p1Selected && (
        <div className="absolute top-0.5 left-0.5 z-20 text-[7px] font-mono font-black text-blue-300 bg-blue-900/80 px-1">P1</div>
      )}
      {p2Selected && (
        <div className="absolute top-0.5 right-0.5 z-20 text-[7px] font-mono font-black text-red-300 bg-red-900/80 px-1">P2</div>
      )}
      {/* Customized dot */}
      {isCustomized && (
        <div className="absolute bottom-4 right-0.5 z-20 w-1.5 h-1.5 rounded-full bg-green-400" />
      )}
    </button>
  );
}

export default function CharacterSelect({ onSelectP1, onSelectP2, onStartMatch }: CharacterSelectProps) {
  const fighters = useMemo(() => getAllBannonFighters(), []);
  const [p1Id, setP1Id] = useState<string | null>(null);
  const [p2Id, setP2Id] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<'p1' | 'p2'>('p1');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [countdown, setCountdown] = useState(60);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerCharId, setCustomizerCharId] = useState<string | null>(null);

  const p1Fighter = p1Id ? getBannonFighter(p1Id) : null;
  const p2Fighter = p2Id ? getBannonFighter(p2Id) : null;
  const cursorFighter = fighters[cursorIndex] ?? null;

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      // Auto-select if time runs out
      if (!p1Id && fighters.length > 0) setP1Id(fighters[0].id);
      if (!p2Id && fighters.length > 1) setP2Id(fighters[1].id);
      return;
    }
    const t = window.setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, p1Id, p2Id, fighters]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const cols = Math.min(fighters.length, 10);
    if (e.key === 'ArrowRight') setCursorIndex(i => Math.min(fighters.length - 1, i + 1));
    else if (e.key === 'ArrowLeft') setCursorIndex(i => Math.max(0, i - 1));
    else if (e.key === 'ArrowDown') setCursorIndex(i => Math.min(fighters.length - 1, i + cols));
    else if (e.key === 'ArrowUp') setCursorIndex(i => Math.max(0, i - cols));
    else if (e.key === 'Enter' || e.key === ' ') {
      handleFighterSelect(fighters[cursorIndex]);
    }
  }, [cursorIndex, fighters]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleFighterSelect = (fighter: BannonFighterProfile) => {
    if (activeSlot === 'p1') {
      setP1Id(fighter.id);
      if (onSelectP1) onSelectP1(fighter);
      setActiveSlot('p2');
    } else {
      setP2Id(fighter.id);
      if (onSelectP2) onSelectP2(fighter);
    }
  };

  const handleStartMatch = () => {
    const f1 = p1Id ? getBannonFighter(p1Id) : null;
    const f2 = p2Id ? getBannonFighter(p2Id) : null;
    if (f1 && f2 && onStartMatch) onStartMatch(f1, f2);
  };

  const canStart = !!(p1Id && p2Id);

  // Grid: up to 10 per row, 2 rows max
  const row1 = fighters.slice(0, 10);
  const row2 = fighters.slice(10, 20);

  return (
    <div className="fixed inset-0 overflow-hidden select-none font-mono"
      style={{
        background: 'linear-gradient(180deg, #0a0a0a 0%, #111113 40%, #0d0d0f 100%)',
      }}
    >
      {/* ── Industrial metallic background texture ── */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]" style={{
        backgroundImage: `
          repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 40px),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 40px)
        `
      }} />
      {/* Rivet dots */}
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{
        backgroundImage: 'radial-gradient(circle, #555 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── PLAYER SELECT stamp text (background) ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div
          className="text-[6vw] md:text-[5vw] font-black tracking-[0.35em] text-white uppercase select-none"
          style={{
            opacity: 0.04,
            letterSpacing: '0.4em',
            fontFamily: 'monospace',
            textShadow: '2px 2px 0 #fff, -2px -2px 0 #fff',
            filter: 'blur(0.5px)',
          }}
        >
          PLAYER SELECT
        </div>
      </div>

      {/* ── TOP ZONE: Two player portrait busts ── */}
      <div className="relative z-10 flex h-[52%]">
        {/* P1 Portrait */}
        <div className="flex-1 border-r border-zinc-800/60">
          <FighterPortrait fighter={p1Fighter} slot="P1" active={activeSlot === 'p1'} />
        </div>

        {/* Center divider with countdown timer */}
        <div className="relative flex flex-col items-center justify-center w-16 md:w-20 shrink-0 z-20"
          style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)' }}
        >
          {/* PLAYER SELECT vertical text */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
            {'PLAYER SELECT'.split('').map((ch, i) => (
              <span key={i} className="text-[7px] text-zinc-600 font-black tracking-widest leading-tight">{ch}</span>
            ))}
          </div>
          {/* Countdown */}
          <div className="flex flex-col items-center mt-4">
            <div
              className="text-3xl md:text-4xl font-black tabular-nums"
              style={{
                color: countdown <= 10 ? '#ef4444' : '#facc15',
                textShadow: countdown <= 10
                  ? '0 0 16px #ef4444, 0 0 32px #ef444488' :'0 0 16px #facc15, 0 0 32px #facc1588',
                fontFamily: 'monospace',
              }}
            >
              {String(countdown).padStart(2, '0')}
            </div>
            <div className="text-[7px] text-zinc-600 tracking-widest mt-0.5">TIME</div>
          </div>
          {/* VS text */}
          <div className="mt-3 text-xs font-black text-zinc-700 tracking-widest">VS</div>
        </div>

        {/* P2 Portrait */}
        <div className="flex-1 border-l border-zinc-800/60">
          <FighterPortrait fighter={p2Fighter} slot="P2" active={activeSlot === 'p2'} />
        </div>
      </div>

      {/* ── CHARACTER NAME BAR ── */}
      <div className="relative z-10 flex h-8 border-t border-b border-zinc-800"
        style={{ background: 'linear-gradient(90deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)' }}
      >
        {/* P1 name */}
        <div className="flex-1 flex items-center px-4">
          <span className="text-white font-black text-sm tracking-[0.2em] uppercase truncate"
            style={{ textShadow: p1Fighter ? `0 0 8px ${FACTION_COLOR[p1Fighter.factionAlignment]}` : undefined }}
          >
            {p1Fighter?.name ?? '───'}
          </span>
        </div>
        {/* Center divider */}
        <div className="w-16 md:w-20 flex items-center justify-center shrink-0">
          <div className="w-px h-full bg-zinc-700" />
        </div>
        {/* P2 name */}
        <div className="flex-1 flex items-center justify-end px-4">
          <span className="text-white font-black text-sm tracking-[0.2em] uppercase truncate text-right"
            style={{ textShadow: p2Fighter ? `0 0 8px ${FACTION_COLOR[p2Fighter.factionAlignment]}` : undefined }}
          >
            {p2Fighter?.name ?? '───'}
          </span>
        </div>
      </div>

      {/* ── BOTTOM ZONE: Roster grid ── */}
      <div className="relative z-10 flex flex-col flex-1"
        style={{ background: 'linear-gradient(180deg, #0d0d0f 0%, #0a0a0a 100%)' }}
      >
        {/* Active slot indicator */}
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-600 tracking-[0.3em]">SELECTING FOR</span>
            <span className={`text-[10px] font-black tracking-[0.3em] px-2 py-0.5 border ${
              activeSlot === 'p1' ?'border-blue-600 text-blue-400 bg-blue-950/40' :'border-red-600 text-red-400 bg-red-950/40'
            }`}>
              {activeSlot === 'p1' ? 'PLAYER 1' : 'PLAYER 2'}
            </span>
            <button
              onClick={() => setActiveSlot(activeSlot === 'p1' ? 'p2' : 'p1')}
              className="text-[9px] text-zinc-600 hover:text-zinc-400 border border-zinc-800 hover:border-zinc-600 px-2 py-0.5 transition-colors"
            >
              SWITCH
            </button>
          </div>
          <div className="flex items-center gap-2">
            {cursorFighter && (
              <button
                onClick={() => { setCustomizerCharId(cursorFighter.id); setCustomizerOpen(true); }}
                className="text-[9px] text-zinc-500 hover:text-yellow-400 border border-zinc-800 hover:border-yellow-700 px-2 py-0.5 transition-colors"
              >
                CUSTOMIZE MOVES
              </button>
            )}
            {canStart && (
              <button
                onClick={handleStartMatch}
                className="text-[10px] font-black text-black bg-yellow-400 hover:bg-yellow-300 px-4 py-0.5 tracking-widest transition-colors"
              >
                FIGHT!
              </button>
            )}
          </div>
        </div>

        {/* Roster rows */}
        <div className="flex-1 flex flex-col justify-center px-2 py-2 gap-1">
          {/* Row 2 (unlockable / overflow) — shown only if more than 10 fighters */}
          {row2.length > 0 && (
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${Math.min(row2.length + 2, 12)}, 1fr)` }}
            >
              {/* Random select left */}
              <button className="aspect-square border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 text-[10px] font-mono hover:border-zinc-600 hover:text-zinc-400 transition-colors">
                ?
              </button>
              {row2.map((fighter, i) => (
                <RosterSlot
                  key={fighter.id}
                  fighter={fighter}
                  p1Selected={fighter.id === p1Id}
                  p2Selected={fighter.id === p2Id}
                  cursorOn={cursorIndex === i + 10}
                  onClick={() => { setCursorIndex(i + 10); handleFighterSelect(fighter); }}
                />
              ))}
              {/* Random select right */}
              <button className="aspect-square border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 text-[10px] font-mono hover:border-zinc-600 hover:text-zinc-400 transition-colors">
                ?
              </button>
            </div>
          )}

          {/* Row 1 (base roster) */}
          <div
            className="grid gap-1"
            style={{ gridTemplateColumns: `repeat(${Math.min(row1.length + 2, 12)}, 1fr)` }}
          >
            {/* Random select left */}
            <button className="aspect-square border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 text-[10px] font-mono hover:border-zinc-600 hover:text-zinc-400 transition-colors">
              ?
            </button>
            {row1.map((fighter, i) => (
              <RosterSlot
                key={fighter.id}
                fighter={fighter}
                p1Selected={fighter.id === p1Id}
                p2Selected={fighter.id === p2Id}
                cursorOn={cursorIndex === i}
                onClick={() => { setCursorIndex(i); handleFighterSelect(fighter); }}
              />
            ))}
            {/* Random select right */}
            <button className="aspect-square border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 text-[10px] font-mono hover:border-zinc-600 hover:text-zinc-400 transition-colors">
              ?
            </button>
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="flex items-center justify-between px-4 py-1 border-t border-zinc-800/50">
          <div className="text-[8px] text-zinc-700 tracking-[0.3em]">
            {cursorFighter ? `${cursorFighter.name.toUpperCase()} · ${cursorFighter.fightingStyle.split('.')[0].toUpperCase()}` : 'MOVE CURSOR TO SELECT'}
          </div>
          <div className="text-[8px] text-zinc-700 tracking-[0.3em]">
            {fighters.length} FIGHTERS · BANNON ROSTER
          </div>
        </div>
      </div>

      {/* ── Move Set Customizer overlay ── */}
      {customizerOpen && customizerCharId && (
        <MoveSetCustomizer
          initialCharacterId={customizerCharId}
          onClose={() => setCustomizerOpen(false)}
          onConfirm={() => setCustomizerOpen(false)}
        />
      )}
    </div>
  );
}
