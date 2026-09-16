'use client';

import React, { useState, useMemo } from 'react';
import { BANNON_ROSTER } from '../data/bannonRoster';
import {
  buildMoveLibrary,
  STANDARD_CLIP_SET,
  SBW_CLIP_SET,
  TEKKEN_CLIP_SET,
  getFighterMoves,
  type MoveLibrary,
} from '../engine/retarget/MoveLibrary';
import type { FighterMotionState } from '../engine/retarget/AnimationController';

interface MoveLibraryViewerProps {
  onClose: () => void;
}

const SOURCE_COLORS: Record<string, string> = {
  schwarzerblitz: '#7c3aed',
  tekken:         '#1d4ed8',
  bannon:         '#d97706',
  generic:        '#52525b',
};

const SOURCE_LABELS: Record<string, string> = {
  schwarzerblitz: 'SBW',
  tekken:         'TKN',
  bannon:         'BNN',
  generic:        'GEN',
};

export default function MoveLibraryViewer({ onClose }: MoveLibraryViewerProps) {
  const [selectedFighter, setSelectedFighter] = useState(BANNON_ROSTER[0].id);
  const [selectedSource, setSelectedSource] = useState<'all' | 'schwarzerblitz' | 'tekken' | 'bannon'>('all');

  // Build the move library from all roster fighters using all clip sets
  const library: MoveLibrary = useMemo(() => {
    const rosterClips = BANNON_ROSTER.map(fighter => ({
      fighterId: fighter.id,
      clipNames: [
        ...STANDARD_CLIP_SET,
        ...SBW_CLIP_SET,
        ...TEKKEN_CLIP_SET,
      ],
      loadErrors: [],
    }));
    return buildMoveLibrary(rosterClips);
  }, []);

  const fighterMoves = getFighterMoves(library, selectedFighter);
  const filteredMoves = selectedSource === 'all'
    ? fighterMoves
    : fighterMoves.filter(m => m.frameData.source === selectedSource);

  // Deduplicate by motionState (prefer bannon > sbw > tekken > generic)
  const deduped = useMemo(() => {
    const seen = new Map<FighterMotionState, typeof filteredMoves[0]>();
    const priority: Record<string, number> = { bannon: 0, schwarzerblitz: 1, tekken: 2, generic: 3 };
    for (const entry of filteredMoves) {
      const existing = seen.get(entry.frameData.motionState);
      if (!existing || (priority[entry.frameData.source] ?? 99) < (priority[existing.frameData.source] ?? 99)) {
        seen.set(entry.frameData.motionState, entry);
      }
    }
    return Array.from(seen.values());
  }, [filteredMoves]);

  const totalLoaded = library.loadedClips;
  const totalClips = library.totalClips;

  return (
    <div className="fixed inset-0 bg-[#080a10] text-white font-mono overflow-y-auto z-50">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-5">
          <button onClick={onClose} className="text-[8px] tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors mb-3">
            ← BACK TO PRACTICE
          </button>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] tracking-[0.5em] text-zinc-500">ANIMATION PIPELINE</div>
              <div className="text-2xl font-black tracking-widest">MOVE LIBRARY</div>
            </div>
            <div className="border border-purple-900 bg-purple-900/20 px-3 py-1.5 text-right">
              <div className="text-[7px] text-purple-700">{totalLoaded}/{totalClips} CLIPS</div>
              <div className="text-[9px] font-black text-purple-400">NORMALIZED</div>
            </div>
          </div>
          <div className="mt-1 h-px bg-zinc-800" />
          <div className="mt-2 text-[8px] text-zinc-600">
            Animations loaded from Schwarzerblitz/Tekken research GLBs, normalized to motion states with frame-data metadata.
          </div>
        </div>

        {/* Source filter */}
        <div className="mb-4">
          <div className="text-[8px] tracking-[0.3em] text-zinc-500 mb-2">CLIP SOURCE</div>
          <div className="flex gap-1.5">
            {(['all', 'schwarzerblitz', 'tekken', 'bannon'] as const).map(src => (
              <button
                key={src}
                onClick={() => setSelectedSource(src)}
                className="border px-3 py-1.5 text-[8px] font-black tracking-widest transition-all"
                style={{
                  borderColor: selectedSource === src
                    ? (src === 'all' ? '#facc15' : SOURCE_COLORS[src])
                    : '#27272a',
                  color: selectedSource === src
                    ? (src === 'all' ? '#facc15' : SOURCE_COLORS[src])
                    : '#52525b',
                  background: selectedSource === src
                    ? `${src === 'all' ? '#facc15' : SOURCE_COLORS[src]}12`
                    : 'transparent',
                }}
              >
                {src === 'all' ? 'ALL' : SOURCE_LABELS[src]}
              </button>
            ))}
          </div>
        </div>

        {/* Fighter selector */}
        <div className="mb-4">
          <div className="text-[8px] tracking-[0.3em] text-zinc-500 mb-2">FIGHTER</div>
          <div className="flex flex-wrap gap-1">
            {BANNON_ROSTER.slice(0, 8).map(fighter => (
              <button
                key={fighter.id}
                onClick={() => setSelectedFighter(fighter.id)}
                className="border px-2 py-1 text-[8px] font-black transition-all"
                style={{
                  borderColor: selectedFighter === fighter.id ? '#facc15' : '#27272a',
                  color: selectedFighter === fighter.id ? '#facc15' : '#52525b',
                  background: selectedFighter === fighter.id ? '#facc1512' : 'transparent',
                }}
              >
                {fighter.name.toUpperCase().slice(0, 8)}
              </button>
            ))}
          </div>
        </div>

        {/* Move table */}
        <div className="border border-zinc-800">
          <div className="grid grid-cols-12 gap-0 border-b border-zinc-800 px-3 py-1.5 bg-zinc-900/50">
            <div className="col-span-3 text-[7px] tracking-widest text-zinc-500">MOTION STATE</div>
            <div className="col-span-3 text-[7px] tracking-widest text-zinc-500">CLIP NAME</div>
            <div className="col-span-1 text-[7px] tracking-widest text-zinc-500 text-center">SRC</div>
            <div className="col-span-1 text-[7px] tracking-widest text-zinc-500 text-center">S</div>
            <div className="col-span-1 text-[7px] tracking-widest text-zinc-500 text-center">A</div>
            <div className="col-span-1 text-[7px] tracking-widest text-zinc-500 text-center">R</div>
            <div className="col-span-1 text-[7px] tracking-widest text-zinc-500 text-center">DMG</div>
            <div className="col-span-1 text-[7px] tracking-widest text-zinc-500 text-center">FPS</div>
          </div>

          <div className="divide-y divide-zinc-900">
            {deduped.map((entry, i) => {
              const fd = entry.frameData;
              const srcColor = SOURCE_COLORS[fd.source] ?? '#52525b';
              const isAttack = fd.damage > 0;
              return (
                <div
                  key={i}
                  className="grid grid-cols-12 gap-0 px-3 py-1.5 hover:bg-zinc-900/30 transition-colors"
                >
                  <div className="col-span-3 text-[8px] font-black" style={{ color: isAttack ? '#facc15' : '#a1a1aa' }}>
                    {fd.motionState}
                  </div>
                  <div className="col-span-3 text-[7px] text-zinc-500 truncate">{fd.clipName}</div>
                  <div className="col-span-1 text-center">
                    <span
                      className="text-[6px] font-black px-1 py-0.5"
                      style={{ color: srcColor, border: `1px solid ${srcColor}44` }}
                    >
                      {SOURCE_LABELS[fd.source] ?? 'GEN'}
                    </span>
                  </div>
                  <div className="col-span-1 text-[7px] text-center" style={{ color: '#facc15' }}>
                    {fd.startupFrames > 0 ? fd.startupFrames : '—'}
                  </div>
                  <div className="col-span-1 text-[7px] text-center" style={{ color: '#22c55e' }}>
                    {fd.activeFrames > 0 ? fd.activeFrames : '—'}
                  </div>
                  <div className="col-span-1 text-[7px] text-center" style={{ color: '#ef4444' }}>
                    {fd.recoveryFrames > 0 ? fd.recoveryFrames : '—'}
                  </div>
                  <div className="col-span-1 text-[7px] text-center text-zinc-400">
                    {fd.damage > 0 ? fd.damage : '—'}
                  </div>
                  <div className="col-span-1 text-[7px] text-center text-zinc-500">
                    {fd.totalFrames}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 border border-zinc-900 p-3">
          <div className="text-[7px] tracking-widest text-zinc-600 mb-2">LEGEND</div>
          <div className="flex flex-wrap gap-3 text-[7px]">
            <span style={{ color: '#facc15' }}>S = Startup frames</span>
            <span style={{ color: '#22c55e' }}>A = Active frames (hitbox live)</span>
            <span style={{ color: '#ef4444' }}>R = Recovery frames</span>
            <span className="text-zinc-500">DMG = Base damage</span>
            <span className="text-zinc-500">FPS = Total frames at 60fps</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-2 text-[7px]">
            {Object.entries(SOURCE_LABELS).map(([src, label]) => (
              <span key={src} style={{ color: SOURCE_COLORS[src] }}>
                {label} = {src.charAt(0).toUpperCase() + src.slice(1)}
              </span>
            ))}
          </div>
        </div>

        {/* Errors */}
        {library.errors.length > 0 && (
          <div className="mt-3 border border-red-900/50 p-3">
            <div className="text-[7px] tracking-widest text-red-700 mb-1">LOAD ERRORS</div>
            {library.errors.slice(0, 5).map((err, i) => (
              <div key={i} className="text-[7px] text-red-500">{err}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
