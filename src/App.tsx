import { useEffect, useState } from 'react';
import { AppScreen } from './types';
import { BANNON_GLB_PLAYABLE_MODELS } from './data/bannonGlbRoster';
import { type BannonFighterProfile, getBannonFighter } from './data/bannonRoster';
import dynamic from 'next/dynamic';
import { useAuth } from './contexts/AuthContext';
import { type TournamentEndData } from './components/TournamentBracket';
import { type TournamentSettings, DEFAULT_TOURNAMENT_SETTINGS } from './components/TournamentSettingsScreen';

const CharacterSelect = dynamic(() => import('./components/CharacterSelect'), { ssr: false });
const GameBattleArena = dynamic(() => import('./components/GameBattleArena'), { ssr: false });
const TournamentBracket = dynamic(() => import('./components/TournamentBracket'), { ssr: false });
const TournamentStatsScreen = dynamic(() => import('./components/TournamentStatsScreen'), { ssr: false });
const TournamentBrowserScreen = dynamic(() => import('./components/TournamentBrowserScreen'), { ssr: false });
const AuthScreen = dynamic(() => import('./components/AuthScreen'), { ssr: false });
const PostTournamentScreen = dynamic(() => import('./components/PostTournamentScreen'), { ssr: false });
const PlayerProfileScreen = dynamic(() => import('./components/PlayerProfileScreen'), { ssr: false });
const TournamentSettingsScreen = dynamic(() => import('./components/TournamentSettingsScreen'), { ssr: false });
const LeaderboardScreen = dynamic(() => import('./components/LeaderboardScreen'), { ssr: false });

export default function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [screen, setScreen] = useState<AppScreen>(AppScreen?.Boot);
  const [p1BannonFighter, setP1BannonFighter] = useState<BannonFighterProfile | null>(null);
  const [p2BannonFighter, setP2BannonFighter] = useState<BannonFighterProfile | null>(null);
  const [matchWinner, setMatchWinner] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [gameMode, setGameMode] = useState<'arcade' | 'versus' | 'tournament'>('versus');
  const [tournamentEndData, setTournamentEndData] = useState<TournamentEndData | null>(null);
  const [tournamentSettings, setTournamentSettings] = useState<TournamentSettings>(DEFAULT_TOURNAMENT_SETTINGS);

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

  // ── Auth loading ──
  if (authLoading) {
    return (
      <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono">
        <div className="text-[9px] tracking-[0.45em] text-zinc-600 animate-pulse">AUTHENTICATING...</div>
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
          <div className="mb-2 text-xs tracking-[0.45em] text-slate-500">3D FIGHTING GAME</div>
          {user && (
            <div className="mb-6 flex items-center justify-between">
              <div className="text-[8px] tracking-widest text-zinc-600">
                PLAYER: <span className="text-zinc-400">{(user.email ?? '').split('@')[0].toUpperCase()}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="text-[7px] tracking-widest text-zinc-700 hover:text-zinc-400 transition-colors border border-zinc-800 px-2 py-1"
              >
                SIGN OUT
              </button>
            </div>
          )}
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
              onClick={() => { setGameMode('tournament'); setScreen('tournament_browser' as any); }}
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
            <button
              onClick={() => setScreen('leaderboard' as any)}
              className="block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all"
            >
              LEADERBOARD
              <span className="ml-3 text-[10px] text-yellow-400 tracking-widest">GLOBAL RANKS</span>
            </button>
            <button
              onClick={() => {
                if (!user) { setScreen('auth' as any); }
                else { setScreen('stats' as any); }
              }}
              className="block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all"
            >
              STATS
              <span className="ml-3 text-[10px] text-zinc-500 tracking-widest">RECORDS & RANK</span>
            </button>
            <button
              onClick={() => {
                if (!user) { setScreen('auth' as any); }
                else { setScreen('profile' as any); }
              }}
              className="block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black transition-all"
            >
              PROFILE
              <span className="ml-3 text-[10px] text-zinc-500 tracking-widest">MASTERY & COSMETICS</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Auth Screen ──
  if ((screen as any) === 'auth') {
    return <AuthScreen onSuccess={() => setScreen('stats' as any)} />;
  }

  // ── Tournament Browser ──
  if ((screen as any) === 'tournament_browser') {
    return <TournamentBrowserScreen onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Tournament Settings (pre-entry) ──
  if ((screen as any) === 'tournament_settings') {
    return (
      <TournamentSettingsScreen
        initialSettings={tournamentSettings}
        onBack={() => setScreen(AppScreen?.MainMenu)}
        onConfirm={(s) => {
          setTournamentSettings(s);
          setScreen('tournament_browser' as any);
        }}
      />
    );
  }

  // ── Leaderboard ──
  if ((screen as any) === 'leaderboard') {
    return <LeaderboardScreen onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Tournament Stats (auth-gated) ──
  if ((screen as any) === 'stats') {
    if (!user) return <AuthScreen onSuccess={() => setScreen('stats' as any)} />;
    return <TournamentStatsScreen onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Player Profile Screen ──
  if ((screen as any) === 'profile') {
    if (!user) return <AuthScreen onSuccess={() => setScreen('profile' as any)} />;
    return <PlayerProfileScreen onBack={() => setScreen(AppScreen?.MainMenu)} />;
  }

  // ── Post Tournament Screen ──
  if ((screen as any) === 'post_tournament' && tournamentEndData) {
    return (
      <PostTournamentScreen
        playerFighter={tournamentEndData.playerFighter}
        results={tournamentEndData.results}
        stats={tournamentEndData.stats}
        isChampion={tournamentEndData.isChampion}
        rankPointsEarned={tournamentEndData.rankPointsEarned}
        rankTier={tournamentEndData.rankTier}
        onMainMenu={() => { setTournamentEndData(null); setScreen(AppScreen?.MainMenu); }}
        onPlayAgain={() => { setTournamentEndData(null); setScreen('tournament_browser' as any); }}
      />
    );
  }

  // ── Character Select ──
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
        onTournamentEnd={(data) => {
          setTournamentEndData(data);
          setScreen('post_tournament' as any);
        }}
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
        settings={tournamentSettings}
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
