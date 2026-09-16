'use client';

import React from 'react';
import type { ComboState } from '../engine/combat/ComboSystem';
import { getScalingLabel } from '../engine/combat/ComboSystem';

interface ComboCounterHUDProps {
  p1Combo: ComboState;
  p2Combo: ComboState;
  p1Color: string;
  p2Color: string;
}

export default function ComboCounterHUD({ p1Combo, p2Combo, p1Color, p2Color }: ComboCounterHUDProps) {
  return (
    <>
      {/* P1 combo counter — bottom left */}
      {p1Combo.active && p1Combo.count >= 2 && (
        <ComboDisplay combo={p1Combo} color={p1Color} side="left" />
      )}

      {/* P2 combo counter — bottom right */}
      {p2Combo.active && p2Combo.count >= 2 && (
        <ComboDisplay combo={p2Combo} color={p2Color} side="right" />
      )}
    </>
  );
}

interface ComboDisplayProps {
  combo: ComboState;
  color: string;
  side: 'left' | 'right';
}

function ComboDisplay({ combo, color, side }: ComboDisplayProps) {
  const scalingLabel = getScalingLabel(combo.damageMultiplier);
  const isHighCombo = combo.count >= 5;
  const isMidCombo = combo.count >= 3;

  return (
    <div
      className="absolute z-40 pointer-events-none"
      style={{
        bottom: '120px',
        left: side === 'left' ? '12px' : 'auto',
        right: side === 'right' ? '12px' : 'auto',
      }}
    >
      {/* Combo count */}
      <div className="flex flex-col items-center gap-0.5">
        <div
          className="font-black tabular-nums leading-none"
          style={{
            fontSize: isHighCombo ? '3rem' : isMidCombo ? '2.5rem' : '2rem',
            color,
            textShadow: `0 0 20px ${color}, 0 0 40px ${color}66`,
            fontFamily: 'monospace',
          }}
        >
          {combo.count}
        </div>
        <div
          className="text-[8px] font-black tracking-widest"
          style={{ color }}
        >
          HIT COMBO
        </div>

        {/* Damage scaling indicator */}
        {scalingLabel && (
          <div
            className="text-[7px] tracking-widest px-1.5 py-0.5 border"
            style={{
              color: '#ef4444',
              borderColor: '#ef444444',
              background: 'rgba(0,0,0,0.7)',
            }}
          >
            {scalingLabel}
          </div>
        )}

        {/* Total combo damage */}
        <div className="text-[7px] text-zinc-400 font-black">
          {combo.totalDamage} TOTAL
        </div>
      </div>
    </div>
  );
}
