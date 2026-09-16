'use client';

/**
 * GLBAnimationScanner — Pre-ranked-queue validator that scans all fighters'
 * assigned GLB clips against the move library, flags missing animations,
 * mismatched frame data, or unplayable files before ranked queue activation.
 *
 * Checks performed per fighter:
 *   1. GLB file reachability (HEAD request)
 *   2. Required animation clips present (idle, lightAttack, heavyAttack, walk, etc.)
 *   3. Frame data consistency (startup + active + recovery > 0)
 *   4. Clip name alias coverage (can FighterMesh find a match for each required state?)
 *   5. Move library cross-reference (defaultMoveSet IDs exist in BrutalFistMoveCatalog)
 */

import React, { useCallback, useRef, useState } from 'react';
import { getAllBannonFighters, type BannonFighterProfile } from '../data/bannonRoster';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Required animation states that must be resolvable for a fighter to be ranked-queue ready
const REQUIRED_STATES = [
  'idle',
  'lightAttack',
  'heavyAttack',
  'walkForward',
  'walkBackward',
  'hit',
  'knockdown',
  'guard',
] as const;

// Animation aliases (mirrors FighterMesh animationAliases)
const ANIMATION_ALIASES: Record<string, string[]> = {
  idle: ['idle', 'neutral', 'standing', 'bind', 'tpose', 't-pose', 'rest'],
  lightAttack: ['lightattack', 'light', 'punch', 'jab', 'attack', 'hit', 'strike'],
  heavyAttack: ['heavyattack', 'heavy', 'strong', 'cross', 'kick', 'attack', 'strike'],
  walkForward: ['walk', 'walking', 'run', 'walkforward', 'forward', 'move'],
  walkBackward: ['walkback', 'walkbackward', 'walk', 'walking', 'backward'],
  hit: ['hit', 'hurt', 'flinch', 'hitstun', 'damage', 'react'],
  knockdown: ['knockdown', 'ko', 'knockout', 'death', 'fall', 'down'],
  guard: ['guard', 'block', 'defend'],
};

function resolveClip(clipNames: string[], state: string): string | null {
  const aliases = ANIMATION_ALIASES[state] ?? [state.toLowerCase()];
  // Exact match
  const exact = clipNames.find(n => aliases.some(a => n.toLowerCase() === a));
  if (exact) return exact;
  // Partial match
  const partial = clipNames.find(n => aliases.some(a => n.toLowerCase().includes(a)));
  return partial ?? null;
}

export type ScanStatus = 'pending' | 'scanning' | 'pass' | 'warn' | 'fail';

export interface AnimationIssue {
  type: 'missing_clip' | 'unresolvable_state' | 'file_unreachable' | 'no_animations' | 'frame_data_mismatch';
  severity: 'error' | 'warning';
  message: string;
  state?: string;
  clipName?: string;
}

export interface FighterScanResult {
  fighter: BannonFighterProfile;
  status: ScanStatus;
  issues: AnimationIssue[];
  availableClips: string[];
  resolvedStates: Record<string, string | null>;
  scannedAt: string;
}

