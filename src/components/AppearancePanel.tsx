'use client';

/**
 * AppearancePanel — the in-menu appearance customizer (Phase 2 port of the
 * AshLanev2 7-item suite). EXTENDS the character select's existing
 * customization UI (attire strip + GearPaintBar); it is not a parallel menu.
 * Every control applies live to the portrait preview above via the build
 * state owned by CharacterSelect.
 *
 * Sections: eyes, face paint (canon presets + custom layer builder),
 * accessories (hair/mask/hood/chain/gloves/wristbands/shoes), morphs,
 * save/reset. Sections enable honestly from `analysis` (what the loaded
 * model actually supports) — never fake controls.
 */
import React, { useMemo, useState } from 'react';
import {
  ACCESSORY_SLOTS,
  defaultBuild,
  type AccessorySlotId,
  type CustomBuild,
  type ModelAnalysis,
  type MorphKey,
} from '../engine/customization/types';
import { MORPH_DEFS } from '../engine/customization/morphs';
import { EYE_COLOR_PALETTE } from '../engine/customization/eyeColors';
import { listAccessories } from '../engine/customization/accessories';
import {
  getPickerData,
  getPreset,
  clonePresetLayers,
  validateLayers,
  serializeLayers,
  parseLayers,
  supportsFacePaint,
  type FacePaintLayer,
} from '../engine/customization/facepaintAdapter';
import { saveBuild, deleteBuild, notifyBuildsChanged } from '../engine/customization/persistence';

// Re-exported so CharacterPortrait3D can import the analysis type from one place.
export type { ModelAnalysis };

const SLOT_LABELS: Record<AccessorySlotId, string> = {
  hair: 'HAIR',
  facialHair: 'FACIAL HAIR',
  mask: 'MASK',
  hood: 'HOOD',
  chain: 'CHAIN',
  gloves: 'GLOVES',
  wristbands: 'WRIST',
  shoes: 'SHOES',
};

interface AppearancePanelProps {
  fighterId: string;
  attireId: string;
  slot: 'P1' | 'P2';
  build: CustomBuild;
  onChange: (build: CustomBuild) => void;
  analysis: ModelAnalysis | null;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[8px] text-zinc-500 tracking-[0.2em] mt-2 mb-1">{children}</div>
  );
}

