import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../engine/GameEngine';
import { InputBitmask } from '../types';

export function useGameLoop() {
  const engineRef = useRef(new GameEngine());
  const [engineState, setEngineState] = useState({
    frame: 0,
    state: 'Neutral',
    p2State: 'Neutral',
    stateFrameCounter: 0,
    p2StateFrameCounter: 0,
    buffer: [] as InputBitmask[],
    p1Health: 250,
    p2Health: 250,
    p1X: -2.25,
    p1Z: 0,
    p2X: 2.25,
    p2Z: 0
  });

  const inputRef = useRef<InputBitmask>({
    up: false, down: false, left: false, right: false, light: false, heavy: false, guard: false
  });

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
    const down = handleKey(true);
    const up = handleKey(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let accumulator = 0;
    const step = 1000 / 60;

    const loop = (time: number) => {
      accumulator += Math.min(100, time - last);
      last = time;

      let ticked = false;
      while (accumulator >= step) {
        engineRef.current.tick(inputRef.current);
        accumulator -= step;
        ticked = true;
      }

      if (ticked) {
        const engine = engineRef.current;
        setEngineState({
          frame: engine.currentFrame,
          state: engine.state,
          p2State: engine.p2State,
          stateFrameCounter: engine.stateFrameCounter,
          p2StateFrameCounter: engine.p2StateFrameCounter,
          buffer: [...engine.inputBuffer],
          p1Health: engine.p1Health,
          p2Health: engine.p2Health,
          p1X: engine.p1X,
          p1Z: engine.p1Z,
          p2X: engine.p2X,
          p2Z: engine.p2Z
        });
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { engineState, inputRef };
}
