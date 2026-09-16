'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '../lib/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { BANNON_ROSTER } from '../data/bannonRoster';
import { BANNON_GLB_PLAYABLE_MODELS } from '../data/bannonGlbRoster';
import { useRankedCosmeticUnlocks, CosmeticUnlockBanner } from './CosmeticUnlockSystem';

interface MatchmakingQueueScreenProps {
  onBack: () => void;
  onMatchFound?: (opponentFighterId: string, opponentFighterName: string) => void;
}

type QueueTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend';

interface QueueEntry {
  id: string;
  userId: string;
  fighterName: string;
  fighterId: string;
  eloRating: number;
  tier: QueueTier;
  status: 'waiting' | 'matched' | 'cancelled' | 'expired';
  joinedAt: string;
  matchedWith?: string | null;
  matchedFighterName?: string | null;
}

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  timestamp: number;
}

const TIER_CONFIG: Record<QueueTier, { label: string; color: string; eloMin: number; eloMax: number; glow: string }> = {
  bronze:   { label: 'BRONZE',   color: '#cd7f32', eloMin: 0,    eloMax: 899,  glow: 'rgba(205,127,50,0.15)' },
  silver:   { label: 'SILVER',   color: '#94a3b8', eloMin: 900,  eloMax: 1099, glow: 'rgba(148,163,184,0.15)' },
  gold:     { label: 'GOLD',     color: '#facc15', eloMin: 1100, eloMax: 1299, glow: 'rgba(250,204,21,0.15)' },
  platinum: { label: 'PLATINUM', color: '#67e8f9', eloMin: 1300, eloMax: 1599, glow: 'rgba(103,232,249,0.15)' },
  diamond:  { label: 'DIAMOND',  color: '#a78bfa', eloMin: 1600, eloMax: 1999, glow: 'rgba(167,139,250,0.15)' },
  legend:   { label: 'LEGEND',   color: '#f97316', eloMin: 2000, eloMax: 9999, glow: 'rgba(249,115,22,0.15)' },
};

function getEloTier(elo: number): QueueTier {
  if (elo >= 2000) return 'legend';
  if (elo >= 1600) return 'diamond';
  if (elo >= 1300) return 'platinum';
  if (elo >= 1100) return 'gold';
  if (elo >= 900) return 'silver';
  return 'bronze';
}

function estimateWaitTime(queueCount: number, tier: QueueTier): string {
  if (queueCount === 0) return '2–5 min';
  if (queueCount === 1) return '< 30 sec';
  if (queueCount <= 3) return '< 1 min';
  return '< 2 min';
}

