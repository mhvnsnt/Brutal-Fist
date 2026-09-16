'use client';

import React, { useEffect, useRef } from 'react';
import type {
  DebugOverlaySettings,
  FighterDebugData,
  ImpactMarker,
} from '../engine/debug/DebugOverlay';
import { getPhaseColor, getPhaseName } from '../engine/debug/DebugOverlay';

interface DebugOverlayHUDProps {
  settings: DebugOverlaySettings;
  p1Debug: FighterDebugData | null;
  p2Debug: FighterDebugData | null;
}

/** Renders the in-arena debug overlay — frame windows, AABB boxes, impact markers */
export default function DebugOverlayHUD({ settings, p1Debug, p2Debug }: DebugOverlayHUDProps) {
  if (!settings.enabled) return null;

  return (
    <div className="absolute inset-0 z-45 pointer-events-none font-mono">
      {/* ── P1 Debug Panel (bottom-left) ── */}
      {settings.showP1 && p1Debug && (
        <FighterDebugPanel
          data={p1Debug}
          settings={settings}
          side="left"
        />
      )}

      {/* ── P2 Debug Panel (bottom-right) ── */}
      {settings.showP2 && p2Debug && (
        <FighterDebugPanel
          data={p2Debug}
          settings={settings}
          side="right"
        />
      )}

      {/* ── AABB Visualization (center arena overlay) ── */}
      {settings.showAABB && (
        <AABBVisualization p1Debug={p1Debug} p2Debug={p2Debug} settings={settings} />
      )}

      {/* ── Impact Markers ── */}
      {settings.showImpactMarkers && (
        <>
          {p1Debug?.impactMarkers.map(m => (
            <ImpactMarkerDot key={m.id} marker={m} side="right" />
          ))}
          {p2Debug?.impactMarkers.map(m => (
            <ImpactMarkerDot key={m.id} marker={m} side="left" />
          ))}
        </>
      )}

      {/* ── Debug mode badge ── */}
      <div className="absolute top-20 left-1/2 transform -translate-x-1/2">
        <div className="text-[7px] tracking-widest px-2 py-0.5 border border-yellow-500/50 text-yellow-400/70 bg-black/60">
          DEBUG MODE
        </div>
      </div>
    </div>
  );
}

// ── Fighter debug panel ───────────────────────────────────────────────────────

interface FighterDebugPanelProps {
  data: FighterDebugData;
  settings: DebugOverlaySettings;
  side: 'left' | 'right';
}

