'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { statsService, type Tournament, TIER_COLOR, TIER_LABEL } from '../lib/statsService';
import { type BannonFighterProfile, BANNON_ROSTER } from '../data/bannonRoster';
import dynamic from 'next/dynamic';

const TournamentBracket = dynamic(() => import('./TournamentBracket'), { ssr: false });

type TournamentTier = 'all' | 'rookie' | 'challenger' | 'elite' | 'legend';

interface TournamentBrowserProps {
  onBack: () => void;
}

const TIER_ORDER: Record<string, number> = { rookie: 0, challenger: 1, elite: 2, legend: 3 };

const TIER_DESC: Record<string, string> = {
  rookie: 'Entry-level bracket. Perfect for new fighters.',
  challenger: 'Mid-tier chaos. Tougher opponents, bigger rewards.',
  elite: 'Elite fighters only. Seven rounds of punishment.',
  legend: 'The pinnacle. Only legends compete here.',
};

function TournamentCard({
  tournament,
  onEnter,
}: {
  tournament: Tournament;
  onEnter: (t: Tournament) => void;
}) {
  const color = TIER_COLOR[tournament.tier] ?? '#94a3b8';
  return (
    <div
      className="border p-4 transition-all cursor-pointer group"
      style={{ borderColor: '#27272a', background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = color; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = '#27272a'; }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-white tracking-wider">{tournament.name.toUpperCase()}</div>
          <div className="text-[8px] text-zinc-500 mt-1">{tournament.description}</div>
        </div>
        <div
          className="ml-3 shrink-0 border px-2 py-1 text-[8px] font-black tracking-widest"
          style={{ color, borderColor: color, background: `${color}15` }}
        >
          {TIER_LABEL[tournament.tier] ?? tournament.tier.toUpperCase()}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <div className="text-base font-black text-white">{tournament.maxRounds}</div>
          <div className="text-[7px] text-zinc-600">ROUNDS</div>
        </div>
        <div className="text-center">
          <div className="text-[8px] font-black text-zinc-400">{tournament.entryRankMin}–{tournament.entryRankMax}</div>
          <div className="text-[7px] text-zinc-600">RANK RANGE</div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[7px] text-zinc-600">ACTIVE</span>
        </div>
      </div>

      <button
        onClick={() => onEnter(tournament)}
        className="w-full border py-2.5 text-[9px] font-black tracking-widest transition-all"
        style={{ borderColor: color, color }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.background = color;
          (e.currentTarget as HTMLButtonElement).style.color = '#000';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = color;
        }}
      >
        ENTER TOURNAMENT →
      </button>
    </div>
  );
}

