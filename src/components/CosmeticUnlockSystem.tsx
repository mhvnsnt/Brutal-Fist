'use client';

/**
 * CosmeticUnlockSystem — Auto-grants cosmetic unlocks on ranked match wins
 * based on opponent tier, win streak, and milestone thresholds.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '../lib/supabase/client';

export interface CosmeticUnlockReward {
  id: string;
  name: string;
  type: 'OUTFIT' | 'EFFECT' | 'BANNER' | 'BADGE' | 'TITLE' | 'BUNDLE';
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  color: string;
  unlockReason: string;
}

export interface RankedMatchResult {
  userId: string;
  fighterId: string;
  fighterName: string;
  opponentTier: string;
  winStreak: number;
  totalWins: number;
  isRankedWin: boolean;
}

// ── Cosmetic milestone thresholds ─────────────────────────────────────────────
const WIN_MILESTONES: Array<{
  wins: number;
  reward: CosmeticUnlockReward;
}> = [
  {
    wins: 1,
    reward: { id: 'milestone_1win', name: 'FIRST BLOOD BANNER', type: 'BANNER', rarity: 'COMMON', color: '#ef4444', unlockReason: 'First ranked win' },
  },
  {
    wins: 5,
    reward: { id: 'milestone_5wins', name: 'BRUTAL AURA', type: 'EFFECT', rarity: 'RARE', color: '#ef4444', unlockReason: '5 ranked wins' },
  },
  {
    wins: 10,
    reward: { id: 'milestone_10wins', name: 'SHADOW ATTIRE', type: 'OUTFIT', rarity: 'RARE', color: '#7c3aed', unlockReason: '10 ranked wins' },
  },
  {
    wins: 15,
    reward: { id: 'milestone_15wins', name: 'VOID AURA', type: 'EFFECT', rarity: 'EPIC', color: '#8b5cf6', unlockReason: '15 ranked wins' },
  },
  {
    wins: 25,
    reward: { id: 'milestone_25wins', name: 'LEGEND TITLE', type: 'TITLE', rarity: 'LEGENDARY', color: '#facc15', unlockReason: '25 ranked wins' },
  },
  {
    wins: 50,
    reward: { id: 'milestone_50wins', name: 'GRANDMASTER ATTIRE', type: 'OUTFIT', rarity: 'LEGENDARY', color: '#facc15', unlockReason: '50 ranked wins — Grandmaster' },
  },
];

// ── Win streak rewards ────────────────────────────────────────────────────────
const STREAK_REWARDS: Array<{
  streak: number;
  reward: CosmeticUnlockReward;
}> = [
  {
    streak: 3,
    reward: { id: 'streak_3', name: 'HOT STREAK BADGE', type: 'BADGE', rarity: 'RARE', color: '#f97316', unlockReason: '3-win streak' },
  },
  {
    streak: 5,
    reward: { id: 'streak_5', name: 'UNSTOPPABLE AURA', type: 'EFFECT', rarity: 'EPIC', color: '#a855f7', unlockReason: '5-win streak' },
  },
  {
    streak: 10,
    reward: { id: 'streak_10', name: 'STREAK LEGEND TITLE', type: 'TITLE', rarity: 'LEGENDARY', color: '#facc15', unlockReason: '10-win streak' },
  },
];

// ── Opponent tier rewards ─────────────────────────────────────────────────────
const TIER_UPSET_REWARDS: Record<string, CosmeticUnlockReward> = {
  gold: {
    id: 'tier_upset_gold', name: 'GOLD SLAYER BADGE', type: 'BADGE', rarity: 'RARE', color: '#facc15', unlockReason: 'Beat a Gold tier opponent',
  },
  platinum: {
    id: 'tier_upset_platinum', name: 'PLATINUM BREAKER EFFECT', type: 'EFFECT', rarity: 'EPIC', color: '#67e8f9', unlockReason: 'Beat a Platinum tier opponent',
  },
  diamond: {
    id: 'tier_upset_diamond', name: 'DIAMOND CRUSHER OUTFIT', type: 'OUTFIT', rarity: 'EPIC', color: '#a78bfa', unlockReason: 'Beat a Diamond tier opponent',
  },
  legend: {
    id: 'tier_upset_legend', name: 'LEGEND SLAYER TITLE', type: 'TITLE', rarity: 'LEGENDARY', color: '#f97316', unlockReason: 'Beat a Legend tier opponent',
  },
};

const RARITY_COLOR: Record<string, string> = {
  COMMON: '#94a3b8',
  RARE: '#3b82f6',
  EPIC: '#a855f7',
  LEGENDARY: '#facc15',
};

/**
 * Evaluate which cosmetics should be auto-granted for a ranked win.
 * Returns array of rewards to grant (deduplication handled by caller).
 */
