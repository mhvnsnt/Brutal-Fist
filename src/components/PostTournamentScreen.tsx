'use client';

import React, { useState } from 'react';
import { type BannonFighterProfile } from '../data/bannonRoster';
import { type RoundResult, type CumulativeStats } from './TournamentBracket';


interface PostTournamentScreenProps {
  playerFighter: BannonFighterProfile;
  results: RoundResult[];
  stats: CumulativeStats;
  isChampion: boolean;
  rankPointsEarned: number;
  rankTier: string;
  onMainMenu: () => void;
  onPlayAgain: () => void;
}

const FACTION_COLOR: Record<string, string> = {
  alliance:    '#1d4ed8',
  corporate:   '#dc2626',
  chaos:       '#7c3aed',
  independent: '#d97706',
};

const RANK_TIERS = [
  { tier: 'BRONZE',   min: 0,   color: '#cd7f32' },
  { tier: 'SILVER',   min: 100, color: '#94a3b8' },
  { tier: 'GOLD',     min: 250, color: '#facc15' },
  { tier: 'PLATINUM', min: 500, color: '#67e8f9' },
  { tier: 'DIAMOND',  min: 800, color: '#a78bfa' },
  { tier: 'LEGEND',   min: 1200, color: '#f97316' },
];

function getRankColor(tier: string): string {
  return RANK_TIERS.find(r => r.tier === tier.toUpperCase())?.color ?? '#94a3b8';
}

/** Compute earned rewards based on performance */
function computeRewards(stats: CumulativeStats, isChampion: boolean, rankPointsEarned: number): Array<{ label: string; value: string; color: string }> {
  const rewards: Array<{ label: string; value: string; color: string }> = [];

  rewards.push({ label: 'RANK POINTS', value: `+${rankPointsEarned} RP`, color: '#facc15' });

  if (isChampion) {
    rewards.push({ label: 'CHAMPION TITLE', value: 'BRUTAL FIST CHAMPION', color: '#facc15' });
    rewards.push({ label: 'COSMETIC UNLOCK', value: 'GOLD AURA EFFECT', color: '#fbbf24' });
  }

  if (stats.wins >= 5) {
    rewards.push({ label: 'MASTERY BONUS', value: `${stats.wins}× WIN BADGE`, color: '#4ade80' });
  }

  if (stats.currentStreak >= 3) {
    rewards.push({ label: 'STREAK BONUS', value: `${stats.currentStreak}× STREAK TITLE`, color: '#f97316' });
  }

  const aiRounds = 0; // placeholder — could count aiResolved rounds
  if (stats.totalRounds >= 7) {
    rewards.push({ label: 'ENDURANCE BADGE', value: 'FULL BRACKET CLEARED', color: '#67e8f9' });
  }

  return rewards;
}

