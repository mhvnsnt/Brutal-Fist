'use client';

import React, { useState } from 'react';

export interface TournamentSettings {
  difficulty: 'easy' | 'normal' | 'hard' | 'brutal';
  cameraFov: number;
  cosmeticPreview: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
}

export const DEFAULT_TOURNAMENT_SETTINGS: TournamentSettings = {
  difficulty: 'normal',
  cameraFov: 55,
  cosmeticPreview: true,
  soundEnabled: true,
  musicEnabled: true,
};

interface TournamentSettingsScreenProps {
  onConfirm: (settings: TournamentSettings) => void;
  onBack: () => void;
  initialSettings?: TournamentSettings;
}

const DIFFICULTY_OPTIONS: { value: TournamentSettings['difficulty']; label: string; desc: string; color: string }[] = [
  { value: 'easy',   label: 'EASY',   desc: 'Reduced AI reaction speed, lower combo damage', color: '#22c55e' },
  { value: 'normal', label: 'NORMAL', desc: 'Balanced AI — standard Schwarzerblitz behavior', color: '#facc15' },
  { value: 'hard',   label: 'HARD',   desc: 'Aggressive AI with counter-hit reads', color: '#f97316' },
  { value: 'brutal', label: 'BRUTAL', desc: 'Frame-perfect AI, full poise engine active', color: '#ef4444' },
];

const FOV_PRESETS = [45, 55, 65, 75, 85];

