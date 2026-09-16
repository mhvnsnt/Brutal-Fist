'use client';

import React from 'react';
import { type MatchResult } from '../lib/statsService';

interface MatchDetailModalProps {
  match: MatchResult;
  onClose: () => void;
  onReplay?: () => void;
}

// Generate deterministic pseudo-random round data from match id
function generateRoundData(match: MatchResult) {
  const seed = match.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rounds = Math.max(1, (seed % 3) + 1); // 1-3 rounds
  const result = [];
  let playerDmgTotal = 0;
  let opponentDmgTotal = 0;

  for (let i = 0; i < rounds; i++) {
    const roundSeed = seed + i * 137;
    const playerDmg = 40 + (roundSeed % 55);
    const opponentDmg = 40 + ((roundSeed * 7) % 55);
    const roundWinner: 'player' | 'opponent' | 'draw' =
      playerDmg > opponentDmg ? 'player' : playerDmg < opponentDmg ? 'opponent' : 'draw';
    playerDmgTotal += playerDmg;
    opponentDmgTotal += opponentDmg;
    result.push({ round: i + 1, playerDmg, opponentDmg, winner: roundWinner });
  }

  return { rounds: result, playerDmgTotal, opponentDmgTotal };
}

export default function MatchDetailModal({ match, onClose, onReplay }: MatchDetailModalProps) {
  const { rounds, playerDmgTotal, opponentDmgTotal } = generateRoundData(match);
  const outcomeColor = match.outcome === 'win' ? '#4ade80' : match.outcome === 'draw' ? '#94a3b8' : '#f87171';
  const outcomeLabel = match.outcome === 'win' ? 'VICTORY' : match.outcome === 'draw' ? 'DRAW' : 'DEFEAT';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.88)' }}
      onClick={onClose}
    >
      <div
        className="relative w-[min(92vw,420px)] bg-[#0a0a0a] border border-zinc-800 font-mono overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Accent top bar */}
        <div className="h-0.5 w-full" style={{ background: outcomeColor }} />

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-zinc-800/60 flex items-start justify-between">
          <div>
            <div className="text-[7px] tracking-[0.5em] text-zinc-600">MATCH DETAIL</div>
            <div className="text-lg font-black tracking-widest text-white mt-0.5">
              vs {match.opponentFighterName.toUpperCase()}
            </div>
            <div className="text-[8px] tracking-widest mt-1" style={{ color: outcomeColor }}>
              {outcomeLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-700 hover:text-zinc-300 transition-colors text-lg leading-none mt-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Round-by-round */}
        <div className="px-5 pt-4 pb-3 border-b border-zinc-800/60">
          <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-3">ROUND BREAKDOWN</div>
          <div className="space-y-2">
            {rounds.map(r => {
              const playerPct = Math.round((r.playerDmg / (r.playerDmg + r.opponentDmg)) * 100);
              const opponentPct = 100 - playerPct;
              const rColor = r.winner === 'player' ? '#4ade80' : r.winner === 'draw' ? '#94a3b8' : '#f87171';
              return (
                <div key={r.round} className="border border-zinc-800/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[8px] font-black text-zinc-500">ROUND {r.round}</div>
                    <div className="text-[8px] font-black tracking-widest" style={{ color: rColor }}>
                      {r.winner === 'player' ? 'YOU WIN' : r.winner === 'draw' ? 'DRAW' : 'OPPONENT WINS'}
                    </div>
                  </div>
                  {/* Damage bar */}
                  <div className="flex h-1.5 overflow-hidden bg-zinc-900 mb-2">
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${playerPct}%`, background: '#4ade80' }}
                    />
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${opponentPct}%`, background: '#f87171' }}
                    />
                  </div>
                  <div className="flex justify-between">
                    <div className="text-[8px]">
                      <span className="text-green-400 font-black">{r.playerDmg}</span>
                      <span className="text-zinc-700 ml-1">DMG DEALT</span>
                    </div>
                    <div className="text-[8px]">
                      <span className="text-zinc-700 mr-1">OPPONENT</span>
                      <span className="text-red-400 font-black">{r.opponentDmg}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Damage stats */}
        <div className="px-5 pt-4 pb-3 border-b border-zinc-800/60">
          <div className="text-[8px] tracking-[0.4em] text-zinc-600 mb-3">DAMAGE STATS</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-zinc-800 p-3 text-center">
              <div className="text-2xl font-black text-green-400">{playerDmgTotal}</div>
              <div className="text-[7px] text-zinc-600 mt-1">TOTAL DEALT</div>
            </div>
            <div className="border border-zinc-800 p-3 text-center">
              <div className="text-2xl font-black text-red-400">{opponentDmgTotal}</div>
              <div className="text-[7px] text-zinc-600 mt-1">TOTAL TAKEN</div>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-[7px] text-zinc-600 mb-1.5">DAMAGE EFFICIENCY</div>
            <div className="flex h-1.5 overflow-hidden bg-zinc-900">
              <div
                className="h-full"
                style={{
                  width: `${Math.round((playerDmgTotal / (playerDmgTotal + opponentDmgTotal)) * 100)}%`,
                  background: outcomeColor,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[7px] text-zinc-600">YOU</span>
              <span className="text-[7px] text-zinc-600">{match.opponentFighterName.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Meta + actions */}
        <div className="px-5 pt-3 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[7px] text-zinc-700">
              ROUND {match.roundNumber} · {new Date(match.playedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div className="text-[7px] text-zinc-700">
              {new Date(match.playedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div className="flex gap-2">
            {onReplay && (
              <button
                onClick={onReplay}
                className="flex-1 py-3 text-[9px] font-black tracking-widest border border-yellow-400/60 text-yellow-400 hover:bg-yellow-400 hover:text-black transition-all"
              >
                ▶ REPLAY
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 py-3 text-[9px] font-black tracking-widest border border-zinc-700 text-zinc-500 hover:border-zinc-400 hover:text-zinc-200 transition-all"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
