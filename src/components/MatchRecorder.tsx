'use client';

/**
 * MatchRecorder — 30-second rolling match recorder with frame-by-frame scrub
 * and tournament-ready clip export with custom speed and region crop.
 *
 * Architecture:
 *   - Maintains a 30-second circular buffer of MatchFrame snapshots (60fps = 1800 frames max)
 *   - Frame data: p1/p2 state, animation, health, position, input bitmask, timestamp
 *   - Scrub UI: timeline slider, frame-by-frame prev/next, playback speed control
 *   - Export: serializes selected region to JSON with metadata for tournament use
 *   - Region crop: set in/out points on the timeline to export a sub-clip
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';

export interface MatchFrame {
  frameIndex: number;
  timestamp: number;
  p1State: string;
  p2State: string;
  p1Animation: string;
  p2Animation: string;
  p1Health: number;
  p2Health: number;
  p1X: number;
  p2X: number;
  p1Z: number;
  p2Z: number;
  p1Input: {
    light: boolean; heavy: boolean; guard: boolean;
    left: boolean; right: boolean; up: boolean; down: boolean;
  };
  roundTimer: number;
}

export interface MatchClip {
  id: string;
  label: string;
  p1Name: string;
  p2Name: string;
  stageName: string;
  frames: MatchFrame[];
  inPoint: number;
  outPoint: number;
  speedMultiplier: number;
  exportedAt: string;
  totalFrames: number;
  durationMs: number;
}

const MAX_BUFFER_FRAMES = 1800; // 30s @ 60fps

export function useMatchRecorder() {
  const bufferRef = useRef<MatchFrame[]>([]);
  const frameCountRef = useRef(0);
  const isRecordingRef = useRef(false);

  const startRecording = useCallback(() => {
    bufferRef.current = [];
    frameCountRef.current = 0;
    isRecordingRef.current = true;
  }, []);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
  }, []);

  const recordFrame = useCallback((frame: Omit<MatchFrame, 'frameIndex'>) => {
    if (!isRecordingRef.current) return;
    const f: MatchFrame = { ...frame, frameIndex: frameCountRef.current++ };
    bufferRef.current.push(f);
    // Rolling 30-second window
    if (bufferRef.current.length > MAX_BUFFER_FRAMES) {
      bufferRef.current.shift();
    }
  }, []);

  const getBuffer = useCallback((): MatchFrame[] => {
    return [...bufferRef.current];
  }, []);

  const isRecording = () => isRecordingRef.current;

  return { startRecording, stopRecording, recordFrame, getBuffer, isRecording };
}

interface MatchRecorderHUDProps {
  p1Name: string;
  p2Name: string;
  stageName: string;
  getBuffer: () => MatchFrame[];
  isRecording: () => boolean;
  onScrubFrame?: (frame: MatchFrame) => void;
}

export function MatchRecorderHUD({
  p1Name,
  p2Name,
  stageName,
  getBuffer,
  isRecording,
  onScrubFrame,
}: MatchRecorderHUDProps) {
  const [open, setOpen] = useState(false);
  const [frames, setFrames] = useState<MatchFrame[]>([]);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadBuffer = useCallback(() => {
    const buf = getBuffer();
    setFrames(buf);
    if (buf.length > 0) {
      setScrubIndex(buf.length - 1);
      setInPoint(0);
      setOutPoint(buf.length - 1);
    }
  }, [getBuffer]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || frames.length === 0) {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
      return;
    }
    const intervalMs = Math.max(8, (1000 / 60) / speed);
    playIntervalRef.current = setInterval(() => {
      setScrubIndex(prev => {
        const next = prev + 1;
        if (next > outPoint) {
          // Loop back to in-point
          return inPoint;
        }
        return next;
      });
    }, intervalMs);
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, speed, inPoint, outPoint, frames.length]);

  // Notify parent of scrub position
  useEffect(() => {
    if (frames[scrubIndex] && onScrubFrame) {
      onScrubFrame(frames[scrubIndex]);
    }
  }, [scrubIndex, frames, onScrubFrame]);

  const exportClip = useCallback(() => {
    if (frames.length === 0) return;
    const clip: MatchClip = {
      id: `clip_${Date.now()}`,
      label: `${p1Name} vs ${p2Name} — ${stageName}`,
      p1Name,
      p2Name,
      stageName,
      frames: frames.slice(inPoint, outPoint + 1),
      inPoint,
      outPoint,
      speedMultiplier: speed,
      exportedAt: new Date().toISOString(),
      totalFrames: outPoint - inPoint + 1,
      durationMs: frames[outPoint]
        ? frames[outPoint].timestamp - (frames[inPoint]?.timestamp ?? 0)
        : 0,
    };
    const blob = new Blob([JSON.stringify(clip, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brutal_fist_clip_${clip.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportStatus(`✓ Exported ${clip.totalFrames} frames (${(clip.durationMs / 1000).toFixed(2)}s)`);
    setTimeout(() => setExportStatus(null), 3000);
  }, [frames, inPoint, outPoint, speed, p1Name, p2Name, stageName]);

  const currentFrame = frames[scrubIndex];
  const totalFrames = frames.length;
  const durationSec = totalFrames > 0
    ? ((frames[totalFrames - 1]?.timestamp ?? 0) - (frames[0]?.timestamp ?? 0)) / 1000
    : 0;

  return (
    <div className="absolute bottom-20 right-3 z-40 font-mono">
      {/* Toggle button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) loadBuffer(); }}
        className="text-[8px] tracking-widest border border-zinc-700 bg-black/80 text-zinc-400 hover:text-yellow-400 hover:border-yellow-700 px-2 py-1 transition-colors"
      >
        ⏺ REC
      </button>

      {open && (
        <div
          className="absolute bottom-8 right-0 w-80 border border-zinc-700 bg-black/95 p-3 space-y-2"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-yellow-400 tracking-widest font-black">MATCH RECORDER</span>
            <div className="flex items-center gap-1">
              {isRecording() && (
                <span className="text-[7px] text-red-400 animate-pulse tracking-widest">● LIVE</span>
              )}
              <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-300 text-xs">✕</button>
            </div>
          </div>

          {/* Buffer info */}
          <div className="text-[7px] text-zinc-500 tracking-wider">
            {totalFrames} frames · {durationSec.toFixed(1)}s buffered
          </div>

          {/* Timeline scrubber */}
          {totalFrames > 0 && (
            <div className="space-y-1">
              <input
                type="range"
                min={0}
                max={totalFrames - 1}
                value={scrubIndex}
                onChange={e => { setIsPlaying(false); setScrubIndex(Number(e.target.value)); }}
                className="w-full h-1 accent-yellow-400"
              />
              <div className="flex justify-between text-[6px] text-zinc-600">
                <span>F{frames[0]?.frameIndex ?? 0}</span>
                <span className="text-yellow-400">F{currentFrame?.frameIndex ?? 0}</span>
                <span>F{frames[totalFrames - 1]?.frameIndex ?? 0}</span>
              </div>
            </div>
          )}

          {/* Frame-by-frame controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setIsPlaying(false); setScrubIndex(i => Math.max(0, i - 1)); }}
              className="text-[8px] border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white px-2 py-0.5"
            >◀</button>
            <button
              onClick={() => setIsPlaying(p => !p)}
              className={`text-[8px] border px-2 py-0.5 flex-1 ${isPlaying ? 'border-yellow-600 text-yellow-400' : 'border-zinc-700 text-zinc-300 hover:text-white'}`}
            >
              {isPlaying ? '⏸ PAUSE' : '▶ PLAY'}
            </button>
            <button
              onClick={() => { setIsPlaying(false); setScrubIndex(i => Math.min(totalFrames - 1, i + 1)); }}
              className="text-[8px] border border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white px-2 py-0.5"
            >▶</button>
          </div>

          {/* Speed control */}
          <div className="flex items-center gap-2">
            <span className="text-[7px] text-zinc-500 w-10">SPEED</span>
            <input
              type="range"
              min={0.1}
              max={4}
              step={0.1}
              value={speed}
              onChange={e => setSpeed(Number(e.target.value))}
              className="flex-1 h-1 accent-yellow-400"
            />
            <span className="text-[7px] text-yellow-400 w-8 text-right">{speed.toFixed(1)}x</span>
          </div>

          {/* Region crop (in/out points) */}
          <div className="space-y-1">
            <div className="text-[7px] text-zinc-500 tracking-wider">REGION CROP</div>
            <div className="flex gap-2">
              <div className="flex-1">
                <div className="text-[6px] text-zinc-600 mb-0.5">IN</div>
                <input
                  type="range"
                  min={0}
                  max={totalFrames - 1}
                  value={inPoint}
                  onChange={e => setInPoint(Math.min(Number(e.target.value), outPoint))}
                  className="w-full h-1 accent-blue-400"
                />
                <div className="text-[6px] text-blue-400">F{inPoint}</div>
              </div>
              <div className="flex-1">
                <div className="text-[6px] text-zinc-600 mb-0.5">OUT</div>
                <input
                  type="range"
                  min={0}
                  max={totalFrames - 1}
                  value={outPoint}
                  onChange={e => setOutPoint(Math.max(Number(e.target.value), inPoint))}
                  className="w-full h-1 accent-red-400"
                />
                <div className="text-[6px] text-red-400">F{outPoint}</div>
              </div>
            </div>
            <div className="text-[6px] text-zinc-600">
              Clip: {outPoint - inPoint + 1} frames · {(((frames[outPoint]?.timestamp ?? 0) - (frames[inPoint]?.timestamp ?? 0)) / 1000).toFixed(2)}s
            </div>
          </div>

          {/* Current frame data */}
          {currentFrame && (
            <div className="border border-zinc-800 bg-zinc-950 p-1.5 space-y-0.5">
              <div className="text-[6px] text-zinc-500 tracking-wider">FRAME DATA</div>
              <div className="grid grid-cols-2 gap-x-2 text-[6px]">
                <span className="text-blue-400">P1: {currentFrame.p1Animation}</span>
                <span className="text-red-400">P2: {currentFrame.p2Animation}</span>
                <span className="text-blue-300">HP: {Math.ceil(currentFrame.p1Health)}</span>
                <span className="text-red-300">HP: {Math.ceil(currentFrame.p2Health)}</span>
                <span className="text-zinc-400">State: {currentFrame.p1State}</span>
                <span className="text-zinc-400">State: {currentFrame.p2State}</span>
              </div>
              <div className="text-[6px] text-zinc-600">
                Timer: {currentFrame.roundTimer}s · F{currentFrame.frameIndex}
              </div>
            </div>
          )}

          {/* Export button */}
          <button
            onClick={exportClip}
            disabled={totalFrames === 0}
            className="w-full text-[8px] font-black tracking-widest border border-yellow-700 text-yellow-400 hover:bg-yellow-900/30 py-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ⬇ EXPORT TOURNAMENT CLIP
          </button>

          {exportStatus && (
            <div className="text-[7px] text-green-400 tracking-wider">{exportStatus}</div>
          )}

          {/* Refresh buffer */}
          <button
            onClick={loadBuffer}
            className="w-full text-[7px] text-zinc-600 hover:text-zinc-400 border border-zinc-800 py-0.5 transition-colors"
          >
            ↻ REFRESH BUFFER
          </button>
        </div>
      )}
    </div>
  );
}
