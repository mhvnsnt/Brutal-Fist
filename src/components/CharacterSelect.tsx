'use client';

import React, { useState, useMemo } from 'react';
import { getAllBannonFighters, getBannonFighter, type BannonFighterProfile } from '../data/bannonRoster';
import { getCharacterMoveSet } from '../engine/CharacterMoveSetSystem';
import dynamic from 'next/dynamic';

const MoveSetCustomizer = dynamic(() => import('./MoveSetCustomizer'), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface CharacterSelectProps {
  onSelectP1?: (fighter: BannonFighterProfile) => void;
  onSelectP2?: (fighter: BannonFighterProfile) => void;
  onStartMatch?: (p1: BannonFighterProfile, p2: BannonFighterProfile) => void;
}

// ─── Faction Colors ───────────────────────────────────────────────────────────

const FACTION_BORDER: Record<string, string> = {
  alliance:    'border-blue-600',
  corporate:   'border-red-600',
  chaos:       'border-purple-600',
  independent: 'border-yellow-600',
};

const FACTION_GLOW: Record<string, string> = {
  alliance:    'shadow-blue-900/60',
  corporate:   'shadow-red-900/60',
  chaos:       'shadow-purple-900/60',
  independent: 'shadow-yellow-900/60',
};

const FACTION_LABEL: Record<string, string> = {
  alliance:    'ALLIANCE',
  corporate:   'CORPORATE',
  chaos:       'CHAOS',
  independent: 'INDEPENDENT',
};

const FACTION_TEXT: Record<string, string> = {
  alliance:    'text-blue-400',
  corporate:   'text-red-400',
  chaos:       'text-purple-400',
  independent: 'text-yellow-400',
};

// ─── Fighter Card ─────────────────────────────────────────────────────────────

function FighterCard({
  fighter,
  slot,
  selected,
  onClick,
  onCustomize,
}: {
  fighter: BannonFighterProfile;
  slot: 'p1' | 'p2' | null;
  selected: boolean;
  onClick: () => void;
  onCustomize: () => void;
}) {
  const moveSet = useMemo(() => getCharacterMoveSet(fighter.id), [fighter.id]);
  const isCustomized = moveSet?.isCustomized ?? false;

  return (
    <div
      className={`relative group cursor-pointer rounded-xl border-2 transition-all duration-200 overflow-hidden ${
        selected
          ? `${FACTION_BORDER[fighter.factionAlignment]} shadow-lg ${FACTION_GLOW[fighter.factionAlignment]}`
          : 'border-gray-800 hover:border-gray-600'
      } bg-gray-900`}
      onClick={onClick}
    >
      {/* Slot indicator */}
      {slot && (
        <div className={`absolute top-2 left-2 z-10 text-xs font-bold font-mono px-2 py-0.5 rounded ${
          slot === 'p1' ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {slot === 'p1' ? 'P1' : 'P2'}
        </div>
      )}

      {/* Customized badge */}
      {isCustomized && (
        <div className="absolute top-2 right-2 z-10 text-xs font-mono text-green-400">✦</div>
      )}

      {/* Character avatar placeholder */}
      <div className={`h-28 flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900 ${
        selected ? 'from-gray-700' : ''
      }`}>
        <div className={`text-4xl font-black font-mono ${FACTION_TEXT[fighter.factionAlignment]} opacity-60`}>
          {fighter.name.charAt(0)}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <span className={`font-bold text-sm ${selected ? FACTION_TEXT[fighter.factionAlignment] : 'text-white'}`}>
            {fighter.name}
          </span>
          <span className={`text-xs font-mono ${FACTION_TEXT[fighter.factionAlignment]}`}>
            {FACTION_LABEL[fighter.factionAlignment]}
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-tight line-clamp-2 mb-2">
          {fighter.fightingStyle.split('.')[0]}
        </p>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-1 text-xs font-mono">
          <div className="text-center">
            <div className="text-gray-600">SPD</div>
            <div className="text-white">{fighter.speed}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-600">STR</div>
            <div className="text-white">{fighter.strength}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-600">POI</div>
            <div className="text-white">{fighter.poise}</div>
          </div>
        </div>

        {/* Customize button */}
        <button
          onClick={e => { e.stopPropagation(); onCustomize(); }}
          className="mt-2 w-full text-xs font-mono py-1 rounded border border-gray-700 text-gray-400 hover:border-yellow-600 hover:text-yellow-400 transition-colors"
        >
          {isCustomized ? '✦ Edit Moves' : 'Customize Moves'}
        </button>
      </div>
    </div>
  );
}

// ─── Selected Fighter Detail ──────────────────────────────────────────────────

function SelectedFighterDetail({ fighter, slot }: { fighter: BannonFighterProfile; slot: 'P1' | 'P2' }) {
  const slotColor = slot === 'P1' ? 'text-blue-400' : 'text-red-400';
  const borderColor = slot === 'P1' ? 'border-blue-800' : 'border-red-800';
  const bgColor = slot === 'P1' ? 'bg-blue-950/20' : 'bg-red-950/20';

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-xs font-bold font-mono ${slotColor} bg-current/10 px-2 py-0.5 rounded`}>
          {slot}
        </span>
        <span className="text-white font-bold">{fighter.name}</span>
        <span className={`text-xs font-mono ${FACTION_TEXT[fighter.factionAlignment]}`}>
          {FACTION_LABEL[fighter.factionAlignment]}
        </span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed mb-3">{fighter.bio}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
        <span className="text-gray-600">Payback</span>
        <span className="text-yellow-400">{fighter.payback}</span>
        <span className="text-gray-600">Manager</span>
        <span className="text-white">{fighter.manager}</span>
        <span className="text-gray-600">HP</span>
        <span className="text-white">{fighter.hp.toLocaleString()}</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CharacterSelect({ onSelectP1, onSelectP2, onStartMatch }: CharacterSelectProps) {
  const fighters = useMemo(() => getAllBannonFighters(), []);
  const [p1Id, setP1Id] = useState<string | null>(null);
  const [p2Id, setP2Id] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<'p1' | 'p2'>('p1');
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [customizerCharId, setCustomizerCharId] = useState<string | null>(null);
  const [filterFaction, setFilterFaction] = useState<string>('all');

  const p1Fighter = p1Id ? getBannonFighter(p1Id) : null;
  const p2Fighter = p2Id ? getBannonFighter(p2Id) : null;

  const filteredFighters = useMemo(() => {
    if (filterFaction === 'all') return fighters;
    return fighters.filter(f => f.factionAlignment === filterFaction);
  }, [fighters, filterFaction]);

  const handleFighterClick = (fighter: BannonFighterProfile) => {
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
    if (p1Fighter && p2Fighter && onStartMatch) {
      onStartMatch(p1Fighter, p2Fighter);
    }
  };

  const openCustomizer = (charId: string) => {
    setCustomizerCharId(charId);
    setCustomizerOpen(true);
  };

  const factions = ['all', 'alliance', 'corporate', 'chaos', 'independent'];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black font-mono text-yellow-400 tracking-widest uppercase">
              Brutal Fist
            </h1>
            <p className="text-xs text-gray-500 font-mono mt-0.5">Character Select — Bannon Roster</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs font-mono text-gray-500">
              Selecting for:{' '}
              <span className={activeSlot === 'p1' ? 'text-blue-400 font-bold' : 'text-red-400 font-bold'}>
                {activeSlot === 'p1' ? 'PLAYER 1' : 'PLAYER 2'}
              </span>
            </div>
            <button
              onClick={() => setActiveSlot(activeSlot === 'p1' ? 'p2' : 'p1')}
              className="text-xs font-mono px-3 py-1.5 border border-gray-700 rounded hover:border-gray-500 text-gray-400 hover:text-white transition-colors"
            >
              Switch Slot
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 flex flex-col gap-6">

        {/* Selected fighters */}
        {(p1Fighter || p2Fighter) && (
          <div className="grid grid-cols-2 gap-4">
            {p1Fighter ? (
              <SelectedFighterDetail fighter={p1Fighter} slot="P1" />
            ) : (
              <div className="rounded-xl border border-blue-900/40 bg-blue-950/10 p-4 flex items-center justify-center">
                <span className="text-blue-800 font-mono text-sm">Select Player 1</span>
              </div>
            )}
            {p2Fighter ? (
              <SelectedFighterDetail fighter={p2Fighter} slot="P2" />
            ) : (
              <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-4 flex items-center justify-center">
                <span className="text-red-800 font-mono text-sm">Select Player 2</span>
              </div>
            )}
          </div>
        )}

        {/* Start Match button */}
        {p1Fighter && p2Fighter && (
          <div className="flex justify-center">
            <button
              onClick={handleStartMatch}
              className="px-12 py-3 bg-yellow-400 text-black font-black font-mono text-lg rounded-xl hover:bg-yellow-300 transition-colors tracking-widest uppercase shadow-lg shadow-yellow-900/40"
            >
              Start Match
            </button>
          </div>
        )}

        {/* Faction filter */}
        <div className="flex gap-2 flex-wrap">
          {factions.map(faction => (
            <button
              key={faction}
              onClick={() => setFilterFaction(faction)}
              className={`px-3 py-1 text-xs font-mono rounded uppercase tracking-wide transition-colors ${
                filterFaction === faction
                  ? 'bg-yellow-500 text-black font-bold' :'text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-white'
              }`}
            >
              {faction === 'all' ? `All (${fighters.length})` : faction}
            </button>
          ))}
        </div>

        {/* Fighter grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredFighters.map(fighter => (
            <FighterCard
              key={fighter.id}
              fighter={fighter}
              slot={fighter.id === p1Id ? 'p1' : fighter.id === p2Id ? 'p2' : null}
              selected={fighter.id === p1Id || fighter.id === p2Id}
              onClick={() => handleFighterClick(fighter)}
              onCustomize={() => openCustomizer(fighter.id)}
            />
          ))}
        </div>

        {/* Roster info */}
        <div className="text-center text-xs text-gray-700 font-mono pb-4">
          {fighters.length} characters — Bannon Roster (github.com/mhvnsnt/Bannon) ·
          Moves sourced from Schwarzerblitz open-source engine &amp; BrutalfistbaseofTekken3Recompiled
        </div>
      </div>

      {/* Move Set Customizer Modal */}
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