function FighterDebugPanel({ data, settings, side }: FighterDebugPanelProps) {
  const fw = data.frameWindow;
  const phaseColor = fw ? getPhaseColor(fw.phase) : '#52525b';
  const phaseName = fw ? getPhaseName(fw.phase) : 'IDLE';

  return (
    <div
      className="absolute bottom-24 text-[8px] bg-black/80 border p-2 space-y-1.5 min-w-[140px]"
      style={{
        left: side === 'left' ? '8px' : 'auto',
        right: side === 'right' ? '8px' : 'auto',
        borderColor: phaseColor + '88',
      }}
    >
      {/* Fighter label */}
      <div className="text-[7px] tracking-widest" style={{ color: phaseColor }}>
        {data.player.toUpperCase()} · {data.actionState}
      </div>

      {/* Frame window bars */}
      {settings.showFrameWindows && fw && (
        <div className="space-y-1">
          {/* Phase label */}
          <div className="flex items-center justify-between">
            <span className="text-[7px]" style={{ color: phaseColor }}>{phaseName}</span>
            <span className="text-[7px] text-zinc-400">F{fw.currentFrame}/{fw.totalFrames}</span>
          </div>

          {/* Frame timeline bar */}
          <div className="h-3 bg-zinc-900 border border-zinc-700 relative overflow-hidden flex">
            {/* Startup segment */}
            <div
              className="h-full"
              style={{
                width: `${(fw.startupFrames / fw.totalFrames) * 100}%`,
                background: '#facc1566',
                borderRight: '1px solid #facc1544',
              }}
            />
            {/* Active segment */}
            <div
              className="h-full"
              style={{
                width: `${(fw.activeFrames / fw.totalFrames) * 100}%`,
                background: '#22c55e66',
                borderRight: '1px solid #22c55e44',
              }}
            />
            {/* Recovery segment */}
            <div
              className="h-full flex-1"
              style={{ background: '#ef444466' }}
            />
            {/* Current frame cursor */}
            <div
              className="absolute top-0 bottom-0 w-0.5"
              style={{
                left: `${(fw.currentFrame / fw.totalFrames) * 100}%`,
                background: phaseColor,
                boxShadow: `0 0 4px ${phaseColor}`,
              }}
            />
          </div>

          {/* Frame counts */}
          <div className="flex gap-2 text-[6px]">
            <span style={{ color: '#facc15' }}>S:{fw.startupFrames}</span>
            <span style={{ color: '#22c55e' }}>A:{fw.activeFrames}</span>
            <span style={{ color: '#ef4444' }}>R:{fw.recoveryFrames}</span>
          </div>
        </div>
      )}

      {/* AABB info */}
      {settings.showAABB && data.aabb && (
        <div className="text-[7px] text-zinc-400 space-y-0.5">
          <div style={{ color: data.aabb.isActive ? '#22c55e' : '#52525b' }}>
            AABB {data.aabb.isActive ? '● ACTIVE' : '○ INACTIVE'}
          </div>
          {data.aabb.isActive && (
            <div className="text-zinc-500">
              {data.aabb.width.toFixed(2)}w × {data.aabb.depth.toFixed(2)}d
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── AABB visualization overlay ────────────────────────────────────────────────

interface AABBVisualizationProps {
  p1Debug: FighterDebugData | null;
  p2Debug: FighterDebugData | null;
  settings: DebugOverlaySettings;
}

function AABBVisualization({ p1Debug, p2Debug, settings }: AABBVisualizationProps) {
  // Map world X (-3 to 3) to screen percentage (10% to 90%)
  const worldToScreenX = (worldX: number) => {
    return ((worldX + 3) / 6) * 80 + 10;
  };

  const worldToWidth = (worldW: number) => {
    return (worldW / 6) * 80;
  };

  return (
    <div className="absolute inset-0">
      {/* P1 hitbox box */}
      {settings.showP1 && p1Debug?.aabb?.isActive && (
        <div
          className="absolute border-2"
          style={{
            left: `${worldToScreenX(p1Debug.aabb.centerX) - worldToWidth(p1Debug.aabb.width) / 2}%`,
            top: '30%',
            width: `${worldToWidth(p1Debug.aabb.width)}%`,
            height: '40%',
            borderColor: '#22c55e',
            background: '#22c55e18',
            boxShadow: '0 0 8px #22c55e44',
          }}
        >
          <div className="absolute -top-4 left-0 text-[6px] text-green-400 whitespace-nowrap">P1 HITBOX</div>
        </div>
      )}

      {/* P2 hitbox box */}
      {settings.showP2 && p2Debug?.aabb?.isActive && (
        <div
          className="absolute border-2"
          style={{
            left: `${worldToScreenX(p2Debug.aabb.centerX) - worldToWidth(p2Debug.aabb.width) / 2}%`,
            top: '30%',
            width: `${worldToWidth(p2Debug.aabb.width)}%`,
            height: '40%',
            borderColor: '#ef4444',
            background: '#ef444418',
            boxShadow: '0 0 8px #ef444444',
          }}
        >
          <div className="absolute -top-4 left-0 text-[6px] text-red-400 whitespace-nowrap">P2 HITBOX</div>
        </div>
      )}

      {/* Fighter hurtboxes (always visible) */}
      {settings.showP1 && (
        <div
          className="absolute border border-dashed"
          style={{
            left: `${worldToScreenX(-1.8) - 3}%`,
            top: '20%',
            width: '6%',
            height: '60%',
            borderColor: '#1d4ed844',
          }}
        />
      )}
      {settings.showP2 && (
        <div
          className="absolute border border-dashed"
          style={{
            left: `${worldToScreenX(1.8) - 3}%`,
            top: '20%',
            width: '6%',
            height: '60%',
            borderColor: '#dc262644',
          }}
        />
      )}
    </div>
  );
}

// ── Impact marker dot ─────────────────────────────────────────────────────────

interface ImpactMarkerDotProps {
  marker: ImpactMarker;
  side: 'left' | 'right';
}

function ImpactMarkerDot({ marker, side }: ImpactMarkerDotProps) {
  const age = Date.now() - marker.timestamp;
  const opacity = Math.max(0, 1 - age / 1500);

  if (opacity <= 0) return null;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${marker.x}%`,
        top: `${marker.y}%`,
        opacity,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Cross-hair marker */}
      <div className="relative w-6 h-6">
        <div
          className="absolute top-1/2 left-0 right-0 h-px"
          style={{ background: marker.isBlocked ? '#facc15' : '#ef4444' }}
        />
        <div
          className="absolute left-1/2 top-0 bottom-0 w-px"
          style={{ background: marker.isBlocked ? '#facc15' : '#ef4444' }}
        />
        <div
          className="absolute inset-1 rounded-full border"
          style={{ borderColor: marker.isBlocked ? '#facc15' : '#ef4444' }}
        />
      </div>
      {/* Damage label */}
      <div
        className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[7px] font-black whitespace-nowrap"
        style={{ color: marker.isBlocked ? '#facc15' : '#ef4444' }}
      >
        {marker.isBlocked ? 'BLK' : `-${marker.damage}`}
      </div>
    </div>
  );
}
