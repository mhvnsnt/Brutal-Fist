'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getAllBannonFighters, getBannonFighter, type BannonFighterProfile } from '../data/bannonRoster';
import { BANNON_GLB_MODELS } from '../data/bannonGlbRoster';
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

/** Deduplicated character list — one entry per unique character id */
function getUniqueCharacters(fighters: readonly BannonFighterProfile[]): BannonFighterProfile[] {
  const seen = new Set<string>();
  const result: BannonFighterProfile[] = [];
  for (const f of fighters) {
    if (!seen.has(f.id)) {
      seen.add(f.id);
      result.push(f);
    }
  }
  return result;
}

/** Get all attires for a character from the GLB roster */
function getCharacterAttires(characterId: string): Array<{ attire: string; model: string; portraitUrl: string }> {
  const BANNON_RAW = 'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/models';
  const entries = BANNON_GLB_MODELS.filter(e => e.id === characterId && e.playableGate === 'PASS');
  if (entries.length === 0) return [];
  return entries.map(e => ({
    attire: e.attire ?? 'Default',
    model: e.model,
    portraitUrl: e.overrideUrl ?? `${BANNON_RAW}/${e.model}`,
  }));
}

// ── Large portrait panel (P1 or P2 side) ─────────────────────────────────────
function FighterPortrait({
  fighter,
  attirePortraitUrl,
  slot,
  active,
}: {
  fighter: BannonFighterProfile | null;
  attirePortraitUrl?: string;
  slot: 'P1' | 'P2';
  active: boolean;
}) {
  const isP1 = slot === 'P1';

  if (!fighter) {
    return (
      <div className={`relative flex flex-col items-center justify-end h-full w-full overflow-hidden`}>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)'
        }} />
        <div className="relative z-10 flex flex-col items-center justify-center h-full w-full gap-3">
          <div className="w-28 h-40 md:w-40 md:h-56 bg-zinc-800 rounded-sm opacity-60"
            style={{ clipPath: 'polygon(20% 0%, 80% 0%, 100% 15%, 100% 85%, 80% 100%, 20% 100%, 0% 85%, 0% 15%)' }}
          />
          <div className="text-zinc-500 font-mono text-xs tracking-[0.3em] animate-pulse">
            {isP1 ? 'SELECT FIGHTER' : 'PUSH P2 START'}
          </div>
        </div>
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
  const portraitUrl = attirePortraitUrl ?? fighter.portraitUrl;

  return (
    <div className="relative flex flex-col items-center justify-end h-full w-full overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-b ${factionBg}`} />
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)'
      }} />
      <div className="absolute inset-0 animate-pulse opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${factionColor}55 0%, transparent 70%)` }}
      />
      <div className="absolute inset-0 z-10">
        <CharacterPortrait3D
          modelUrl={portraitUrl}
          factionColor={factionColor}
          mode="bust"
          rotationY={isP1 ? -0.45 : Math.PI}
        />
      </div>
      <div className="relative z-20 w-full flex justify-center pb-2 pointer-events-none">
        <div className="text-zinc-400 font-mono text-[9px] tracking-[0.25em] uppercase bg-black/50 px-2 py-0.5">
          {fighter.role.split('/')[0].trim()}
        </div>
      </div>
      <div className={`absolute top-3 ${isP1 ? 'left-3' : 'right-3'} z-30`}>
        <span className={`font-mono text-xs font-black tracking-[0.3em] px-2 py-1 border ${isP1 ? 'border-blue-500 text-blue-300 bg-blue-950/80' : 'border-red-500 text-red-300 bg-red-950/80'}`}>
          {slot}
        </span>
      </div>
      {active && (
        <div className="absolute inset-0 z-20 pointer-events-none border-2 animate-pulse"
          style={{ borderColor: factionColor }}
        />
      )}
    </div>
  );
}

