import { RefObject, useRef, useCallback } from 'react';
import { InputBitmask } from '../types';

interface MobileControlsProps { inputRef: RefObject<InputBitmask>; }

/**
 * MobileControls — Tekken 4-limb touch input overlay.
 *
 * Button layout (Tekken limb system):
 *   1 (LP) = Left Punch  → Square/X
 *   2 (RP) = Right Punch → Triangle/Y
 *   3 (LK) = Left Kick   → Cross/A
 *   4 (RK) = Right Kick  → Circle/B
 *
 * Combination inputs (multi-touch simultaneous press):
 *   1+3 (LP+LK) → Left Throw
 *   2+4 (RP+RK) → Right Throw
 *   2+3 (RP+LK) → Heat Burst
 *   1+2 (LP+RP) → Parry / Heavy Strike
 *   3+4 (LK+RK) → Heavy Kick Combo
 *
 * Multi-touch is handled by tracking which pointer IDs are pressing which buttons.
 * When two buttons are held simultaneously, the combination input fires.
 *
 * CRITICAL pointer-events layering:
 * - The outer wrapper uses pointer-events: none so it doesn't block the 3D canvas.
 * - Each individual button/pad element uses pointer-events: auto so touches register.
 */
export function MobileControls({ inputRef }: MobileControlsProps) {
  // Track which pointer IDs are currently pressing which limb buttons
  const activePointers = useRef<Map<number, keyof InputBitmask>>(new Map());
  // Track currently held limb buttons for combination detection
  const heldLimbs = useRef<Set<string>>(new Set());

  const COMBO_WINDOW_MS = 80;
  const limbPressTime = useRef<Record<string, number>>({});

  const setInput = useCallback((key: keyof InputBitmask, value: boolean) => {
    if (inputRef.current) (inputRef.current as any)[key] = value;
  }, [inputRef]);

  const updateCombinations = useCallback(() => {
    const held = heldLimbs.current;
    const inp = inputRef.current as any;
    if (!inp) return;

    const now = performance.now();
    const lp = held.has('lp');
    const rp = held.has('rp');
    const lk = held.has('lk');
    const rk = held.has('rk');

    // Check simultaneous presses within combo window
    const lpRpSimult = lp && rp && Math.abs((limbPressTime.current.lp ?? 0) - (limbPressTime.current.rp ?? 0)) <= COMBO_WINDOW_MS;
    const lkRkSimult = lk && rk && Math.abs((limbPressTime.current.lk ?? 0) - (limbPressTime.current.rk ?? 0)) <= COMBO_WINDOW_MS;
    const lpLkSimult = lp && lk && Math.abs((limbPressTime.current.lp ?? 0) - (limbPressTime.current.lk ?? 0)) <= COMBO_WINDOW_MS;
    const rpRkSimult = rp && rk && Math.abs((limbPressTime.current.rp ?? 0) - (limbPressTime.current.rk ?? 0)) <= COMBO_WINDOW_MS;
    const rpLkSimult = rp && lk && Math.abs((limbPressTime.current.rp ?? 0) - (limbPressTime.current.lk ?? 0)) <= COMBO_WINDOW_MS;

    inp.heatBurst = rpLkSimult;
    inp.leftThrow = lpLkSimult && !rpLkSimult;
    inp.rightThrow = rpRkSimult && !rpLkSimult;
    // 1+2 → heavy parry, 3+4 → heavy kick combo (both map to heavy)
    inp.heavy = rp || rk || lpRpSimult || lkRkSimult;
    inp.light = (lp || lk) && !lpLkSimult && !rpLkSimult;
    inp.lp = lp;
    inp.rp = rp;
    inp.lk = lk;
    inp.rk = rk;
  }, [inputRef]);

  const handleLimbDown = useCallback((limb: string, inputKey: keyof InputBitmask) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    activePointers.current.set(e.pointerId, inputKey);
    heldLimbs.current.add(limb);
    limbPressTime.current[limb] = performance.now();
    updateCombinations();
  }, [updateCombinations]);

  const handleLimbUp = useCallback((limb: string, inputKey: keyof InputBitmask) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    activePointers.current.delete(e.pointerId);
    heldLimbs.current.delete(limb);
    const inp = inputRef.current as any;
    if (inp) {
      inp[inputKey] = false;
      inp[limb] = false;
    }
    updateCombinations();
  }, [inputRef, updateCombinations]);

  const handleDirDown = (key: keyof InputBitmask) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inputRef.current) inputRef.current[key] = true;
  };

  const handleDirUp = (key: keyof InputBitmask) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (inputRef.current) inputRef.current[key] = false;
  };

  const btnBase = 'flex items-center justify-center select-none touch-none active:opacity-70 transition-opacity';

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
          onPointerDown={handleDirDown('up')}
          onPointerUp={handleDirUp('up')}
          onPointerLeave={handleDirUp('up')}
          onPointerCancel={handleDirUp('up')}
        >↑</div>
        {/* Down */}
        <div
          className={`${btnBase} absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-12 bg-slate-800/80 border-2 border-slate-700 rounded-b-lg text-slate-300 text-xl font-bold`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDirDown('down')}
          onPointerUp={handleDirUp('down')}
          onPointerLeave={handleDirUp('down')}
          onPointerCancel={handleDirUp('down')}
        >↓</div>
        {/* Left */}
        <div
          className={`${btnBase} absolute top-1/2 left-0 -translate-y-1/2 w-12 h-12 bg-slate-800/80 border-2 border-slate-700 rounded-l-lg text-slate-300 text-xl font-bold`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDirDown('left')}
          onPointerUp={handleDirUp('left')}
          onPointerLeave={handleDirUp('left')}
          onPointerCancel={handleDirUp('left')}
        >←</div>
        {/* Right */}
        <div
          className={`${btnBase} absolute top-1/2 right-0 -translate-y-1/2 w-12 h-12 bg-slate-800/80 border-2 border-slate-700 rounded-r-lg text-slate-300 text-xl font-bold`}
          style={{ pointerEvents: 'auto' }}
          onPointerDown={handleDirDown('right')}
          onPointerUp={handleDirUp('right')}
          onPointerLeave={handleDirUp('right')}
          onPointerCancel={handleDirUp('right')}
        >→</div>
        {/* Center nub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-slate-900 border-2 border-slate-950" style={{ pointerEvents: 'none' }} />
      </div>

      {/* ── Tekken 4-Limb Action Buttons ── */}
      {/*
        Layout mirrors Tekken arcade layout:
          2(RP)  4(RK)
        1(LP)  3(LK)
        With G (Guard) and GR (Grapple) as shoulder-style extras.

        Multi-touch combinations:
          1+3 = Left Throw  |  2+4 = Right Throw
          2+3 = Heat Burst  |  1+2 = Parry
      */}
      <div
        className="relative w-56 h-48"
        style={{ pointerEvents: 'auto', touchAction: 'none' }}
      >
        {/* 2 — Right Punch (RP) — top-left of diamond */}
        <div
          className={`${btnBase} absolute left-4 top-0 w-14 h-14 rounded-full border-2 text-white font-black text-base shadow-lg`}
          style={{
            background: 'rgba(168,85,247,0.75)',
            borderColor: 'rgba(196,132,252,0.7)',
            boxShadow: '0 0 12px rgba(168,85,247,0.4)',
            pointerEvents: 'auto',
          }}
          onPointerDown={handleLimbDown('rp', 'heavy')}
          onPointerUp={handleLimbUp('rp', 'heavy')}
          onPointerLeave={handleLimbUp('rp', 'heavy')}
          onPointerCancel={handleLimbUp('rp', 'heavy')}
        >
          <div className="flex flex-col items-center leading-none">
            <span className="text-[11px] font-black">2</span>
            <span className="text-[6px] text-purple-200 tracking-wide">RP</span>
          </div>
        </div>

        {/* 4 — Right Kick (RK) — top-right of diamond */}
        <div
          className={`${btnBase} absolute right-0 top-4 w-14 h-14 rounded-full border-2 text-white font-black text-base shadow-lg`}
          style={{
            background: 'rgba(239,68,68,0.75)',
            borderColor: 'rgba(252,165,165,0.7)',
            boxShadow: '0 0 12px rgba(239,68,68,0.4)',
            pointerEvents: 'auto',
          }}
          onPointerDown={handleLimbDown('rk', 'heavy')}
          onPointerUp={handleLimbUp('rk', 'heavy')}
          onPointerLeave={handleLimbUp('rk', 'heavy')}
          onPointerCancel={handleLimbUp('rk', 'heavy')}
        >
          <div className="flex flex-col items-center leading-none">
            <span className="text-[11px] font-black">4</span>
            <span className="text-[6px] text-red-200 tracking-wide">RK</span>
          </div>
        </div>

        {/* 1 — Left Punch (LP) — bottom-left of diamond */}
        <div
          className={`${btnBase} absolute left-0 bottom-8 w-14 h-14 rounded-full border-2 text-white font-black text-base shadow-lg`}
          style={{
            background: 'rgba(37,99,235,0.75)',
            borderColor: 'rgba(147,197,253,0.7)',
            boxShadow: '0 0 12px rgba(37,99,235,0.4)',
            pointerEvents: 'auto',
          }}
          onPointerDown={handleLimbDown('lp', 'light')}
          onPointerUp={handleLimbUp('lp', 'light')}
          onPointerLeave={handleLimbUp('lp', 'light')}
          onPointerCancel={handleLimbUp('lp', 'light')}
        >
          <div className="flex flex-col items-center leading-none">
            <span className="text-[11px] font-black">1</span>
            <span className="text-[6px] text-blue-200 tracking-wide">LP</span>
          </div>
        </div>

        {/* 3 — Left Kick (LK) — bottom-right of diamond */}
        <div
          className={`${btnBase} absolute right-4 bottom-4 w-14 h-14 rounded-full border-2 text-white font-black text-base shadow-lg`}
          style={{
            background: 'rgba(5,150,105,0.75)',
            borderColor: 'rgba(110,231,183,0.7)',
            boxShadow: '0 0 12px rgba(5,150,105,0.4)',
            pointerEvents: 'auto',
          }}
          onPointerDown={handleLimbDown('lk', 'light')}
          onPointerUp={handleLimbUp('lk', 'light')}
          onPointerLeave={handleLimbUp('lk', 'light')}
          onPointerCancel={handleLimbUp('lk', 'light')}
        >
          <div className="flex flex-col items-center leading-none">
            <span className="text-[11px] font-black">3</span>
            <span className="text-[6px] text-emerald-200 tracking-wide">LK</span>
          </div>
        </div>

        {/* G — Guard (shoulder-style, top-center) */}
        <div
          className={`${btnBase} absolute left-1/2 -translate-x-1/2 top-0 w-10 h-8 rounded border-2 text-white font-black text-xs shadow`}
          style={{
            background: 'rgba(71,85,105,0.80)',
            borderColor: 'rgba(148,163,184,0.6)',
            pointerEvents: 'auto',
          }}
          onPointerDown={handleDirDown('guard')}
          onPointerUp={handleDirUp('guard')}
          onPointerLeave={handleDirUp('guard')}
          onPointerCancel={handleDirUp('guard')}
        >G</div>

        {/* GR — Grapple (shoulder-style, bottom-center) */}
        <div
          className={`${btnBase} absolute left-1/2 -translate-x-1/2 bottom-0 w-10 h-8 rounded border-2 text-white font-black text-[10px] shadow`}
          style={{
            background: 'rgba(109,40,217,0.80)',
            borderColor: 'rgba(196,132,252,0.6)',
            pointerEvents: 'auto',
          }}
          onPointerDown={handleDirDown('grapple')}
          onPointerUp={handleDirUp('grapple')}
          onPointerLeave={handleDirUp('grapple')}
          onPointerCancel={handleDirUp('grapple')}
        >GR</div>

        {/* Combination hint labels */}
        <div
          className="absolute -bottom-5 left-0 right-0 text-center text-[5px] text-zinc-600 tracking-wide"
          style={{ pointerEvents: 'none' }}
        >
          1+3=THROW · 2+4=THROW · 2+3=HEAT
        </div>
      </div>
    </div>
  );
}
