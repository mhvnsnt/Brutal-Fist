import { useEffect, useState } from 'react';
import { useGameLoop } from './hooks/useGameLoop';
import { PSXCanvas } from './components/PSXCanvas';
import { MobileControls } from './components/MobileControls';
import { AppScreen } from './types';
import { useDriveModel } from './hooks/useDriveModel';
import { BANNON_ROSTER } from './data/bannonRoster';

export default function App() {
  const { engineState, inputRef } = useGameLoop();
  const [screen, setScreen] = useState<AppScreen>(AppScreen.Boot);
  const [vsStartTime, setVsStartTime] = useState<number | null>(null);
  const loadAssets = screen === AppScreen.Select || screen === AppScreen.VS || screen === AppScreen.Combat;
  const { modelUrl, loading: modelLoading, error: modelError } = useDriveModel(loadAssets);

  useEffect(() => {
    if (screen !== AppScreen.Boot) return;
    const timer = window.setTimeout(() => setScreen(AppScreen.Title), 1400);
    return () => window.clearTimeout(timer);
  }, [screen]);

  useEffect(() => {
    if (screen !== AppScreen.VS) { setVsStartTime(null); return; }
    setVsStartTime(Date.now());
  }, [screen]);

  useEffect(() => {
    if (screen !== AppScreen.VS || vsStartTime === null) return;
    const timer = window.setTimeout(() => setScreen(AppScreen.Combat), Math.max(0, 2200 - (Date.now() - vsStartTime)));
    return () => window.clearTimeout(timer);
  }, [screen, vsStartTime]);

  useEffect(() => {
    if (screen !== AppScreen.Combat) return;
    if (engineState.p1Health <= 0 || engineState.p2Health <= 0) {
      const timer = window.setTimeout(() => setScreen(AppScreen.MainMenu), 2200);
      return () => window.clearTimeout(timer);
    }
  }, [screen, engineState.p1Health, engineState.p2Health]);

  const p1Name = BANNON_ROSTER[0].name;
  const p2Name = BANNON_ROSTER[3].name;

  if (screen === AppScreen.Boot) return <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono"><div className="text-center"><div className="text-xs tracking-[0.45em] text-slate-500">SCHWARZERBLITZ RUNTIME</div><div className="mt-3 text-2xl font-black tracking-widest">BRUTAL FIST</div></div></div>;
  if (screen === AppScreen.Title) return <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono"><button autoFocus onClick={() => setScreen(AppScreen.MainMenu)} className="text-4xl font-black italic tracking-[0.18em] text-white animate-pulse">BRUTAL FIST<span className="block mt-8 text-sm tracking-[0.45em] text-yellow-400">PRESS START</span></button></div>;
  if (screen === AppScreen.MainMenu) return <div className="fixed inset-0 bg-[#10131a] text-white flex items-center justify-center font-mono"><div className="w-[min(86vw,420px)]"><div className="mb-10 text-xs tracking-[0.45em] text-slate-500">3D FIGHTING GAME</div><div className="space-y-2"><button onClick={() => setScreen(AppScreen.Select)} className="block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black">ARCADE</button><button onClick={() => setScreen(AppScreen.Select)} className="block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black">VERSUS</button><button onClick={() => setScreen(AppScreen.Select)} className="block w-full border border-slate-600 px-6 py-4 text-left text-xl font-black tracking-widest hover:bg-white hover:text-black">TRAINING</button></div></div></div>;
  if (screen === AppScreen.Select) return <div className="fixed inset-0 bg-black text-white flex flex-col items-center justify-center font-mono"><div className="text-xs tracking-[0.45em] text-slate-500 mb-4">CHARACTER SELECT · BANNON ROSTER</div><button onClick={() => setScreen(AppScreen.VS)} className="w-72 h-44 border-2 border-white bg-[#252933] hover:bg-[#3b414d]"><div className="text-2xl font-black tracking-widest">{p1Name}</div><div className="mt-3 text-xs text-slate-400">{BANNON_ROSTER.length} SEEDED FIGHTERS · ENTER TO FIGHT</div></button></div>;
  if (screen === AppScreen.VS) return <div className="fixed inset-0 bg-black text-white flex items-center justify-center font-mono overflow-hidden"><div className="w-full px-8 flex items-center justify-between"><div className="text-3xl md:text-6xl font-black italic">{p1Name}</div><div className="text-4xl md:text-7xl font-black text-red-500">VS</div><div className="text-3xl md:text-7xl font-black italic text-slate-500">{p2Name}</div></div><div className="absolute bottom-8 left-0 right-0 text-center text-xs tracking-[0.45em] text-yellow-400 animate-pulse">{modelLoading ? 'NOW LOADING FIGHTER' : 'NOW LOADING'}</div>{modelError && <div className="absolute bottom-2 left-0 right-0 text-center text-[9px] text-slate-700">FALLBACK ACTOR</div>}</div>;

  const p1Percent = Math.max(0, Math.min(100, (engineState.p1Health / engineState.p1MaxHealth) * 100));
  const p2Percent = Math.max(0, Math.min(100, (engineState.p2Health / engineState.p2MaxHealth) * 100));
  const ko = engineState.p1Health <= 0 || engineState.p2Health <= 0;

  return <div className="fixed inset-0 bg-black text-white overflow-hidden touch-none select-none">
    <PSXCanvas fighterState={engineState.state} opponentState={engineState.p2State} fighterAnimation={engineState.p1Animation} opponentAnimation={engineState.p2Animation} modelUrl={modelUrl} p1X={engineState.p1X} p1Z={engineState.p1Z} p2X={engineState.p2X} p2Z={engineState.p2Z} p1Facing={engineState.p1Facing} p2Facing={engineState.p2Facing} />
    <div className="pointer-events-none absolute top-3 left-3 right-3 z-30 flex items-center gap-3"><div className="h-5 flex-1 border border-white/70 bg-black/70 p-[2px]"><div className="h-full bg-yellow-400" style={{ width: `${p1Percent}%` }} /></div><div className="px-3 text-lg font-black italic">{Math.max(0, Math.ceil((180 - engineState.frame) / 60))}</div><div className="h-5 flex-1 border border-white/70 bg-black/70 p-[2px]"><div className="h-full bg-yellow-400 ml-auto" style={{ width: `${p2Percent}%` }} /></div></div>
    <div className="pointer-events-none absolute left-3 right-3 top-10 z-30 flex justify-between text-[9px] font-mono text-white/60"><span>{p1Name}</span><span>{p2Name} · 60HZ SIM · F{engineState.frame}</span></div>
    {ko && <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"><div className="text-7xl md:text-9xl font-black italic tracking-widest text-yellow-400">K.O.</div></div>}
    {!ko && <MobileControls inputRef={inputRef} />}
  </div>;
}
