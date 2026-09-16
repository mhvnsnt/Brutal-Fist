'use client';

import React, { useState, useEffect } from 'react';
import { type BannonFighterProfile, BANNON_ROSTER } from '../data/bannonRoster';
import { useAuth } from '../contexts/AuthContext';
import { statsService, getRankTier } from '../lib/statsService';
import { createClient } from '../lib/supabase/client';

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

function getMasteryLevel(wins: number): number {
  return Math.min(10, 1 + Math.floor(wins / 3));
}

// ── Rarity system ─────────────────────────────────────────────────────────────
type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
type CosmeticCategory = 'OUTFIT' | 'EFFECT' | 'BANNER' | 'ACCESSORY' | 'TITLE' | 'BADGE' | 'BUNDLE';

interface CosmeticItem {
  id: string;
  name: string;
  type: CosmeticCategory;
  rarity: Rarity;
  color: string;
  price: number;           // in Brutal Coins
  unlocked: boolean;
  purchased: boolean;
  milestoneReq?: string;   // e.g. "5 wins with Bannon"
  masteryReq?: number;     // mastery level required
  seasonal?: boolean;
  seasonTag?: string;
  bundleItems?: string[];  // for bundles
  description: string;
}

const RARITY_COLOR: Record<Rarity, string> = {
  COMMON:    '#94a3b8',
  RARE:      '#3b82f6',
  EPIC:      '#a855f7',
  LEGENDARY: '#facc15',
};

const RARITY_GLOW: Record<Rarity, string> = {
  COMMON:    'transparent',
  RARE:      'rgba(59,130,246,0.15)',
  EPIC:      'rgba(168,85,247,0.15)',
  LEGENDARY: 'rgba(250,204,21,0.15)',
};

// ── ELO / Matchmaking types ───────────────────────────────────────────────────
interface PlayerEloRow {
  fighterId: string;
  fighterName: string;
  eloRating: number;
  tier: string;
  wins: number;
  losses: number;
  draws: number;
  winStreak: number;
}

interface TierClimbEntry {
  id: string;
  fighterId: string;
  fighterName: string;
  fromTier: string;
  toTier: string;
  eloAtChange: number;
  direction: string;
  recordedAt: string;
}

interface H2HRecord {
  id: string;
  opponentId: string;
  opponentName: string;
  userFighterId: string;
  opponentFighterId: string;
  wins: number;
  losses: number;
  draws: number;
  lastPlayedAt: string;
}

interface CosmeticUnlockEntry {
  id: string;
  cosmeticId: string;
  cosmeticName: string;
  cosmeticType: string;
  rarity: string;
  unlockSource: string;
  unlockContext: string | null;
  unlockedAt: string;
}

const TIER_COLORS: Record<string, string> = {
  bronze: '#cd7f32',
  silver: '#94a3b8',
  gold: '#facc15',
  platinum: '#67e8f9',
  diamond: '#a78bfa',
  legend: '#f97316',
};

