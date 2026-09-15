import { RefObject } from 'react';
import { InputBitmask } from '../types';

interface MobileControlsProps { inputRef: RefObject<InputBitmask>; }

/**
 * MobileControls — Touch/pointer input overlay for the 3D combat arena.
 *
 * CRITICAL pointer-events layering:
 * - The outer wrapper uses pointer-events: none so it doesn't block the 3D canvas.
 * - Each individual button/pad element uses pointer-events: auto so touches register.
 * - onPointerDown / onTouchStart both fire to ensure cross-browser mobile support.
 */
export function MobileControls({ inputRef }: MobileControlsProps) {
  const handleDown = (key: keyof InputBitmask) => (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inputRef.current) inputRef.current[key] = true;
  };

  const handleUp = (key: keyof InputBitmask) => (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inputRef.current) inputRef.current[key] = false;
  };

  const btnBase =
    'flex items-center justify-center select-none touch-none active:opacity-80 transition-opacity';

  return (
    <div
      className="absolute bottom-4 left-0 w-full px-4 flex justify-between items-end z-50"
      style={{ pointerEvents: 'none' }}
    >
      {/* ── D-Pad ── */}
      <div
        className="relative w-36 h-36"
        style={{ pointerEvents: 'auto', touchAction: 'none' }}
      >
        {/* Up */}
        <div
          className={`${btnBase} absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-slate-800/80 border-2 border-slate-700 rounded-t-lg text-slate-300 text-xl font-bold`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDown('up')}
          onPointerUp={handleUp('up')}
          onPointerLeave={handleUp('up')}
          onPointerCancel={handleUp('up')}
        >↑</div>
        {/* Down */}
        <div
          className={`${btnBase} absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-slate-800/80 border-2 border-slate-700 rounded-b-lg text-slate-300 text-xl font-bold`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDown('down')}
          onPointerUp={handleUp('down')}
          onPointerLeave={handleUp('down')}
          onPointerCancel={handleUp('down')}
        >↓</div>
        {/* Left */}
        <div
          className={`${btnBase} absolute top-1/2 left-0 -translate-y-1/2 w-12 h-12 bg-slate-800/80 border-2 border-slate-700 rounded-l-lg text-slate-300 text-xl font-bold`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDown('left')}
          onPointerUp={handleUp('left')}
          onPointerLeave={handleUp('left')}
          onPointerCancel={handleUp('left')}
        >←</div>
        {/* Right */}
        <div
          className={`${btnBase} absolute top-1/2 right-0 -translate-y-1/2 w-12 h-12 bg-slate-800/80 border-2 border-slate-700 rounded-r-lg text-slate-300 text-xl font-bold`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDown('right')}
          onPointerUp={handleUp('right')}
          onPointerLeave={handleUp('right')}
          onPointerCancel={handleUp('right')}
        >→</div>
        {/* Center nub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-slate-900 border-2 border-slate-950" style={{ pointerEvents: 'none' }} />
      </div>

      {/* ── Action Buttons ── */}
      <div
        className="relative w-52 h-44 flex items-center justify-center"
        style={{ pointerEvents: 'auto', touchAction: 'none' }}
      >
        {/* L — Light Attack */}
        <div
          className={`${btnBase} absolute left-0 bottom-4 w-16 h-16 rounded-full bg-blue-600/80 border-2 border-blue-400/60 text-white font-bold text-lg shadow-lg shadow-blue-900/50`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDown('light')}
          onPointerUp={handleUp('light')}
          onPointerLeave={handleUp('light')}
          onPointerCancel={handleUp('light')}
        >L</div>
        {/* H — Heavy Attack */}
        <div
          className={`${btnBase} absolute right-0 top-2 w-16 h-16 rounded-full bg-red-600/80 border-2 border-red-400/60 text-white font-bold text-lg shadow-lg shadow-red-900/50`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDown('heavy')}
          onPointerUp={handleUp('heavy')}
          onPointerLeave={handleUp('heavy')}
          onPointerCancel={handleUp('heavy')}
        >H</div>
        {/* G — Guard */}
        <div
          className={`${btnBase} absolute right-8 bottom-0 w-12 h-12 rounded-full bg-slate-600/80 border-2 border-slate-400/60 text-white font-bold text-sm shadow-lg`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDown('guard')}
          onPointerUp={handleUp('guard')}
          onPointerLeave={handleUp('guard')}
          onPointerCancel={handleUp('guard')}
        >G</div>
        {/* GR — Grapple */}
        <div
          className={`${btnBase} absolute left-14 top-0 w-12 h-12 rounded-full bg-purple-700/90 border-2 border-purple-400/60 text-white font-bold text-xs shadow-lg`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDown('grapple')}
          onPointerUp={handleUp('grapple')}
          onPointerLeave={handleUp('grapple')}
          onPointerCancel={handleUp('grapple')}
        >GR</div>
        {/* ESC — Escape */}
        <div
          className={`${btnBase} absolute left-2 top-0 w-10 h-10 rounded-full bg-emerald-700/90 border-2 border-emerald-400/60 text-white font-bold text-xs shadow-lg`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDown('escape')}
          onPointerUp={handleUp('escape')}
          onPointerLeave={handleUp('escape')}
          onPointerCancel={handleUp('escape')}
        >ESC</div>
      </div>
    </div>
  );
}
