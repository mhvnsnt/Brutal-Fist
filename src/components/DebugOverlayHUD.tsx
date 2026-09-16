'use client';

import React, { useEffect, useRef } from 'react';
import type {
  DebugOverlaySettings,
  FighterDebugData,
  ImpactMarker,
  HurtboxRegion,
} from '../engine/debug/DebugOverlay';
import { getPhaseColor, getPhaseName, getRegionColor } from '../engine/debug/DebugOverlay';

interface DebugOverlayHUDProps {
  settings: DebugOverlaySettings;
  p1Debug: FighterDebugData | null;
  p2Debug: FighterDebugData | null;
}

/** Renders the in-arena debug overlay — frame windows, AABB boxes, impact markers, rig state */
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

      {/* ── Hurtbox Region Visualization ── */}
      {settings.showHurtboxRegions && (
        <HurtboxRegionVisualization p1Debug={p1Debug} p2Debug={p2Debug} settings={settings} />
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
  const rig = data.rigState;

  return (
    <div
      className="absolute bottom-24 text-[8px] bg-black/85 border p-2 space-y-1.5 min-w-[160px] max-w-[200px]"
      style={{
        left: side === 'left' ? '8px' : 'auto',
        right: side === 'right' ? '8px' : 'auto',
        borderColor: phaseColor + '88',
      }}
    >
      {/* Fighter label + action state */}
      <div className="text-[7px] tracking-widest" style={{ color: phaseColor }}>
        {data.player.toUpperCase()} · {data.actionState}
      </div>

      {/* ── GLB Rig State Panel ── */}
      {settings.showRigState && rig && (
        <div className="border-t border-zinc-800 pt-1.5 space-y-1">
          <div className="text-[6px] tracking-widest text-zinc-500">GLB RIG STATE</div>

          {/* Active clip */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[7px] text-zinc-400">CLIP</span>
            <span
              className="text-[7px] font-black tracking-wide truncate max-w-[100px]"
              style={{ color: rig.isCrossfading ? '#f97316' : '#a3e635' }}
              title={rig.activeClip}
            >
              {rig.isCrossfading ? `${rig.fromClip}→${rig.toClip}` : rig.activeClip}
            </span>
          </div>

          {/* Frame number */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[7px] text-zinc-400">FRAME</span>
            <span className="text-[7px] font-black text-cyan-400 tabular-nums">
              {rig.clipFrame}/{rig.clipTotalFrames}
            </span>
          </div>

          {/* Playback speed */}
          <div className="flex items-center justify-between gap-1">
            <span className="text-[7px] text-zinc-400">SPEED</span>
            <span
              className="text-[7px] font-black tabular-nums"
              style={{ color: rig.playbackSpeed !== 1.0 ? '#facc15' : '#71717a' }}
            >
              {rig.playbackSpeed.toFixed(2)}×
            </span>
          </div>

          {/* Crossfade progress bar */}
          {rig.isCrossfading && (
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[6px] text-orange-400">XFADE</span>
                <span className="text-[6px] text-orange-400 tabular-nums">
                  {Math.round(rig.crossfadeProgress * 100)}%
                </span>
              </div>
              <div className="h-1.5 bg-zinc-900 border border-zinc-700 overflow-hidden">
                <div
                  className="h-full transition-all duration-75"
                  style={{ width: `${rig.crossfadeProgress * 100}%`, background: '#f97316' }}
                />
              </div>
            </div>
          )}

          {/* Clip progress bar */}
          <div className="h-1.5 bg-zinc-900 border border-zinc-700 overflow-hidden">
            <div
              className="h-full transition-all duration-75"
              style={{
                width: `${(rig.clipFrame / Math.max(1, rig.clipTotalFrames)) * 100}%`,
                background: rig.isCrossfading ? '#f97316' : '#a3e635',
              }}
            />
          </div>
        </div>
      )}

      {/* Frame window bars */}
      {settings.showFrameWindows && fw && (
        <div className="border-t border-zinc-800 pt-1.5 space-y-1">
          <div className="text-[6px] tracking-widest text-zinc-500">FRAME DATA</div>
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
        <div className="border-t border-zinc-800 pt-1 text-[7px] text-zinc-400 space-y-0.5">
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

// ── Hurtbox region visualization ──────────────────────────────────────────────

interface HurtboxRegionVisualizationProps {
  p1Debug: FighterDebugData | null;
  p2Debug: FighterDebugData | null;
  settings: DebugOverlaySettings;
}

function HurtboxRegionVisualization({ p1Debug, p2Debug, settings }: HurtboxRegionVisualizationProps) {
  const worldToScreenX = (worldX: number) => ((worldX + 3) / 6) * 80 + 10;

  const renderRegions = (regions: HurtboxRegion[], worldX: number, playerColor: string) => {
    const screenX = worldToScreenX(worldX);
    // Fighter occupies roughly 20% to 80% of vertical space (top=20%, bottom=80%)
    const fighterTopPct = 18;
    const fighterHeightPct = 62;

    return regions.map(region => {
      const regionColor = getRegionColor(region.region, region.wasHit);
      // yOffset is normalized -1 (top) to +1 (bottom) relative to fighter center
      // Map to screen: center is at fighterTopPct + fighterHeightPct * 0.5
      const centerY = fighterTopPct + fighterHeightPct * (0.5 - region.yOffset * 0.5);
      const heightPct = region.height * fighterHeightPct;
      const topPct = centerY - heightPct / 2;

      return (
        <div
          key={region.region}
          className="absolute border transition-colors duration-100"
          style={{
            left: `${screenX - 3.5}%`,
            top: `${topPct}%`,
            width: '7%',
            height: `${heightPct}%`,
            borderColor: regionColor + (region.wasHit ? 'ff' : '55'),
            background: region.wasHit ? regionColor + '30' : regionColor + '08',
            boxShadow: region.wasHit ? `0 0 6px ${regionColor}88` : 'none',
          }}
        >
          {region.wasHit && (
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-[5px] font-black whitespace-nowrap"
              style={{ color: regionColor }}
            >
              HIT
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      {settings.showP1 && p1Debug?.hurtboxRegions && renderRegions(p1Debug.hurtboxRegions, -1.8, '#1d4ed8')}
      {settings.showP2 && p2Debug?.hurtboxRegions && renderRegions(p2Debug.hurtboxRegions, 1.8, '#dc2626')}
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