function buildMarketplace(totalWins: number, isChampion: boolean, masteryMap: Record<string, number>): CosmeticItem[] {
  const maxMastery = Math.max(0, ...Object.values(masteryMap));
  return [
    // ── COMMON ──
    {
      id: 'default_attire',
      name: 'DEFAULT ATTIRE',
      type: 'OUTFIT',
      rarity: 'COMMON',
      color: '#94a3b8',
      price: 0,
      unlocked: true,
      purchased: true,
      description: 'Standard issue fighter uniform.',
    },
    {
      id: 'faction_banner',
      name: 'FACTION BANNER',
      type: 'BANNER',
      rarity: 'COMMON',
      color: '#3b82f6',
      price: 200,
      unlocked: totalWins >= 1,
      purchased: totalWins >= 1,
      milestoneReq: '1 tournament win',
      description: 'Display your faction allegiance in the arena.',
    },
    {
      id: 'iron_gloves',
      name: 'IRON FIST GLOVES',
      type: 'ACCESSORY',
      rarity: 'COMMON',
      color: '#6b7280',
      price: 350,
      unlocked: totalWins >= 3,
      purchased: totalWins >= 3,
      milestoneReq: '3 tournament wins',
      description: 'Reinforced combat gloves for serious fighters.',
    },
    // ── RARE ──
    {
      id: 'brutal_aura',
      name: 'BRUTAL AURA',
      type: 'EFFECT',
      rarity: 'RARE',
      color: '#ef4444',
      price: 750,
      unlocked: totalWins >= 5,
      purchased: totalWins >= 5,
      milestoneReq: '5 tournament wins',
      description: 'A crimson energy field that pulses with every hit.',
    },
    {
      id: 'shadow_attire',
      name: 'SHADOW ATTIRE',
      type: 'OUTFIT',
      rarity: 'RARE',
      color: '#7c3aed',
      price: 900,
      unlocked: totalWins >= 10,
      purchased: totalWins >= 10,
      milestoneReq: '10 tournament wins',
      description: 'Dark tactical outfit worn by underground champions.',
    },
    {
      id: 'mastery_badge_3',
      name: 'VETERAN BADGE',
      type: 'BADGE',
      rarity: 'RARE',
      color: '#0ea5e9',
      price: 600,
      unlocked: maxMastery >= 3,
      purchased: maxMastery >= 3,
      masteryReq: 3,
      milestoneReq: 'Reach Mastery LV 3 with any fighter',
      description: 'Awarded to fighters who have mastered the basics.',
    },
    // ── EPIC ──
    {
      id: 'void_aura',
      name: 'VOID AURA',
      type: 'EFFECT',
      rarity: 'EPIC',
      color: '#8b5cf6',
      price: 1500,
      unlocked: totalWins >= 15,
      purchased: false,
      milestoneReq: '15 tournament wins',
      description: 'Dimensional rift energy — your strikes tear through reality.',
    },
    {
      id: 'mastery_outfit_5',
      name: 'ELITE COMBAT SUIT',
      type: 'OUTFIT',
      rarity: 'EPIC',
      color: '#06b6d4',
      price: 1800,
      unlocked: maxMastery >= 5,
      purchased: false,
      masteryReq: 5,
      milestoneReq: 'Reach Mastery LV 5 with any fighter',
      description: 'High-tech suit worn only by elite-tier combatants.',
    },
    {
      id: 'legend_badge',
      name: 'LEGEND BADGE',
      type: 'BADGE',
      rarity: 'EPIC',
      color: '#f97316',
      price: 2000,
      unlocked: totalWins >= 20,
      purchased: totalWins >= 20,
      milestoneReq: '20 tournament wins',
      description: 'Reserved for those who have left their mark on the circuit.',
    },
    // ── LEGENDARY ──
    {
      id: 'champion_crown',
      name: 'CHAMPION CROWN',
      type: 'TITLE',
      rarity: 'LEGENDARY',
      color: '#facc15',
      price: 0,
      unlocked: isChampion,
      purchased: isChampion,
      milestoneReq: 'Win a full tournament bracket',
      description: 'Only true champions may wear this. Cannot be purchased.',
    },
    {
      id: 'gold_aura',
      name: 'GOLD AURA',
      type: 'EFFECT',
      rarity: 'LEGENDARY',
      color: '#fbbf24',
      price: 3500,
      unlocked: isChampion,
      purchased: false,
      milestoneReq: 'Win a tournament bracket',
      description: 'The aura of a champion — blinding golden energy.',
    },
    {
      id: 'mastery_legendary',
      name: 'GRANDMASTER ATTIRE',
      type: 'OUTFIT',
      rarity: 'LEGENDARY',
      color: '#facc15',
      price: 5000,
      unlocked: maxMastery >= 8,
      purchased: false,
      masteryReq: 8,
      milestoneReq: 'Reach Mastery LV 8 with any fighter',
      description: 'The ultimate fighter aesthetic. Worn only by grandmasters.',
    },
    // ── SEASONAL ──
    {
      id: 'season1_outfit',
      name: 'SEASON 1: IRON CIRCUIT',
      type: 'OUTFIT',
      rarity: 'EPIC',
      color: '#f97316',
      price: 2500,
      unlocked: totalWins >= 8,
      purchased: false,
      seasonal: true,
      seasonTag: 'SEASON 1',
      milestoneReq: '8 wins during Season 1',
      description: 'Limited season outfit from the inaugural Iron Circuit.',
    },
    {
      id: 'season1_banner',
      name: 'SEASON 1: IRON BANNER',
      type: 'BANNER',
      rarity: 'RARE',
      color: '#f97316',
      price: 1200,
      unlocked: totalWins >= 5,
      purchased: false,
      seasonal: true,
      seasonTag: 'SEASON 1',
      milestoneReq: '5 wins during Season 1',
      description: 'Commemorative banner from the first season.',
    },
    // ── BUNDLES ──
    {
      id: 'bundle_starter',
      name: 'ROOKIE BUNDLE',
      type: 'BUNDLE',
      rarity: 'RARE',
      color: '#22c55e',
      price: 800,
      unlocked: totalWins >= 1,
      purchased: false,
      milestoneReq: '1 tournament win',
      bundleItems: ['Faction Banner', 'Iron Fist Gloves', 'Veteran Badge'],
      description: 'Everything a new champion needs. 3 items at a discount.',
    },
    {
      id: 'bundle_elite',
      name: 'ELITE BUNDLE',
      type: 'BUNDLE',
      rarity: 'EPIC',
      color: '#a855f7',
      price: 3200,
      unlocked: maxMastery >= 5,
      purchased: false,
      masteryReq: 5,
      milestoneReq: 'Mastery LV 5 + 15 wins',
      bundleItems: ['Void Aura', 'Elite Combat Suit', 'Legend Badge'],
      description: 'The elite fighter package. Mastery LV 5 required.',
    },
  ];
}

