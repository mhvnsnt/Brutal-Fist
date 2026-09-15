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
  const [vsStartTime, setVsStartTime] = useState(0);

  // Pre-fetch assets automatically when reaching Main Menu if authenticated
  const { modelUrl, loading: modelLoading } = useDriveModel(
    !needsAuth && (screen === AppScreen.MainMenu || screen === AppScreen.Select || screen === AppScreen.VS || screen === AppScreen.Combat)
  );

  useEffect(() => {
    initAuth(
      () => setNeedsAuth(false),
      () => setNeedsAuth(true)
    );
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) setNeedsAuth(false);
    } catch (err) {
      console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  useEffect(() => {
    if (screen === AppScreen.Boot) {
      const timer = setTimeout(() => setScreen(AppScreen.Title), 2500);
      return () => clearTimeout(timer);
    }
    if (screen === AppScreen.VS) {
      setVsStartTime(Date.now());
    }
    if (screen === AppScreen.Combat) {
      if (engineState.p1Health <= 0 || engineState.p2Health <= 0) {
        const timer = setTimeout(() => setScreen(AppScreen.PostMatch), 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [screen, engineState.p1Health, engineState.p2Health]);

  useEffect(() => {
    if (screen === AppScreen.VS) {
      const elapsed = Date.now() - vsStartTime;
      const remaining = Math.max(0, 2500 - elapsed);
      
      if (!modelLoading) {
         const timer = setTimeout(() => setScreen(AppScreen.Combat), remaining);
         return () => clearTimeout(timer);
      }
    }
  }, [screen, modelLoading, vsStartTime]);

  const renderBoot = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white text-center">
      <h2 className="text-xl font-mono text-slate-400 tracking-[0.2em]">INITIALIZING SCHWARZERLICHT ENGINE</h2>
      <p className="text-sm font-mono text-slate-600 mt-2">v1.0.4.52</p>
    </div>
  );

  const renderTitle = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white relative">
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjIiIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4xNSIvPjwvc3ZnPg==')] z-10" />
      <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-indigo-500 mb-12 filter drop-shadow-lg z-20">
        BRUTAL FISTS
      </h1>
      <button 
        onClick={() => setScreen(AppScreen.MainMenu)}
        className="z-20 text-2xl font-bold uppercase tracking-widest text-yellow-400 animate-pulse bg-transparent border-none outline-none focus:outline-none"
      >
        Press Start
      </button>
    </div>
  );

  const renderMainMenu = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white relative">
      <h1 className="text-5xl md:text-7xl font-black italic tracking-tighter text-indigo-500 mb-12 filter drop-shadow-lg z-20">
        BRUTAL FISTS
      </h1>
      <div className="flex flex-col gap-4 w-64 z-20">
        <button onClick={() => setScreen(AppScreen.Select)} className="p-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase border-2 border-slate-700 text-left pl-6">
          Arcade Mode
        </button>
        <button onClick={() => setScreen(AppScreen.Select)} className="p-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase border-2 border-slate-700 text-left pl-6">
          Versus Mode
        </button>
        <button onClick={() => setScreen(AppScreen.Select)} className="p-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase border-2 border-slate-700 text-left pl-6">
          Training
        </button>
        <button onClick={() => setScreen(AppScreen.Options)} className="p-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase border-2 border-slate-700 text-left pl-6">
          Options
        </button>
      </div>
    </div>
  );

  const renderOptions = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-white relative">
      <h2 className="text-3xl font-black italic tracking-tighter text-slate-300 mb-8">OPTIONS</h2>
      <div className="flex flex-col gap-4 w-64 z-20">
        <button 
          onClick={handleLogin}
          disabled={isLoggingIn || !needsAuth}
          className={`p-3 font-bold uppercase ${needsAuth ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-green-600'} text-white border-2 border-slate-700 text-left pl-6`}
        >
          {isLoggingIn ? 'Connecting...' : needsAuth ? 'Link Drive Assets' : 'Assets Linked'}
        </button>
        <button 
          onClick={() => setScreen(AppScreen.MainMenu)}
          className="p-3 bg-slate-800 hover:bg-slate-700 text-white font-bold uppercase border-2 border-slate-700 text-left pl-6 mt-8"
        >
          Back
        </button>
      </div>
    </div>
  );

  const renderSelect = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-white p-4 relative">
      <h2 className="text-2xl font-bold uppercase mb-8 tracking-widest text-yellow-400 z-20">Select Character</h2>
      <div className="grid grid-cols-2 gap-4 w-full max-w-md z-20">
        <button 
          onClick={() => setScreen(AppScreen.VS)}
          className="bg-indigo-600/80 border-2 border-indigo-400 h-32 flex items-center justify-center font-bold uppercase tracking-wider shadow-[0_0_15px_rgba(99,102,241,0.5)]"
        >
          Brawler
        </button>
        <button 
          onClick={() => setScreen(AppScreen.VS)}
          className="bg-slate-700/80 border-2 border-slate-500 h-32 flex items-center justify-center font-bold uppercase tracking-wider hover:bg-slate-600"
        >
          Random
        </button>
      </div>
    </div>
  );

  const renderVS = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-8 relative overflow-hidden">
      <div className="absolute top-1/2 left-0 w-full h-32 bg-red-600/20 -skew-y-6 -translate-y-1/2 z-0"></div>
      <div className="flex w-full justify-between items-center z-10 px-8">
        <div className="text-3xl md:text-5xl font-black italic tracking-tighter text-indigo-400">BRAWLER</div>
        <div className="text-5xl font-black italic text-red-500">VS</div>
        <div className="text-3xl md:text-5xl font-black italic tracking-tighter text-slate-400">DUMMY</div>
      </div>
      <div className="absolute bottom-12 right-12 z-10 text-xl font-mono text-yellow-400 animate-pulse uppercase tracking-widest">
        {modelLoading ? 'NOW LOADING...' : 'NOW LOADING...'}
      </div>
    </div>
  );

  const renderCombat = () => (
    <div className="w-full h-full flex flex-col relative bg-black">
      {/* HUD (Health Bars & Timer) */}
      <div className="absolute top-0 left-0 w-full p-4 z-40 flex justify-between items-start gap-4">
        <div className="w-5/12 h-6 border-2 border-slate-300 bg-red-900 flex justify-end">
          <div className="h-full bg-yellow-400 transition-all duration-75" style={{ width: `${(engineState.p1Health / 250) * 100}%` }}></div>
        </div>
        <div className="w-12 h-12 bg-slate-900 border-2 border-slate-300 text-yellow-400 flex items-center justify-center text-xl font-bold font-mono">
          60
        </div>
        <div className="w-5/12 h-6 border-2 border-slate-300 bg-red-900">
          <div className="h-full bg-yellow-400 transition-all duration-75" style={{ width: `${(engineState.p2Health / 250) * 100}%` }}></div>
        </div>
      </div>

      <div className="absolute top-16 left-4 z-40 text-xs text-white bg-black/50 p-2 font-mono">
        State: {engineState.state} [{engineState.stateFrameCounter}]
      </div>

      <div className="flex-1 w-full h-full relative">
        <PSXCanvas fighterState={engineState.state} modelUrl={modelUrl} />
      </div>

      <MobileControls inputRef={inputRef} />
    </div>
  );

  const renderPostMatch = () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 text-white text-center">
      <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter text-yellow-400 mb-8 filter drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">
        {engineState.p2Health <= 0 ? 'K.O.' : 'TIME UP'}
      </h2>
      <button 
        onClick={() => window.location.reload()}
        className="px-8 py-3 bg-white text-slate-900 font-bold uppercase tracking-wider hover:bg-slate-200"
      >
        Continue
      </button>
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
