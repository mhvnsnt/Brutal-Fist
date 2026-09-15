'use client';

import React, { useState, useEffect } from 'react';
import { type BannonFighterProfile, BANNON_ROSTER } from '../data/bannonRoster';
import { useAuth } from '../contexts/AuthContext';
import { statsService, getRankTier } from '../lib/statsService';

interface PlayerProfileScreenProps {
  onBack: () => void;
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

/** Compute mastery level (1–10) from wins */
function getMasteryLevel(wins: number): number {
  return Math.min(10, 1 + Math.floor(wins / 3));
}

/** Compute unlocked cosmetics based on wins and mastery */
function getUnlockedCosmetics(wins: number, isChampion: boolean): Array<{ name: string; type: string; color: string; unlocked: boolean }> {
  return [
    { name: 'DEFAULT ATTIRE', type: 'OUTFIT', color: '#94a3b8', unlocked: true },
    { name: 'FACTION BANNER', type: 'BANNER', color: '#3b82f6', unlocked: wins >= 1 },
    { name: 'IRON FIST GLOVES', type: 'ACCESSORY', color: '#6b7280', unlocked: wins >= 3 },
    { name: 'BRUTAL AURA', type: 'EFFECT', color: '#ef4444', unlocked: wins >= 5 },
    { name: 'CHAMPION CROWN', type: 'TITLE', color: '#facc15', unlocked: isChampion },
    { name: 'GOLD AURA', type: 'EFFECT', color: '#fbbf24', unlocked: isChampion },
    { name: 'SHADOW ATTIRE', type: 'OUTFIT', color: '#7c3aed', unlocked: wins >= 10 },
    { name: 'LEGEND BADGE', type: 'BADGE', color: '#f97316', unlocked: wins >= 20 },
  ];
}

/** Season achievements */
function getSeasonAchievements(wins: number, losses: number, draws: number, isChampion: boolean, streak: number): Array<{ name: string; desc: string; color: string; earned: boolean }> {
  return [
    { name: 'FIRST BLOOD', desc: 'Win your first tournament match', color: '#ef4444', earned: wins >= 1 },
    { name: 'ON A ROLL', desc: 'Win 3 matches in a row', color: '#f97316', earned: streak >= 3 },
    { name: 'IRON WILL', desc: 'Complete 5 tournament rounds', color: '#94a3b8', earned: wins + losses + draws >= 5 },
    { name: 'DOMINANT', desc: 'Win 10 tournament matches', color: '#facc15', earned: wins >= 10 },
    { name: 'CHAMPION', desc: 'Win a full tournament bracket', color: '#facc15', earned: isChampion },
    { name: 'VETERAN', desc: 'Play 20 total rounds', color: '#67e8f9', earned: wins + losses + draws >= 20 },
    { name: 'UNSTOPPABLE', desc: 'Achieve a 5-match win streak', color: '#a78bfa', earned: streak >= 5 },
    { name: 'LEGEND', desc: 'Win 25 tournament matches', color: '#f97316', earned: wins >= 25 },
  ];
}

interface FighterStatRow {
  fighterId: string;
  fighterName: string;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  tournamentWon: boolean;
}

export default function PlayerProfileScreen({ onBack }: PlayerProfileScreenProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'career' | 'mastery' | 'cosmetics' | 'season'>('career');
  const [fighterStats, setFighterStats] = useState<FighterStatRow[]>([]);
  const [rankPoints, setRankPoints] = useState(0);
  const [rankTier, setRankTier] = useState('BRONZE');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    Promise.all([
      statsService.getFighterStats(user.id),
      statsService.getCurrentRank(user.id),
    ]).then(([fs, rank]) => {
      // Map FighterStat[] to FighterStatRow[]
      const rows: FighterStatRow[] = (fs ?? []).map((f: any) => ({
        fighterId: f.fighterId,
        fighterName: f.fighterName,
        wins: f.totalWins ?? 0,
        losses: f.totalLosses ?? 0,
        draws: f.totalDraws ?? 0,
        streak: f.bestStreak ?? 0,
        tournamentWon: f.tournamentsWon > 0,
      }));
      setFighterStats(rows);
      if (rank) {
        setRankPoints((rank as any).rankPoints ?? 0);
        setRankTier((rank as any).rankTier ?? getRankTier((rank as any).rankPoints ?? 0));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.id]);

  // Aggregate career totals
  const totalWins = fighterStats.reduce((s, f) => s + (f.wins ?? 0), 0);
  const totalLosses = fighterStats.reduce((s, f) => s + (f.losses ?? 0), 0);
  const totalDraws = fighterStats.reduce((s, f) => s + (f.draws ?? 0), 0);
  const totalRounds = totalWins + totalLosses + totalDraws;
  const winRate = totalRounds > 0 ? Math.round((totalWins / totalRounds) * 100) : 0;
  const isChampion = fighterStats.some(f => f.tournamentWon);
  const maxStreak = fighterStats.reduce((m, f) => Math.max(m, f.streak ?? 0), 0);
  const rankColor = getRankColor(rankTier);

  const cosmetics = getUnlockedCosmetics(totalWins, isChampion);
  const achievements = getSeasonAchievements(totalWins, totalLosses, totalDraws, isChampion, maxStreak);
  const unlockedCount = cosmetics.filter(c => c.unlocked).length;
  const earnedCount = achievements.filter(a => a.earned).length;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono">
        <div className="text-[9px] tracking-[0.45em] text-zinc-600 animate-pulse">LOADING PROFILE...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col font-mono overflow-hidden">
      {/* Atmosphere */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 50% 0%, ${rankColor}12 0%, transparent 55%)`,
      }} />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)',
      }} />

      {/* Header */}
      <div className="relative z-10 flex-shrink-0 border-b border-zinc-900 px-5 pt-5 pb-4">
        <button onClick={onBack} className="text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors mb-3">
          ← BACK
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[8px] tracking-[0.5em] text-zinc-600">PLAYER PROFILE</div>
            <div className="mt-1 text-xl font-black tracking-widest text-white">
              {user?.email ? user.email.split('@')[0].toUpperCase() : 'FIGHTER'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[7px] tracking-widest text-zinc-600">RANK</div>
            <div className="text-xl font-black mt-0.5" style={{ color: rankColor }}>{rankTier}</div>
            <div className="text-[8px] text-zinc-600 mt-0.5">{rankPoints} RP</div>
          </div>
        </div>

        {/* Career summary row */}
        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-green-400">{totalWins}</div>
            <div className="text-[7px] text-zinc-600">WINS</div>
          </div>
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-red-400">{totalLosses}</div>
            <div className="text-[7px] text-zinc-600">LOSSES</div>
          </div>
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-yellow-400">{winRate}%</div>
            <div className="text-[7px] text-zinc-600">WIN RATE</div>
          </div>
          <div className="border border-zinc-900 py-2">
            <div className="text-xl font-black text-zinc-400">{totalRounds}</div>
            <div className="text-[7px] text-zinc-600">ROUNDS</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex-shrink-0 flex border-b border-zinc-900">
        {(['career', 'mastery', 'cosmetics', 'season'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-3 text-[8px] tracking-[0.2em] font-black transition-all"
            style={{
              color: activeTab === tab ? '#fff' : '#52525b',
              borderBottom: activeTab === tab ? `2px solid ${rankColor}` : '2px solid transparent',
            }}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">

        {/* CAREER TAB */}
        {activeTab === 'career' && (
          <div className="space-y-4">
            <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">CAREER RECORD</div>

            {/* Overall record */}
            <div className="border border-zinc-900 p-4 space-y-3">
              <div className="text-[8px] tracking-widest text-zinc-600">OVERALL</div>
              <div className="flex items-center gap-3">
                <div className="text-3xl font-black text-green-400">{totalWins}</div>
                <div className="text-zinc-700 font-black">-</div>
                <div className="text-3xl font-black text-red-400">{totalLosses}</div>
                <div className="text-zinc-700 font-black">-</div>
                <div className="text-3xl font-black text-zinc-500">{totalDraws}</div>
              </div>
              <div className="text-[8px] text-zinc-600">W - L - D</div>
              {/* Win rate bar */}
              <div className="mt-2">
                <div className="flex justify-between text-[7px] text-zinc-600 mb-1">
                  <span>WIN RATE</span><span>{winRate}%</span>
                </div>
                <div className="h-2 bg-zinc-900">
                  <div className="h-full bg-green-500 transition-all duration-700" style={{ width: `${winRate}%` }} />
                </div>
              </div>
            </div>

            {/* Per-fighter breakdown */}
            {fighterStats.length > 0 ? (
              <div>
                <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">PER FIGHTER</div>
                <div className="space-y-2">
                  {fighterStats.map((fs, i) => {
                    const fighter = BANNON_ROSTER.find(f => f.id === fs.fighterId);
                    const fColor = fighter ? FACTION_COLOR[fighter.factionAlignment] : '#94a3b8';
                    const fWinRate = (fs.wins + fs.losses + fs.draws) > 0
                      ? Math.round((fs.wins / (fs.wins + fs.losses + fs.draws)) * 100)
                      : 0;
                    return (
                      <div key={i} className="border border-zinc-900 px-3 py-2">
                        <div className="flex items-center justify-between mb-1">
                          <div className="text-[10px] font-black" style={{ color: fColor }}>{fs.fighterName.toUpperCase()}</div>
                          <div className="text-[8px] text-zinc-500">{fs.wins}W · {fs.losses}L · {fs.draws}D</div>
                        </div>
                        <div className="h-1 bg-zinc-900">
                          <div className="h-full transition-all" style={{ width: `${fWinRate}%`, background: fColor }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[7px] text-zinc-700">{fWinRate}% WIN RATE</span>
                          {fs.streak > 0 && <span className="text-[7px] text-yellow-600">{fs.streak}× STREAK</span>}
                          {fs.tournamentWon && <span className="text-[7px] text-yellow-400">👑 CHAMPION</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-700 text-[9px] tracking-widest">
                NO MATCH DATA YET<br />
                <span className="text-zinc-800">ENTER A TOURNAMENT TO BEGIN</span>
              </div>
            )}
          </div>
        )}

        {/* MASTERY TAB */}
        {activeTab === 'mastery' && (
          <div className="space-y-4">
            <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">FIGHTER MASTERY LEVELS</div>
            {BANNON_ROSTER.slice(0, 8).map((fighter) => {
              const fs = fighterStats.find(f => f.fighterId === fighter.id);
              const wins = fs?.wins ?? 0;
              const mastery = getMasteryLevel(wins);
              const fColor = FACTION_COLOR[fighter.factionAlignment];
              const nextLevelWins = mastery < 10 ? mastery * 3 : null;
              return (
                <div key={fighter.id} className="border border-zinc-900 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-[10px] font-black" style={{ color: fColor }}>{fighter.name.toUpperCase()}</div>
                      <div className="text-[7px] text-zinc-600">{fighter.fightingStyle.split('.')[0]}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black" style={{ color: fColor }}>LV {mastery}</div>
                      <div className="text-[7px] text-zinc-600">{wins} WINS</div>
                    </div>
                  </div>
                  {/* Mastery bar */}
                  <div className="flex gap-0.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div key={i} className="flex-1 h-2 transition-all"
                        style={{ background: i < mastery ? fColor : '#27272a' }}
                      />
                    ))}
                  </div>
                  {nextLevelWins !== null && (
                    <div className="text-[7px] text-zinc-700 mt-1">
                      {nextLevelWins - wins > 0 ? `${nextLevelWins - wins} more wins to LV ${mastery + 1}` : 'Level up ready!'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* COSMETICS TAB */}
        {activeTab === 'cosmetics' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[8px] tracking-[0.3em] text-zinc-600">UNLOCKED COSMETICS</div>
              <div className="text-[8px] text-zinc-500">{unlockedCount} / {cosmetics.length}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cosmetics.map((c, i) => (
                <div key={i} className="border p-3 transition-all"
                  style={{
                    borderColor: c.unlocked ? `${c.color}40` : '#27272a',
                    background: c.unlocked ? `${c.color}08` : 'transparent',
                    opacity: c.unlocked ? 1 : 0.4,
                  }}
                >
                  <div className="text-[7px] tracking-widest mb-1" style={{ color: c.unlocked ? c.color : '#52525b' }}>
                    {c.type}
                  </div>
                  <div className="text-[10px] font-black" style={{ color: c.unlocked ? '#fff' : '#52525b' }}>
                    {c.name}
                  </div>
                  <div className="mt-1 text-[7px]" style={{ color: c.unlocked ? c.color : '#3f3f46' }}>
                    {c.unlocked ? '✓ UNLOCKED' : '🔒 LOCKED'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEASON TAB */}
        {activeTab === 'season' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[8px] tracking-[0.3em] text-zinc-600">SEASON ACHIEVEMENTS</div>
              <div className="text-[8px] text-zinc-500">{earnedCount} / {achievements.length}</div>
            </div>

            {/* Season rank progress */}
            <div className="border border-zinc-900 p-4" style={{ background: `${rankColor}08` }}>
              <div className="text-[8px] tracking-widest text-zinc-600 mb-2">SEASON RANK</div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-2xl font-black" style={{ color: rankColor }}>{rankTier}</div>
                <div className="text-[9px] text-zinc-500">{rankPoints} RP</div>
              </div>
              <div className="flex justify-between text-[7px] text-zinc-700 mb-1">
                {RANK_TIERS.map(r => (
                  <span key={r.tier} style={{ color: r.tier === rankTier.toUpperCase() ? rankColor : '#3f3f46' }}>
                    {r.tier.slice(0, 3)}
                  </span>
                ))}
              </div>
              <div className="h-1.5 bg-zinc-900">
                <div className="h-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, (rankPoints / 1200) * 100)}%`,
                    background: `linear-gradient(90deg, #facc15, ${rankColor})`,
                  }}
                />
              </div>
            </div>

            {/* Achievement list */}
            <div className="space-y-2">
              {achievements.map((a, i) => (
                <div key={i} className="flex items-center gap-3 border p-3 transition-all"
                  style={{
                    borderColor: a.earned ? `${a.color}40` : '#27272a',
                    background: a.earned ? `${a.color}08` : 'transparent',
                    opacity: a.earned ? 1 : 0.5,
                  }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.earned ? a.color : '#3f3f46' }} />
                  <div className="flex-1">
                    <div className="text-[10px] font-black" style={{ color: a.earned ? '#fff' : '#52525b' }}>{a.name}</div>
                    <div className="text-[7px] text-zinc-600 mt-0.5">{a.desc}</div>
                  </div>
                  <div className="text-[8px] font-black" style={{ color: a.earned ? a.color : '#3f3f46' }}>
                    {a.earned ? '✓' : '○'}
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