function getSeasonAchievements(wins: number, losses: number, draws: number, isChampion: boolean, streak: number) {
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

type MarketFilter = 'ALL' | 'OUTFIT' | 'EFFECT' | 'BUNDLE' | 'SEASONAL' | 'UNLOCKED';

export default function PlayerProfileScreen({ onBack }: PlayerProfileScreenProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'career' | 'mastery' | 'cosmetics' | 'season' | 'elo' | 'h2h'>('career');
  const [fighterStats, setFighterStats] = useState<FighterStatRow[]>([]);
  const [rankPoints, setRankPoints] = useState(0);
  const [rankTier, setRankTier] = useState('BRONZE');
  const [loading, setLoading] = useState(true);
  const [marketFilter, setMarketFilter] = useState<MarketFilter>('ALL');
  const [selectedItem, setSelectedItem] = useState<CosmeticItem | null>(null);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [brutalCoins] = useState(1250);

  // New ELO / extended profile state
  const [playerEloRows, setPlayerEloRows] = useState<PlayerEloRow[]>([]);
  const [tierHistory, setTierHistory] = useState<TierClimbEntry[]>([]);
  const [h2hRecords, setH2HRecords] = useState<H2HRecord[]>([]);
  const [cosmeticTimeline, setCosmeticTimeline] = useState<CosmeticUnlockEntry[]>([]);
  const [eloLoading, setEloLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    Promise.all([
      statsService.getFighterStats(user.id),
      statsService.getCurrentRank(user.id),
    ]).then(([fs, rank]) => {
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

  // Load ELO / extended data when those tabs are opened
  useEffect(() => {
    if (!user?.id || (activeTab !== 'elo' && activeTab !== 'h2h')) return;
    setEloLoading(true);
    const supabase = createClient();
    Promise.all([
      supabase.from('player_elo').select('*').eq('user_id', user.id).order('elo_rating', { ascending: false }),
      supabase.from('tier_climb_history').select('*').eq('user_id', user.id).order('recorded_at', { ascending: false }).limit(30),
      supabase.from('head_to_head_records').select('*').eq('user_id', user.id).order('last_played_at', { ascending: false }).limit(20),
      supabase.from('cosmetic_unlocks').select('*').eq('user_id', user.id).order('unlocked_at', { ascending: false }),
    ]).then(([eloRes, tierRes, h2hRes, cosRes]) => {
      if (eloRes.data) {
        setPlayerEloRows(eloRes.data.map(r => ({
          fighterId: r.fighter_id,
          fighterName: r.fighter_name,
          eloRating: r.elo_rating,
          tier: r.tier,
          wins: r.wins,
          losses: r.losses,
          draws: r.draws,
          winStreak: r.win_streak,
        })));
      }
      if (tierRes.data) {
        setTierHistory(tierRes.data.map(r => ({
          id: r.id,
          fighterId: r.fighter_id,
          fighterName: r.fighter_name,
          fromTier: r.from_tier,
          toTier: r.to_tier,
          eloAtChange: r.elo_at_change,
          direction: r.direction,
          recordedAt: r.recorded_at,
        })));
      }
      if (h2hRes.data) {
        setH2HRecords(h2hRes.data.map(r => ({
          id: r.id,
          opponentId: r.opponent_id,
          opponentName: r.opponent_name,
          userFighterId: r.user_fighter_id,
          opponentFighterId: r.opponent_fighter_id,
          wins: r.wins,
          losses: r.losses,
          draws: r.draws,
          lastPlayedAt: r.last_played_at,
        })));
      }
      if (cosRes.data) {
        setCosmeticTimeline(cosRes.data.map(r => ({
          id: r.id,
          cosmeticId: r.cosmetic_id,
          cosmeticName: r.cosmetic_name,
          cosmeticType: r.cosmetic_type,
          rarity: r.rarity,
          unlockSource: r.unlock_source,
          unlockContext: r.unlock_context,
          unlockedAt: r.unlocked_at,
        })));
      }
      setEloLoading(false);
    }).catch(() => setEloLoading(false));
  }, [user?.id, activeTab]);

  const totalWins = fighterStats.reduce((s, f) => s + (f.wins ?? 0), 0);
  const totalLosses = fighterStats.reduce((s, f) => s + (f.losses ?? 0), 0);
  const totalDraws = fighterStats.reduce((s, f) => s + (f.draws ?? 0), 0);
  const totalRounds = totalWins + totalLosses + totalDraws;
  const winRate = totalRounds > 0 ? Math.round((totalWins / totalRounds) * 100) : 0;
  const isChampion = fighterStats.some(f => f.tournamentWon);
  const maxStreak = fighterStats.reduce((m, f) => Math.max(m, f.streak ?? 0), 0);
  const rankColor = getRankColor(rankTier);

  // Build mastery map
  const masteryMap: Record<string, number> = {};
  for (const fs of fighterStats) {
    masteryMap[fs.fighterId] = getMasteryLevel(fs.wins);
  }

  const marketplace = buildMarketplace(totalWins, isChampion, masteryMap);
  const achievements = getSeasonAchievements(totalWins, totalLosses, totalDraws, isChampion, maxStreak);
  const earnedCount = achievements.filter(a => a.earned).length;

  // Merge purchased state
  const allItems = marketplace.map(item => ({
    ...item,
    purchased: item.purchased || purchasedIds.has(item.id),
  }));

  const filteredItems = allItems.filter(item => {
    if (marketFilter === 'ALL') return true;
    if (marketFilter === 'SEASONAL') return item.seasonal;
    if (marketFilter === 'BUNDLE') return item.type === 'BUNDLE';
    if (marketFilter === 'UNLOCKED') return item.unlocked;
    return item.type === marketFilter;
  });

  function handlePurchase(item: CosmeticItem) {
    if (!item.unlocked || item.purchased || item.price === 0) return;
    if (brutalCoins < item.price) return;
    setPurchasedIds(prev => new Set([...prev, item.id]));
    setSelectedItem(null);
  }

  // Best ELO across all fighters
  const bestElo = playerEloRows.length > 0 ? Math.max(...playerEloRows.map(r => r.eloRating)) : rankPoints;
  const bestEloTier = playerEloRows.length > 0
    ? (playerEloRows.sort((a, b) => b.eloRating - a.eloRating)[0]?.tier ?? 'bronze')
    : 'bronze';

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
            {playerEloRows.length > 0 && (
              <div className="text-[7px] mt-0.5" style={{ color: TIER_COLORS[bestEloTier] ?? '#94a3b8' }}>
                ELO {bestElo}
              </div>
            )}
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

      {/* Tabs — now 6 tabs */}
      <div className="relative z-10 flex-shrink-0 flex border-b border-zinc-900 overflow-x-auto">
        {(['career', 'elo', 'h2h', 'mastery', 'cosmetics', 'season'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-shrink-0 px-3 py-3 text-[7px] tracking-[0.2em] font-black transition-all"
            style={{
              color: activeTab === tab ? '#fff' : '#52525b',
              borderBottom: activeTab === tab ? `2px solid ${rankColor}` : '2px solid transparent',
            }}
          >
            {tab === 'elo' ? 'ELO' : tab === 'h2h' ? 'H2H' : tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4">

        {/* CAREER TAB */}
        {activeTab === 'career' && (
          <div className="space-y-4">
            <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">CAREER RECORD</div>
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
              <div className="mt-2">
                <div className="flex justify-between text-[7px] text-zinc-600 mb-1">
                  <span>WIN RATE</span><span>{winRate}%</span>
                </div>
                <div className="h-2 bg-zinc-900">
                  <div className="h-full bg-green-500 transition-all duration-700" style={{ width: `${winRate}%` }} />
                </div>
              </div>
            </div>

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

        {/* ELO TAB */}
        {activeTab === 'elo' && (
          <div className="space-y-4">
            <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">ELO RATINGS & RANK PROGRESS</div>

            {eloLoading ? (
              <div className="text-center py-8 text-zinc-700 text-[9px] animate-pulse">LOADING ELO DATA...</div>
            ) : (
              <>
                {/* ELO per fighter */}
                {playerEloRows.length > 0 ? (
                  <div className="space-y-2">
                    {playerEloRows.map((row, i) => {
                      const tierColor = TIER_COLORS[row.tier] ?? '#94a3b8';
                      const total = row.wins + row.losses + row.draws;
                      const wr = total > 0 ? Math.round((row.wins / total) * 100) : 0;
                      return (
                        <div key={i} className="border p-3" style={{ borderColor: `${tierColor}40`, background: `${tierColor}06` }}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="text-[10px] font-black" style={{ color: tierColor }}>{row.fighterName.toUpperCase()}</div>
                              <div className="text-[7px] text-zinc-600 mt-0.5">{row.tier.toUpperCase()} TIER</div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-black" style={{ color: tierColor }}>{row.eloRating}</div>
                              <div className="text-[7px] text-zinc-600">ELO</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-1 text-center mb-2">
                            <div className="border border-zinc-900 py-1">
                              <div className="text-[10px] font-black text-green-400">{row.wins}</div>
                              <div className="text-[6px] text-zinc-700">W</div>
                            </div>
                            <div className="border border-zinc-900 py-1">
                              <div className="text-[10px] font-black text-red-400">{row.losses}</div>
                              <div className="text-[6px] text-zinc-700">L</div>
                            </div>
                            <div className="border border-zinc-900 py-1">
                              <div className="text-[10px] font-black text-zinc-500">{row.draws}</div>
                              <div className="text-[6px] text-zinc-700">D</div>
                            </div>
                            <div className="border border-zinc-900 py-1">
                              <div className="text-[10px] font-black text-yellow-400">{wr}%</div>
                              <div className="text-[6px] text-zinc-700">WR</div>
                            </div>
                          </div>
                          {row.winStreak > 0 && (
                            <div className="text-[7px] font-black" style={{ color: tierColor }}>
                              🔥 {row.winStreak}× WIN STREAK
                            </div>
                          )}
                          {/* ELO progress bar within tier */}
                          <div className="mt-2">
                            <div className="flex justify-between text-[6px] text-zinc-700 mb-1">
                              <span>TIER PROGRESS</span>
                              <span>{row.eloRating} ELO</span>
                            </div>
                            <div className="h-1 bg-zinc-900">
                              <div className="h-full transition-all duration-700"
                                style={{
                                  width: `${Math.min(100, ((row.eloRating - (TIER_COLORS[row.tier] ? 0 : 0)) / 400) * 100)}%`,
                                  background: tierColor,
                                }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-zinc-700 text-[9px] tracking-widest border border-zinc-900">
                    NO ELO DATA YET<br />
                    <span className="text-zinc-800">JOIN RANKED QUEUE TO BEGIN</span>
                  </div>
                )}

                {/* Tier Climb History */}
                {tierHistory.length > 0 && (
                  <div>
                    <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-2 mt-4">TIER CLIMB HISTORY</div>
                    <div className="space-y-1.5">
                      {tierHistory.slice(0, 10).map((entry, i) => {
                        const isUp = entry.direction === 'up';
                        const toColor = TIER_COLORS[entry.toTier] ?? '#94a3b8';
                        const fromColor = TIER_COLORS[entry.fromTier] ?? '#52525b';
                        return (
                          <div key={i} className="flex items-center justify-between border border-zinc-900 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <div className="text-[10px] font-black" style={{ color: isUp ? '#22c55e' : '#ef4444' }}>
                                {isUp ? '▲' : '▼'}
                              </div>
                              <div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-black" style={{ color: fromColor }}>{entry.fromTier.toUpperCase()}</span>
                                  <span className="text-[7px] text-zinc-700">→</span>
                                  <span className="text-[8px] font-black" style={{ color: toColor }}>{entry.toTier.toUpperCase()}</span>
                                </div>
                                <div className="text-[7px] text-zinc-600">{entry.fighterName}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-[8px] font-black" style={{ color: toColor }}>{entry.eloAtChange} ELO</div>
                              <div className="text-[6px] text-zinc-700">
                                {new Date(entry.recordedAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Seasonal Rank Progress */}
                <div className="border border-zinc-900 p-4 mt-2" style={{ background: `${rankColor}08` }}>
                  <div className="text-[8px] tracking-widest text-zinc-600 mb-2">SEASONAL RANK PROGRESS</div>
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
                  <div className="mt-2 text-[7px] text-zinc-700">
                    Next tier: <span className="text-zinc-400 font-black">
                      {RANK_TIERS.find(r => r.min > rankPoints)?.tier ?? 'MAX RANK'}
                    </span>
                    {RANK_TIERS.find(r => r.min > rankPoints) && (
                      <span className="ml-1">({RANK_TIERS.find(r => r.min > rankPoints)!.min - rankPoints} RP needed)</span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* H2H TAB */}
        {activeTab === 'h2h' && (
          <div className="space-y-4">
            <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-3">HEAD-TO-HEAD RECORDS</div>

            {eloLoading ? (
              <div className="text-center py-8 text-zinc-700 text-[9px] animate-pulse">LOADING H2H DATA...</div>
            ) : h2hRecords.length > 0 ? (
              <div className="space-y-2">
                {h2hRecords.map((record, i) => {
                  const total = record.wins + record.losses + record.draws;
                  const wr = total > 0 ? Math.round((record.wins / total) * 100) : 0;
                  const isWinning = record.wins > record.losses;
                  const isTied = record.wins === record.losses;
                  return (
                    <div key={i} className="border border-zinc-900 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-[9px] font-black text-white">{record.opponentName || 'UNKNOWN OPPONENT'}</div>
                          <div className="text-[7px] text-zinc-600 mt-0.5">
                            {record.userFighterId.toUpperCase()} vs {record.opponentFighterId.toUpperCase()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] font-black"
                            style={{ color: isWinning ? '#22c55e' : isTied ? '#facc15' : '#ef4444' }}>
                            {isWinning ? 'WINNING' : isTied ? 'TIED' : 'LOSING'}
                          </div>
                          <div className="text-[7px] text-zinc-600 mt-0.5">
                            {new Date(record.lastPlayedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-2xl font-black text-green-400">{record.wins}</div>
                        <div className="text-zinc-700">-</div>
                        <div className="text-2xl font-black text-red-400">{record.losses}</div>
                        <div className="text-zinc-700">-</div>
                        <div className="text-2xl font-black text-zinc-500">{record.draws}</div>
                        <div className="text-[7px] text-zinc-600 ml-1">W-L-D</div>
                      </div>
                      <div className="h-1.5 bg-zinc-900 flex overflow-hidden">
                        <div className="h-full bg-green-500 transition-all" style={{ width: `${wr}%` }} />
                        <div className="h-full bg-red-500 transition-all" style={{ width: `${total > 0 ? Math.round((record.losses / total) * 100) : 0}%` }} />
                      </div>
                      <div className="text-[7px] text-zinc-700 mt-1">{wr}% WIN RATE · {total} MATCHES</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-700 text-[9px] tracking-widest border border-zinc-900">
                NO HEAD-TO-HEAD DATA YET<br />
                <span className="text-zinc-800">PLAY RANKED MATCHES TO BUILD RECORDS</span>
              </div>
            )}

            {/* Cosmetic Unlock Timeline */}
            <div className="mt-4">
              <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-2">COSMETIC UNLOCK TIMELINE</div>
              {cosmeticTimeline.length > 0 ? (
                <div className="space-y-1.5">
                  {cosmeticTimeline.map((entry, i) => {
                    const rarityColor = RARITY_COLOR[entry.rarity as Rarity] ?? '#94a3b8';
                    return (
                      <div key={i} className="flex items-center gap-3 border px-3 py-2"
                        style={{ borderColor: `${rarityColor}30`, background: `${rarityColor}06` }}>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: rarityColor }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-black truncate" style={{ color: rarityColor }}>
                            {entry.cosmeticName}
                          </div>
                          <div className="text-[7px] text-zinc-600 mt-0.5">
                            {entry.cosmeticType} · {entry.unlockSource.toUpperCase()}
                            {entry.unlockContext && ` · ${entry.unlockContext}`}
                          </div>
                        </div>
                        <div className="text-[6px] text-zinc-700 flex-shrink-0">
                          {new Date(entry.unlockedAt).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-zinc-700 text-[9px] tracking-widest border border-zinc-900">
                  NO COSMETICS UNLOCKED YET
                </div>
              )}
            </div>
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

        {/* COSMETICS MARKETPLACE TAB */}
        {activeTab === 'cosmetics' && (
          <div className="space-y-4">
            {/* Wallet + header */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[8px] tracking-[0.3em] text-zinc-600">COSMETICS MARKETPLACE</div>
                <div className="text-[7px] text-zinc-700 mt-0.5">{allItems.filter(i => i.purchased).length} / {allItems.length} OWNED</div>
              </div>
              <div className="border border-yellow-900 bg-yellow-900/20 px-3 py-1.5 text-right">
                <div className="text-[7px] text-yellow-700">BRUTAL COINS</div>
                <div className="text-sm font-black text-yellow-400">{brutalCoins.toLocaleString()}</div>
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex gap-1 flex-wrap">
              {(['ALL', 'OUTFIT', 'EFFECT', 'BUNDLE', 'SEASONAL', 'UNLOCKED'] as MarketFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setMarketFilter(f)}
                  className="px-2 py-1 text-[7px] tracking-widest border transition-all"
                  style={{
                    borderColor: marketFilter === f ? '#facc15' : '#27272a',
                    color: marketFilter === f ? '#facc15' : '#52525b',
                    background: marketFilter === f ? 'rgba(250,204,21,0.08)' : 'transparent',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Item grid */}
            <div className="grid grid-cols-2 gap-2">
              {filteredItems.map((item) => {
                const rarityColor = RARITY_COLOR[item.rarity];
                const rarityGlow = RARITY_GLOW[item.rarity];
                const isOwned = item.purchased;
                const canBuy = item.unlocked && !isOwned && item.price > 0 && brutalCoins >= item.price;
                const locked = !item.unlocked;

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                    className="text-left border p-3 transition-all relative overflow-hidden"
                    style={{
                      borderColor: selectedItem?.id === item.id ? rarityColor : locked ? '#1c1c1e' : `${rarityColor}40`,
                      background: locked ? 'transparent' : rarityGlow,
                      opacity: locked ? 0.45 : 1,
                    }}
                  >
                    {/* Rarity stripe */}
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: locked ? '#27272a' : rarityColor }} />

                    {/* Tags */}
                    <div className="flex items-center gap-1 mb-1.5">
                      <span className="text-[6px] tracking-widest font-black px-1 py-0.5"
                        style={{ color: rarityColor, background: `${rarityColor}20` }}>
                        {item.rarity}
                      </span>
                      {item.seasonal && (
                        <span className="text-[6px] tracking-widest font-black px-1 py-0.5 text-orange-400 bg-orange-400/10">
                          {item.seasonTag}
                        </span>
                      )}
                      {item.type === 'BUNDLE' && (
                        <span className="text-[6px] tracking-widest font-black px-1 py-0.5 text-green-400 bg-green-400/10">
                          BUNDLE
                        </span>
                      )}
                    </div>

                    <div className="text-[7px] text-zinc-500 mb-0.5">{item.type}</div>
                    <div className="text-[10px] font-black leading-tight" style={{ color: locked ? '#52525b' : '#fff' }}>
                      {item.name}
                    </div>

                    {/* Price / status */}
                    <div className="mt-2">
                      {isOwned ? (
                        <div className="text-[7px] font-black" style={{ color: rarityColor }}>✓ OWNED</div>
                      ) : locked ? (
                        <div className="text-[7px] text-zinc-700">🔒 {item.milestoneReq ?? `MASTERY LV ${item.masteryReq}`}</div>
                      ) : item.price === 0 ? (
                        <div className="text-[7px] text-zinc-500">FREE UNLOCK</div>
                      ) : (
                        <div className="text-[8px] font-black text-yellow-400">{item.price.toLocaleString()} BC</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Item detail panel */}
            {selectedItem && (
              <div
                className="border p-4 mt-2"
                style={{
                  borderColor: RARITY_COLOR[selectedItem.rarity],
                  background: RARITY_GLOW[selectedItem.rarity],
                }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-[7px] tracking-widest mb-1" style={{ color: RARITY_COLOR[selectedItem.rarity] }}>
                      {selectedItem.rarity} · {selectedItem.type}
                      {selectedItem.seasonal && ` · ${selectedItem.seasonTag}`}
                    </div>
                    <div className="text-sm font-black">{selectedItem.name}</div>
                  </div>
                  <button onClick={() => setSelectedItem(null)} className="text-zinc-600 hover:text-zinc-400 text-xs">✕</button>
                </div>
                <div className="text-[8px] text-zinc-400 mb-3">{selectedItem.description}</div>
                {selectedItem.bundleItems && (
                  <div className="mb-3">
                    <div className="text-[7px] text-zinc-600 mb-1">INCLUDES:</div>
                    {selectedItem.bundleItems.map((bi, i) => (
                      <div key={i} className="text-[8px] text-zinc-400">· {bi}</div>
                    ))}
                  </div>
                )}
                {selectedItem.milestoneReq && (
                  <div className="text-[7px] text-zinc-600 mb-3">REQUIREMENT: {selectedItem.milestoneReq}</div>
                )}
                {!selectedItem.purchased && selectedItem.unlocked && selectedItem.price > 0 && (
                  <button
                    onClick={() => handlePurchase(selectedItem)}
                    disabled={brutalCoins < selectedItem.price}
                    className="w-full py-2 text-[9px] font-black tracking-widest border transition-all"
                    style={{
                      borderColor: brutalCoins >= selectedItem.price ? RARITY_COLOR[selectedItem.rarity] : '#27272a',
                      color: brutalCoins >= selectedItem.price ? RARITY_COLOR[selectedItem.rarity] : '#3f3f46',
                      background: brutalCoins >= selectedItem.price ? `${RARITY_COLOR[selectedItem.rarity]}15` : 'transparent',
                    }}
                  >
                    {brutalCoins >= selectedItem.price
                      ? `PURCHASE — ${selectedItem.price.toLocaleString()} BC`
                      : `INSUFFICIENT COINS (NEED ${(selectedItem.price - brutalCoins).toLocaleString()} MORE)`}
                  </button>
                )}
                {selectedItem.purchased && (
                  <div className="text-center text-[9px] font-black py-2" style={{ color: RARITY_COLOR[selectedItem.rarity] }}>
                    ✓ ALREADY OWNED
                  </div>
                )}
                {!selectedItem.unlocked && (
                  <div className="text-center text-[9px] text-zinc-600 py-2">
                    🔒 MILESTONE REQUIRED
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SEASON TAB */}
        {activeTab === 'season' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[8px] tracking-[0.3em] text-zinc-600">SEASON ACHIEVEMENTS</div>
              <div className="text-[8px] text-zinc-500">{earnedCount} / {achievements.length}</div>
            </div>

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
