import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../engine/GameEngine';
import { InputBitmask } from '../types';

export function useGameLoop() {
  const engineRef = useRef(new GameEngine());
  const makeState = () => {
    const snapshot = engineRef.current.getSnapshot();
    return {
      ...snapshot,
      p1Health: snapshot.p1.health,
      p2Health: snapshot.p2.health,
      p1MaxHealth: engineRef.current.p1MaxHealth,
      p2MaxHealth: engineRef.current.p2MaxHealth,
      p1X: snapshot.p1.x,
      p1Z: snapshot.p1.z,
      p2X: snapshot.p2.x,
      p2Z: snapshot.p2.z,
      state: snapshot.p1.state,
      p2State: snapshot.p2.state,
      p1Facing: snapshot.p1.facing,
      p2Facing: snapshot.p2.facing,
      p1Animation: snapshot.p1.animation,
      p2Animation: snapshot.p2.animation
    };
  };

  const [engineState, setEngineState] = useState(makeState);
  const inputRef = useRef<InputBitmask>({ up: false, down: false, left: false, right: false, light: false, heavy: false, guard: false });

  useEffect(() => {
    const handleKey = (pressed: boolean) => (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w': inputRef.current.up = pressed; break;
        case 's': inputRef.current.down = pressed; break;
        case 'a': inputRef.current.left = pressed; break;
        case 'd': inputRef.current.right = pressed; break;
        case 'j': inputRef.current.light = pressed; break;
        case 'k': inputRef.current.heavy = pressed; break;
        case 'l': inputRef.current.guard = pressed; break;
      }
    };
    const down = handleKey(true); const up = handleKey(false);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    let raf = 0; let last = performance.now(); let accumulator = 0; const fixedStepMs = 1000 / 60;
    const loop = (time: number) => {
      accumulator += Math.min(100, time - last); last = time;
      while (accumulator >= fixedStepMs) { engineRef.current.tick({ ...inputRef.current }); accumulator -= fixedStepMs; }
      setEngineState(makeState());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { engineState, inputRef };
}