export default function MatchmakingQueueScreen({ onBack, onMatchFound }: MatchmakingQueueScreenProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const { pendingRewards, triggerUnlockCheck, dismissRewards } = useRankedCosmeticUnlocks(user?.id);

  const [selectedFighterId, setSelectedFighterId] = useState<string>('');
  const [selectedTier, setSelectedTier] = useState<QueueTier>('bronze');
  const [playerElo, setPlayerElo] = useState<number>(1000);
  const [inQueue, setInQueue] = useState(false);
  const [queueEntryId, setQueueEntryId] = useState<string | null>(null);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchFound, setMatchFound] = useState<QueueEntry | null>(null);
  const waitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const playableFighters = BANNON_ROSTER.filter(f =>
    BANNON_GLB_PLAYABLE_MODELS.some(m => m.characterId === f.id || m.id === f.id)
  );

  // Load player ELO on mount
  useEffect(() => {
    if (!user?.id || !selectedFighterId) return;
    supabase
      .from('player_elo')
      .select('elo_rating, tier')
      .eq('user_id', user.id)
      .eq('fighter_id', selectedFighterId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPlayerElo(data.elo_rating);
          setSelectedTier(data.tier as QueueTier);
        } else {
          setPlayerElo(1000);
          setSelectedTier('bronze');
        }
      });
  }, [user?.id, selectedFighterId]);

  // Set default fighter
  useEffect(() => {
    if (playableFighters.length > 0 && !selectedFighterId) {
      setSelectedFighterId(playableFighters[0].id);
    }
  }, [playableFighters.length]);

  const addNotification = useCallback((message: string, type: Notification['type'] = 'info') => {
    const notif: Notification = { id: Math.random().toString(36).slice(2), message, type, timestamp: Date.now() };
    setNotifications(prev => [notif, ...prev.slice(0, 4)]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notif.id));
    }, 5000);
  }, []);

  // Real-time subscription to active_match_queue
  useEffect(() => {
    const channel = supabase
      .channel('active_match_queue_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'active_match_queue' },
        (payload) => {
          const row = payload.new as any;
          const oldRow = payload.old as any;

          if (payload.eventType === 'INSERT') {
            const entry: QueueEntry = {
              id: row.id,
              userId: row.user_id,
              fighterName: row.fighter_name,
              fighterId: row.fighter_id,
              eloRating: row.elo_rating,
              tier: row.tier,
              status: row.status,
              joinedAt: row.joined_at,
            };
            setQueueEntries(prev => {
              if (prev.some(e => e.id === entry.id)) return prev;
              return [...prev, entry];
            });
            if (row.user_id !== user?.id) {
              addNotification(`${row.fighter_name} joined the ${row.tier.toUpperCase()} queue`, 'info');
            }
          }

          if (payload.eventType === 'UPDATE') {
            setQueueEntries(prev =>
              prev.map(e => e.id === row.id ? {
                ...e,
                status: row.status,
                matchedWith: row.matched_with,
                matchedFighterName: row.matched_fighter_name,
              } : e)
            );

            // Check if our entry got matched
            if (row.user_id === user?.id && row.status === 'matched' && row.matched_fighter_name) {
              setMatchFound({
                id: row.id,
                userId: row.user_id,
                fighterName: row.fighter_name,
                fighterId: row.fighter_id,
                eloRating: row.elo_rating,
                tier: row.tier,
                status: 'matched',
                joinedAt: row.joined_at,
                matchedFighterName: row.matched_fighter_name,
              });
              addNotification(`MATCH FOUND! vs ${row.matched_fighter_name}`, 'success');
              setInQueue(false);
              if (waitTimerRef.current) clearInterval(waitTimerRef.current);
            }

            // Notify when any match is found in the pool
            if (row.status === 'matched' && row.user_id !== user?.id && oldRow?.status === 'waiting') {
              addNotification(`Match started: ${row.fighter_name} vs ${row.matched_fighter_name ?? 'opponent'}`, 'info');
            }
          }

          if (payload.eventType === 'DELETE') {
            setQueueEntries(prev => prev.filter(e => e.id !== oldRow?.id));
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, addNotification]);

  // Load current queue on mount
  useEffect(() => {
    supabase
      .from('active_match_queue')
      .select('*')
      .eq('status', 'waiting')
      .order('joined_at', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setQueueEntries(data.map(r => ({
            id: r.id,
            userId: r.user_id,
            fighterName: r.fighter_name,
            fighterId: r.fighter_id,
            eloRating: r.elo_rating,
            tier: r.tier,
            status: r.status,
            joinedAt: r.joined_at,
          })));
        }
      });
  }, []);

  // Wait timer
  useEffect(() => {
    if (inQueue) {
      setWaitSeconds(0);
      waitTimerRef.current = setInterval(() => setWaitSeconds(s => s + 1), 1000);
    } else {
      if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    }
    return () => { if (waitTimerRef.current) clearInterval(waitTimerRef.current); };
  }, [inQueue]);

  async function joinQueue() {
    if (!user?.id || !selectedFighterId || loading) return;
    setLoading(true);
    const fighter = playableFighters.find(f => f.id === selectedFighterId);
    if (!fighter) { setLoading(false); return; }

    // Cancel any existing entry first
    await supabase
      .from('active_match_queue')
      .update({ status: 'cancelled' })
      .eq('user_id', user.id)
      .eq('status', 'waiting');

    const { data, error } = await supabase
      .from('active_match_queue')
      .insert({
        user_id: user.id,
        fighter_id: fighter.id,
        fighter_name: fighter.name,
        elo_rating: playerElo,
        tier: selectedTier,
        status: 'waiting',
      })
      .select('id')
      .single();

    if (!error && data) {
      setQueueEntryId(data.id);
      setInQueue(true);
      addNotification(`Joined ${selectedTier.toUpperCase()} queue as ${fighter.name}`, 'success');
    } else {
      addNotification('Failed to join queue. Try again.', 'warning');
    }
    setLoading(false);
  }

  async function leaveQueue() {
    if (!queueEntryId || loading) return;
    setLoading(true);
    await supabase
      .from('active_match_queue')
      .update({ status: 'cancelled' })
      .eq('id', queueEntryId);
    setInQueue(false);
    setQueueEntryId(null);
    setWaitSeconds(0);
    addNotification('Left the queue', 'info');
    setLoading(false);
  }

  function formatWait(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
  }

  const tierEntries = queueEntries.filter(e => e.tier === selectedTier && e.status === 'waiting');
  const tierConfig = TIER_CONFIG[selectedTier];

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono">
        <div className="text-center space-y-4">
          <div className="text-[8px] tracking-[0.45em] text-zinc-600">RANKED MATCHMAKING</div>
          <div className="text-sm font-black text-zinc-400">SIGN IN TO JOIN THE QUEUE</div>
          <button onClick={onBack} className="text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 border border-zinc-800 px-4 py-2">
            ← BACK
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col font-mono overflow-hidden">
      {/* Atmosphere */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `radial-gradient(ellipse at 50% 0%, ${tierConfig.color}10 0%, transparent 60%)`,
      }} />
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)',
      }} />

      {/* Notifications */}
      <div className="absolute top-4 right-4 z-50 space-y-2 pointer-events-none" style={{ maxWidth: '240px' }}>
        {notifications.map(n => (
          <div key={n.id} className="border px-3 py-2 text-[8px] tracking-wide font-black animate-pulse"
            style={{
              borderColor: n.type === 'success' ? '#22c55e' : n.type === 'warning' ? '#f97316' : '#3f3f46',
              color: n.type === 'success' ? '#22c55e' : n.type === 'warning' ? '#f97316' : '#94a3b8',
              background: 'rgba(0,0,0,0.9)',
            }}>
            {n.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="relative z-10 flex-shrink-0 border-b border-zinc-900 px-5 pt-5 pb-4">
        <button onClick={onBack} className="text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors mb-3">
          ← BACK
        </button>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[8px] tracking-[0.5em] text-zinc-600">RANKED MATCHMAKING</div>
            <div className="mt-1 text-xl font-black tracking-widest">QUEUE POOL</div>
          </div>
          <div className="text-right">
            <div className="text-[7px] tracking-widest text-zinc-600">YOUR ELO</div>
            <div className="text-xl font-black mt-0.5" style={{ color: tierConfig.color }}>{playerElo}</div>
            <div className="text-[8px] mt-0.5" style={{ color: tierConfig.color }}>{selectedTier.toUpperCase()}</div>
          </div>
        </div>
      </div>

      {/* Match Found Banner */}
      {matchFound && (
        <div className="relative z-20 flex-shrink-0 border-b-2 px-5 py-4"
          style={{ borderColor: '#22c55e', background: 'rgba(34,197,94,0.08)' }}>
          <div className="text-[8px] tracking-[0.4em] text-green-400 mb-1">MATCH FOUND</div>
          <div className="text-lg font-black text-white">
            {matchFound.fighterName.toUpperCase()} <span className="text-zinc-600">VS</span> {(matchFound.matchedFighterName ?? 'OPPONENT').toUpperCase()}
          </div>
          <div className="flex gap-3 mt-3">
            <button
              onClick={() => {
                // Trigger cosmetic unlock check on ranked match acceptance
                if (user?.id) {
                  triggerUnlockCheck({
                    userId: user.id,
                    fighterId: selectedFighterId,
                    fighterName: BANNON_ROSTER.find(f => f.id === selectedFighterId)?.name ?? selectedFighterId,
                    opponentTier: matchFound?.tier ?? selectedTier,
                    winStreak: 1,
                    totalWins: 1,
                    isRankedWin: true,
                  });
                }
                onMatchFound?.(matchFound.fighterId, matchFound.matchedFighterName ?? '');
                setMatchFound(null);
              }}
              className="flex-1 py-2 text-[9px] font-black tracking-widest border border-green-500 text-green-400 hover:bg-green-500 hover:text-black transition-all"
            >
              ENTER MATCH
            </button>
            <button
              onClick={() => setMatchFound(null)}
              className="px-4 py-2 text-[9px] font-black tracking-widest border border-zinc-700 text-zinc-500 hover:text-zinc-300 transition-all"
            >
              DECLINE
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 flex-1 overflow-y-auto px-5 py-4 space-y-5">

        {/* Fighter Select */}
        <div>
          <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-2">SELECT FIGHTER</div>
          <div className="grid grid-cols-3 gap-1.5">
            {playableFighters.slice(0, 6).map(f => (
              <button
                key={f.id}
                onClick={() => !inQueue && setSelectedFighterId(f.id)}
                disabled={inQueue}
                className="border py-2 px-2 text-left transition-all"
                style={{
                  borderColor: selectedFighterId === f.id ? tierConfig.color : '#27272a',
                  background: selectedFighterId === f.id ? `${tierConfig.color}12` : 'transparent',
                  opacity: inQueue && selectedFighterId !== f.id ? 0.4 : 1,
                }}
              >
                <div className="text-[8px] font-black truncate" style={{ color: selectedFighterId === f.id ? '#fff' : '#71717a' }}>
                  {f.name.toUpperCase()}
                </div>
                <div className="text-[6px] text-zinc-700 mt-0.5 truncate">{f.factionAlignment.toUpperCase()}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Tier Pool Selector */}
        <div>
          <div className="text-[8px] tracking-[0.3em] text-zinc-600 mb-2">BRACKET TIER</div>
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(TIER_CONFIG) as QueueTier[]).map(tier => {
              const cfg = TIER_CONFIG[tier];
              const count = queueEntries.filter(e => e.tier === tier && e.status === 'waiting').length;
              const isMyTier = tier === selectedTier;
              return (
                <button
                  key={tier}
                  onClick={() => !inQueue && setSelectedTier(tier)}
                  disabled={inQueue}
                  className="border py-2 px-2 text-left transition-all relative"
                  style={{
                    borderColor: isMyTier ? cfg.color : '#27272a',
                    background: isMyTier ? cfg.glow : 'transparent',
                    opacity: inQueue && !isMyTier ? 0.4 : 1,
                  }}
                >
                  <div className="text-[8px] font-black" style={{ color: isMyTier ? cfg.color : '#52525b' }}>
                    {cfg.label}
                  </div>
                  <div className="text-[6px] text-zinc-700 mt-0.5">{cfg.eloMin}–{cfg.eloMax === 9999 ? '∞' : cfg.eloMax} ELO</div>
                  {count > 0 && (
                    <div className="absolute top-1 right-1 text-[6px] font-black px-1"
                      style={{ color: cfg.color, background: `${cfg.color}20` }}>
                      {count}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Queue Status Panel */}
        <div className="border p-4 space-y-3"
          style={{ borderColor: inQueue ? tierConfig.color : '#27272a', background: inQueue ? tierConfig.glow : 'transparent' }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[8px] tracking-[0.3em] text-zinc-600">QUEUE STATUS</div>
              <div className="text-sm font-black mt-0.5" style={{ color: inQueue ? tierConfig.color : '#52525b' }}>
                {inQueue ? 'SEARCHING...' : 'STANDBY'}
              </div>
            </div>
            {inQueue && (
              <div className="text-right">
                <div className="text-[7px] text-zinc-600">WAIT TIME</div>
                <div className="text-lg font-black" style={{ color: tierConfig.color }}>{formatWait(waitSeconds)}</div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-[8px]">
            <div>
              <span className="text-zinc-600">IN POOL: </span>
              <span className="font-black" style={{ color: tierConfig.color }}>{tierEntries.length}</span>
              <span className="text-zinc-700"> fighters</span>
            </div>
            <div>
              <span className="text-zinc-600">EST. WAIT: </span>
              <span className="font-black text-zinc-400">{estimateWaitTime(tierEntries.length, selectedTier)}</span>
            </div>
          </div>

          {inQueue ? (
            <button
              onClick={leaveQueue}
              disabled={loading}
              className="w-full py-3 text-[9px] font-black tracking-widest border border-red-900 text-red-500 hover:bg-red-900/20 transition-all"
            >
              {loading ? 'LEAVING...' : 'LEAVE QUEUE'}
            </button>
          ) : (
            <button
              onClick={joinQueue}
              disabled={loading || !selectedFighterId}
              className="w-full py-3 text-[9px] font-black tracking-widest border transition-all"
              style={{
                borderColor: selectedFighterId ? tierConfig.color : '#27272a',
                color: selectedFighterId ? tierConfig.color : '#3f3f46',
                background: selectedFighterId ? `${tierConfig.color}10` : 'transparent',
              }}
            >
              {loading ? 'JOINING...' : `JOIN ${selectedTier.toUpperCase()} QUEUE`}
            </button>
          )}
        </div>

        {/* Live Queue Pool */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[8px] tracking-[0.3em] text-zinc-600">LIVE POOL — {selectedTier.toUpperCase()}</div>
            <div className="text-[7px] text-zinc-700">{tierEntries.length} WAITING</div>
          </div>
          {tierEntries.length === 0 ? (
            <div className="border border-zinc-900 py-6 text-center">
              <div className="text-[8px] text-zinc-700 tracking-widest">NO FIGHTERS IN THIS TIER</div>
              <div className="text-[7px] text-zinc-800 mt-1">BE THE FIRST TO JOIN</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {tierEntries.map(entry => {
                const isMe = entry.userId === user?.id;
                return (
                  <div key={entry.id}
                    className="flex items-center justify-between border px-3 py-2"
                    style={{
                      borderColor: isMe ? tierConfig.color : '#27272a',
                      background: isMe ? `${tierConfig.color}08` : 'transparent',
                    }}>
                    <div>
                      <div className="text-[9px] font-black" style={{ color: isMe ? tierConfig.color : '#a1a1aa' }}>
                        {entry.fighterName.toUpperCase()}
                        {isMe && <span className="ml-2 text-[6px] text-zinc-600">YOU</span>}
                      </div>
                      <div className="text-[7px] text-zinc-700 mt-0.5">ELO {entry.eloRating}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[7px] text-zinc-600">
                        {Math.floor((Date.now() - new Date(entry.joinedAt).getTime()) / 1000)}s
                      </div>
                      <div className="w-1.5 h-1.5 rounded-full ml-auto mt-1 animate-pulse"
                        style={{ background: tierConfig.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ELO Range Info */}
        <div className="border border-zinc-900 p-3">
          <div className="text-[7px] tracking-[0.3em] text-zinc-700 mb-2">MATCHMAKING RANGE</div>
          <div className="text-[8px] text-zinc-500">
            Matches players within <span className="text-zinc-300 font-black">±150 ELO</span> of your rating.
            After <span className="text-zinc-300 font-black">2 minutes</span>, range expands to ±300.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-[7px] text-zinc-700">YOUR RANGE:</div>
            <div className="text-[8px] font-black" style={{ color: tierConfig.color }}>
              {Math.max(100, playerElo - 150)} – {playerElo + 150}
            </div>
          </div>
        </div>
      </div>

      {/* Cosmetic unlock banner */}
      <CosmeticUnlockBanner rewards={pendingRewards} onDismiss={dismissRewards} />
    </div>
  );
}
