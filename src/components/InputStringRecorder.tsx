'use client';

/**
 * InputStringRecorder — Records a complete P1 input string (button presses + timing),
 * loops playback infinitely so testers can analyze combos and frame-data behavior
 * against a fixed opponent pattern.
 *
 * Architecture:
 *   - Records rising-edge button presses with precise timestamps
 *   - Stores the full sequence as an InputEvent array
 *   - Playback: replays the sequence by injecting inputs into the game's inputRef
 *   - Loop mode: restarts from frame 0 after the last input + a configurable gap
 *   - Display: shows the input string as a visual notation (Z=light, X=heavy, C=guard, etc.)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { InputBitmask } from '../types';

export interface InputEvent {
  key: keyof InputBitmask;
  pressed: boolean;
  timestamp: number;
  /** Relative time from start of recording (ms) */
  relativeMs: number;
}

export interface InputString {
  id: string;
  label: string;
  events: InputEvent[];
  totalDurationMs: number;
  recordedAt: string;
}

const KEY_LABELS: Record<string, string> = {
  light: 'Z',
  heavy: 'X',
  guard: 'C',
  grapple: 'V',
  left: '←',
  right: '→',
  up: '↑',
  down: '↓',
  up_left: '↖',
  up_right: '↗',
  escape: 'ESC',
  pin: 'PIN',
};

const KEY_COLORS: Record<string, string> = {
  light: '#60a5fa',
  heavy: '#f87171',
  guard: '#4ade80',
  grapple: '#facc15',
  left: '#a78bfa',
  right: '#a78bfa',
  up: '#a78bfa',
  down: '#a78bfa',
};

interface InputStringRecorderProps {
  inputRef: React.MutableRefObject<InputBitmask>;
  /** Called when playback injects an input — use to sync with game state */
  onPlaybackInput?: (input: Partial<InputBitmask>) => void;
}

