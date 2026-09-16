'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { getAllBannonFighters, type BannonFighterProfile } from '../data/bannonRoster';

// ── Types ─────────────────────────────────────────────────────────────────────
export type TierName = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'FINALS';

interface TierConfig {
  name: TierName;
  minElo: number;
  maxElo: number;
  color: string;
  bgColor: string;
  borderColor: string;
  reward: string;
  rewardType: 'skin' | 'effect' | 'bundle' | 'seasonal';
  icon: string;
}

const TIERS: TierConfig[] = [
  {
    name: 'BRONZE',
    minElo: 0,
    maxElo: 999,
    color: '#cd7f32',
    bgColor: '#1a0e00',
    borderColor: '#7c4a1a',
    reward: 'Bronze Faction Skin',
    rewardType: 'skin',
    icon: '🥉',
  },
  {
    name: 'SILVER',
    minElo: 1000,
    maxElo: 1499,
    color: '#c0c0c0',
    bgColor: '#111114',
    borderColor: '#6b6b6b',
    reward: 'Silver Impact Effect',
    rewardType: 'effect',
    icon: '🥈',
  },
  {
    name: 'GOLD',
    minElo: 1500,
    maxElo: 1999,
    color: '#ffd700',
    bgColor: '#1a1400',
    borderColor: '#8b7300',
    reward: 'Gold Aura Bundle',
    rewardType: 'bundle',
    icon: '🥇',
  },
  {
    name: 'PLATINUM',
    minElo: 2000,
    maxElo: 2499,
    color: '#e5e4e2',
    bgColor: '#0d1014',
    borderColor: '#5a6a7a',
    reward: 'Platinum Seasonal Cosmetic',
    rewardType: 'seasonal',
    icon: '💎',
  },
  {
    name: 'FINALS',
    minElo: 2500,
    maxElo: 9999,
    color: '#f59e0b',
    bgColor: '#1a0a00',
    borderColor: '#b45309',
    reward: 'Season Champion Skin + Title',
    rewardType: 'seasonal',
    icon: '🏆',
  },
];

// ── ELO calculation ───────────────────────────────────────────────────────────
function calcEloChange(winnerElo: number, loserElo: number, k = 32): number {
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return Math.round(k * (1 - expected));
}

function getTierForElo(elo: number): TierConfig {
  return TIERS.slice().reverse().find((t) => elo >= t.minElo) ?? TIERS[0];
}

// ── Bracket participant ───────────────────────────────────────────────────────
interface Participant {
  id: string;
  name: string;
  elo: number;
  tier: TierConfig;
  isPlayer: boolean;
  wins: number;
  losses: number;
  eliminated: boolean;
}

interface BracketMatch {
  id: string;
  round: number;
  p1: Participant;
  p2: Participant;
  winner: Participant | null;
  eloChange: number;
}

// ── Seed participants from roster ─────────────────────────────────────────────
function buildParticipants(fighters: BannonFighterProfile[], playerFighterId: string): Participant[] {
  return fighters.slice(0, 8).map((f, i) => {
    // Assign varied ELO based on fighter stats for seeding
    const baseElo = 800 + (f.strength + f.speed + f.defense) * 12 + i * 40;
    const tier = getTierForElo(baseElo);
    return {
      id: f.id,
      name: f.name,
      elo: baseElo,
      tier,
      isPlayer: f.id === playerFighterId,
      wins: 0,
      losses: 0,
      eliminated: false,
    };
  });
}

// ── Build initial bracket (8-player single elimination) ───────────────────────
function buildBracket(participants: Participant[]): BracketMatch[][] {
  // Sort by ELO descending (seeding)
  const seeded = [...participants].sort((a, b) => b.elo - a.elo);
  // Pair 1v8, 2v7, 3v6, 4v5 (standard bracket seeding)
  const qf: BracketMatch[] = [
    { id: 'qf1', round: 1, p1: seeded[0], p2: seeded[7], winner: null, eloChange: 0 },
    { id: 'qf2', round: 1, p1: seeded[1], p2: seeded[6], winner: null, eloChange: 0 },
    { id: 'qf3', round: 1, p1: seeded[2], p2: seeded[5], winner: null, eloChange: 0 },
    { id: 'qf4', round: 1, p1: seeded[3], p2: seeded[4], winner: null, eloChange: 0 },
  ];
  return [qf];
}