function FighterPicker({
  selected,
  onSelect,
}: {
  selected: BannonFighterProfile | null;
  onSelect: (f: BannonFighterProfile) => void;
}) {
  const FACTION_COLOR: Record<string, string> = {
    alliance: '#1d4ed8',
    corporate: '#dc2626',
    chaos: '#7c3aed',
    independent: '#d97706',
  };

  return (
    <div className="space-y-2">
      <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-3">SELECT YOUR FIGHTER</div>
      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
        {BANNON_ROSTER.map(f => {
          const color = FACTION_COLOR[f.factionAlignment];
          const isSelected = selected?.id === f.id;
          return (
            <button
              key={f.id}
              onClick={() => onSelect(f)}
              className="border p-2.5 text-left transition-all"
              style={{
                borderColor: isSelected ? color : '#27272a',
                background: isSelected ? `${color}20` : 'transparent',
              }}
            >
              <div className="text-[9px] font-black" style={{ color: isSelected ? color : '#a1a1aa' }}>
                {f.name.toUpperCase()}
              </div>
              <div className="text-[7px] text-zinc-600 mt-0.5 truncate">{f.role.split('/')[0].trim()}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TournamentBrowserScreen({ onBack }: TournamentBrowserProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TournamentTier>('all');
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [selectedFighter, setSelectedFighter] = useState<BannonFighterProfile | null>(null);
  const [phase, setPhase] = useState<'browse' | 'pick_fighter' | 'in_bracket'>('browse');

  const loadTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await statsService.getTournaments();
      setTournaments(data);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load tournaments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTournaments(); }, [loadTournaments]);

  const filtered = tournaments
    .filter(t => tierFilter === 'all' || t.tier === tierFilter)
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 0) - (TIER_ORDER[b.tier] ?? 0));

  const handleEnterTournament = (t: Tournament) => {
    setSelectedTournament(t);
    setPhase('pick_fighter');
  };

  const handleStartBracket = () => {
    if (!selectedFighter) return;
    setPhase('in_bracket');
  };

  // ── In-bracket phase ──────────────────────────────────────────────────────────
  if (phase === 'in_bracket' && selectedFighter) {
    return (
      <TournamentBracket
        playerFighter={selectedFighter}
        onExit={() => {
          setPhase('browse');
          setSelectedTournament(null);
          setSelectedFighter(null);
        }}
      />
    );
  }

  // ── Fighter picker phase ──────────────────────────────────────────────────────
  if (phase === 'pick_fighter' && selectedTournament) {
    const color = TIER_COLOR[selectedTournament.tier] ?? '#94a3b8';
    return (
      <div className="fixed inset-0 bg-black text-white font-mono overflow-hidden flex flex-col">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}18 0%, #000 65%)` }}
        />

        <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800/60 shrink-0">
          <div>
            <div className="text-[8px] tracking-[0.5em] text-zinc-600">TOURNAMENT ENTRY</div>
            <div className="text-xl font-black tracking-widest mt-0.5" style={{ color }}>
              {selectedTournament.name.toUpperCase()}
            </div>
          </div>
          <button
            onClick={() => setPhase('browse')}
            className="text-[9px] tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors border border-zinc-800 px-3 py-1.5"
          >
            ← BACK
          </button>
        </div>

        <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Tournament info */}
          <div className="border border-zinc-800 p-4" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #111 100%)' }}>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-2xl font-black text-white">{selectedTournament.maxRounds}</div>
                <div className="text-[7px] text-zinc-600">ROUNDS</div>
              </div>
              <div className="flex-1">
                <div className="text-[8px] text-zinc-400">{TIER_DESC[selectedTournament.tier]}</div>
              </div>
              <div
                className="border px-2 py-1 text-[8px] font-black tracking-widest"
                style={{ color, borderColor: color }}
              >
                {TIER_LABEL[selectedTournament.tier]}
              </div>
            </div>
          </div>

          {/* Fighter picker */}
          <div className="border border-zinc-800 p-4">
            <FighterPicker selected={selectedFighter} onSelect={setSelectedFighter} />
          </div>
        </div>

        {/* CTA */}
        <div className="relative z-10 px-5 pb-5 pt-3 border-t border-zinc-800/60 shrink-0">
          <button
            onClick={handleStartBracket}
            disabled={!selectedFighter}
            className="w-full border-2 py-4 text-sm font-black tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              borderColor: selectedFighter ? color : '#27272a',
              color: selectedFighter ? color : '#52525b',
            }}
            onMouseEnter={e => {
              if (!selectedFighter) return;
              (e.currentTarget as HTMLButtonElement).style.background = color;
              (e.currentTarget as HTMLButtonElement).style.color = '#000';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              (e.currentTarget as HTMLButtonElement).style.color = selectedFighter ? color : '#52525b';
            }}
          >
            {selectedFighter ? `ENTER WITH ${selectedFighter.name.toUpperCase()} →` : 'SELECT A FIGHTER FIRST'}
          </button>
        </div>
      </div>
    );
  }

  // ── Browse phase ──────────────────────────────────────────────────────────────
  const TIERS: { id: TournamentTier; label: string }[] = [
    { id: 'all', label: 'ALL' },
    { id: 'rookie', label: 'ROOKIE' },
    { id: 'challenger', label: 'CHALLENGER' },
    { id: 'elite', label: 'ELITE' },
    { id: 'legend', label: 'LEGEND' },
  ];

  return (
    <div className="fixed inset-0 bg-black text-white font-mono overflow-hidden flex flex-col">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, #1c1c2e 0%, #000 70%)' }}
      />
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px),
            repeating-linear-gradient(0deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 1px, transparent 1px, transparent 80px)`,
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3 border-b border-zinc-800/60 shrink-0">
        <div>
          <div className="text-[8px] tracking-[0.5em] text-zinc-600">BRUTAL FIST</div>
          <div className="text-xl font-black tracking-widest text-white mt-0.5">TOURNAMENTS</div>
        </div>
        <button
          onClick={onBack}
          className="text-[9px] tracking-widest text-zinc-600 hover:text-zinc-300 transition-colors border border-zinc-800 px-3 py-1.5"
        >
          ← BACK
        </button>
      </div>

      {/* Tier filter */}
      <div className="relative z-10 flex gap-1 px-5 py-3 border-b border-zinc-800/60 overflow-x-auto shrink-0">
        {TIERS.map(t => (
          <button
            key={t.id}
            onClick={() => setTierFilter(t.id)}
            className="shrink-0 border px-3 py-1.5 text-[8px] font-black tracking-widest transition-all"
            style={{
              borderColor: tierFilter === t.id
                ? (t.id === 'all' ? '#facc15' : TIER_COLOR[t.id] ?? '#facc15')
                : '#27272a',
              color: tierFilter === t.id
                ? (t.id === 'all' ? '#facc15' : TIER_COLOR[t.id] ?? '#facc15')
                : '#52525b',
              background: tierFilter === t.id
                ? `${t.id === 'all' ? '#facc15' : TIER_COLOR[t.id] ?? '#facc15'}15`
                : 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tournament list */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-[9px] tracking-widest text-zinc-600 animate-pulse">LOADING TOURNAMENTS...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-[9px] tracking-widest text-red-500">{error}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <div className="text-[9px] tracking-widest text-zinc-600">NO TOURNAMENTS AVAILABLE</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(t => (
              <TournamentCard key={t.id} tournament={t} onEnter={handleEnterTournament} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
