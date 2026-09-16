import { RefObject } from 'react';
import { InputBitmask } from '../types';

interface MobileControlsProps { inputRef: RefObject<InputBitmask>; }

export function MobileControls({ inputRef }: MobileControlsProps) {
  const handleTouch = (key: keyof InputBitmask, isDown: boolean) => (e: React.PointerEvent | React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (inputRef.current) inputRef.current[key] = isDown;
  };

  return (
    <div className="absolute bottom-4 left-0 w-full px-6 flex justify-between items-end z-50 pointer-events-none touch-none select-none">
      <div className="relative w-36 h-36 pointer-events-auto">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-slate-800/80 active:bg-slate-600/90 border-2 border-slate-900 rounded-t-lg flex items-center justify-center text-slate-400" onPointerDown={handleTouch('up', true)} onPointerUp={handleTouch('up', false)} onPointerLeave={handleTouch('up', false)}>↑</div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-slate-800/80 active:bg-slate-600/90 border-2 border-slate-900 rounded-b-lg flex items-center justify-center text-slate-400" onPointerDown={handleTouch('down', true)} onPointerUp={handleTouch('down', false)} onPointerLeave={handleTouch('down', false)}>↓</div>
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-12 h-12 bg-slate-800/80 active:bg-slate-600/90 border-2 border-slate-900 rounded-l-lg flex items-center justify-center text-slate-400" onPointerDown={handleTouch('left', true)} onPointerUp={handleTouch('left', false)} onPointerLeave={handleTouch('left', false)}>←</div>
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-12 h-12 bg-slate-800/80 active:bg-slate-600/90 border-2 border-slate-900 rounded-r-lg flex items-center justify-center text-slate-400" onPointerDown={handleTouch('right', true)} onPointerUp={handleTouch('right', false)} onPointerLeave={handleTouch('right', false)}>→</div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-slate-900 border-2 border-slate-950"></div>
      </div>

      <div className="relative w-48 h-40 pointer-events-auto flex items-center justify-center">
        <button className="absolute left-0 bottom-4 w-16 h-16 rounded-full bg-blue-600/80 active:bg-blue-400/90 border-2 border-slate-900 flex items-center justify-center text-white font-bold text-lg shadow-lg" onPointerDown={handleTouch('light', true)} onPointerUp={handleTouch('light', false)} onPointerLeave={handleTouch('light', false)}>L</button>
        <button className="absolute right-0 top-2 w-16 h-16 rounded-full bg-red-600/80 active:bg-red-400/90 border-2 border-slate-900 flex items-center justify-center text-white font-bold text-lg shadow-lg" onPointerDown={handleTouch('heavy', true)} onPointerUp={handleTouch('heavy', false)} onPointerLeave={handleTouch('heavy', false)}>H</button>
        <button className="absolute right-8 bottom-0 w-12 h-12 rounded-full bg-slate-600/80 active:bg-slate-400/90 border-2 border-slate-900 flex items-center justify-center text-white font-bold text-sm shadow-lg" onPointerDown={handleTouch('guard', true)} onPointerUp={handleTouch('guard', false)} onPointerLeave={handleTouch('guard', false)}>G</button>
        <button className="absolute left-14 top-0 w-12 h-12 rounded-full bg-purple-700/90 active:bg-purple-500/90 border-2 border-slate-900 flex items-center justify-center text-white font-bold text-xs shadow-lg" onPointerDown={handleTouch('grapple', true)} onPointerUp={handleTouch('grapple', false)} onPointerLeave={handleTouch('grapple', false)}>GR</button>
        <button className="absolute left-2 top-0 w-10 h-10 rounded-full bg-emerald-700/90 active:bg-emerald-500/90 border-2 border-slate-900 flex items-center justify-center text-white font-bold text-xs shadow-lg" onPointerDown={handleTouch('escape', true)} onPointerUp={handleTouch('escape', false)} onPointerLeave={handleTouch('escape', false)}>ESC</button>
      </div>
    </div>
  );
}
