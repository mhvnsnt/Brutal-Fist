'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '../lib/supabase/client';
import { useAuth } from '../contexts/AuthContext';

interface SpectatorMatch {
  id: string;
  p1Name: string;
  p2Name: string;
  p1Fighter: string;
  p2Fighter: string;
  p1Health: number;
  p2Health: number;
  p1MaxHealth: number;
  p2MaxHealth: number;
  stage: string;
  round: number;
  timer: number;
  status: 'live' | 'ended';
  startedAt: string;
  winner?: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
  color: string;
}

interface ReplayClip {
  id: string;
  matchId: string;
  label: string;
  timestamp: number;
  p1Health: number;
  p2Health: number;
  event: string;
}

const CHAT_COLORS = [
  '#facc15', '#22d3ee', '#a855f7', '#f97316', '#22c55e', '#ef4444', '#3b82f6', '#ec4899',
];

function getUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return CHAT_COLORS[Math.abs(hash) % CHAT_COLORS.length];
}

// ── Mock live match data (used when no real match in DB) ──────────────────────
function buildMockMatch(): SpectatorMatch {
  return {
    id: 'mock-live-001',
    p1Name: 'SHADOW_WOLF',
    p2Name: 'IRON_FIST_99',
    p1Fighter: 'Bannon',
    p2Fighter: 'Maime',
    p1Health: 780,
    p2Health: 620,
    p1MaxHealth: 1000,
    p2MaxHealth: 1000,
    stage: 'Urban Night',
    round: 2,
    timer: 67,
    status: 'live',
    startedAt: new Date().toISOString(),
  };
}

const MOCK_CHAT_SEED: ChatMessage[] = [
  { id: '1', userId: 'u1', username: 'BrutalFan', text: 'P1 is dominating this round!', timestamp: Date.now() - 8000, color: '#facc15' },
  { id: '2', userId: 'u2', username: 'FightWatcher', text: 'That combo was insane 🔥', timestamp: Date.now() - 6000, color: '#22d3ee' },
  { id: '3', userId: 'u3', username: 'IronFistFan', text: 'P2 needs to guard more', timestamp: Date.now() - 4000, color: '#a855f7' },
  { id: '4', userId: 'u4', username: 'ArenaObserver', text: 'Round 2 is heating up!', timestamp: Date.now() - 2000, color: '#f97316' },
];

interface SpectatorViewerProps {
  onBack: () => void;
}

