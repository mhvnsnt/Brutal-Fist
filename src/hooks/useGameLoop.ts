import { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../engine/GameEngine';
import { InputBitmask } from '../types';

export function useGameLoop() {
  const engineRef = useRef(new GameEngine());
  const [engineState, setEngineState] = useState<{
    frame: number;
    state: string;
    stateFrameCounter: number;
    buffer: InputBitmask[];
    p1Health: number;
    p2Health: number;
  }>({
    frame: 0,
    state: 'Neutral',
    stateFrameCounter: 0,
    buffer: [],
    p1Health: 250,
    p2Health: 250
  });

  const inputRef = useRef<InputBitmask>({
    up: false, down: false, left: false, right: false, light: false, heavy: false, guard: false
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w': inputRef.current.up = true; break;
        case 's': inputRef.current.down = true; break;
        case 'a': inputRef.current.left = true; break;
        case 'd': inputRef.current.right = true; break;
        case 'j': inputRef.current.light = true; break;
        case 'k': inputRef.current.heavy = true; break;
        case 'l': inputRef.current.guard = true; break;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w': inputRef.current.up = false; break;
        case 's': inputRef.current.down = false; break;
        case 'a': inputRef.current.left = false; break;
        case 'd': inputRef.current.right = false; break;
        case 'j': inputRef.current.light = false; break;
        case 'k': inputRef.current.heavy = false; break;
        case 'l': inputRef.current.guard = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let accumulator = 0;
    const TIME_STEP = 1000 / 60; // 60 TPS

    const loop = (time: number) => {
      accumulator += time - lastTime;
      lastTime = time;

      let ticked = false;
      while (accumulator >= TIME_STEP) {
        engineRef.current.tick(inputRef.current);
        accumulator -= TIME_STEP;
        ticked = true;
      }

      if (ticked) {
        setEngineState({
          frame: engineRef.current.currentFrame,
          state: engineRef.current.state,
          stateFrameCounter: engineRef.current.stateFrameCounter,
          buffer: [...engineRef.current.inputBuffer],
          p1Health: engineRef.current.p1Health,
          p2Health: engineRef.current.p2Health
        });
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return { engineState, inputRef };
}
