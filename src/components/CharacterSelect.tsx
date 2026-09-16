'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getAllBannonFighters, getBannonFighter, type BannonFighterProfile } from '../data/bannonRoster';
import { getPlayableAttires } from '../data/bannonGlbRoster';
import { resolveGlbUrl } from '../data/bannonGlbUrl';
import { getCharacterMoveSet } from '../engine/CharacterMoveSetSystem';
import {
  cycleCardArt,
  getSelectedCardArtKind,
  getSelectedCardArtSrc,
} from '../data/fighterCardArt';
import dynamic from 'next/dynamic';

const MoveSetCustomizer = dynamic(() => import('./MoveSetCustomizer'), { ssr: false });
const CharacterPortrait3D = dynamic(() => import('./CharacterPortrait3D'), { ssr: false });

interface CharacterSelectProps {
  onSelectP1?: (fighter: BannonFighterProfile) => void;
  onSelectP2?: (fighter: BannonFighterProfile) => void;
  onStartMatch?: (p1: BannonFighterProfile, p2: BannonFighterProfile) => void;
}

/**
 * Viewport slot rotation — universal, never baked into a GLB.
 * Base model loads at 0°. CharacterSelect applies this after load.
 * P1 faces 45° inward to the right; P2 faces 45° inward to the left.
 */
export const SELECT_SLOT_ROTATION_Y = {
  P1: Math.PI / 4,
  P2: -Math.PI / 4,
} as const;

/** arcade = original 65/15/20 hybrid. block = later 9×3 Tekken-style grid. */
export type CharacterSelectLayout = 'arcade' | 'block';
const LAYOUT_STORAGE_KEY = 'bf-character-select-layout';

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

function getCharacterAttires(characterId: string): Array<{ attire: string; model: string; portraitUrl: string }> {
  const entries = getPlayableAttires(characterId);
  if (entries.length === 0) return [];
  return entries.map(e => ({
    attire: e.attire ?? 'Default',
    model: e.model,
    portraitUrl: resolveGlbUrl(e.model, e.overrideUrl),
  }));
}

function readStoredLayout(): CharacterSelectLayout {
  if (typeof window === 'undefined') return 'arcade';
  const v = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
  return v === 'block' ? 'block' : 'arcade';
}

// ── Large 3D portrait panel (P1 or P2) ───────────────────────────────────────
function FighterPortrait({
  fighter,
  attirePortraitUrl,
  slot,
  active,
  frame = 'faction',
}: {
  fighter: BannonFighterProfile | null;
  attirePortraitUrl?: string;
  slot: 'P1' | 'P2';
  active: boolean;
  /** arcade uses isolated navy/slate frames; block keeps faction washes */
  frame?: 'arcade' | 'faction';
}) {
  const isP1 = slot === 'P1';
  const emptyLabel = isP1 ? 'SELECT FIGHTER' : 'PUSH P2 START';

  if (!fighter) {
    return (
      <div className="relative flex flex-col items-center justify-end h-full w-full overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: frame === 'arcade'
              ? (isP1
                ? 'linear-gradient(180deg, #0a1628 0%, #07101c 55%, #050b14 100%)'
                : 'linear-gradient(180deg, #101820 0%, #0b1218 55%, #080d12 100%)')
              : undefined,
          }}
        />
        {frame !== 'arcade' && <div className="absolute inset-0 bg-gradient-to-b from-zinc-900 to-zinc-950" />}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)',
        }} />
        <div className="relative z-10 flex flex-col items-center justify-center h-full w-full gap-3">
          <div
            className="w-28 h-40 md:w-40 md:h-56 bg-zinc-800 rounded-sm opacity-60"
            style={{ clipPath: 'polygon(20% 0%, 80% 0%, 100% 15%, 100% 85%, 80% 100%, 20% 100%, 0% 85%, 0% 15%)' }}
          />
          <div className="text-zinc-500 font-mono text-xs tracking-[0.3em] animate-pulse">
            {emptyLabel}
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
      {frame === 'arcade' ? (
        <div
          className="absolute inset-0"
          style={{
            background: isP1
              ? 'linear-gradient(180deg, #0a1628 0%, #07101c 55%, #050b14 100%)'
              : 'linear-gradient(180deg, #101820 0%, #0b1218 55%, #080d12 100%)',
          }}
        />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-b ${factionBg}`} />
      )}
      <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.4) 2px, rgba(0,0,0,0.4) 4px)',
      }} />
      <div
        className="absolute inset-0 animate-pulse opacity-20 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${factionColor}55 0%, transparent 70%)` }}
      />
      <div className="absolute inset-0 z-10 flex items-end justify-center">
        <CharacterPortrait3D
          modelUrl={portraitUrl}
          factionColor={factionColor}
          mode="bust"
          rotationY={isP1 ? SELECT_SLOT_ROTATION_Y.P1 : SELECT_SLOT_ROTATION_Y.P2}
          cardUrl={getSelectedCardArtSrc(fighter.id)}
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
        <div className="absolute inset-0 z-20 pointer-events-none border-2 animate-pulse" style={{ borderColor: factionColor }} />
      )}
    </div>
  );
}