// ── Simulate a match result ───────────────────────────────────────────────────
function simulateMatch(match: BracketMatch): BracketMatch {
  // Player always wins their match (for demo); AI vs AI uses ELO probability
  let winner: Participant;
  if (match.p1.isPlayer || match.p2.isPlayer) {
    winner = match.p1.isPlayer ? match.p1 : match.p2;
  } else {
    const p1WinProb = 1 / (1 + Math.pow(10, (match.p2.elo - match.p1.elo) / 400));
    winner = Math.random() < p1WinProb ? match.p1 : match.p2;
  }
  const loser = winner === match.p1 ? match.p2 : match.p1;
  const change = calcEloChange(winner.elo, loser.elo);
  winner.wins += 1;
  loser.losses += 1;
  loser.eliminated = true;
  winner.elo += change;
  loser.elo = Math.max(0, loser.elo - change);
  winner.tier = getTierForElo(winner.elo);
  loser.tier = getTierForElo(loser.elo);
  return { ...match, winner, eloChange: change };
}

// ── Advance bracket to next round ─────────────────────────────────────────────
function advanceRound(rounds: BracketMatch[][]): BracketMatch[][] {
  const lastRound = rounds[rounds.length - 1];
  if (lastRound.some((m) => !m.winner)) return rounds; // incomplete round
  const winners = lastRound.map((m) => m.winner!);
  if (winners.length === 1) return rounds; // tournament over
  const nextRound: BracketMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (winners[i + 1]) {
      nextRound.push({
        id: `r${rounds.length + 1}m${i / 2 + 1}`,
        round: rounds.length + 1,
        p1: winners[i],
        p2: winners[i + 1],
        winner: null,
        eloChange: 0,
      });
    }
  }
  return [...rounds, nextRound];
}

// ── Cosmetic reward banner ────────────────────────────────────────────────────
function RewardBanner({ tier, visible }: { tier: TierConfig; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="fixed inset-x-4 top-20 z-50 border-2 p-4 font-mono text-center animate-bounce"
      style={{
        borderColor: tier.color,
        background: `${tier.bgColor}ee`,
        boxShadow: `0 0 30px ${tier.color}66`,
      }}
    >
      <div className="text-2xl mb-1">{tier.icon}</div>
      <div className="text-[8px] tracking-[0.5em]" style={{ color: tier.color }}>
        TIER REWARD UNLOCKED
      </div>
      <div className="text-base font-black tracking-widest text-white mt-1">{tier.reward}</div>
      <div className="text-[7px] tracking-widest text-zinc-500 mt-1 uppercase">
        {tier.rewardType} · {tier.name} TIER
      </div>
    </div>
  );
}

