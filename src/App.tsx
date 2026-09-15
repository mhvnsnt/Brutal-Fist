import { useState, useEffect } from 'react';
import { useGameLoop } from './hooks/useGameLoop';
import { PSXCanvas } from './components/PSXCanvas';
import { MobileControls } from './components/MobileControls';
import { AppScreen } from './types';
import { initAuth, googleSignIn } from './lib/firebase';
import { useDriveModel } from './hooks/useDriveModel';

export default function App() {
  const { engineState, inputRef } = useGameLoop();
  const [screen, setScreen] = useState<AppScreen>(AppScreen.Boot);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [vsStartTime, setVsStartTime] = useState<number | null>(null);

  // Drive is an implementation detail. It is never exposed on the title screen.
  const shouldPrefetch = !needsAuth && (
    screen === AppScreen.MainMenu || screen === AppScreen.Select ||
    screen === AppScreen.VS || screen === AppScreen.Combat
  );
  const { modelUrl, loading: modelLoading, error: modelError } = useDriveModel(shouldPrefetch);

  useEffect(() => {
    const unsubscribe = initAuth(
      () => setNeedsAuth(false),
      () => setNeedsAuth(true)
    );
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      if (await googleSignIn()) setNeedsAuth(false);
    } catch (err) {
      console.error('Asset authorization failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Deterministic arcade flow: Boot -> Title -> Menu -> Select -> VS -> Combat.
  useEffect(() => {
    if (screen === AppScreen.Boot) {
      const timer = window.setTimeout(() => setScreen(AppScreen.Title), 2500);
      return () => window.clearTimeout(timer);
    }
    if (screen === AppScreen.VS) setVsStartTime(Date.now());
    else setVsStartTime(null);
  }, [screen]);

  useEffect(() => {
    if (screen !== AppScreen.VS || vsStartTime === null) return;
    const remaining = Math.max(0, 2500 - (Date.now() - vsStartTime));
    const timer = window.setTimeout(() => setScreen(AppScreen.Combat), remaining);
    return () => window.clearTimeout(timer);
  }, [screen, vsStartTime]);

  useEffect(() => {
    if (screen !== AppScreen.Combat) return;
    if (engineState.p1Health <= 0 || engineState.p2Health <= 0) {
      const timer = window.setTimeout(() => setScreen(AppScreen.PostMatch), 2000);
      return () => window.clearTimeout(timer);
    }
  }, [screen, engineState.p1Health, engineState.p2Health]);

  const renderBoot = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white text-center">
      <h2 className="text-xl font-mono text-slate-400 tracking-[0.2em]">INITIALIZING SCHWARZERBLITZ ENGINE</h2>
      <p className="text-sm font-mono text-slate-600 mt-2">v1.0.4.52</p>
    </div>
  );

  const renderTitle = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white relative">
      <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-indigo-500 mb-12 z-20">BRUTAL FISTS</h1>
      <button onClick={() => setScreen(AppScreen.MainMenu)} className="z-20 text-2xl font-bold uppercase tracking-widest text-yellow-400 animate-pulse bg-transparent border-none outline-none">Press Start</button>
    </div>
  );

  const renderMainMenu = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white">
      <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-indigo-500 mb-12">BRUTAL FISTS</h1>
      <div className="flex flex-col gap-4 w-64">
        <button onClick={() => setScreen(AppScreen.Select)} className="p-3 bg-slate-800 text-white font-bold uppercase border-2 border-slate-700 text-left pl-6">Arcade Mode</button>
        <button onClick={() => setScreen(AppScreen.Select)} className="p-3 bg-slate-800 text-white font-bold uppercase border-2 border-slate-700 text-left pl-6">Versus Mode</button>
        <button onClick={() => setScreen(AppScreen.Select)} className="p-3 bg-slate-800 text-white font-bold uppercase border-2 border-slate-700 text-left pl-6">Training</button>
        <button onClick={() => setScreen(AppScreen.Options)} className="p-3 bg-slate-800 text-white font-bold uppercase border-2 border-slate-700 text-left pl-6">Options</button>
      </div>
    </div>
  );

  const renderOptions = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white">
      <h2 className="text-3xl font-black italic tracking-tighter text-slate-300 mb-8">OPTIONS</h2>
      <div className="flex flex-col gap-4 w-64">
        <button onClick={handleLogin} disabled={isLoggingIn || !needsAuth} className={`p-3 font-bold uppercase ${needsAuth ? 'bg-indigo-600' : 'bg-green-600'} text-white border-2 border-slate-700 text-left pl-6`}>
          {isLoggingIn ? 'Linking Assets...' : needsAuth ? 'Link Drive Assets' : 'Assets Linked'}
        </button>
        <button onClick={() => setScreen(AppScreen.MainMenu)} className="p-3 bg-slate-800 text-white font-bold uppercase border-2 border-slate-700 text-left pl-6 mt-8">Back</button>
      </div>
    </div>
  );

  const renderSelect = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-white p-4">
      <h2 className="text-2xl font-bold uppercase mb-8 tracking-widest text-yellow-400">Select Character</h2>
      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        <button onClick={() => setScreen(AppScreen.VS)} className="bg-indigo-600/80 border-2 border-indigo-400 h-32 flex items-center justify-center font-bold uppercase">Brawler</button>
        <button onClick={() => setScreen(AppScreen.VS)} className="bg-slate-700/80 border-2 border-slate-500 h-32 flex items-center justify-center font-bold uppercase">Random</button>
      </div>
    </div>
  );

  const renderVS = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-8 relative overflow-hidden">
      <div className="flex w-full justify-between items-center px-8">
        <div className="text-3xl md:text-5xl font-black italic text-indigo-400">BRAWLER</div>
        <div className="text-5xl font-black italic text-red-500">VS</div>
        <div className="text-3xl md:text-5xl font-black italic text-slate-400">DUMMY</div>
      </div>
      <div className="absolute bottom-12 right-12 text-xl font-mono text-yellow-400 animate-pulse uppercase tracking-widest">NOW LOADING...</div>
      <div className="absolute bottom-4 left-4 text-[10px] font-mono text-slate-600 uppercase">
        {modelLoading ? 'Preparing fighter data' : modelUrl ? 'Fighter data ready' : modelError ? 'Engine fallback' : 'Preparing fighter data'}
      </div>
    </div>
  );

  const renderCombat = () => (
    <div className="w-full h-full flex flex-col relative bg-black">
      <div className="absolute top-0 left-0 w-full p-4 z-40 flex justify-between items-start gap-4">
        <div className="w-5/12 h-6 border-2 border-slate-300 bg-red-900 flex justify-end"><div className="h-full bg-yellow-400" style={{ width: `${Math.max(0, Math.min(100, (engineState.p1Health / 250) * 100))}%` }} /></div>
        <div className="w-12 h-12 bg-slate-900 border-2 border-slate-300 text-yellow-400 flex items-center justify-center text-xl font-bold font-mono">60</div>
        <div className="w-5/12 h-6 border-2 border-slate-300 bg-red-900"><div className="h-full bg-yellow-400" style={{ width: `${Math.max(0, Math.min(100, (engineState.p2Health / 250) * 100))}%` }} /></div>
      </div>
      <div className="absolute top-16 left-4 z-40 text-xs text-white bg-black/50 p-2 font-mono">State: {engineState.state} [{engineState.stateFrameCounter}]</div>
      <div className="flex-1 w-full h-full relative"><PSXCanvas fighterState={engineState.state} modelUrl={modelUrl} /></div>
      <MobileControls inputRef={inputRef} />
    </div>
  );

  const renderPostMatch = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 text-white text-center">
      <h2 className="text-4xl md:text-6xl font-black italic text-yellow-400 mb-8">{engineState.p2Health <= 0 ? 'K.O.' : 'TIME UP'}</h2>
      <button onClick={() => setScreen(AppScreen.MainMenu)} className="px-8 py-3 bg-white text-slate-900 font-bold uppercase">Continue</button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black text-slate-200 flex flex-col overflow-hidden font-sans select-none touch-none">
      {screen === AppScreen.Boot && renderBoot()}
      {screen === AppScreen.Title && renderTitle()}
      {screen === AppScreen.MainMenu && renderMainMenu()}
      {screen === AppScreen.Options && renderOptions()}
      {screen === AppScreen.Select && renderSelect()}
      {screen === AppScreen.VS && renderVS()}
      {screen === AppScreen.Combat && renderCombat()}
      {screen === AppScreen.PostMatch && renderPostMatch()}
    </div>
  );
}
