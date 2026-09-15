import { useEffect, useState } from 'react';
import { AppScreen } from './types';
import { BANNON_GLB_PLAYABLE_MODELS } from './data/bannonGlbRoster';
import { type BannonFighterProfile, getBannonFighter } from './data/bannonRoster';
import dynamic from 'next/dynamic';

const CharacterSelect = dynamic(() => import('./components/CharacterSelect'), { ssr: false });
const GameBattleArena = dynamic(() => import('./components/GameBattleArena'), { ssr: false });
const TournamentBracket = dynamic(() => import('./components/TournamentBracket'), { ssr: false });

export default function App() {
  const [screen, setScreen] = useState<AppScreen>(AppScreen?.Boot);
  const [p1BannonFighter, setP1BannonFighter] = useState<BannonFighterProfile | null>(null);
  const [p2BannonFighter, setP2BannonFighter] = useState<BannonFighterProfile | null>(null);
  const [matchWinner, setMatchWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [gameMode, setGameMode] = useState<'arcade' | 'versus' | 'tournament'>('versus');

  useEffect(() => {
    if (screen !== AppScreen?.Boot) return;
    const timer = window.setTimeout(() => setScreen(AppScreen?.Title), 1400);
    return () => window.clearTimeout(timer);
  }, [screen]);

  if (!BANNON_GLB_PLAYABLE_MODELS?.length) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono">
        <div className="text-center">
          <div className="text-xs tracking-[0.45em] text-red-400">ROSTER LOCKED</div>
          <div className="mt-3 text-xl font-black tracking-widest">NO VALID BANNON GLB FIGHTERS</div>
          <div className="mt-3 text-xs text-slate-500">NO GLB = NO CHARACTER</div>
        </div>
      </div>
    );
  }

  // ── Boot ──
  if (screen === AppScreen?.Boot) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono">
        <div className="text-center">
          <div className="text-xs tracking-[0.45em] text-slate-500">SCHWARZERBLITZ RUNTIME</div>
          <div className="mt-3 text-2xl font-black tracking-widest">BRUTAL FIST</div>
        </div>
      </div>
    );
  }

  // ── Title ──
  if (screen === AppScreen?.Title) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono">
        <button
          autoFocus
          onClick={() => setScreen(AppScreen?.MainMenu)}
          className="text-4xl font-black italic tracking-[0.18em] text-white animate-pulse"
        >
          BRUTAL FIST
          <span className="block mt-8 text-sm tracking-[0.45em] text-yellow-400">PRESS START</span>
        </button>
      </div>
    );
  }

  // ── Main Menu ──
  if (screen === AppScreen?.MainMenu) {
    return (
      <div className="fixed inset-0 bg-[#10131a] text-white flex items-center justify-center font-mono">
        <div className="w-[min(86vw,420px)]">
          <div className="mb-10 text-xs tracking-[0.45em] text-slate-500">3D FIGHTING GAME</div>
          <div className="space-y-2">
            <button
              onClick={() => { setGameMode('arcade'); setScreen(AppScreen?.Select); }}
              className="block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all"
            >
              ARCADE
            </button>
            <button
              onClick={() => { setGameMode('versus'); setScreen(AppScreen?.Select); }}
              className="block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all"
            >
              VERSUS
            </button>
            <button
              onClick={() => { setGameMode('tournament'); setScreen(AppScreen?.Select); }}
              className="block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all"
            >
              TOURNAMENT
              <span className="ml-3 text-[10px] text-yellow-400 tracking-widest">BRACKET MODE</span>
            </button>
            <button
              onClick={() => { setGameMode('versus'); setScreen(AppScreen?.Select); }}
              className="block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all"
            >
              TRAINING
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Character Select (Tekken 3 layout) ──
  if (screen === AppScreen?.Select) {
    return (
      <CharacterSelect
        onStartMatch={(p1f, p2f) => {
          setP1BannonFighter(p1f);
          setP2BannonFighter(p2f);
          if (gameMode === 'tournament') {
            setScreen('tournament' as any);
          } else {
            setScreen(AppScreen?.Combat);
          }
        }}
      />
    );
  }

  // ── Tournament Bracket ──
  if ((screen as any) === 'tournament') {
    const player = p1BannonFighter ?? getBannonFighter('bannon')!;
    return (
      <TournamentBracket
        playerFighter={player}
        onExit={() => setScreen(AppScreen?.MainMenu)}
      />
    );
  }

  // ── Game Battle Arena ──
  if (screen === AppScreen?.Combat) {
    const p1 = p1BannonFighter ?? getBannonFighter('bannon')!;
    const p2 = p2BannonFighter ?? getBannonFighter('maime')!;
    return (
      <GameBattleArena
        p1Fighter={p1}
        p2Fighter={p2}
        onMatchEnd={(winner) => {
          setMatchWinner(winner);
          setScreen(AppScreen?.PostMatch);
        }}
        onBack={() => setScreen(AppScreen?.Select)}
      />
    );
  }

  // ── Post Match ──
  if (screen === AppScreen?.PostMatch) {
    const p1 = p1BannonFighter ?? getBannonFighter('bannon')!;
    const p2 = p2BannonFighter ?? getBannonFighter('maime')!;
    const winnerName = matchWinner === 'p1' ? p1.name : matchWinner === 'p2' ? p2.name : null;
    return (
      <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center font-mono gap-6">
        <div className="text-xs tracking-[0.45em] text-slate-500">MATCH COMPLETE</div>
        {winnerName ? (
          <div className="text-3xl font-black tracking-widest text-yellow-400">{winnerName.toUpperCase()} WINS</div>
        ) : (
          <div className="text-3xl font-black tracking-widest text-zinc-400">DRAW</div>
        )}
        <div className="text-4xl font-black tracking-widest text-white">BRUTAL FIST</div>
        <div className="flex gap-4 mt-4">
          <button
            onClick={() => setScreen(AppScreen?.Select)}
            className="border border-slate-600 px-6 py-3 text-sm font-black tracking-widest hover:bg-white hover:text-black transition-all"
          >
            REMATCH
          </button>
          <button
            onClick={() => setScreen(AppScreen?.MainMenu)}
            className="border border-slate-600 px-6 py-3 text-sm font-black tracking-widest hover:bg-white hover:text-black transition-all"
          >
            MAIN MENU
          </button>
        </div>
      </div>
    );
  }

  // ── VS screen (legacy fallback) ──
  if (screen === AppScreen?.VS) {
    const p1 = p1BannonFighter;
    const p2 = p2BannonFighter;
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono overflow-hidden">
        <div className="w-full px-8 flex items-center justify-between">
          <div className="text-3xl md:text-6xl font-black italic">{p1?.name ?? 'P1'}</div>
          <div className="text-4xl md:text-7xl font-black text-red-500">VS</div>
          <div className="text-right text-3xl md:text-7xl font-black italic text-slate-500">{p2?.name ?? 'P2'}</div>
        </div>
      </div>
    );
  }

  return null;
}