export function InputStringRecorder({ inputRef, onPlaybackInput }: InputStringRecorderProps) {
  const [open, setOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [loopGapMs, setLoopGapMs] = useState(1000);
  const [savedStrings, setSavedStrings] = useState<InputString[]>([]);
  const [activeStringId, setActiveStringId] = useState<string | null>(null);
  const [currentLabel, setCurrentLabel] = useState('Combo 1');
  const [playbackPos, setPlaybackPos] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const recordingRef = useRef<InputEvent[]>([]);
  const recordStartRef = useRef<number>(0);
  const prevInputRef = useRef<InputBitmask>({
    up: false, down: false, left: false, right: false,
    light: false, heavy: false, guard: false,
    grapple: false, escape: false, pin: false,
  });
  const playbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackIndexRef = useRef(0);
  const playbackLoopCountRef = useRef(0);
  const [loopCount, setLoopCount] = useState(0);

  // ── Recording: poll inputRef for rising/falling edges ────────────────────
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(() => {
    recordingRef.current = [];
    recordStartRef.current = performance.now();
    setIsRecording(true);

    pollIntervalRef.current = setInterval(() => {
      const now = performance.now();
      const cur = inputRef.current;
      const prev = prevInputRef.current;
      const keys: Array<keyof InputBitmask> = ['light', 'heavy', 'guard', 'grapple', 'left', 'right', 'up', 'down', 'escape', 'pin'];

      for (const key of keys) {
        const curVal = cur[key] ?? false;
        const prevVal = prev[key] ?? false;
        if (curVal !== prevVal) {
          recordingRef.current.push({
            key,
            pressed: curVal,
            timestamp: now,
            relativeMs: now - recordStartRef.current,
          });
        }
      }
      prevInputRef.current = { ...cur };
    }, 8); // ~120fps polling
  }, [inputRef]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const events = recordingRef.current;
    if (events.length === 0) return;

    const totalDurationMs = events[events.length - 1].relativeMs + 200;
    const str: InputString = {
      id: `input_${Date.now()}`,
      label: currentLabel,
      events,
      totalDurationMs,
      recordedAt: new Date().toISOString(),
    };
    setSavedStrings(prev => [...prev, str]);
    setActiveStringId(str.id);
  }, [currentLabel]);

  // ── Playback: replay events with precise timing ───────────────────────────
  const stopPlayback = useCallback(() => {
    setIsPlaying(false);
    if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
    playbackIndexRef.current = 0;
    setPlaybackPos(0);
    setPlaybackProgress(0);
  }, []);

  const scheduleNextEvent = useCallback((str: InputString, index: number, loopStart: number) => {
    if (index >= str.events.length) {
      // End of string — loop or stop
      if (loopEnabled) {
        playbackLoopCountRef.current += 1;
        setLoopCount(playbackLoopCountRef.current);
        playbackTimerRef.current = setTimeout(() => {
          playbackIndexRef.current = 0;
          scheduleNextEvent(str, 0, performance.now());
        }, loopGapMs);
      } else {
        stopPlayback();
      }
      return;
    }

    const event = str.events[index];
    const elapsed = performance.now() - loopStart;
    const delay = Math.max(0, event.relativeMs - elapsed);

    playbackTimerRef.current = setTimeout(() => {
      // Inject input
      const patch: Partial<InputBitmask> = { [event.key]: event.pressed };
      if (inputRef.current) {
        (inputRef.current as any)[event.key] = event.pressed;
      }
      onPlaybackInput?.(patch);

      playbackIndexRef.current = index + 1;
      setPlaybackPos(index + 1);
      setPlaybackProgress((index + 1) / str.events.length);

      scheduleNextEvent(str, index + 1, loopStart);
    }, delay);
  }, [loopEnabled, loopGapMs, inputRef, onPlaybackInput, stopPlayback]);

  const startPlayback = useCallback((str: InputString) => {
    stopPlayback();
    setIsPlaying(true);
    playbackLoopCountRef.current = 0;
    setLoopCount(0);
    const loopStart = performance.now();
    scheduleNextEvent(str, 0, loopStart);
  }, [stopPlayback, scheduleNextEvent]);

  useEffect(() => {
    return () => {
      if (playbackTimerRef.current) clearTimeout(playbackTimerRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const activeString = savedStrings.find(s => s.id === activeStringId);

  // Build visual notation from events (press-only, no releases)
  const buildNotation = (str: InputString) => {
    return str.events
      .filter(e => e.pressed)
      .map(e => KEY_LABELS[e.key] ?? e.key.toUpperCase())
      .join(' → ');
  };

  const exportString = useCallback((str: InputString) => {
    const blob = new Blob([JSON.stringify(str, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `input_string_${str.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="absolute bottom-20 left-3 z-40 font-mono">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[8px] tracking-widest border border-zinc-700 bg-black/80 text-zinc-400 hover:text-blue-400 hover:border-blue-700 px-2 py-1 transition-colors"
      >
        🎮 INPUT
      </button>

      {open && (
        <div
          className="absolute bottom-8 left-0 w-72 border border-zinc-700 bg-black/95 p-3 space-y-2"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-blue-400 tracking-widest font-black">INPUT RECORDER</span>
            <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-300 text-xs">✕</button>
          </div>

          {/* Label input */}
          <div className="flex gap-1">
            <input
              type="text"
              value={currentLabel}
              onChange={e => setCurrentLabel(e.target.value)}
              className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-300 text-[8px] px-2 py-0.5 font-mono"
              placeholder="Combo name..."
            />
          </div>

          {/* Record controls */}
          <div className="flex gap-1">
            {!isRecording ? (
              <button
                onClick={startRecording}
                className="flex-1 text-[8px] font-black border border-red-700 text-red-400 hover:bg-red-900/30 py-1 tracking-widest transition-colors"
              >
                ● RECORD
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex-1 text-[8px] font-black border border-red-500 text-red-300 bg-red-900/20 py-1 tracking-widest animate-pulse"
              >
                ■ STOP ({recordingRef.current.length} events)
              </button>
            )}
          </div>

          {/* Saved strings list */}
          {savedStrings.length > 0 && (
            <div className="space-y-1">
              <div className="text-[7px] text-zinc-500 tracking-wider">SAVED STRINGS</div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {savedStrings.map(str => (
                  <div
                    key={str.id}
                    className={`border p-1.5 cursor-pointer transition-colors ${
                      activeStringId === str.id
                        ? 'border-blue-600 bg-blue-950/30' :'border-zinc-800 hover:border-zinc-600'
                    }`}
                    onClick={() => setActiveStringId(str.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[7px] text-zinc-300 font-black">{str.label}</span>
                      <span className="text-[6px] text-zinc-600">{str.events.length} events · {(str.totalDurationMs / 1000).toFixed(2)}s</span>
                    </div>
                    <div className="text-[6px] text-zinc-500 mt-0.5 truncate">
                      {buildNotation(str).slice(0, 60)}{buildNotation(str).length > 60 ? '…' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active string playback */}
          {activeString && (
            <div className="space-y-1.5">
              {/* Visual notation */}
              <div className="border border-zinc-800 bg-zinc-950 p-1.5">
                <div className="text-[6px] text-zinc-500 mb-1">INPUT NOTATION</div>
                <div className="flex flex-wrap gap-0.5">
                  {activeString.events.filter(e => e.pressed).map((e, i) => (
                    <span
                      key={i}
                      className="text-[7px] font-black px-1 py-0.5 border"
                      style={{
                        color: KEY_COLORS[e.key] ?? '#a1a1aa',
                        borderColor: (KEY_COLORS[e.key] ?? '#52525b') + '88',
                        background: (KEY_COLORS[e.key] ?? '#27272a') + '22',
                      }}
                    >
                      {KEY_LABELS[e.key] ?? e.key.toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              {/* Loop settings */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loopEnabled}
                    onChange={e => setLoopEnabled(e.target.checked)}
                    className="accent-blue-400"
                  />
                  <span className="text-[7px] text-zinc-400">LOOP ∞</span>
                </label>
                {loopEnabled && (
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-[6px] text-zinc-600">GAP</span>
                    <input
                      type="range"
                      min={200}
                      max={3000}
                      step={100}
                      value={loopGapMs}
                      onChange={e => setLoopGapMs(Number(e.target.value))}
                      className="flex-1 h-1 accent-blue-400"
                    />
                    <span className="text-[6px] text-blue-400">{(loopGapMs / 1000).toFixed(1)}s</span>
                  </div>
                )}
              </div>

              {/* Playback controls */}
              <div className="flex gap-1">
                {!isPlaying ? (
                  <button
                    onClick={() => startPlayback(activeString)}
                    className="flex-1 text-[8px] font-black border border-blue-700 text-blue-400 hover:bg-blue-900/30 py-1 tracking-widest transition-colors"
                  >
                    ▶ PLAY {loopEnabled ? '∞' : '1×'}
                  </button>
                ) : (
                  <button
                    onClick={stopPlayback}
                    className="flex-1 text-[8px] font-black border border-blue-500 text-blue-300 bg-blue-900/20 py-1 tracking-widest"
                  >
                    ■ STOP
                  </button>
                )}
                <button
                  onClick={() => exportString(activeString)}
                  className="text-[7px] border border-zinc-700 text-zinc-400 hover:text-yellow-400 hover:border-yellow-700 px-2 py-1 transition-colors"
                >
                  ⬇
                </button>
              </div>

              {/* Playback progress */}
              {isPlaying && (
                <div className="space-y-0.5">
                  <div className="h-0.5 bg-zinc-800 w-full">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${playbackProgress * 100}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[6px] text-zinc-600">
                    <span>Event {playbackPos}/{activeString.events.length}</span>
                    {loopEnabled && <span className="text-blue-400">Loop #{loopCount + 1}</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
