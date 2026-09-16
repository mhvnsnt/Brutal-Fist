'use client';

import React from 'react';

export interface FighterRuntimeChecklist {
  fighterId: string;
  fighterName: string;
  skeletonBones: number;
  visibleSkinnedMeshes: number;
  animationClips: number;
  missingClipVerdicts: string[];
  remediation: string[];
}

export function validatePreCombatFighter(fighter: FighterRuntimeChecklist) {
  const failures: string[] = [];
  if (fighter.skeletonBones <= 0) failures.push('SKELETON_BONES > 0');
  if (fighter.visibleSkinnedMeshes <= 0) failures.push('VISIBLE_SKINNED_MESHES > 0');
  if (fighter.animationClips <= 0) failures.push('ANIMATION_CLIPS > 0');
  if (fighter.missingClipVerdicts.length > 0) failures.push(`NO_MISSING_CLIP_VERDICTS (${fighter.missingClipVerdicts.join(', ')})`);
  return { pass: failures.length === 0, failures };
}

export function PreCombatRosterGate({ fighters, onEnterCombat, onBack }: { fighters: FighterRuntimeChecklist[]; onEnterCombat: () => void; onBack?: () => void }) {
  const results = fighters.map(f => ({ fighter: f, result: validatePreCombatFighter(f) }));
  const blocked = results.filter(r => !r.result.pass);
  const canFight = results.length > 0 && blocked.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#080a10] text-white font-mono">
      <header className="border-b border-zinc-800 px-5 py-4">
        <div className="text-[10px] tracking-[0.35em] text-zinc-500">PRE-COMBAT VALIDATION</div>
        <h1 className="mt-1 text-xl tracking-widest">ROSTER READINESS GATE</h1>
        <div className={`mt-2 text-xs tracking-widest ${canFight ? 'text-green-400' : 'text-red-400'}`}>
          {canFight ? 'ALL ACTIVE FIGHTERS VERIFIED — COMBAT UNLOCKED' : 'COMBAT BLOCKED — FIX FAILED CHECKS'}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-5 space-y-4">
        {results.map(({ fighter, result }) => (
          <section key={fighter.fighterId} className="border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-bold tracking-wider">{fighter.fighterName.toUpperCase()}</div>
              <div className={`text-[10px] tracking-widest ${result.pass ? 'text-green-400' : 'text-red-400'}`}>
                {result.pass ? 'READY' : 'BLOCKED'}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] md:grid-cols-4">
              <Metric label="SKELETON BONES" value={fighter.skeletonBones} pass={fighter.skeletonBones > 0} />
              <Metric label="SKINNED MESHES" value={fighter.visibleSkinnedMeshes} pass={fighter.visibleSkinnedMeshes > 0} />
              <Metric label="ANIMATION CLIPS" value={fighter.animationClips} pass={fighter.animationClips > 0} />
              <Metric label="MISSING CLIPS" value={fighter.missingClipVerdicts.length} pass={fighter.missingClipVerdicts.length === 0} />
            </div>
            {!result.pass && (
              <div className="mt-3 border-l-2 border-red-500 pl-3 text-xs text-red-200">
                <div className="font-bold tracking-wider">REMEDIATION</div>
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  {result.failures.map(f => <li key={f}>{f}</li>)}
                  {fighter.remediation.map((r, i) => <li key={`${r}-${i}`}>{r}</li>)}
                </ul>
              </div>
            )}
          </section>
        ))}
      </main>

      <footer className="border-t border-zinc-800 p-4 flex justify-end gap-3">
        {onBack && <button onClick={onBack} className="border border-zinc-700 px-5 py-2 text-xs tracking-widest">BACK</button>}
        <button disabled={!canFight} onClick={onEnterCombat} className="border border-zinc-600 px-6 py-2 text-xs tracking-widest disabled:cursor-not-allowed disabled:opacity-30">FIGHT</button>
      </footer>
    </div>
  );
}

function Metric({ label, value, pass }: { label: string; value: number; pass: boolean }) {
  return <div className="border border-zinc-800 p-2"><div className="text-zinc-500">{label}</div><div className={pass ? 'text-green-400 text-lg' : 'text-red-400 text-lg'}>{value}</div></div>;
}
