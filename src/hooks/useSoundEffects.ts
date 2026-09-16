'use client';

import { useRef, useCallback } from 'react';

/**
 * useSoundEffects — Web Audio API synthesized sound effects
 * No external files needed. All sounds generated procedurally.
 */
export function useSoundEffects() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  /** Short noise burst with envelope */
  const playNoise = useCallback((
    duration: number,
    gainPeak: number,
    filterFreq: number,
    filterQ: number,
    pitchShift = 0
  ) => {
    const ctx = getCtx();
    if (!ctx) return;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq + pitchShift;
    filter.Q.value = filterQ;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + duration);
  }, [getCtx]);

  /** Tone with envelope */
  const playTone = useCallback((
    freq: number,
    duration: number,
    gainPeak: number,
    type: OscillatorType = 'square',
    freqEnd?: number
  ) => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
    }

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }, [getCtx]);

  // ── SOUND EFFECTS ──────────────────────────────────────────────────────────

  /** Light punch / jab */
  const playLightHit = useCallback(() => {
    playNoise(0.08, 0.6, 2200, 3, Math.random() * 200 - 100);
    playTone(180, 0.06, 0.3, 'square', 90);
  }, [playNoise, playTone]);

  /** Heavy punch / power strike */
  const playHeavyHit = useCallback(() => {
    playNoise(0.14, 1.0, 800, 2, Math.random() * 100 - 50);
    playTone(90, 0.12, 0.5, 'sawtooth', 40);
    // Low thud
    playTone(55, 0.18, 0.4, 'sine', 30);
  }, [playNoise, playTone]);

  /** Block / guard impact */
  const playBlock = useCallback(() => {
    playNoise(0.06, 0.4, 3500, 5);
    playTone(320, 0.05, 0.25, 'square', 280);
  }, [playNoise, playTone]);

  /** Counter hit — extra crack */
  const playCounter = useCallback(() => {
    playNoise(0.10, 0.8, 1800, 4);
    playTone(440, 0.08, 0.4, 'sawtooth', 220);
    setTimeout(() => playTone(660, 0.06, 0.3, 'square', 330), 40);
  }, [playNoise, playTone]);

  /** Move execution whoosh */
  const playMoveExec = useCallback(() => {
    playNoise(0.07, 0.25, 4000, 8);
  }, [playNoise]);

  /** KO — dramatic low boom + high ring */
  const playKO = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    // Deep boom
    playTone(55, 0.6, 0.9, 'sine', 20);
    playNoise(0.5, 1.2, 200, 1);
    // High ring
    setTimeout(() => playTone(880, 0.8, 0.5, 'sine', 440), 80);
    // Crowd roar simulation
    setTimeout(() => playNoise(1.2, 0.6, 600, 0.5), 200);
  }, [getCtx, playTone, playNoise]);

  /** Round start bell */
  const playRoundStart = useCallback(() => {
    playTone(660, 0.4, 0.7, 'sine');
    setTimeout(() => playTone(880, 0.3, 0.5, 'sine'), 150);
    setTimeout(() => playTone(1100, 0.5, 0.6, 'sine'), 280);
  }, [playTone]);

  /** Victory fanfare */
  const playVictory = useCallback(() => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.3, 0.6, 'square'), i * 120);
    });
  }, [playTone]);

  /** Grapple initiation thud */
  const playGrapple = useCallback(() => {
    playNoise(0.12, 0.7, 400, 2);
    playTone(70, 0.15, 0.5, 'sine', 50);
  }, [playNoise, playTone]);

  return {
    playLightHit,
    playHeavyHit,
    playBlock,
    playCounter,
    playMoveExec,
    playKO,
    playRoundStart,
    playVictory,
    playGrapple,
  };
}