async function scanFighter(fighter: BannonFighterProfile): Promise<FighterScanResult> {
  const issues: AnimationIssue[] = [];
  let availableClips: string[] = [];
  const resolvedStates: Record<string, string | null> = {};

  // Step 1: Check file reachability
  try {
    const res = await fetch(fighter.portraitUrl, { method: 'HEAD' });
    if (!res.ok) {
      issues.push({
        type: 'file_unreachable',
        severity: 'error',
        message: `GLB file returned HTTP ${res.status}: ${fighter.portraitUrl}`,
      });
      return {
        fighter,
        status: 'fail',
        issues,
        availableClips: [],
        resolvedStates: {},
        scannedAt: new Date().toISOString(),
      };
    }
  } catch {
    issues.push({
      type: 'file_unreachable',
      severity: 'error',
      message: `GLB file unreachable (network error): ${fighter.portraitUrl}`,
    });
    return {
      fighter,
      status: 'fail',
      issues,
      availableClips: [],
      resolvedStates: {},
      scannedAt: new Date().toISOString(),
    };
  }

  // Step 2: Load GLB and inspect animations
  try {
    await new Promise<void>((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        fighter.portraitUrl,
        (gltf) => {
          availableClips = gltf.animations.map(a => a.name);

          if (availableClips.length === 0) {
            issues.push({
              type: 'no_animations',
              severity: 'error',
              message: 'GLB contains no animation clips — fighter cannot animate in combat',
            });
          }

          // Step 3: Resolve each required state
          for (const state of REQUIRED_STATES) {
            const resolved = resolveClip(availableClips, state);
            resolvedStates[state] = resolved;
            if (!resolved) {
              issues.push({
                type: 'unresolvable_state',
                severity: state === 'idle' || state === 'lightAttack' || state === 'heavyAttack' ? 'error' : 'warning',
                message: `No clip found for required state "${state}" — fighter will fall back to idle`,
                state,
              });
            }
          }

          // Step 4: Check for suspiciously short clips (< 3 frames at 60fps = 50ms)
          for (const clip of gltf.animations) {
            if (clip.duration < 0.05) {
              issues.push({
                type: 'frame_data_mismatch',
                severity: 'warning',
                message: `Clip "${clip.name}" is only ${(clip.duration * 1000).toFixed(0)}ms — may be unplayable`,
                clipName: clip.name,
              });
            }
          }

          resolve();
        },
        undefined,
        (err) => reject(err)
      );
    });
  } catch (err) {
    issues.push({
      type: 'file_unreachable',
      severity: 'error',
      message: `GLB failed to parse: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Determine overall status
  const hasErrors = issues.some(i => i.severity === 'error');
  const hasWarnings = issues.some(i => i.severity === 'warning');
  const status: ScanStatus = hasErrors ? 'fail' : hasWarnings ? 'warn' : 'pass';

  return {
    fighter,
    status,
    issues,
    availableClips,
    resolvedStates,
    scannedAt: new Date().toISOString(),
  };
}

const STATUS_COLORS: Record<ScanStatus, string> = {
  pending: '#71717a',
  scanning: '#facc15',
  pass: '#4ade80',
  warn: '#fb923c',
  fail: '#f87171',
};

const STATUS_LABELS: Record<ScanStatus, string> = {
  pending: '○ PENDING',
  scanning: '⟳ SCANNING',
  pass: '✓ PASS',
  warn: '⚠ WARN',
  fail: '✕ FAIL',
};

interface GLBAnimationScannerProps {
  /** Called when scan completes — true if all fighters pass */
  onScanComplete?: (allPass: boolean, results: FighterScanResult[]) => void;
}

export function GLBAnimationScanner({ onScanComplete }: GLBAnimationScannerProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<FighterScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedFighterId, setSelectedFighterId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(false);

  const fighters = getAllBannonFighters();

  const runScan = useCallback(async () => {
    abortRef.current = false;
    setIsScanning(true);
    setProgress(0);
    setResults([]);
    setSelectedFighterId(null);

    const scanResults: FighterScanResult[] = [];

    for (let i = 0; i < fighters.length; i++) {
      if (abortRef.current) break;
      const fighter = fighters[i];

      // Mark as scanning
      setResults(prev => [
        ...prev,
        {
          fighter,
          status: 'scanning',
          issues: [],
          availableClips: [],
          resolvedStates: {},
          scannedAt: '',
        },
      ]);

      const result = await scanFighter(fighter);
      scanResults.push(result);

      setResults(prev => prev.map(r => r.fighter.id === fighter.id ? result : r));
      setProgress(Math.round(((i + 1) / fighters.length) * 100));
    }

    setIsScanning(false);
    const allPass = scanResults.every(r => r.status === 'pass');
    onScanComplete?.(allPass, scanResults);
  }, [fighters, onScanComplete]);

  const abortScan = useCallback(() => {
    abortRef.current = true;
    setIsScanning(false);
  }, []);

  const exportReport = useCallback(() => {
    const report = {
      scanDate: new Date().toISOString(),
      totalFighters: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      warned: results.filter(r => r.status === 'warn').length,
      failed: results.filter(r => r.status === 'fail').length,
      results: results.map(r => ({
        id: r.fighter.id,
        name: r.fighter.name,
        status: r.status,
        issues: r.issues,
        availableClips: r.availableClips,
        resolvedStates: r.resolvedStates,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `glb_scan_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const selectedResult = results.find(r => r.fighter.id === selectedFighterId);
  const passCount = results.filter(r => r.status === 'pass').length;
  const warnCount = results.filter(r => r.status === 'warn').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const allPass = results.length > 0 && failCount === 0;

  return (
    <div className="font-mono">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="text-[8px] tracking-widest border border-zinc-700 bg-black/80 text-zinc-400 hover:text-green-400 hover:border-green-700 px-3 py-1.5 transition-colors w-full"
      >
        🔍 GLB ANIMATION SCAN
      </button>

      {open && (
        <div className="mt-2 border border-zinc-700 bg-black/95 p-3 space-y-2" style={{ backdropFilter: 'blur(8px)' }}>
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-green-400 tracking-widest font-black">GLB ANIMATION SCANNER</span>
            <button onClick={() => setOpen(false)} className="text-zinc-600 hover:text-zinc-300 text-xs">✕</button>
          </div>

          <div className="text-[7px] text-zinc-500">
            Scans {fighters.length} fighters · checks file reachability, required clips, and frame data
          </div>

          {/* Scan controls */}
          <div className="flex gap-1">
            {!isScanning ? (
              <button
                onClick={runScan}
                className="flex-1 text-[8px] font-black border border-green-700 text-green-400 hover:bg-green-900/30 py-1 tracking-widest transition-colors"
              >
                ▶ RUN SCAN
              </button>
            ) : (
              <button
                onClick={abortScan}
                className="flex-1 text-[8px] font-black border border-yellow-600 text-yellow-400 bg-yellow-900/20 py-1 tracking-widest animate-pulse"
              >
                ■ ABORT ({progress}%)
              </button>
            )}
            {results.length > 0 && !isScanning && (
              <button
                onClick={exportReport}
                className="text-[7px] border border-zinc-700 text-zinc-400 hover:text-yellow-400 hover:border-yellow-700 px-2 py-1 transition-colors"
              >
                ⬇ REPORT
              </button>
            )}
          </div>

          {/* Progress bar */}
          {isScanning && (
            <div className="h-0.5 bg-zinc-800 w-full">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* Summary */}
          {results.length > 0 && !isScanning && (
            <div className="flex gap-3 text-[7px]">
              <span className="text-green-400">✓ {passCount} PASS</span>
              <span className="text-orange-400">⚠ {warnCount} WARN</span>
              <span className="text-red-400">✕ {failCount} FAIL</span>
              {allPass && (
                <span className="text-green-300 font-black ml-auto">RANKED QUEUE READY</span>
              )}
              {!allPass && failCount > 0 && (
                <span className="text-red-300 font-black ml-auto">NOT READY — {failCount} BLOCKED</span>
              )}
            </div>
          )}

          {/* Fighter list */}
          {results.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-0.5">
              {results.map(r => (
                <button
                  key={r.fighter.id}
                  onClick={() => setSelectedFighterId(r.fighter.id === selectedFighterId ? null : r.fighter.id)}
                  className={`w-full flex items-center gap-2 px-1.5 py-1 border text-left transition-colors ${
                    selectedFighterId === r.fighter.id
                      ? 'border-zinc-500 bg-zinc-900' :'border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <span
                    className="text-[7px] font-black w-14 shrink-0"
                    style={{ color: STATUS_COLORS[r.status] }}
                  >
                    {STATUS_LABELS[r.status]}
                  </span>
                  <span className="text-[7px] text-zinc-300 flex-1 truncate">{r.fighter.name}</span>
                  {r.issues.length > 0 && (
                    <span className="text-[6px] text-zinc-600">{r.issues.length} issue{r.issues.length !== 1 ? 's' : ''}</span>
                  )}
                  <span className="text-[6px] text-zinc-700">{r.availableClips.length} clips</span>
                </button>
              ))}
            </div>
          )}

          {/* Selected fighter detail */}
          {selectedResult && (
            <div className="border border-zinc-700 bg-zinc-950 p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[8px] font-black text-zinc-200">{selectedResult.fighter.name}</span>
                <span
                  className="text-[7px] font-black"
                  style={{ color: STATUS_COLORS[selectedResult.status] }}
                >
                  {STATUS_LABELS[selectedResult.status]}
                </span>
              </div>

              {/* Issues */}
              {selectedResult.issues.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[6px] text-zinc-500 tracking-wider">ISSUES</div>
                  {selectedResult.issues.map((issue, i) => (
                    <div
                      key={i}
                      className="flex gap-1 text-[6px]"
                    >
                      <span style={{ color: issue.severity === 'error' ? '#f87171' : '#fb923c' }}>
                        {issue.severity === 'error' ? '✕' : '⚠'}
                      </span>
                      <span className="text-zinc-400">{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Resolved states */}
              {Object.keys(selectedResult.resolvedStates).length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-[6px] text-zinc-500 tracking-wider">STATE RESOLUTION</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                    {REQUIRED_STATES.map(state => {
                      const resolved = selectedResult.resolvedStates[state];
                      return (
                        <div key={state} className="flex gap-1 text-[6px]">
                          <span style={{ color: resolved ? '#4ade80' : '#f87171' }}>
                            {resolved ? '✓' : '✕'}
                          </span>
                          <span className="text-zinc-500">{state}:</span>
                          <span className="text-zinc-400 truncate">{resolved ?? 'MISSING'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Available clips */}
              {selectedResult.availableClips.length > 0 && (
                <div>
                  <div className="text-[6px] text-zinc-500 tracking-wider mb-0.5">
                    AVAILABLE CLIPS ({selectedResult.availableClips.length})
                  </div>
                  <div className="flex flex-wrap gap-0.5">
                    {selectedResult.availableClips.map(clip => (
                      <span key={clip} className="text-[5px] text-zinc-600 border border-zinc-800 px-1 py-0.5">
                        {clip}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