// ── Match card ────────────────────────────────────────────────────────────────
function MatchCard({
  match,
  onSimulate,
  isActive,
}: {
  match: BracketMatch;
  onSimulate: (matchId: string) => void;
  isActive: boolean;
}) {
  const p1Won = match.winner?.id === match.p1.id;
  const p2Won = match.winner?.id === match.p2.id;

  return (
    <div
      className="border font-mono overflow-hidden transition-all duration-200"
      style={{
        borderColor: match.winner
          ? match.winner.tier.borderColor
          : isActive
          ? '#52525b' :'#27272a',
        background: '#0a0a0a',
      }}
    >
      {/* P1 row */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{
          borderColor: '#1a1a1a',
          background: p1Won ? `${match.p1.tier.bgColor}` : 'transparent',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[7px] tracking-widest text-zinc-600">
            {match.p1.tier.icon}
          </span>
          <span
            className="text-[10px] font-black tracking-wider"
            style={{ color: p1Won ? match.p1.tier.color : p1Won === false && match.winner ? '#52525b' : '#d4d4d8' }}
          >
            {match.p1.name.toUpperCase()}
          </span>
          {match.p1.isPlayer && (
            <span className="text-[6px] tracking-widest text-yellow-400 border border-yellow-800 px-1">YOU</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-zinc-600">{match.p1.elo}</span>
          {p1Won && <span className="text-[8px] text-green-400">+{match.eloChange}</span>}
          {!p1Won && match.winner && <span className="text-[8px] text-red-500">-{match.eloChange}</span>}
        </div>
      </div>

      {/* P2 row */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          background: p2Won ? `${match.p2.tier.bgColor}` : 'transparent',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[7px] tracking-widest text-zinc-600">
            {match.p2.tier.icon}
          </span>
          <span
            className="text-[10px] font-black tracking-wider"
            style={{ color: p2Won ? match.p2.tier.color : p2Won === false && match.winner ? '#52525b' : '#d4d4d8' }}
          >
            {match.p2.name.toUpperCase()}
          </span>
          {match.p2.isPlayer && (
            <span className="text-[6px] tracking-widest text-yellow-400 border border-yellow-800 px-1">YOU</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] text-zinc-600">{match.p2.elo}</span>
          {p2Won && <span className="text-[8px] text-green-400">+{match.eloChange}</span>}
          {!p2Won && match.winner && <span className="text-[8px] text-red-500">-{match.eloChange}</span>}
        </div>
      </div>

      {/* Simulate button */}
      {!match.winner && isActive && (
        <button
          onClick={() => onSimulate(match.id)}
          className="w-full py-1.5 text-[8px] tracking-[0.4em] font-black border-t border-zinc-800 text-yellow-400 hover:bg-yellow-400/10 transition-colors"
        >
          ▶ FIGHT
        </button>
      )}
      {match.winner && (
        <div
          className="w-full py-1 text-[7px] tracking-[0.4em] text-center border-t"
          style={{ borderColor: '#1a1a1a', color: match.winner.tier.color }}
        >
          {match.winner.name.toUpperCase()} ADVANCES
        </div>
      )}
    </div>
  );
}

// ── Tier progress bar ─────────────────────────────────────────────────────────
function TierProgressBar({ participant }: { participant: Participant | null }) {
  if (!participant) return null;
  const tier = participant.tier;
  const nextTier = TIERS[TIERS.indexOf(tier) + 1];
  const progress = nextTier
    ? ((participant.elo - tier.minElo) / (nextTier.minElo - tier.minElo)) * 100
    : 100;

  return (
    <div className="font-mono">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-base">{tier.icon}</span>
          <div>
            <div className="text-[8px] tracking-[0.4em]" style={{ color: tier.color }}>
              {tier.name} TIER
            </div>
            <div className="text-[7px] text-zinc-600">ELO: {participant.elo}</div>
          </div>
        </div>
        {nextTier && (
          <div className="text-right">
            <div className="text-[7px] text-zinc-600">NEXT: {nextTier.name}</div>
            <div className="text-[7px]" style={{ color: nextTier.color }}>
              {nextTier.minElo - participant.elo} ELO away
            </div>
          </div>
        )}
      </div>
      <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, progress)}%`, background: tier.color }}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface SeasonalTournamentScreenProps {
  onBack: () => void;
  playerFighterId?: string;
}

export default function SeasonalTournamentScreen({
  onBack,
  playerFighterId = 'bannon',
}: SeasonalTournamentScreenProps) {
  const fighters = getAllBannonFighters();
  const [participants] = useState<Participant[]>(() =>
    buildParticipants(fighters, playerFighterId)
  );
  const [rounds, setRounds] = useState<BracketMatch[][]>(() =>
    buildBracket(participants)
  );
  const [rewardTier, setRewardTier] = useState<TierConfig | null>(null);
  const [showReward, setShowReward] = useState(false);
  const [champion, setChampion] = useState<Participant | null>(null);
  const [activeTab, setActiveTab] = useState<'bracket' | 'tiers' | 'standings'>('bracket');

  const playerParticipant = useMemo(
    () => participants.find((p) => p.isPlayer) ?? null,
    [participants]
  );

  const currentRound = rounds[rounds.length - 1];
  const isRoundComplete = currentRound.every((m) => m.winner !== null);
  const tournamentOver = champion !== null;

  const handleSimulate = useCallback(
    (matchId: string) => {
      setRounds((prev) => {
        const updated = prev.map((round) =>
          round.map((m) => (m.id === matchId ? simulateMatch({ ...m }) : m))
        );
        return updated;
      });
    },
    []
  );

  const handleAdvanceRound = useCallback(() => {
    setRounds((prev) => {
      const advanced = advanceRound(prev);
      const lastRound = advanced[advanced.length - 1];
      // Check if tournament is over (1 match, 1 winner)
      if (advanced.length > prev.length && lastRound.length === 0) {
        // Finals winner
        const finalsMatch = prev[prev.length - 1][0];
        if (finalsMatch?.winner) {
          setChampion(finalsMatch.winner);
          // Grant reward if player won
          if (finalsMatch.winner.isPlayer) {
            const tier = getTierForElo(finalsMatch.winner.elo);
            setRewardTier(tier);
            setShowReward(true);
            setTimeout(() => setShowReward(false), 4000);
          }
        }
      }
      // Check if single match remains (finals)
      if (lastRound.length === 1 && !lastRound[0].winner) {
        // Check if player advanced to finals
        const finalsMatch = lastRound[0];
        if (finalsMatch.p1.isPlayer || finalsMatch.p2.isPlayer) {
          const playerTier = playerParticipant?.tier;
          if (playerTier && TIERS.indexOf(playerTier) >= TIERS.indexOf(TIERS[3])) {
            setRewardTier(playerTier);
            setShowReward(true);
            setTimeout(() => setShowReward(false), 3500);
          }
        }
      }
      return advanced;
    });
  }, [playerParticipant]);

  const roundLabels = ['QUARTER-FINALS', 'SEMI-FINALS', 'FINALS'];

  return (
    <div className="fixed inset-0 bg-[#080808] text-white font-mono flex flex-col overflow-hidden">
      {/* Reward banner */}
      {rewardTier && <RewardBanner tier={rewardTier} visible={showReward} />}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900 shrink-0">
        <button
          onClick={onBack}
          className="text-[9px] tracking-[0.4em] text-zinc-600 hover:text-white transition-colors"
        >
          ← BACK
        </button>
        <div className="text-center">
          <div className="text-[7px] tracking-[0.5em] text-zinc-600">SEASON 1</div>
          <div className="text-sm font-black tracking-[0.2em] text-yellow-400">BRUTAL FIST CHAMPIONSHIP</div>
        </div>
        <div className="text-[7px] tracking-widest text-zinc-700 text-right">
          ELO BRACKET
        </div>
      </div>

      {/* Player ELO bar */}
      {playerParticipant && (
        <div className="px-4 py-3 border-b border-zinc-900 bg-zinc-950 shrink-0">
          <TierProgressBar participant={playerParticipant} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-900 shrink-0">
        {(['bracket', 'tiers', 'standings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2.5 text-[8px] tracking-[0.4em] font-black transition-colors"
            style={{
              color: activeTab === tab ? '#f59e0b' : '#52525b',
              borderBottom: activeTab === tab ? '2px solid #f59e0b' : '2px solid transparent',
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── BRACKET TAB ── */}
        {activeTab === 'bracket' && (
          <div className="p-4 space-y-6">
            {tournamentOver && champion && (
              <div
                className="border-2 p-4 text-center"
                style={{
                  borderColor: '#f59e0b',
                  background: '#1a0a00',
                  boxShadow: '0 0 30px #f59e0b44',
                }}
              >
                <div className="text-2xl mb-1">🏆</div>
                <div className="text-[8px] tracking-[0.5em] text-yellow-600">SEASON CHAMPION</div>
                <div className="text-xl font-black tracking-widest text-yellow-400 mt-1">
                  {champion.name.toUpperCase()}
                </div>
                {champion.isPlayer && (
                  <div className="text-[8px] tracking-widest text-green-400 mt-2">
                    ✓ SEASON COSMETICS UNLOCKED
                  </div>
                )}
              </div>
            )}

            {rounds.map((round, rIdx) => (
              <div key={rIdx}>
                <div className="text-[8px] tracking-[0.5em] text-zinc-600 mb-3">
                  {roundLabels[rIdx] ?? `ROUND ${rIdx + 1}`}
                </div>
                <div className="space-y-2">
                  {round.map((match) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      onSimulate={handleSimulate}
                      isActive={rIdx === rounds.length - 1}
                    />
                  ))}
                </div>

                {/* Advance round button */}
                {rIdx === rounds.length - 1 && isRoundComplete && !tournamentOver && (
                  <button
                    onClick={handleAdvanceRound}
                    className="w-full mt-3 py-3 border-2 border-yellow-600 text-yellow-400 text-[9px] tracking-[0.4em] font-black hover:bg-yellow-400/10 transition-colors"
                  >
                    ADVANCE TO {roundLabels[rIdx + 1] ?? 'FINALS'} →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── TIERS TAB ── */}
        {activeTab === 'tiers' && (
          <div className="p-4 space-y-3">
            <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-4">
              CLIMB TIERS BY WINNING MATCHES. EACH TIER UNLOCKS EXCLUSIVE COSMETICS.
            </div>
            {TIERS.map((tier) => {
              const isCurrentTier = playerParticipant?.tier.name === tier.name;
              const isUnlocked = playerParticipant
                ? playerParticipant.elo >= tier.minElo
                : false;
              return (
                <div
                  key={tier.name}
                  className="border p-4 transition-all"
                  style={{
                    borderColor: isCurrentTier ? tier.color : tier.borderColor,
                    background: isCurrentTier ? tier.bgColor : '#0a0a0a',
                    boxShadow: isCurrentTier ? `0 0 20px ${tier.color}33` : 'none',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{tier.icon}</span>
                      <div>
                        <div
                          className="text-sm font-black tracking-widest"
                          style={{ color: tier.color }}
                        >
                          {tier.name}
                        </div>
                        <div className="text-[7px] text-zinc-600 mt-0.5">
                          {tier.minElo}–{tier.maxElo === 9999 ? '∞' : tier.maxElo} ELO
                        </div>
                      </div>
                    </div>
                    {isCurrentTier && (
                      <span
                        className="text-[6px] tracking-widest border px-2 py-0.5 shrink-0"
                        style={{ borderColor: tier.color, color: tier.color }}
                      >
                        CURRENT
                      </span>
                    )}
                    {!isCurrentTier && isUnlocked && (
                      <span className="text-[6px] tracking-widest text-green-500 border border-green-900 px-2 py-0.5 shrink-0">
                        CLEARED
                      </span>
                    )}
                  </div>

                  <div className="mt-3 border-t pt-3" style={{ borderColor: '#1a1a1a' }}>
                    <div className="text-[7px] tracking-[0.4em] text-zinc-600 mb-1">TIER REWARD</div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px]">
                        {tier.rewardType === 'skin' ? '👕' : tier.rewardType === 'effect' ? '✨' : tier.rewardType === 'bundle' ? '📦' : '🌟'}
                      </span>
                      <span
                        className="text-[9px] font-black tracking-wider"
                        style={{ color: isUnlocked ? tier.color : '#52525b' }}
                      >
                        {tier.reward}
                      </span>
                      {isUnlocked && (
                        <span className="text-[6px] text-green-400 ml-auto">✓ UNLOCKED</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── STANDINGS TAB ── */}
        {activeTab === 'standings' && (
          <div className="p-4">
            <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-4">
              CURRENT STANDINGS — ELO SEEDED
            </div>
            <div className="space-y-1">
              {[...participants]
                .sort((a, b) => b.elo - a.elo)
                .map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 px-3 py-2.5 border transition-all"
                    style={{
                      borderColor: p.isPlayer ? p.tier.borderColor : '#1f1f1f',
                      background: p.isPlayer ? p.tier.bgColor : '#0a0a0a',
                    }}
                  >
                    <div
                      className="text-[9px] font-black w-5 text-center"
                      style={{ color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : '#52525b' }}
                    >
                      {idx + 1}
                    </div>
                    <span className="text-base">{p.tier.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-black tracking-wider"
                          style={{ color: p.eliminated ? '#52525b' : p.isPlayer ? p.tier.color : '#d4d4d8' }}
                        >
                          {p.name.toUpperCase()}
                        </span>
                        {p.isPlayer && (
                          <span className="text-[6px] tracking-widest text-yellow-400 border border-yellow-800 px-1">YOU</span>
                        )}
                        {p.eliminated && (
                          <span className="text-[6px] tracking-widest text-red-800 border border-red-900 px-1">OUT</span>
                        )}
                      </div>
                      <div className="text-[7px] text-zinc-700 mt-0.5">
                        W:{p.wins} L:{p.losses}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-black" style={{ color: p.tier.color }}>
                        {p.elo}
                      </div>
                      <div className="text-[6px] text-zinc-700">ELO</div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