function AttireSelector({
  characterId,
  selectedAttire,
  onSelectAttire,
  slot,
  compact = false,
}: {
  characterId: string;
  selectedAttire: string;
  onSelectAttire: (attire: string, portraitUrl: string) => void;
  slot: 'P1' | 'P2';
  compact?: boolean;
}) {
  const attires = useMemo(() => getCharacterAttires(characterId), [characterId]);
  if (attires.length === 0) return null;
  const isP1 = slot === 'P1';

  return (
    <div className={`flex gap-1 overflow-x-auto no-scrollbar ${isP1 ? 'justify-start' : 'justify-end'} ${compact ? 'px-0 py-0' : 'px-2 py-1'}`}>
      {attires.map((a) => (
        <button
          key={a.model}
          onClick={() => onSelectAttire(a.attire, a.portraitUrl)}
          className={`text-[8px] font-mono px-2 py-0.5 border transition-all truncate ${compact ? 'max-w-[88px] shrink-0' : 'max-w-[80px]'} ${
            selectedAttire === a.attire
              ? isP1
                ? 'border-blue-500 text-blue-300 bg-blue-950/60'
                : 'border-red-500 text-red-300 bg-red-950/60'
              : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
          }`}
          title={a.attire}
        >
          {a.attire.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function CardArtSelector({
  characterId,
  onChange,
  slot,
}: {
  characterId: string;
  onChange: () => void;
  slot: 'P1' | 'P2';
}) {
  const kind = getSelectedCardArtKind(characterId);
  const isP1 = slot === 'P1';
  return (
    <button
      onClick={() => { cycleCardArt(characterId); onChange(); }}
      className={`text-[8px] font-mono px-2 py-0.5 border tracking-widest ${
        isP1 ? 'border-blue-800 text-blue-400' : 'border-red-800 text-red-400'
      }`}
      title="Tekken-style card art: likeness (GLB/canon), concept (archived), pixel"
    >
      CARD {kind.toUpperCase()}
    </button>
  );
}

function RosterSlot({
  fighter,
  p1Selected,
  p2Selected,
  cursorOn,
  onClick,
  preview = 'sprite',
}: {
  fighter: BannonFighterProfile;
  p1Selected: boolean;
  p2Selected: boolean;
  cursorOn: boolean;
  onClick: () => void;
  /** arcade uses 2D headshots; block keeps the later 3D-in-cell previews */
  preview?: 'sprite' | 'glb';
}) {
  const factionColor = FACTION_COLOR[fighter.factionAlignment];
  const moveSet = useMemo(() => getCharacterMoveSet(fighter.id), [fighter.id]);
  const isCustomized = moveSet?.isCustomized ?? false;
  const face = getSelectedCardArtSrc(fighter.id);
  const pixelated = getSelectedCardArtKind(fighter.id) === 'pixel';

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center w-full h-full border transition-all duration-100 overflow-hidden group
        ${cursorOn ? 'scale-[1.06] z-10' : 'scale-100'}
        ${p1Selected ? 'border-blue-500' : p2Selected ? 'border-red-500' : 'border-zinc-700 hover:border-zinc-500'}
      `}
      style={{
        background: '#0a0a0c',
        minHeight: 0,
        boxShadow: cursorOn
          ? `0 0 0 2px #facc15, 0 0 12px #22d3ee, 0 0 18px ${factionColor}88`
          : p1Selected
            ? '0 0 8px #3b82f6aa'
            : p2Selected
              ? '0 0 8px #ef4444aa'
              : undefined,
        outline: cursorOn ? '1px solid #22d3ee' : undefined,
        outlineOffset: cursorOn ? 1 : undefined,
      }}
    >
      {preview === 'glb' ? (
        <div className="absolute inset-0 z-0">
          <CharacterPortrait3D
            modelUrl={fighter.portraitUrl}
            factionColor={factionColor}
            mode="full"
            rotationY={0}
          />
        </div>
      ) : (
        <img
          src={face}
          alt=""
          draggable={false}
          className="absolute inset-0 z-0 w-full h-full object-cover object-top"
          style={{ imageRendering: pixelated ? 'pixelated' : 'auto' }}
        />
      )}
      <div className="absolute inset-0 z-[1] opacity-20 pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.55) 1px, rgba(0,0,0,0.55) 2px)',
      }} />
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/70 py-0.5">
        <div className="text-[7px] font-mono text-zinc-300 tracking-widest truncate w-full text-center px-0.5">
          {fighter.name.toUpperCase()}
        </div>
      </div>
      {p1Selected && (
        <div className="absolute top-0.5 left-0.5 z-20 text-[7px] font-mono font-black text-blue-300 bg-blue-900/80 px-1">P1</div>
      )}
      {p2Selected && (
        <div className="absolute top-0.5 right-0.5 z-20 text-[7px] font-mono font-black text-red-300 bg-red-950/80 px-1">P2</div>
      )}
      {isCustomized && (
        <div className="absolute bottom-4 right-0.5 z-20 w-1.5 h-1.5 rounded-full bg-green-400" />
      )}
    </button>
  );
}

function LayoutToggle({
  layout,
  onChange,
}: {
  layout: CharacterSelectLayout;
  onChange: (next: CharacterSelectLayout) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[7px] text-zinc-600 tracking-[0.25em] hidden sm:inline">LAYOUT</span>
      <button
        type="button"
        onClick={() => onChange('arcade')}
        className={`text-[8px] font-mono tracking-widest px-2 py-0.5 border ${
          layout === 'arcade'
            ? 'border-yellow-500 text-yellow-300 bg-yellow-950/50'
            : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'
        }`}
        title="Original arcade: 65% 3D busts / 15% costumes / 20% roster"
      >
        ARCADE
      </button>
      <button
        type="button"
        onClick={() => onChange('block')}
        className={`text-[8px] font-mono tracking-widest px-2 py-0.5 border ${
          layout === 'block'
            ? 'border-yellow-500 text-yellow-300 bg-yellow-950/50'
            : 'border-zinc-800 text-zinc-600 hover:text-zinc-400'
        }`}
        title="Block grid: large flex portraits + 9×3 Tekken-style roster"
      >
        BLOCK
      </button>
    </div>
  );
}

export default function CharacterSelect({ onSelectP1, onSelectP2, onStartMatch }: CharacterSelectProps) {
  const allFighters = useMemo(() => getAllBannonFighters(), []);
  const characters = useMemo(() => getUniqueCharacters(allFighters), [allFighters]);

  const [p1Id, setP1Id] = useState<string | null>(null);
  const [p2Id, setP2Id] = useState<string | null>(null);
  const [p1Attire, setP1Attire] = useState<string>('Default');
  const [p2Attire, setP2Attire] = useState<string>('Default');
  const [p1PortraitUrl, setP1PortraitUrl] = useState<string | undefined>(undefined);
  const [p2PortraitUrl, setP2PortraitUrl] = useState<string | undefined>(undefined);

  const [activeSlot, setActiveSlot] = useState<'p1' | 'p2'>('p1');
  const [cursorIndex, setCursorIndex] = useState(0);
  const [countdown, setCountdown] = useState(60);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerCharId, setCustomizerCharId] = useState<string | null>(null);
  const [layout, setLayout] = useState<CharacterSelectLayout>('arcade');
  const [cardTick, setCardTick] = useState(0);

  useEffect(() => {
    setLayout(readStoredLayout());
  }, []);

  const setLayoutAndStore = (next: CharacterSelectLayout) => {
    setLayout(next);
    try { window.localStorage.setItem(LAYOUT_STORAGE_KEY, next); } catch { /* ignore */ }
  };

  const p1Fighter = p1Id ? getBannonFighter(p1Id) : null;
  const p2Fighter = p2Id ? getBannonFighter(p2Id) : null;
  const cursorFighter = characters[cursorIndex] ?? null;

  useEffect(() => {
    if (countdown <= 0) {
      if (!p1Id && characters.length > 0) setP1Id(characters[0].id);
      if (!p2Id && characters.length > 1) setP2Id(characters[1].id);
      return;
    }
    const t = window.setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, p1Id, p2Id, characters]);

  const arcadeCols = Math.max(13, Math.ceil(Math.max(characters.length, 1) / 2));
  const cols = layout === 'arcade' ? arcadeCols : 9;

  const handleFighterSelect = useCallback((fighter: BannonFighterProfile) => {
    const attires = getCharacterAttires(fighter.id);
    const matched = attires.find(a => a.model === fighter.model) ?? attires[0];
    const defaultAttire = matched?.attire ?? fighter.attire ?? 'Default';
    const defaultPortrait = matched?.portraitUrl ?? fighter.portraitUrl;

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
  }, [activeSlot, onSelectP1, onSelectP2]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setCursorIndex(i => Math.min(characters.length - 1, i + 1));
    else if (e.key === 'ArrowLeft') setCursorIndex(i => Math.max(0, i - 1));
    else if (e.key === 'ArrowDown') setCursorIndex(i => Math.min(characters.length - 1, i + cols));
    else if (e.key === 'ArrowUp') setCursorIndex(i => Math.max(0, i - cols));
    else if (e.key === 'Enter' || e.key === ' ') {
      if (cursorFighter) handleFighterSelect(cursorFighter);
    }
  }, [characters, cursorFighter, cols, handleFighterSelect]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handleStartMatch = () => {
    const f1 = p1Id ? getBannonFighter(p1Id) : null;
    const f2 = p2Id ? getBannonFighter(p2Id) : null;
    if (f1 && f2 && onStartMatch) {
      const a1 = getCharacterAttires(f1.id).find(a => a.attire === p1Attire);
      const a2 = getCharacterAttires(f2.id).find(a => a.attire === p2Attire);
      onStartMatch(
        { ...f1, attire: p1Attire, model: a1?.model ?? f1.model, portraitUrl: p1PortraitUrl || f1.portraitUrl },
        { ...f2, attire: p2Attire, model: a2?.model ?? f2.model, portraitUrl: p2PortraitUrl || f2.portraitUrl },
      );
    }
  };

  const canStart = !!(p1Id && p2Id);

  const pickRandom = () => {
    const pick = characters[Math.floor(Math.random() * characters.length)];
    if (pick) {
      setCursorIndex(characters.indexOf(pick));
      handleFighterSelect(pick);
    }
  };

  const arcadeRows: BannonFighterProfile[][] = [];
  for (let r = 0; r < 2; r++) {
    arcadeRows.push(characters.slice(r * arcadeCols, (r + 1) * arcadeCols));
  }

  const blockRows: BannonFighterProfile[][] = [];
  const SLOTS_PER_ROW = 9;
  for (let i = 0; i < characters.length; i += SLOTS_PER_ROW) {
    blockRows.push(characters.slice(i, i + SLOTS_PER_ROW));
  }

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none font-mono flex flex-col"
      style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111113 40%, #0d0d0f 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]" style={{
        backgroundImage: `
          repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 40px),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 40px)
        `,
      }} />
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{
        backgroundImage: 'radial-gradient(circle, #555 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
        <div
          className="text-[6vw] font-black tracking-[0.35em] text-white uppercase select-none"
          style={{ opacity: 0.04, fontFamily: 'monospace', filter: 'blur(0.5px)' }}
        >
          PLAYER SELECT
        </div>
      </div>

      {layout === 'arcade' ? (
        <>
          {/* TOP 65% — isolated P1 | spine | P2 3D busts */}
          <div className="relative z-10 flex shrink-0" style={{ height: '65%' }}>
            <div className="h-full min-w-0 border-r border-zinc-800/60" style={{ width: '45%' }}>
              <FighterPortrait
                fighter={p1Fighter}
                attirePortraitUrl={p1PortraitUrl}
                slot="P1"
                active={activeSlot === 'p1'}
                frame="arcade"
              />
            </div>

            <div
              className="relative flex flex-col items-center justify-center h-full shrink-0 z-20"
              style={{
                width: '10%',
                background: 'linear-gradient(180deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)',
              }}
            >
              <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
                {'PLAYER SELECT'.split('').map((ch, i) => (
                  <span key={i} className="text-[6px] text-zinc-600 font-black tracking-widest leading-tight">{ch}</span>
                ))}
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="text-3xl md:text-5xl font-black tabular-nums"
                  style={{
                    color: countdown <= 10 ? '#ef4444' : '#facc15',
                    textShadow: countdown <= 10
                      ? '0 0 16px #ef4444, 0 0 32px #ef444488'
                      : '0 0 16px #facc15, 0 0 32px #facc1588',
                    fontFamily: 'monospace',
                  }}
                >
                  {String(countdown).padStart(2, '0')}
                </div>
                <div className="text-[7px] text-zinc-600 tracking-widest mt-0.5">TIME</div>
              </div>
              <div className="mt-3 text-xs font-black text-zinc-700 tracking-widest">VS</div>
            </div>

            <div className="h-full min-w-0 border-l border-zinc-800/60" style={{ width: '45%' }}>
              <FighterPortrait
                fighter={p2Fighter}
                attirePortraitUrl={p2PortraitUrl}
                slot="P2"
                active={activeSlot === 'p2'}
                frame="arcade"
              />
            </div>
          </div>

          {/* MID 15% — costumes, names, SWITCH / CUSTOMIZE / FIGHT */}
          <div
            className="relative z-10 shrink-0 flex flex-col justify-center gap-1 px-2 border-t border-b border-zinc-800"
            style={{
              height: '15%',
              background: 'linear-gradient(90deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)',
            }}
          >
            <div className="flex items-center gap-2 min-h-0">
              <div className="flex-1 min-w-0">
                {p1Fighter && (
                  <div className="flex items-center gap-1">
                    <AttireSelector
                      characterId={p1Fighter.id}
                      selectedAttire={p1Attire}
                      onSelectAttire={(attire, url) => { setP1Attire(attire); setP1PortraitUrl(url); }}
                      slot="P1"
                      compact
                    />
                    <CardArtSelector characterId={p1Fighter.id} slot="P1" onChange={() => setCardTick((n) => n + 1)} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setActiveSlot(activeSlot === 'p1' ? 'p2' : 'p1')}
                  className="text-[8px] text-zinc-500 hover:text-zinc-300 border border-zinc-700 hover:border-zinc-500 px-2 py-1 tracking-widest"
                >
                  SWITCH
                </button>
                {cursorFighter && (
                  <button
                    onClick={() => { setCustomizerCharId(cursorFighter.id); setCustomizerOpen(true); }}
                    className="text-[8px] text-zinc-500 hover:text-yellow-400 border border-zinc-700 hover:border-yellow-700 px-2 py-1 tracking-widest"
                  >
                    CUSTOMIZE
                  </button>
                )}
                <button
                  onClick={handleStartMatch}
                  disabled={!canStart}
                  className={`text-[11px] font-black tracking-widest px-4 py-1 ${
                    canStart
                      ? 'text-black bg-yellow-400 hover:bg-yellow-300'
                      : 'text-zinc-600 bg-zinc-800 cursor-not-allowed'
                  }`}
                >
                  FIGHT!
                </button>
              </div>
              <div className="flex-1 min-w-0">
                {p2Fighter && (
                  <div className="flex items-center justify-end gap-1">
                    <CardArtSelector characterId={p2Fighter.id} slot="P2" onChange={() => setCardTick((n) => n + 1)} />
                    <AttireSelector
                      characterId={p2Fighter.id}
                      selectedAttire={p2Attire}
                      onSelectAttire={(attire, url) => { setP2Attire(attire); setP2PortraitUrl(url); }}
                      slot="P2"
                      compact
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div
                  className="text-white font-black text-sm md:text-base tracking-[0.22em] uppercase truncate"
                  style={{ textShadow: p1Fighter ? `0 0 8px ${FACTION_COLOR[p1Fighter.factionAlignment]}` : undefined }}
                >
                  {p1Fighter?.name ?? '───'}
                </div>
              </div>
              <div className={`text-[8px] font-black tracking-[0.3em] px-2 py-0.5 border shrink-0 ${
                activeSlot === 'p1'
                  ? 'border-blue-600 text-blue-400 bg-blue-950/40'
                  : 'border-red-600 text-red-400 bg-red-950/40'
              }`}>
                SELECTING FOR PLAYER {activeSlot === 'p1' ? '1' : '2'}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div
                  className="text-white font-black text-sm md:text-base tracking-[0.22em] uppercase truncate"
                  style={{ textShadow: p2Fighter ? `0 0 8px ${FACTION_COLOR[p2Fighter.factionAlignment]}` : undefined }}
                >
                  {p2Fighter?.name ?? '───'}
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM 20% — 2-row 2D roster */}
          <div
            className="relative z-10 shrink-0 flex flex-col min-h-0"
            style={{ height: '20%', background: 'linear-gradient(180deg, #0d0d0f 0%, #080808 100%)' }}
          >
            <div className="flex-1 min-h-0 flex flex-col gap-0.5 px-1 py-0.5">
              {arcadeRows.map((row, rowIdx) => (
                <div
                  key={`arcade-row-${rowIdx}`}
                  className="flex-1 min-h-0 grid gap-0.5"
                  style={{ gridTemplateColumns: `repeat(${arcadeCols}, minmax(0, 1fr))` }}
                >
                  {row.map((fighter, i) => {
                    const index = rowIdx * arcadeCols + i;
                    return (
                      <RosterSlot
                        key={fighter.id}
                        fighter={fighter}
                        p1Selected={fighter.id === p1Id}
                        p2Selected={fighter.id === p2Id}
                        cursorOn={cursorIndex === index}
                        onClick={() => { setCursorIndex(index); handleFighterSelect(fighter); }}
                      />
                    );
                  })}
                  {Array.from({ length: Math.max(0, arcadeCols - row.length) }).map((_, i) => (
                    <div key={`empty-a-${rowIdx}-${i}`} className="h-full border border-zinc-900/30 bg-zinc-950/30" />
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between px-3 py-0.5 border-t border-zinc-800/50 shrink-0">
              <div className="text-[8px] text-zinc-700 tracking-[0.3em] truncate">
                {cursorFighter
                  ? `${cursorFighter.name.toUpperCase()} · ${cursorFighter.fightingStyle.split('.')[0].toUpperCase()}`
                  : 'MOVE CURSOR TO SELECT'}
              </div>
              <LayoutToggle layout={layout} onChange={setLayoutAndStore} />
              <div className="text-[8px] text-zinc-700 tracking-[0.3em]">
                {characters.length} FIGHTERS ROSTER
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* BLOCK layout — previous Grok change: flex portraits + 9×3 grid */}
          <div className="relative z-10 flex flex-1 min-h-0">
            <div className="flex flex-col flex-1 border-r border-zinc-800/60 min-w-0">
              <div className="flex-1 min-h-0">
                <FighterPortrait fighter={p1Fighter} attirePortraitUrl={p1PortraitUrl} slot="P1" active={activeSlot === 'p1'} frame="faction" />
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

            <div
              className="relative flex flex-col items-center justify-center w-14 md:w-18 shrink-0 z-20"
              style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)' }}
            >
              <div className="absolute top-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5">
                {'PLAYER SELECT'.split('').map((ch, i) => (
                  <span key={i} className="text-[6px] text-zinc-600 font-black tracking-widest leading-tight">{ch}</span>
                ))}
              </div>
              <div className="flex flex-col items-center mt-4">
                <div
                  className="text-3xl md:text-4xl font-black tabular-nums"
                  style={{
                    color: countdown <= 10 ? '#ef4444' : '#facc15',
                    textShadow: countdown <= 10
                      ? '0 0 16px #ef4444, 0 0 32px #ef444488'
                      : '0 0 16px #facc15, 0 0 32px #facc1588',
                    fontFamily: 'monospace',
                  }}
                >
                  {String(countdown).padStart(2, '0')}
                </div>
                <div className="text-[7px] text-zinc-600 tracking-widest mt-0.5">TIME</div>
              </div>
              <div className="mt-3 text-xs font-black text-zinc-700 tracking-widest">VS</div>
            </div>

            <div className="flex flex-col flex-1 border-l border-zinc-800/60 min-w-0">
              <div className="flex-1 min-h-0">
                <FighterPortrait fighter={p2Fighter} attirePortraitUrl={p2PortraitUrl} slot="P2" active={activeSlot === 'p2'} frame="faction" />
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

          <div
            className="relative z-10 flex h-8 border-t border-b border-zinc-800 shrink-0"
            style={{ background: 'linear-gradient(90deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)' }}
          >
            <div className="flex-1 flex items-center px-4">
              <span
                className="text-white font-black text-sm tracking-[0.2em] uppercase truncate"
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
              <span
                className="text-white font-black text-sm tracking-[0.2em] uppercase truncate text-right"
                style={{ textShadow: p2Fighter ? `0 0 8px ${FACTION_COLOR[p2Fighter.factionAlignment]}` : undefined }}
              >
                {p2Fighter?.name ?? '───'}
              </span>
            </div>
          </div>

          <div className="relative z-10 shrink-0" style={{ background: 'linear-gradient(180deg, #0d0d0f 0%, #080808 100%)' }}>
            <div className="flex items-center justify-between px-3 py-1 border-b border-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-zinc-600 tracking-[0.3em]">SELECTING FOR</span>
                <span className={`text-[9px] font-black tracking-[0.3em] px-2 py-0.5 border ${
                  activeSlot === 'p1'
                    ? 'border-blue-600 text-blue-400 bg-blue-950/40'
                    : 'border-red-600 text-red-400 bg-red-950/40'
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
              <LayoutToggle layout={layout} onChange={setLayoutAndStore} />
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

            <div className="flex flex-col gap-0.5 px-1 py-1">
              {blockRows.map((row, rowIdx) => (
                <div
                  key={`block-row-${rowIdx}`}
                  className="grid gap-0.5"
                  style={{ gridTemplateColumns: `repeat(${SLOTS_PER_ROW + 2}, 1fr)` }}
                >
                  <button
                    type="button"
                    className="aspect-square border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 text-[10px] font-mono hover:border-zinc-600 hover:text-zinc-400 transition-colors"
                    onClick={pickRandom}
                  >
                    ?
                  </button>
                  {row.map((fighter, i) => {
                    const index = rowIdx * SLOTS_PER_ROW + i;
                    return (
                      <RosterSlot
                        key={fighter.id}
                        fighter={fighter}
                        p1Selected={fighter.id === p1Id}
                        p2Selected={fighter.id === p2Id}
                        cursorOn={cursorIndex === index}
                        preview="glb"
                        onClick={() => { setCursorIndex(index); handleFighterSelect(fighter); }}
                      />
                    );
                  })}
                  {Array.from({ length: Math.max(0, SLOTS_PER_ROW - row.length) }).map((_, i) => (
                    <div key={`empty-b-${rowIdx}-${i}`} className="aspect-square border border-zinc-900/30 bg-zinc-950/30" />
                  ))}
                  <button
                    type="button"
                    className="aspect-square border border-zinc-800 bg-zinc-900/50 flex items-center justify-center text-zinc-700 text-[10px] font-mono hover:border-zinc-600 hover:text-zinc-400 transition-colors"
                    onClick={pickRandom}
                  >
                    ?
                  </button>
                </div>
              ))}
            </div>

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
        </>
      )}

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