export default function SpectatorViewerScreen({ onBack }: SpectatorViewerProps) {
  const { user } = useAuth();
  const [match, setMatch] = useState<SpectatorMatch>(buildMockMatch());
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(MOCK_CHAT_SEED);
  const [chatInput, setChatInput] = useState('');
  const [replayClips, setReplayClips] = useState<ReplayClip[]>([]);
  const [activeTab, setActiveTab] = useState<'live' | 'clips'>('live');
  const [isExporting, setIsExporting] = useState(false);
  const [exportedClip, setExportedClip] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // ── Simulate live match updates ───────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setMatch(prev => {
        if (prev.status === 'ended') return prev;
        const newTimer = Math.max(0, prev.timer - 1);
        const p1Dmg = Math.random() < 0.15 ? Math.floor(Math.random() * 40 + 10) : 0;
        const p2Dmg = Math.random() < 0.18 ? Math.floor(Math.random() * 35 + 8) : 0;
        const newP1 = Math.max(0, prev.p1Health - p2Dmg);
        const newP2 = Math.max(0, prev.p2Health - p1Dmg);

        // Record clip on significant damage
        if (p1Dmg > 30 || p2Dmg > 30) {
          const clip: ReplayClip = {
            id: `clip-${Date.now()}`,
            matchId: prev.id,
            label: p1Dmg > p2Dmg ? `${prev.p1Name} HEAVY HIT` : `${prev.p2Name} COUNTER`,
            timestamp: Date.now(),
            p1Health: newP1,
            p2Health: newP2,
            event: p1Dmg > p2Dmg ? 'heavy_hit' : 'counter',
          };
          setReplayClips(clips => [clip, ...clips.slice(0, 9)]);
        }

        // Auto-add chat on big events
        if (p1Dmg > 35) {
          const msg: ChatMessage = {
            id: `auto-${Date.now()}`,
            userId: 'system',
            username: 'ARENA',
            text: `💥 ${prev.p1Name} lands a heavy hit! -${p1Dmg} HP`,
            timestamp: Date.now(),
            color: '#ef4444',
          };
          setChatMessages(msgs => [...msgs.slice(-49), msg]);
        }
        if (p2Dmg > 35) {
          const msg: ChatMessage = {
            id: `auto-${Date.now()}-2`,
            userId: 'system',
            username: 'ARENA',
            text: `⚡ ${prev.p2Name} counter attack! -${p2Dmg} HP`,
            timestamp: Date.now(),
            color: '#22d3ee',
          };
          setChatMessages(msgs => [...msgs.slice(-49), msg]);
        }

        const ended = newP1 <= 0 || newP2 <= 0 || newTimer <= 0;
        return {
          ...prev,
          p1Health: newP1,
          p2Health: newP2,
          timer: newTimer,
          status: ended ? 'ended' : 'live',
          winner: ended
            ? (newP1 <= 0 ? prev.p2Name : newP2 <= 0 ? prev.p1Name : newP1 > newP2 ? prev.p1Name : prev.p2Name)
            : undefined,
        };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Real-time chat subscription ───────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('spectator-chat')
      .on('broadcast', { event: 'chat_message' }, (payload) => {
        const msg = payload.payload as ChatMessage;
        setChatMessages(prev => [...prev.slice(-49), msg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim()) return;
    const username = user?.email?.split('@')[0]?.toUpperCase() ?? 'SPECTATOR';
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      userId: user?.id ?? 'anon',
      username,
      text: chatInput.trim(),
      timestamp: Date.now(),
      color: getUserColor(user?.id ?? 'anon'),
    };
    setChatMessages(prev => [...prev.slice(-49), msg]);
    // Broadcast to other spectators
    supabase.channel('spectator-chat').send({
      type: 'broadcast',
      event: 'chat_message',
      payload: msg,
    });
    setChatInput('');
  }, [chatInput, user, supabase]);

  const exportClip = useCallback((clip: ReplayClip) => {
    setIsExporting(true);
    // Simulate clip export (in production: capture canvas frames, encode to webm)
    setTimeout(() => {
      const clipData = JSON.stringify({
        matchId: clip.matchId,
        label: clip.label,
        timestamp: new Date(clip.timestamp).toISOString(),
        p1Health: clip.p1Health,
        p2Health: clip.p2Health,
        event: clip.event,
        exportedBy: user?.email ?? 'anonymous',
      }, null, 2);
      const blob = new Blob([clipData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      setExportedClip(url);
      setIsExporting(false);
    }, 1200);
  }, [user]);

  const p1Pct = Math.max(0, (match.p1Health / match.p1MaxHealth) * 100);
  const p2Pct = Math.max(0, (match.p2Health / match.p2MaxHealth) * 100);

  const getBarColor = (pct: number) => pct > 50 ? '#22c55e' : pct > 25 ? '#f97316' : '#ef4444';

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col font-mono overflow-hidden">
      {/* Atmosphere */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.5) 3px, rgba(255,255,255,0.5) 4px)' }} />

      {/* Header */}
      <div className="relative z-10 flex-shrink-0 border-b border-zinc-900 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onBack} className="text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors">
            ← BACK
          </button>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <div className="text-[8px] tracking-[0.4em] text-red-400">
              {match.status === 'live' ? 'LIVE' : 'MATCH ENDED'}
            </div>
          </div>
          <div className="text-[7px] tracking-widest text-zinc-600">{match.stage.toUpperCase()}</div>
        </div>

        {/* Match HUD */}
        <div className="flex items-center gap-3">
          {/* P1 */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[9px] font-black text-cyan-400">{match.p1Name}</div>
              <div className="text-[7px] text-zinc-500">{match.p1Fighter}</div>
            </div>
            <div className="h-3 bg-zinc-900 border border-zinc-800">
              <div className="h-full transition-all duration-300"
                style={{ width: `${p1Pct}%`, background: getBarColor(p1Pct) }} />
            </div>
            <div className="text-[6px] text-zinc-600 mt-0.5">{match.p1Health} HP</div>
          </div>

          {/* Center */}
          <div className="flex flex-col items-center shrink-0 w-16">
            <div className="text-[7px] text-zinc-600">RND {match.round}</div>
            <div className="text-xl font-black tabular-nums"
              style={{ color: match.timer <= 10 ? '#ef4444' : '#facc15' }}>
              {String(match.timer).padStart(2, '0')}
            </div>
            {match.status === 'ended' && match.winner && (
              <div className="text-[6px] font-black text-yellow-400 text-center leading-tight mt-0.5">
                {match.winner}<br />WINS
              </div>
            )}
          </div>

          {/* P2 */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[7px] text-zinc-500">{match.p2Fighter}</div>
              <div className="text-[9px] font-black text-purple-400">{match.p2Name}</div>
            </div>
            <div className="h-3 bg-zinc-900 border border-zinc-800">
              <div className="h-full transition-all duration-300 ml-auto"
                style={{ width: `${p2Pct}%`, background: getBarColor(p2Pct) }} />
            </div>
            <div className="text-[6px] text-zinc-600 mt-0.5 text-right">{match.p2Health} HP</div>
          </div>
        </div>
      </div>

      {/* Observer camera view (simulated) */}
      <div className="relative z-10 flex-shrink-0 mx-4 mt-3 border border-zinc-800 overflow-hidden"
        style={{ height: '140px', background: 'linear-gradient(135deg, #0a0a14 0%, #0d0010 50%, #0a0a0a 100%)' }}>
        {/* Simulated arena view */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-full h-full">
            {/* Floor line */}
            <div className="absolute bottom-8 left-0 right-0 h-px bg-zinc-800" />
            {/* P1 fighter silhouette */}
            <div className="absolute bottom-8 left-[28%] flex flex-col items-center">
              <div className="w-6 h-12 rounded-t-full border border-cyan-400/40"
                style={{ background: 'linear-gradient(180deg, #22d3ee22, #22d3ee08)' }} />
              <div className="text-[5px] text-cyan-400 mt-1 tracking-widest">{match.p1Name.slice(0, 6)}</div>
            </div>
            {/* P2 fighter silhouette */}
            <div className="absolute bottom-8 right-[28%] flex flex-col items-center">
              <div className="w-6 h-12 rounded-t-full border border-purple-400/40"
                style={{ background: 'linear-gradient(180deg, #a855f722, #a855f708)' }} />
              <div className="text-[5px] text-purple-400 mt-1 tracking-widest">{match.p2Name.slice(0, 6)}</div>
            </div>
            {/* Neon floor glow */}
            <div className="absolute bottom-6 left-1/4 right-1/4 h-1 opacity-30"
              style={{ background: 'linear-gradient(90deg, #22d3ee, transparent, #a855f7)', filter: 'blur(4px)' }} />
          </div>
        </div>
        {/* Observer camera label */}
        <div className="absolute top-2 left-2 text-[6px] tracking-widest text-zinc-600 border border-zinc-800 px-1.5 py-0.5 bg-black/60">
          OBSERVER CAM · READ-ONLY
        </div>
        {/* Live indicator */}
        {match.status === 'live' && (
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
            <div className="text-[6px] text-red-400 tracking-widest">LIVE</div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="relative z-10 flex-shrink-0 flex border-b border-zinc-900 mx-4 mt-2">
        {(['live', 'clips'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 text-[7px] tracking-[0.3em] font-black transition-all"
            style={{
              color: activeTab === tab ? '#fff' : '#52525b',
              borderBottom: activeTab === tab ? '2px solid #facc15' : '2px solid transparent',
            }}>
            {tab === 'live' ? '💬 LIVE CHAT' : '🎬 REPLAY CLIPS'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-hidden flex flex-col mx-4 mb-4">
        {activeTab === 'live' && (
          <>
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto py-2 space-y-1.5">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="flex items-start gap-2">
                  <div className="text-[7px] font-black flex-shrink-0 mt-0.5" style={{ color: msg.color }}>
                    {msg.username}
                  </div>
                  <div className="text-[8px] text-zinc-300 flex-1 leading-relaxed">{msg.text}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="flex-shrink-0 flex gap-2 pt-2 border-t border-zinc-900">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                placeholder={user ? 'TYPE A MESSAGE...' : 'SIGN IN TO CHAT'}
                disabled={!user}
                maxLength={120}
                className="flex-1 bg-zinc-900 border border-zinc-800 px-3 py-2 text-[8px] text-white placeholder-zinc-700 focus:outline-none focus:border-zinc-600 disabled:opacity-40"
              />
              <button
                onClick={sendChat}
                disabled={!user || !chatInput.trim()}
                className="px-3 py-2 text-[7px] font-black tracking-widest border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all disabled:opacity-30"
              >
                SEND
              </button>
            </div>
          </>
        )}

        {activeTab === 'clips' && (
          <div className="flex-1 overflow-y-auto py-2 space-y-2">
            <div className="text-[7px] text-zinc-600 tracking-widest mb-2">
              {replayClips.length} CLIPS RECORDED · TAP TO EXPORT
            </div>
            {replayClips.length === 0 && (
              <div className="text-center py-8 text-zinc-700 text-[9px] tracking-widest border border-zinc-900">
                NO CLIPS YET<br />
                <span className="text-zinc-800">CLIPS ARE RECORDED ON SIGNIFICANT HITS</span>
              </div>
            )}
            {replayClips.map((clip) => (
              <div key={clip.id} className="border border-zinc-800 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[9px] font-black text-white">{clip.label}</div>
                    <div className="text-[7px] text-zinc-600 mt-0.5">
                      {new Date(clip.timestamp).toLocaleTimeString()} · P1: {clip.p1Health}HP · P2: {clip.p2Health}HP
                    </div>
                  </div>
                  <button
                    onClick={() => exportClip(clip)}
                    disabled={isExporting}
                    className="px-2 py-1 text-[7px] font-black tracking-widest border border-zinc-700 text-zinc-400 hover:text-yellow-400 hover:border-yellow-700 transition-all disabled:opacity-40"
                  >
                    {isExporting ? '...' : '⬇ EXPORT'}
                  </button>
                </div>
                {/* Mini health snapshot */}
                <div className="flex gap-2">
                  <div className="flex-1 h-1 bg-zinc-900">
                    <div className="h-full bg-cyan-500 transition-all"
                      style={{ width: `${(clip.p1Health / match.p1MaxHealth) * 100}%` }} />
                  </div>
                  <div className="flex-1 h-1 bg-zinc-900">
                    <div className="h-full bg-purple-500 transition-all ml-auto"
                      style={{ width: `${(clip.p2Health / match.p2MaxHealth) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}

            {/* Export success */}
            {exportedClip && (
              <div className="border border-green-900 p-3 bg-green-900/10">
                <div className="text-[8px] font-black text-green-400 mb-1">✓ CLIP EXPORTED</div>
                <a
                  href={exportedClip}
                  download="brutal-fist-clip.json"
                  className="text-[7px] text-green-600 hover:text-green-400 underline"
                  onClick={() => setTimeout(() => setExportedClip(null), 2000)}
                >
                  DOWNLOAD CLIP DATA
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