export default function PostTournamentScreen({
  playerFighter,
  results,
  stats,
  isChampion,
  rankPointsEarned,
  rankTier,
  onMainMenu,
  onPlayAgain,
}: PostTournamentScreenProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'bracket' | 'rewards'>('summary');
  const playerColor = FACTION_COLOR[playerFighter.factionAlignment];
  const rankColor = getRankColor(rankTier);
  const rewards = computeRewards(stats, isChampion, rankPointsEarned);

  const winRate = stats.totalRounds > 0
    ? Math.round((stats.wins / stats.totalRounds) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col font-mono overflow-hidden">
      {/* Atmosphere */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: isChampion
          ? 'radial-gradient(ellipse at 50% 0%, #facc1518 0%, transparent 60%)'
          : 'radial-gradient(ellipse at 50% 0%, #dc262618 0%, transparent 60%)',
      }} />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)',
      }} />

      {/* Header */}
      <div className="relative z-10 flex-shrink-0 border-b border-zinc-900 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[8px] tracking-[0.5em] text-zinc-600">TOURNAMENT COMPLETE</div>
            <div className="mt-1 text-2xl font-black tracking-widest"
              style={{ color: isChampion ? '#facc15' : '#ef4444', textShadow: `0 0 20px currentColor` }}
            >
              {isChampion ? '👑 CHAMPION' : 'ELIMINATED'}
            </div>
            <div className="mt-1 text-sm font-black" style={{ color: playerColor }}>
              {playerFighter.name.toUpperCase()}
            </div>
          </div>
          {/* Rank badge */}
          <div className="text-right">
            <div className="text-[7px] tracking-widest text-zinc-600">NEW RANK</div>
            <div className="text-xl font-black mt-0.5" style={{ color: rankColor }}>{rankTier}</div>
            <div className="text-[8px] mt-0.5" style={{ color: rankColor }}>+{rankPointsEarned} RP</div>
          </div>
        </div>

        {/* Quick stats row */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-green-400">{stats.wins}</div>
            <div className="text-[7px] text-zinc-600">WINS</div>
          </div>
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-red-400">{stats.losses}</div>
            <div className="text-[7px] text-zinc-600">LOSSES</div>
          </div>
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-zinc-400">{stats.draws}</div>
            <div className="text-[7px] text-zinc-600">DRAWS</div>
          </div>
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-yellow-400">{winRate}%</div>
            <div className="text-[7px] text-zinc-600">WIN RATE</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex-shrink-0 flex border-b border-zinc-900">
        {(['summary', 'bracket', 'rewards'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 text-[9px] tracking-[0.3em] font-black transition-all"
            style={{
              color: activeTab === tab ? '#fff' : '#52525b',
              borderBottom: activeTab === tab ? `2px solid ${playerColor}` : '2px solid transparent',
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">

        {/* SUMMARY TAB */}
        {activeTab === 'summary' && (
          <div className="space-y-4">
            {/* Match-by-match summary */}
            <div>
              <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">MATCH SUMMARY</div>
              <div className="space-y-2">
                {results.map((r, i) => {
                  const oppColor = FACTION_COLOR[r.opponent.factionAlignment];
                  return (
                    <div key={i} className="flex items-center gap-3 border border-zinc-900 px-3 py-2"
                      style={{ background: r.playerWon ? '#4ade8008' : r.winner === 'draw' ? '#94a3b808' : '#f8717108' }}
                    >
                      <div className="text-[8px] text-zinc-600 w-10">RND {r.round}</div>
                      <div className="flex-1">
                        <div className="text-[9px] font-black" style={{ color: oppColor }}>
                          vs {r.opponent.name.toUpperCase()}
                        </div>
                        <div className="text-[7px] text-zinc-600">{r.opponent.fightingStyle.split('.')[0]}</div>
                      </div>
                      {/* Damage bars */}
                      {r.playerDamage !== undefined && r.opponentDamage !== undefined && (
                        <div className="flex flex-col gap-0.5 w-24">
                          <div className="flex items-center gap-1">
                            <div className="text-[6px] text-zinc-600 w-6">YOU</div>
                            <div className="flex-1 h-1 bg-zinc-900">
                              <div className="h-full bg-green-500" style={{ width: `${Math.min(100, (r.playerDamage / 200) * 100)}%` }} />
                            </div>
                            <div className="text-[6px] text-zinc-500 w-6 text-right">{r.playerDamage}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="text-[6px] text-zinc-600 w-6">OPP</div>
                            <div className="flex-1 h-1 bg-zinc-900">
                              <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (r.opponentDamage / 200) * 100)}%` }} />
                            </div>
                            <div className="text-[6px] text-zinc-500 w-6 text-right">{r.opponentDamage}</div>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-black"
                          style={{ color: r.playerWon ? '#4ade80' : r.winner === 'draw' ? '#94a3b8' : '#f87171' }}
                        >
                          {r.playerWon ? 'WIN' : r.winner === 'draw' ? 'DRAW' : 'LOSS'}
                        </span>
                        {r.aiResolved && <span className="text-[7px] text-zinc-700">⚡</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Fighter stats used */}
            <div>
              <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">YOUR FIGHTER STATS</div>
              <div className="border border-zinc-900 p-3 space-y-2">
                {[
                  { label: 'STRENGTH', value: playerFighter.strength, color: '#ef4444' },
                  { label: 'SPEED', value: playerFighter.speed, color: '#3b82f6' },
                  { label: 'POISE', value: playerFighter.poise, color: '#a78bfa' },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className="text-[8px] text-zinc-500 w-20">{s.label}</span>
                    <div className="flex-1 h-1.5 bg-zinc-900">
                      <div className="h-full transition-all" style={{ width: `${s.value}%`, background: s.color }} />
                    </div>
                    <span className="text-[8px] font-black w-6 text-right" style={{ color: s.color }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BRACKET TAB */}
        {activeTab === 'bracket' && (
          <div className="space-y-4">
            <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">FINAL BRACKET OUTCOME</div>

            {/* Visual bracket */}
            <div className="space-y-2">
              {results.map((r, i) => {
                const oppColor = FACTION_COLOR[r.opponent.factionAlignment];
                const isLast = i === results.length - 1;
                return (
                  <div key={i} className="relative">
                    <div className="flex items-stretch gap-0">
                      {/* Round label */}
                      <div className="w-14 flex items-center justify-center text-[7px] text-zinc-700 border-r border-zinc-900 pr-2">
                        RND {r.round}
                      </div>
                      {/* Match card */}
                      <div className="flex-1 border border-zinc-900 ml-2 p-2"
                        style={{
                          borderLeftColor: r.playerWon ? '#4ade80' : r.winner === 'draw' ? '#94a3b8' : '#f87171',
                          borderLeftWidth: 2,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[9px] font-black" style={{ color: playerColor }}>{playerFighter.name.toUpperCase()}</div>
                            <div className="text-[7px] text-zinc-600">{playerFighter.factionAlignment.toUpperCase()}</div>
                          </div>
                          <div className="text-[8px] font-black text-zinc-600">VS</div>
                          <div className="text-right">
                            <div className="text-[9px] font-black" style={{ color: oppColor }}>{r.opponent.name.toUpperCase()}</div>
                            <div className="text-[7px] text-zinc-600">{r.opponent.factionAlignment.toUpperCase()}</div>
                          </div>
                        </div>
                        <div className="mt-1 text-center">
                          <span className="text-[8px] font-black"
                            style={{ color: r.playerWon ? '#4ade80' : r.winner === 'draw' ? '#94a3b8' : '#f87171' }}
                          >
                            {r.playerWon ? '▶ PLAYER WINS' : r.winner === 'draw' ? '— DRAW' : '✕ OPPONENT WINS'}
                          </span>
                          {r.aiResolved && <span className="ml-2 text-[7px] text-zinc-700">⚡ SIMULATED</span>}
                        </div>
                      </div>
                    </div>
                    {/* Connector line */}
                    {!isLast && (
                      <div className="absolute left-14 top-full w-0.5 h-2 bg-zinc-900" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Final outcome */}
            <div className="border-2 p-4 text-center mt-4"
              style={{ borderColor: isChampion ? '#facc15' : '#ef4444', background: isChampion ? '#facc1508' : '#ef444408' }}
            >
              <div className="text-[8px] tracking-widest text-zinc-500 mb-1">FINAL OUTCOME</div>
              <div className="text-2xl font-black" style={{ color: isChampion ? '#facc15' : '#ef4444' }}>
                {isChampion ? '👑 TOURNAMENT CHAMPION' : '✕ ELIMINATED'}
              </div>
              <div className="text-[9px] text-zinc-500 mt-1">
                {stats.wins}W · {stats.losses}L · {stats.draws}D across {stats.totalRounds} rounds
              </div>
            </div>
          </div>
        )}

        {/* REWARDS TAB */}
        {activeTab === 'rewards' && (
          <div className="space-y-4">
            <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">EARNED REWARDS</div>

            {/* Rank change */}
            <div className="border border-zinc-900 p-4" style={{ background: `${rankColor}08` }}>
              <div className="text-[8px] tracking-widest text-zinc-600 mb-2">RANK PROGRESSION</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[8px] text-zinc-600">NEW TIER</div>
                  <div className="text-2xl font-black mt-0.5" style={{ color: rankColor }}>{rankTier}</div>
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-zinc-600">POINTS EARNED</div>
                  <div className="text-2xl font-black text-yellow-400 mt-0.5">+{rankPointsEarned}</div>
                </div>
              </div>
              {/* Tier progress bar */}
              <div className="mt-3">
                <div className="flex justify-between text-[7px] text-zinc-700 mb-1">
                  {RANK_TIERS.map(r => (
                    <span key={r.tier} style={{ color: r.tier === rankTier.toUpperCase() ? rankColor : '#3f3f46' }}>
                      {r.tier.slice(0, 3)}
                    </span>
                  ))}
                </div>
                <div className="h-1.5 bg-zinc-900 relative">
                  <div className="absolute left-0 top-0 h-full transition-all duration-700"
                    style={{
                      width: `${Math.min(100, (rankPointsEarned / 1200) * 100)}%`,
                      background: `linear-gradient(90deg, #facc15, ${rankColor})`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Reward items */}
            <div className="space-y-2">
              {rewards.map((reward, i) => (
                <div key={i} className="flex items-center gap-3 border border-zinc-900 px-3 py-3"
                  style={{ background: `${reward.color}08` }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: reward.color }} />
                  <div className="flex-1">
                    <div className="text-[8px] text-zinc-500">{reward.label}</div>
                    <div className="text-[10px] font-black mt-0.5" style={{ color: reward.color }}>{reward.value}</div>
                  </div>
                  <div className="text-[8px] text-zinc-700">UNLOCKED</div>
                </div>
              ))}
            </div>

            {/* Season progression note */}
            <div className="border border-zinc-900 p-3 text-center">
              <div className="text-[7px] tracking-widest text-zinc-700">SEASON PROGRESSION</div>
              <div className="text-[9px] text-zinc-500 mt-1">
                {stats.wins} tournament wins recorded · {isChampion ? 'Champion badge earned' : 'Keep fighting to earn champion status'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="relative z-10 flex-shrink-0 border-t border-zinc-900 p-4 flex gap-3">
        <button
          onClick={onPlayAgain}
          className="flex-1 border-2 border-yellow-400 py-3 text-xs font-black tracking-widest text-yellow-400 hover:bg-yellow-400 hover:text-black transition-all"
        >
          PLAY AGAIN
        </button>
        <button
          onClick={onMainMenu}
          className="flex-1 border border-zinc-700 py-3 text-xs font-black tracking-widest text-zinc-400 hover:bg-white hover:text-black transition-all"
        >
          MAIN MENU
        </button>
      </div>
    </div>
  );
}