export function evaluateCosmeticUnlocks(result: RankedMatchResult): CosmeticUnlockReward[] {
  if (!result.isRankedWin) return [];
  const rewards: CosmeticUnlockReward[] = [];

  // Win milestone check
  for (const milestone of WIN_MILESTONES) {
    if (result.totalWins === milestone.wins) {
      rewards.push(milestone.reward);
    }
  }

  // Win streak check
  for (const streakReward of STREAK_REWARDS) {
    if (result.winStreak === streakReward.streak) {
      rewards.push(streakReward.reward);
    }
  }

  // Opponent tier upset check
  const opponentTierLower = result.opponentTier.toLowerCase();
  if (TIER_UPSET_REWARDS[opponentTierLower]) {
    rewards.push(TIER_UPSET_REWARDS[opponentTierLower]);
  }

  return rewards;
}

/**
 * Persist cosmetic unlock to Supabase cosmetic_unlocks table.
 */
export async function persistCosmeticUnlock(
  userId: string,
  reward: CosmeticUnlockReward,
  context: string,
): Promise<void> {
  const supabase = createClient();
  await supabase.from('cosmetic_unlocks').insert({
    user_id: userId,
    cosmetic_id: reward.id,
    cosmetic_name: reward.name,
    cosmetic_type: reward.type,
    rarity: reward.rarity,
    unlock_source: 'ranked_win',
    unlock_context: context,
    unlocked_at: new Date().toISOString(),
  });
}

// ── Unlock Banner Component ───────────────────────────────────────────────────
interface UnlockBannerProps {
  rewards: CosmeticUnlockReward[];
  onDismiss: () => void;
}

export function CosmeticUnlockBanner({ rewards, onDismiss }: UnlockBannerProps) {
  const [visible, setVisible] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (rewards.length === 0) return;
    const timer = setTimeout(() => {
      if (currentIdx < rewards.length - 1) {
        setCurrentIdx(i => i + 1);
      } else {
        setVisible(false);
        onDismiss();
      }
    }, 3500);
    return () => clearTimeout(timer);
  }, [currentIdx, rewards.length, onDismiss]);

  if (!visible || rewards.length === 0) return null;

  const reward = rewards[currentIdx];
  const rarityColor = RARITY_COLOR[reward.rarity] ?? '#94a3b8';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto mx-4 border-2 p-5 text-center font-mono max-w-xs w-full"
        style={{
          borderColor: rarityColor,
          background: `rgba(0,0,0,0.95)`,
          boxShadow: `0 0 40px ${rarityColor}44, 0 0 80px ${rarityColor}22`,
        }}
      >
        {/* Rarity glow bar */}
        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: rarityColor }} />

        <div className="text-[7px] tracking-[0.5em] mb-2" style={{ color: rarityColor }}>
          COSMETIC UNLOCKED
        </div>
        <div className="text-[8px] tracking-widest text-zinc-500 mb-1">{reward.type}</div>
        <div className="text-xl font-black tracking-widest mb-2" style={{ color: rarityColor }}>
          {reward.name}
        </div>
        <div className="text-[7px] tracking-widest mb-3"
          style={{ color: `${rarityColor}88` }}>
          {reward.rarity}
        </div>
        <div className="text-[8px] text-zinc-500 mb-4">{reward.unlockReason}</div>

        {rewards.length > 1 && (
          <div className="text-[6px] text-zinc-700 mb-3">
            {currentIdx + 1} / {rewards.length}
          </div>
        )}

        <button
          onClick={() => {
            if (currentIdx < rewards.length - 1) {
              setCurrentIdx(i => i + 1);
            } else {
              setVisible(false);
              onDismiss();
            }
          }}
          className="text-[7px] tracking-[0.3em] border px-4 py-2 transition-all hover:bg-white/5"
          style={{ borderColor: `${rarityColor}60`, color: rarityColor }}
        >
          {currentIdx < rewards.length - 1 ? 'NEXT ▶' : 'COLLECT'}
        </button>
      </div>
    </div>
  );
}

// ── Hook: useRankedCosmeticUnlocks ────────────────────────────────────────────
/**
 * Call triggerUnlockCheck after a ranked win to auto-evaluate and show banners.
 */
export function useRankedCosmeticUnlocks(userId: string | undefined) {
  const [pendingRewards, setPendingRewards] = useState<CosmeticUnlockReward[]>([]);
  const grantedIds = useRef<Set<string>>(new Set());

  const triggerUnlockCheck = useCallback(async (result: RankedMatchResult) => {
    if (!userId) return;
    const rewards = evaluateCosmeticUnlocks(result);
    // Filter already-granted this session
    const newRewards = rewards.filter(r => !grantedIds.current.has(r.id));
    if (newRewards.length === 0) return;

    // Mark as granted
    newRewards.forEach(r => grantedIds.current.add(r.id));
    setPendingRewards(newRewards);

    // Persist to DB
    for (const reward of newRewards) {
      await persistCosmeticUnlock(userId, reward, result.unlockReason ?? result.opponentTier);
    }
  }, [userId]);

  const dismissRewards = useCallback(() => {
    setPendingRewards([]);
  }, []);

  return { pendingRewards, triggerUnlockCheck, dismissRewards };
}

// Extend RankedMatchResult with unlockReason
declare module './CosmeticUnlockSystem' {
  interface RankedMatchResult {
    unlockReason?: string;
  }
}