// ── Attire selector strip (shown below portrait when a character is selected) ─
function AttireSelector({
  characterId,
  selectedAttire,
  onSelectAttire,
  slot,
}: {
  characterId: string;
  selectedAttire: string;
  onSelectAttire: (attire: string, portraitUrl: string) => void;
  slot: 'P1' | 'P2';
}) {
  const attires = useMemo(() => getCharacterAttires(characterId), [characterId]);
  if (attires.length <= 1) return null;
  const isP1 = slot === 'P1';

  return (
    <div className={`flex gap-1 px-2 py-1 ${isP1 ? 'justify-start' : 'justify-end'}`}>
      {attires.map((a) => (
        <button
          key={a.model}
          onClick={() => onSelectAttire(a.attire, a.portraitUrl)}
          className={`text-[8px] font-mono px-2 py-0.5 border transition-all truncate max-w-[80px] ${
            selectedAttire === a.attire
              ? isP1
                ? 'border-blue-500 text-blue-300 bg-blue-950/60' :'border-red-500 text-red-300 bg-red-950/60' :'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
          }`}
          title={a.attire}
        >
          {a.attire.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ── Single character slot in the Tekken-style roster grid ────────────────────
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

      {/* 3D character portrait */}
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

// ── Main CharacterSelect ──────────────────────────────────────────────────────
export default function CharacterSelect({ onSelectP1, onSelectP2, onStartMatch }: CharacterSelectProps) {
  const allFighters = useMemo(() => getAllBannonFighters(), []);
  // Deduplicated: one slot per character
  const characters = useMemo(() => getUniqueCharacters(allFighters), [allFighters]);

  const [p1Id, setP1Id] = useState<string | null>(null);
  const [p2Id, setP2Id] = useState<string | null>(null);
  // Selected attires per slot
  const [p1Attire, setP1Attire] = useState<string>('Default');
  const [p2Attire, setP2Attire] = useState<string>('Default');
  const [p1PortraitUrl, setP1PortraitUrl] = useState<string | undefined>(undefined);
  const [p2PortraitUrl, setP2PortraitUrl] = useState<string | undefined>(undefined);

  const [activeSlot, setActiveSlot] = useState<'p1' | 'p2'>('p1');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [countdown, setCountdown] = useState(60);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerCharId, setCustomizerCharId] = useState<string | null>(null);

  const p1Fighter = p1Id ? getBannonFighter(p1Id) : null;
  const p2Fighter = p2Id ? getBannonFighter(p2Id) : null;
  const cursorFighter = characters[cursorIndex] ?? null;

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) {
      if (!p1Id && characters.length > 0) setP1Id(characters[0].id);
      if (!p2Id && characters.length > 1) setP2Id(characters[1].id);
      return;
    }
    const t = window.setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, p1Id, p2Id, characters]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const cols = Math.min(characters.length, 12);
    if (e.key === 'ArrowRight') setCursorIndex(i => Math.min(characters.length - 1, i + 1));
    else if (e.key === 'ArrowLeft') setCursorIndex(i => Math.max(0, i - 1));
    else if (e.key === 'ArrowDown') setCursorIndex(i => Math.min(characters.length - 1, i + cols));
    else if (e.key === 'ArrowUp') setCursorIndex(i => Math.max(0, i - cols));
    else if (e.key === 'Enter' || e.key === ' ') {
      if (cursorFighter) handleFighterSelect(cursorFighter);
    }
  }, [cursorIndex, characters, cursorFighter]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleFighterSelect = (fighter: BannonFighterProfile) => {
    const attires = getCharacterAttires(fighter.id);
    const defaultAttire = attires[0]?.attire ?? 'Default';
    const defaultPortrait = attires[0]?.portraitUrl ?? fighter.portraitUrl;

    if (activeSlot === 'p1') {
      setP1Id(fighter.id);
      setP1Attire(defaultAttire);
      setP1PortraitUrl(defaultPortrait);
      if (onSelectP1) onSelectP1(fighter);
      setActiveSlot('p2');
    } else {
      setP2Id(fighter.id);
      setP2Attire(defaultAttire);
      setP2PortraitUrl(defaultPortrait);
      if (onSelectP2) onSelectP2(fighter);
    }
  };

  const handleStartMatch = () => {
    const f1 = p1Id ? getBannonFighter(p1Id) : null;
    const f2 = p2Id ? getBannonFighter(p2Id) : null;
    if (f1 && f2 && onStartMatch) onStartMatch(f1, f2);
  };

  const canStart = !!(p1Id && p2Id);

  // Two rows of 12 slots each (Tekken-style)
  const SLOTS_PER_ROW = 12;
  const row1 = characters.slice(0, SLOTS_PER_ROW);
  const row2 = characters.slice(SLOTS_PER_ROW, SLOTS_PER_ROW * 2);

  return (
    <div className="fixed inset-0 overflow-hidden select-none font-mono flex flex-col"
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
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{
        backgroundImage: 'radial-gradient(circle, #555 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* ── PLAYER SELECT watermark ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div className="text-[6vw] font-black tracking-[0.35em] text-white uppercase select-none"
          style={{ opacity: 0.04, fontFamily: 'monospace', filter: 'blur(0.5px)' }}
        >
          PLAYER SELECT
        </div>
      </div>

      {/* ── TOP ZONE: Two player portrait busts (fills remaining space above grid) ── */}
      <div className="relative z-10 flex flex-1 min-h-0">
        {/* P1 Portrait + attire strip */}
        <div className="flex flex-col flex-1 border-r border-zinc-800/60 min-w-0">
          <div className="flex-1 min-h-0">
            <FighterPortrait fighter={p1Fighter} attirePortraitUrl={p1PortraitUrl} slot="P1" active={activeSlot === 'p1'} />
          </div>
          {p1Fighter && (
            <AttireSelector
              characterId={p1Fighter.id}
              selectedAttire={p1Attire}
              onSelectAttire={(attire, url) => { setP1Attire(attire); setP1PortraitUrl(url); }}
              slot="P1"
            />
          )}
        </div>

        {/* Center divider with countdown */}
        <div className="relative flex flex-col items-center justify-center w-14 md:w-18 shrink-0 z-20"
          style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)' }}
        >
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
            {'PLAYER SELECT'.split('').map((ch, i) => (
              <span key={i} className="text-[6px] text-zinc-600 font-black tracking-widest leading-tight">{ch}</span>
            ))}
          </div>
          <div className="flex flex-col items-center mt-4">
            <div className="text-3xl md:text-4xl font-black tabular-nums"
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
          <div className="mt-3 text-xs font-black text-zinc-700 tracking-widest">VS</div>
        </div>

        {/* P2 Portrait + attire strip */}
        <div className="flex flex-col flex-1 border-l border-zinc-800/60 min-w-0">
          <div className="flex-1 min-h-0">
            <FighterPortrait fighter={p2Fighter} attirePortraitUrl={p2PortraitUrl} slot="P2" active={activeSlot === 'p2'} />
          </div>
          {p2Fighter && (
            <AttireSelector
              characterId={p2Fighter.id}
              selectedAttire={p2Attire}
              onSelectAttire={(attire, url) => { setP2Attire(attire); setP2PortraitUrl(url); }}
              slot="P2"
            />
          )}
        </div>
      </div>

      {/* ── CHARACTER NAME BAR ── */}
      <div className="relative z-10 flex h-8 border-t border-b border-zinc-800 shrink-0"
        style={{ background: 'linear-gradient(90deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)' }}
      >
        <div className="flex-1 flex items-center px-4">
          <span className="text-white font-black text-sm tracking-[0.2em] uppercase truncate"
            style={{ textShadow: p1Fighter ? `0 0 8px ${FACTION_COLOR[p1Fighter.factionAlignment]}` : undefined }}
          >
            {p1Fighter?.name ?? '───'}
          </span>
          {p1Fighter && p1Attire !== 'Default' && (
            <span className="ml-2 text-[9px] text-zinc-500 tracking-widest truncate">{p1Attire.toUpperCase()}</span>
          )}
        </div>
        <div className="w-14 md:w-18 flex items-center justify-center shrink-0">
          <div className="w-px h-full bg-zinc-700" />
        </div>
        <div className="flex-1 flex items-center justify-end px-4">
          {p2Fighter && p2Attire !== 'Default' && (
            <span className="mr-2 text-[9px] text-zinc-500 tracking-widest truncate">{p2Attire.toUpperCase()}</span>
          )}
          <span className="text-white font-black text-sm tracking-[0.2em] uppercase truncate text-right"
            style={{ textShadow: p2Fighter ? `0 0 8px ${FACTION_COLOR[p2Fighter.factionAlignment]}` : undefined }}
          >
            {p2Fighter?.name ?? '───'}
          </span>
        </div>
      </div>

      {/* ── BOTTOM ZONE: Tekken-style two-row character grid ── */}
      <div className="relative z-10 shrink-0"
        style={{ background: 'linear-gradient(180deg, #0d0d0f 0%, #080808 100%)' }}
      >
        {/* Controls bar */}
        <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <span className="text-[8px] text-zinc-600 tracking-[0.3em]">SELECTING FOR</span>
            <span className={`text-[9px] font-black tracking-[0.3em] px-2 py-0.5 border ${
              activeSlot === 'p1' ?'border-blue-600 text-blue-400 bg-blue-950/40' :'border-red-600 text-red-400 bg-red-950/40'
            }`}>
              {activeSlot === 'p1' ? 'PLAYER 1' : 'PLAYER 2'}
            </span>
            <button
              onClick={() => setActiveSlot(activeSlot === 'p1' ? 'p2' : 'p1')}
              className="text-[8px] text-zinc-600 hover:text-zinc-400 border border-zinc-800 hover:border-zinc-600 px-2 py-0.5 transition-colors"
            >
              SWITCH
            </button>
          </div>
          <div className="flex items-center gap-2">
            {cursorFighter && (
              <button
                onClick={() => { setCustomizerCharId(cursorFighter.id); setCustomizerOpen(true); }}
                className="text-[8px] text-zinc-500 hover:text-yellow-400 border border-zinc-800 hover:border-yellow-700 px-2 py-0.5 transition-colors"
              >
                CUSTOMIZE
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

        {/* Roster rows — Tekken-style two rows at the bottom */}
        <div className="flex flex-col gap-0.5 px-1 py-1">
          {/* Row 1 */}
          <div
            className="grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${SLOTS_PER_ROW + 2}, 1fr)` }}
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
            {/* Fill empty slots in row 1 if fewer than SLOTS_PER_ROW */}
            {Array.from({ length: Math.max(0, SLOTS_PER_ROW - row1.length) }).map((_, i) => (
              <div key={`empty1-${i}`} className="aspect-square border border-zinc-900/30 bg-zinc-950/30" />
            ))}
            {/* Random select right */}
            <button className="aspect-square border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 text-[10px] font-mono hover:border-zinc-600 hover:text-zinc-400 transition-colors">
              ?
            </button>
          </div>

          {/* Row 2 (overflow characters) */}
          {row2.length > 0 && (
            <div
              className="grid gap-0.5"
              style={{ gridTemplateColumns: `repeat(${SLOTS_PER_ROW + 2}, 1fr)` }}
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
                  cursorOn={cursorIndex === i + SLOTS_PER_ROW}
                  onClick={() => { setCursorIndex(i + SLOTS_PER_ROW); handleFighterSelect(fighter); }}
                />
              ))}
              {/* Fill empty slots in row 2 */}
              {Array.from({ length: Math.max(0, SLOTS_PER_ROW - row2.length) }).map((_, i) => (
                <div key={`empty2-${i}`} className="aspect-square border border-zinc-900/30 bg-zinc-950/30" />
              ))}
              {/* Random select right */}
              <button className="aspect-square border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 text-[10px] font-mono hover:border-zinc-600 hover:text-zinc-400 transition-colors">
                ?
              </button>
            </div>
          )}
        </div>

        {/* Bottom info bar */}
        <div className="flex items-center justify-between px-3 py-1 border-t border-zinc-800/50">
          <div className="text-[8px] text-zinc-700 tracking-[0.3em]">
            {cursorFighter
              ? `${cursorFighter.name.toUpperCase()} · ${cursorFighter.fightingStyle.split('.')[0].toUpperCase()}`
              : 'MOVE CURSOR TO SELECT'}
          </div>
          <div className="text-[8px] text-zinc-700 tracking-[0.3em]">
            {characters.length} FIGHTERS · BANNON ROSTER
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