export default function TournamentSettingsScreen({
  onConfirm,
  onBack,
  initialSettings = DEFAULT_TOURNAMENT_SETTINGS,
}: TournamentSettingsScreenProps) {
  const [settings, setSettings] = useState<TournamentSettings>(initialSettings);
  const [cosmeticTab, setCosmeticTab] = useState<'bannon' | 'maime'>('bannon');

  const set = <K extends keyof TournamentSettings>(key: K, val: TournamentSettings[K]) =>
    setSettings(prev => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 bg-[#0a0c12] text-white font-mono overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="text-[9px] tracking-[0.5em] text-zinc-500 mb-1">PRE-TOURNAMENT</div>
          <div className="text-3xl font-black tracking-widest">SETTINGS</div>
          <div className="mt-1 h-px bg-zinc-800" />
        </div>

        {/* ── DIFFICULTY ── */}
        <section className="mb-8">
          <div className="text-[9px] tracking-[0.4em] text-zinc-500 mb-3">AI OPPONENT STRENGTH</div>
          <div className="grid grid-cols-2 gap-2">
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => set('difficulty', opt.value)}
                className={`border px-4 py-3 text-left transition-all ${
                  settings.difficulty === opt.value
                    ? 'border-yellow-400 bg-yellow-400/10' :'border-zinc-700 hover:border-zinc-500'
                }`}
              >
                <div
                  className="text-sm font-black tracking-widest mb-1"
                  style={{ color: settings.difficulty === opt.value ? opt.color : '#a1a1aa' }}
                >
                  {opt.label}
                </div>
                <div className="text-[8px] text-zinc-500 leading-tight">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* ── CAMERA FOV ── */}
        <section className="mb-8">
          <div className="text-[9px] tracking-[0.4em] text-zinc-500 mb-3">
            CAMERA FOV — <span className="text-yellow-400">{settings.cameraFov}°</span>
          </div>
          <div className="flex gap-2 mb-3">
            {FOV_PRESETS.map(fov => (
              <button
                key={fov}
                onClick={() => set('cameraFov', fov)}
                className={`flex-1 border py-2 text-xs font-black tracking-widest transition-all ${
                  settings.cameraFov === fov
                    ? 'border-yellow-400 text-yellow-400 bg-yellow-400/10' :'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                }`}
              >
                {fov}°
              </button>
            ))}
          </div>
          <input
            type="range"
            min={40}
            max={90}
            step={1}
            value={settings.cameraFov}
            onChange={e => set('cameraFov', Number(e.target.value))}
            className="w-full accent-yellow-400 h-1 bg-zinc-800 rounded appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-[8px] text-zinc-600 mt-1">
            <span>40° NARROW</span>
            <span>90° WIDE</span>
          </div>
        </section>

        {/* ── COSMETIC PREVIEW ── */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[9px] tracking-[0.4em] text-zinc-500">COSMETIC PREVIEW MODE</div>
            <button
              onClick={() => set('cosmeticPreview', !settings.cosmeticPreview)}
              className={`relative w-12 h-6 border transition-all ${
                settings.cosmeticPreview ? 'border-yellow-400 bg-yellow-400/20' : 'border-zinc-700 bg-zinc-900'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 transition-all ${
                  settings.cosmeticPreview ? 'left-6 bg-yellow-400' : 'left-0.5 bg-zinc-600'
                }`}
              />
            </button>
          </div>
          {settings.cosmeticPreview && (
            <div className="border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex gap-2 mb-3">
                {(['bannon', 'maime'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setCosmeticTab(f)}
                    className={`px-3 py-1 text-[9px] tracking-widest border transition-all ${
                      cosmeticTab === f
                        ? 'border-yellow-400 text-yellow-400' :'border-zinc-700 text-zinc-500'
                    }`}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {['DEFAULT', 'CHROME', 'SHADOW', 'GOLD', 'BLOOD', 'NEON', 'VOID', 'FACTION'].map((skin, i) => (
                  <button
                    key={skin}
                    className={`border py-2 text-[8px] tracking-widest transition-all ${
                      i === 0
                        ? 'border-yellow-400 text-yellow-400 bg-yellow-400/10' :'border-zinc-800 text-zinc-600 hover:border-zinc-600'
                    }`}
                  >
                    {skin}
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[7px] text-zinc-600">
                PREVIEW ONLY — ACTIVE COSMETICS APPLY FROM PROFILE SCREEN
              </div>
            </div>
          )}
        </section>

        {/* ── SOUND / MUSIC TOGGLES ── */}
        <section className="mb-8">
          <div className="text-[9px] tracking-[0.4em] text-zinc-500 mb-3">AUDIO</div>
          <div className="space-y-3">
            {/* Sound FX */}
            <div className="flex items-center justify-between border border-zinc-800 px-4 py-3">
              <div>
                <div className="text-sm font-black tracking-widest">SOUND EFFECTS</div>
                <div className="text-[8px] text-zinc-500">Hit impacts, KO, announcer voice lines</div>
              </div>
              <button
                onClick={() => set('soundEnabled', !settings.soundEnabled)}
                className={`relative w-12 h-6 border transition-all ${
                  settings.soundEnabled ? 'border-yellow-400 bg-yellow-400/20' : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 transition-all ${
                    settings.soundEnabled ? 'left-6 bg-yellow-400' : 'left-0.5 bg-zinc-600'
                  }`}
                />
              </button>
            </div>
            {/* Music */}
            <div className="flex items-center justify-between border border-zinc-800 px-4 py-3">
              <div>
                <div className="text-sm font-black tracking-widest">MUSIC</div>
                <div className="text-[8px] text-zinc-500">Background arena music tracks</div>
              </div>
              <button
                onClick={() => set('musicEnabled', !settings.musicEnabled)}
                className={`relative w-12 h-6 border transition-all ${
                  settings.musicEnabled ? 'border-yellow-400 bg-yellow-400/20' : 'border-zinc-700 bg-zinc-900'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 transition-all ${
                    settings.musicEnabled ? 'left-6 bg-yellow-400' : 'left-0.5 bg-zinc-600'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* ── SUMMARY ── */}
        <div className="border border-zinc-800 bg-zinc-900/30 px-4 py-3 mb-6 text-[8px] text-zinc-500 space-y-1">
          <div className="flex justify-between">
            <span>DIFFICULTY</span>
            <span className="text-yellow-400">{settings.difficulty.toUpperCase()}</span>
          </div>
          <div className="flex justify-between">
            <span>CAMERA FOV</span>
            <span className="text-yellow-400">{settings.cameraFov}°</span>
          </div>
          <div className="flex justify-between">
            <span>COSMETIC PREVIEW</span>
            <span className={settings.cosmeticPreview ? 'text-green-400' : 'text-zinc-600'}>
              {settings.cosmeticPreview ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>SOUND FX</span>
            <span className={settings.soundEnabled ? 'text-green-400' : 'text-zinc-600'}>
              {settings.soundEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>MUSIC</span>
            <span className={settings.musicEnabled ? 'text-green-400' : 'text-zinc-600'}>
              {settings.musicEnabled ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        {/* ── ACTIONS ── */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 border border-zinc-700 py-4 text-sm font-black tracking-widest hover:border-zinc-500 transition-all"
          >
            ← BACK
          </button>
          <button
            onClick={() => onConfirm(settings)}
            className="flex-[2] border border-yellow-400 bg-yellow-400 text-black py-4 text-sm font-black tracking-widest hover:bg-yellow-300 transition-all"
          >
            ENTER TOURNAMENT →
          </button>
        </div>

      </div>
    </div>
  );
}
