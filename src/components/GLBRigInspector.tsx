'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { getAllBannonFighters } from '../data/bannonRoster';
import type { RigInspectionResult } from '../../app/api/glb-rig-inspector/route';

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider
        ${ok ? 'bg-green-900/60 text-green-300 border border-green-700' : 'bg-red-900/60 text-red-300 border border-red-700'}`}
    >
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

// ── Clip row ──────────────────────────────────────────────────────────────────
function ClipRow({ name, trackCount }: { name: string; trackCount: number }) {
  return (
    <div className="flex items-center gap-2 py-0.5 border-b border-zinc-800/50 last:border-0">
      <span className="text-zinc-400 font-mono text-[10px] flex-1 truncate">{name}</span>
      <span className="text-zinc-600 font-mono text-[9px] shrink-0">{trackCount} tracks</span>
    </div>
  );
}

// ── Fighter inspection card ───────────────────────────────────────────────────
function FighterRigCard({ result }: { result: RigInspectionResult }) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = result.skeletonValid
    ? 'border-green-800 bg-green-950/20'
    : result.ok
    ? 'border-yellow-800 bg-yellow-950/20' :'border-red-800 bg-red-950/20';

  const statusLabel = result.skeletonValid
    ? '✅ VALID'
    : result.ok
    ? '⚠️ ISSUES' :'❌ ERROR';

  const statusLabelColor = result.skeletonValid
    ? 'text-green-400'
    : result.ok
    ? 'text-yellow-400' :'text-red-400';

  return (
    <div className={`border rounded-sm overflow-hidden ${statusColor}`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition-colors text-left"
      >
        <span className={`font-mono text-xs font-bold shrink-0 ${statusLabelColor}`}>{statusLabel}</span>
        <span className="font-mono text-xs text-white flex-1 truncate">{result.fighterName}</span>
        <span className="font-mono text-[10px] text-zinc-500 shrink-0">
          {result.boneCount} bones · {result.clipCount} clips
        </span>
        <span className="text-zinc-600 text-xs shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Error message */}
      {result.error && (
        <div className="px-3 py-1 bg-red-950/40 border-t border-red-900">
          <span className="font-mono text-[10px] text-red-300">{result.error}</span>
        </div>
      )}

      {/* Flags */}
      {result.flags.length > 0 && (
        <div className="px-3 py-1 border-t border-zinc-800 flex flex-wrap gap-1">
          {result.flags.map((flag, i) => (
            <span key={i} className="font-mono text-[9px] text-yellow-300 bg-yellow-950/40 border border-yellow-800 px-1.5 py-0.5 rounded">
              ⚑ {flag}
            </span>
          ))}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-zinc-800 px-3 py-2 space-y-3">
          {/* Skeleton info */}
          <div>
            <div className="text-[9px] font-mono text-zinc-500 tracking-widest mb-1.5">SKELETON</div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <StatusBadge ok={result.hasSkin} label="SKIN" />
              <StatusBadge ok={result.hasRootBone} label="ROOT BONE" />
              <StatusBadge ok={result.boneCount > 0} label={`${result.boneCount} BONES`} />
              <StatusBadge ok={result.skeletonValid} label="VALID RIG" />
            </div>
            {result.armatureName && (
              <div className="font-mono text-[10px] text-zinc-400">
                Armature: <span className="text-zinc-200">{result.armatureName}</span>
              </div>
            )}
          </div>

          {/* Bone list */}
          {result.bones.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-zinc-500 tracking-widest mb-1">
                BONES ({result.bones.length})
              </div>
              <div className="max-h-28 overflow-y-auto bg-zinc-950/60 rounded px-2 py-1">
                <div className="flex flex-wrap gap-1">
                  {result.bones.map((bone) => (
                    <span key={bone.index} className="font-mono text-[9px] text-zinc-400 bg-zinc-800/60 px-1 rounded">
                      {bone.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Animation clips */}
          <div>
            <div className="text-[9px] font-mono text-zinc-500 tracking-widest mb-1">
              ANIMATION CLIPS ({result.clipCount})
            </div>
            {result.clips.length === 0 ? (
              <div className="font-mono text-[10px] text-red-400">No animation clips found</div>
            ) : (
              <div className="max-h-32 overflow-y-auto bg-zinc-950/60 rounded px-2 py-1">
                {result.clips.map((clip, i) => (
                  <ClipRow key={i} name={clip.name} trackCount={clip.trackCount} />
                ))}
              </div>
            )}
          </div>

          {/* URL */}
          <div className="font-mono text-[9px] text-zinc-600 truncate">{result.url}</div>
        </div>
      )}
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────
interface SummaryData {
  total: number;
  valid: number;
  invalid: number;
  noAnimations: number;
  noSkin: number;
  fetchErrors: number;
}

function SummaryBar({ summary }: { summary: SummaryData }) {
  return (
    <div className="grid grid-cols-3 gap-2 mb-4">
      {[
        { label: 'VALID RIGS', value: summary.valid, color: 'text-green-400' },
        { label: 'ISSUES', value: summary.invalid, color: 'text-yellow-400' },
        { label: 'FETCH ERRORS', value: summary.fetchErrors, color: 'text-red-400' },
        { label: 'NO SKIN', value: summary.noSkin, color: 'text-orange-400' },
        { label: 'NO CLIPS', value: summary.noAnimations, color: 'text-purple-400' },
        { label: 'TOTAL', value: summary.total, color: 'text-zinc-300' },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-sm p-2 text-center">
          <div className={`font-mono text-lg font-black ${color}`}>{value}</div>
          <div className="font-mono text-[8px] text-zinc-600 tracking-widest">{label}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GLBRigInspector() {
  const [results, setResults] = useState<RigInspectionResult[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'valid' | 'issues' | 'errors'>('all');
  const [exportData, setExportData] = useState<string | null>(null);

  const fighters = useMemo(() => getAllBannonFighters(), []);

  const runInspection = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setSummary(null);
    setExportData(null);

    try {
      const payload = {
        fighters: fighters.map(f => ({
          id: f.id,
          name: f.name,
          url: f.portraitUrl,
        })),
      };

      const res = await fetch('/api/glb-rig-inspector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      setResults(data.results ?? []);
      setSummary(data.summary ?? null);

      console.log('[GLBRigInspector] Inspection complete:', data.summary);
    } catch (err) {
      setError(String(err));
      console.error('[GLBRigInspector] Inspection failed:', err);
    } finally {
      setLoading(false);
    }
  }, [fighters]);

  const filteredResults = useMemo(() => {
    if (filter === 'valid') return results.filter(r => r.skeletonValid);
    if (filter === 'issues') return results.filter(r => r.ok && !r.skeletonValid);
    if (filter === 'errors') return results.filter(r => !r.ok);
    return results;
  }, [results, filter]);

  const handleExport = useCallback(() => {
    const report = {
      generatedAt: new Date().toISOString(),
      summary,
      results,
    };
    const json = JSON.stringify(report, null, 2);
    setExportData(json);

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glb-rig-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [summary, results]);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <div>
          <div className="font-mono text-xs font-black tracking-[0.3em] text-white">
            🦴 GLB RIG INSPECTOR
          </div>
          <div className="font-mono text-[9px] text-zinc-500 mt-0.5">
            Backend bone count · armature · clip list · skeleton validity
          </div>
        </div>
        <div className="flex items-center gap-2">
          {results.length > 0 && (
            <button
              onClick={handleExport}
              className="font-mono text-[9px] text-zinc-400 border border-zinc-700 px-2 py-1 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
            >
              ↓ EXPORT JSON
            </button>
          )}
          <button
            onClick={runInspection}
            disabled={loading}
            className={`font-mono text-xs font-bold px-4 py-1.5 border transition-colors
              ${loading
                ? 'border-zinc-700 text-zinc-600 cursor-not-allowed' :'border-yellow-600 text-yellow-400 hover:bg-yellow-950/40 hover:border-yellow-400'
              }`}
          >
            {loading ? '⟳ SCANNING...' : '▶ RUN INSPECTION'}
          </button>
        </div>
      </div>

      <div className="p-4">
        {/* Idle state */}
        {!loading && results.length === 0 && !error && (
          <div className="text-center py-8">
            <div className="text-zinc-600 font-mono text-xs tracking-widest mb-2">
              {fighters.length} FIGHTERS IN ROSTER
            </div>
            <div className="text-zinc-700 font-mono text-[10px]">
              Click RUN INSPECTION to scan all GLB rigs for bone count, armature, clips, and skeleton validity.
            </div>
            <div className="mt-3 text-zinc-800 font-mono text-[9px]">
              Flags models with missing bones or broken rigging before combat loads.
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8">
            <div className="text-yellow-400 font-mono text-xs animate-pulse tracking-widest">
              SCANNING {fighters.length} GLB FILES...
            </div>
            <div className="mt-2 text-zinc-600 font-mono text-[10px]">
              Fetching and parsing binary GLTF chunks server-side
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/40 border border-red-800 rounded-sm p-3 mb-4">
            <div className="font-mono text-xs text-red-300 font-bold mb-1">INSPECTION FAILED</div>
            <div className="font-mono text-[10px] text-red-400">{error}</div>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && summary && (
          <>
            <SummaryBar summary={summary} />

            {/* Filter tabs */}
            <div className="flex gap-1 mb-3">
              {(['all', 'valid', 'issues', 'errors'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`font-mono text-[9px] px-2 py-1 border transition-colors tracking-widest
                    ${filter === f
                      ? 'border-zinc-500 text-zinc-200 bg-zinc-800' :'border-zinc-800 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400'
                    }`}
                >
                  {f.toUpperCase()} ({
                    f === 'all' ? results.length
                    : f === 'valid' ? summary.valid
                    : f === 'issues' ? summary.invalid
                    : summary.fetchErrors
                  })
                </button>
              ))}
            </div>

            {/* Fighter cards */}
            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {filteredResults.length === 0 ? (
                <div className="text-center py-4 font-mono text-[10px] text-zinc-600">
                  No fighters match this filter
                </div>
              ) : (
                filteredResults.map(result => (
                  <FighterRigCard key={result.fighterId} result={result} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