export default function AppearancePanel({
  fighterId,
  attireId,
  slot,
  build,
  onChange,
  analysis,
}: AppearancePanelProps) {
  const isP1 = slot === 'P1';
  const on = isP1
    ? 'border-blue-500 text-blue-300 bg-blue-950/60'
    : 'border-red-500 text-red-300 bg-red-950/60';
  const [open, setOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const picker = useMemo(() => getPickerData(), []);
  const paintSupported = supportsFacePaint(fighterId);

  // ── face-paint local draft ──────────────────────────────────────────────
  const [paintRegion, setPaintRegion] = useState('fullFace');
  const [paintPattern, setPaintPattern] = useState('base-soft');
  const [paintColor, setPaintColor] = useState('#f2ede2');
  const [paintOpacity, setPaintOpacity] = useState(0.9);

  const currentLayers: FacePaintLayer[] | null = useMemo(() => {
    if (!build.facePaint) return null;
    try {
      return clonePresetLayers(getPreset(build.facePaint));
    } catch {
      try {
        return parseLayers(build.facePaint);
      } catch {
        return null;
      }
    }
  }, [build.facePaint]);

  const isPresetPaint = useMemo(() => {
    if (!build.facePaint) return false;
    try {
      getPreset(build.facePaint);
      return true;
    } catch {
      return false;
    }
  }, [build.facePaint]);

  const setPaint = (spec: string | null) => onChange({ ...build, facePaint: spec });

  const addPaintLayer = () => {
    const layers = [...(currentLayers ?? [])];
    layers.push({
      region: paintRegion as FacePaintLayer['region'],
      pattern: paintPattern,
      color: paintColor,
      opacity: paintOpacity,
    });
    if (validateLayers(layers).length > 0) return;
    setPaint(serializeLayers(layers));
  };

  const removePaintLayer = (idx: number) => {
    const layers = [...(currentLayers ?? [])];
    layers.splice(idx, 1);
    setPaint(layers.length > 0 ? serializeLayers(layers) : null);
  };

  const startCustomFromPreset = () => {
    if (!build.facePaint || !isPresetPaint) return;
    setPaint(serializeLayers(clonePresetLayers(getPreset(build.facePaint))));
  };

  // ── save / reset ──────────────────────────────────────────────────────
  const handleSave = async () => {
    await saveBuild(build);
    notifyBuildsChanged();
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  const handleReset = async () => {
    await deleteBuild(fighterId);
    notifyBuildsChanged();
    onChange(defaultBuild(fighterId, attireId));
  };

  const setAccessory = (slotId: AccessorySlotId, id: string | null) =>
    onChange({ ...build, accessories: { ...build.accessories, [slotId]: id } });

  const setMorph = (key: MorphKey, v: number) =>
    onChange({ ...build, morphs: { ...build.morphs, [key]: v } });

  return (
    <div className="px-2 py-1 border-t border-zinc-800/80 bg-black/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-1"
      >
        <span className="text-[8px] text-zinc-400 tracking-[0.2em]">
          {open ? '▾' : '▸'} APPEARANCE
          {build.facePaint || Object.values(build.accessories).some(Boolean) ? (
            <span className={isP1 ? 'text-blue-400' : 'text-red-400'}> ✦</span>
          ) : null}
        </span>
        <span className="text-[8px] text-zinc-600">
          {savedFlash ? <span className="text-green-400">SAVED ✓</span> : 'eyes · paint · gear · morphs'}
        </span>
      </button>

      {open && (
        <div className={`flex flex-col gap-1 pb-2 ${isP1 ? 'items-start' : 'items-end'}`}>
          {/* ── EYES ── */}
          <SectionTitle>EYES</SectionTitle>
          {!analysis ? (
            <div className="text-[8px] text-zinc-600">analyzing model…</div>
          ) : !analysis.eyeSupport ? (
            <div className="text-[8px] text-zinc-600 max-w-[280px] leading-snug">
              Eyes are baked into this fighter's texture — no separate iris to recolor. Skin stays untouched.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {EYE_COLOR_PALETTE.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  onClick={() => onChange({ ...build, eyeColor: c.id })}
                  className={`min-h-8 min-w-8 border ${build.eyeColor === c.id ? 'border-white' : 'border-zinc-700'}`}
                  style={{ background: c.id === 'natural' ? 'linear-gradient(135deg,#4a2c14 50%,#9fd4e8 50%)' : c.hex }}
                />
              ))}
            </div>
          )}

          {/* ── FACE PAINT ── */}
          <SectionTitle>FACE PAINT</SectionTitle>
          {!paintSupported ? (
            <div className="text-[8px] text-zinc-600 max-w-[280px] leading-snug">
              No verified paint profile for this fighter — paint stays off rather than faked.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">
                {picker.presets
                  .filter((p) => p.characterId === fighterId)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      title={p.description}
                      onClick={() => setPaint(p.id)}
                      className={`text-[8px] font-mono px-1.5 py-1 min-h-8 border ${
                        build.facePaint === p.id ? on : 'border-zinc-800 text-zinc-500'
                      }`}
                    >
                      🔒 {p.label.split('—')[1]?.trim().toUpperCase() ?? p.id.toUpperCase()}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => setPaint(null)}
                  className="text-[8px] font-mono px-1.5 py-1 min-h-8 border border-zinc-700 text-zinc-400"
                >
                  CLEAR
                </button>
              </div>
              {build.facePaint && (
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[8px] text-zinc-500">
                    {isPresetPaint ? 'canon preset — locked look' : `${currentLayers?.length ?? 0} custom layer(s)`}
                  </span>
                  {isPresetPaint && (
                    <button
                      type="button"
                      onClick={startCustomFromPreset}
                      className="text-[8px] font-mono px-1.5 py-0.5 border border-zinc-700 text-zinc-400"
                    >
                      CUSTOMIZE →
                    </button>
                  )}
                </div>
              )}
              {(!build.facePaint || !isPresetPaint) && (
                <>
                  <div className="flex flex-wrap gap-1 items-center">
                    <select
                      value={paintRegion}
                      onChange={(e) => setPaintRegion(e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-[8px] font-mono px-1 py-1"
                    >
                      {picker.regions.map((r) => (
                        <option key={r.id} value={r.id}>{r.label.toUpperCase()}</option>
                      ))}
                    </select>
                    <select
                      value={paintPattern}
                      onChange={(e) => setPaintPattern(e.target.value)}
                      className="bg-zinc-900 border border-zinc-700 text-zinc-300 text-[8px] font-mono px-1 py-1"
                    >
                      {picker.patterns.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    <input
                      type="range" min={0.05} max={1} step={0.05}
                      value={paintOpacity}
                      onChange={(e) => setPaintOpacity(Number(e.target.value))}
                      className="w-16"
                      title={`opacity ${Math.round(paintOpacity * 100)}%`}
                    />
                    <button
                      type="button"
                      onClick={addPaintLayer}
                      className={`text-xs font-mono px-3 py-2 min-h-11 border ${on}`}
                    >
                      + LAYER
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {picker.colors.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        title={c.label}
                        aria-label={c.label}
                        onClick={() => setPaintColor(c.hex)}
                        className={`min-h-6 min-w-6 border ${paintColor === c.hex ? 'border-white' : 'border-zinc-700'}`}
                        style={{ background: c.hex }}
                      />
                    ))}
                  </div>
                  {(currentLayers?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {currentLayers!.map((l, i) => (
                        <button
                          key={i}
                          type="button"
                          title={`${l.region} · ${l.pattern} · ${l.color} — remove`}
                          onClick={() => removePaintLayer(i)}
                          className="text-[8px] font-mono px-1.5 py-0.5 border border-zinc-700 text-zinc-400"
                          style={{ borderLeftColor: l.color, borderLeftWidth: 3 }}
                        >
                          {l.pattern} ✕
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── ACCESSORIES ── */}
          <SectionTitle>GEAR (PS1)</SectionTitle>
          {ACCESSORY_SLOTS.map((slotId) => {
            if (slotId === 'facialHair') {
              return (
                <div key={slotId} className="flex items-center gap-1">
                  <span className="text-[8px] text-zinc-600 w-14">{SLOT_LABELS[slotId]}</span>
                  <span className="text-[8px] text-zinc-700">future lane — no assets yet</span>
                </div>
              );
            }
            const options = listAccessories(slotId);
            const current = build.accessories[slotId];
            return (
              <div key={slotId} className="flex flex-wrap items-center gap-1">
                <span className="text-[8px] text-zinc-500 w-14">{SLOT_LABELS[slotId]}</span>
                <button
                  type="button"
                  onClick={() => setAccessory(slotId, null)}
                  className={`text-[8px] font-mono px-1.5 py-1 min-h-8 border ${!current ? on : 'border-zinc-800 text-zinc-600'}`}
                >
                  OFF
                </button>
                {options.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    title={a.canonNotes ?? a.label}
                    onClick={() => setAccessory(slotId, a.id)}
                    className={`text-[8px] font-mono px-1.5 py-1 min-h-8 border ${
                      current === a.id ? on : 'border-zinc-800 text-zinc-500'
                    }`}
                  >
                    {a.canon ? '★ ' : ''}{a.label.toUpperCase()}
                  </button>
                ))}
              </div>
            );
          })}
          <div className="text-[8px] text-zinc-700 max-w-[280px] leading-snug">
            Low-poly procedural gear, parented to the bones — pendant rotation tuned per chain.
          </div>

          {/* ── MORPHS ── */}
          <SectionTitle>BODY</SectionTitle>
          {!analysis ? (
            <div className="text-[8px] text-zinc-600">analyzing model…</div>
          ) : (
            MORPH_DEFS.filter((d) => analysis.morphs.includes(d.key)).map((d) => (
              <div key={d.key} className="flex items-center gap-2 w-full max-w-[280px]">
                <span className="text-[8px] text-zinc-500 w-14">{d.label.toUpperCase()}</span>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={build.morphs[d.key]}
                  onChange={(e) => setMorph(d.key, Number(e.target.value))}
                  onDoubleClick={() => setMorph(d.key, 0.5)}
                  className="flex-1"
                  title={`${d.hint} (double-click resets)`}
                />
                <span className="text-[8px] text-zinc-600 w-8 text-right">
                  {Math.round(build.morphs[d.key] * 100)}
                </span>
              </div>
            ))
          )}
          {analysis && analysis.morphs.length === 0 && (
            <div className="text-[8px] text-zinc-600">No morphable bones found on this model.</div>
          )}

          {/* ── SAVE / RESET ── */}
          <div className="flex gap-1 mt-1">
            <button
              type="button"
              onClick={handleSave}
              className="text-[9px] font-mono font-bold px-3 py-1 min-h-8 bg-yellow-400 text-black hover:bg-yellow-300"
            >
              {savedFlash ? 'SAVED ✓' : 'SAVE BUILD'}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-mono px-3 py-2 min-h-11 border border-zinc-700 text-zinc-400"
            >
              RESET
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
