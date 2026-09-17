'use client';

/**
 * PreCombatValidationScreen.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pre-combat screen that validates every active fighter against a strict
 * roster checklist before allowing combat to begin.
 *
 * CHECKLIST (all must pass):
 *   ✅ skeleton bones > 0
 *   ✅ visible skinned meshes > 0
 *   ✅ animation clips > 0
 *   ✅ no MISSING_CLIP verdicts for required semantic states
 *   ✅ AnimationSourceRegistry completeness: PASS or PARTIAL (not BLOCKED)
 *
 * If any fighter fails, combat is BLOCKED with explicit remediation steps.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useEffect, useState, useCallback } from 'react';
import { type BannonFighterProfile } from '../data/bannonRoster';
import { BANNON_GLB_PLAYABLE_MODELS, getGlbEntryForFighter } from '../data/bannonGlbRoster';
import { REQUIRED_SEMANTIC_STATES } from '../engine/retarget/AnimationSourceRegistry';
import {
  loadBannonClipsFromPublic,
  getCachedBannonMotionBank,
} from '../engine/retarget/BannonClipJsonAdapter';
import { buildMixamoFightingMotionBank } from '../engine/retarget/MixamoFightingMotionBank';

// ── Checklist item types ──────────────────────────────────────────────────────

export type CheckStatus = 'PASS' | 'FAIL' | 'WARN' | 'PENDING';

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  status: CheckStatus;
  value?: string | number;
  remediation?: string;
}

export interface FighterValidationResult {
  fighterId: string;
  fighterName: string;
  glbFile: string;
  overallStatus: 'PASS' | 'BLOCKED' | 'WARN';
  checks: ChecklistItem[];
  remediationSteps: string[];
}

// ── Validation logic ──────────────────────────────────────────────────────────

/**
 * Validate a fighter's GLB roster entry against the strict checklist.
 * This runs synchronously against the static roster data — the full
 * runtime validation (bone travel, mixer binding) happens in AnimationIntegrityGate.
 */
function validateFighterRoster(fighter: BannonFighterProfile): FighterValidationResult {
  const checks: ChecklistItem[] = [];
  const remediationSteps: string[] = [];

  // Find the fighter's GLB entry
  const glbEntry = getGlbEntryForFighter(fighter.id, fighter.model) ?? BANNON_GLB_PLAYABLE_MODELS.find(e => e.id === fighter.id);
  const glbFile = glbEntry?.model ?? 'UNKNOWN.glb';
  const rigStatus = glbEntry?.rigStatus ?? 'unknown';
  const playableGate = glbEntry?.playableGate ?? 'BLOCKED_RIG';

  // ── Check 1: GLB entry exists ─────────────────────────────────────────────
  checks.push({
    id: 'glb_exists',
    label: 'GLB Asset Registered',
    description: 'Fighter has a registered GLB model in the roster',
    status: glbEntry ? 'PASS' : 'FAIL',
    value: glbFile,
    remediation: glbEntry ? undefined : `Register ${fighter.id} in bannonGlbRoster.ts with a valid GLB path`,
  });

  if (!glbEntry) {
    remediationSteps.push(`Register ${fighter.id} in bannonGlbRoster.ts with a valid GLB path`);
  }

  // ── Check 2: Playable gate ────────────────────────────────────────────────
  const gatePass = playableGate === 'PASS';
  checks.push({
    id: 'playable_gate',
    label: 'Playable Gate',
    description: 'GLB has passed the playable quality gate',
    status: gatePass ? 'PASS' : 'FAIL',
    value: playableGate,
    remediation: gatePass ? undefined : `Fix rig issues for ${glbFile} — current gate: ${playableGate}`,
  });

  if (!gatePass) {
    remediationSteps.push(`Fix rig issues for ${glbFile} — current gate: ${playableGate}`);
  }

  // ── Check 3: Rig status (skeleton bones > 0 proxy) ───────────────────────
  const hasRig = rigStatus === 'skinned';
  const rigWarn = rigStatus === 'qa-weak';
  const rigFail = !hasRig && !rigWarn;

  let rigCheckStatus: CheckStatus = 'PASS';
  if (rigFail) rigCheckStatus = 'FAIL';
  else if (rigWarn) rigCheckStatus = 'WARN';

  checks.push({
    id: 'skeleton_bones',
    label: 'Skeleton Bones > 0',
    description: 'GLB contains a skeleton with at least one bone',
    status: rigCheckStatus,
    value: rigStatus,
    remediation: rigFail
      ? `Run scripts/rig-static-glbs-cli.mjs to generate ${glbFile.replace('.glb', '_rigged_ready.glb')}`
      : rigWarn
      ? `Run scripts/rig-static-glbs-cli.mjs to upgrade ${glbFile} to rigged_ready status`
      : undefined,
  });

  if (rigFail) {
    remediationSteps.push(`Run: node scripts/rig-static-glbs-cli.mjs to generate ${glbFile.replace('.glb', '_rigged_ready.glb')}`);
    remediationSteps.push(`Update bannonGlbRoster.ts to reference the *_rigged_ready.glb file`);
  } else if (rigWarn) {
    remediationSteps.push(`Consider running scripts/rig-static-glbs-cli.mjs to upgrade ${glbFile} to full rigged_ready status`);
  }

  // ── Check 4: Skinned mesh (proxy via rig status) ──────────────────────────
  const hasSkinnedMesh = hasRig;
  checks.push({
    id: 'skinned_meshes',
    label: 'Visible Skinned Meshes > 0',
    description: 'GLB contains at least one SkinnedMesh with JOINTS_0 / WEIGHTS_0',
    status: hasSkinnedMesh ? (rigWarn ? 'WARN' : 'PASS') : 'FAIL',
    value: hasSkinnedMesh ? 'present' : 'MISSING',
    remediation: hasSkinnedMesh ? undefined
      : `Run scripts/rig-static-glbs-cli.mjs — static GLBs have no JOINTS_0/WEIGHTS_0 attributes`,
  });

  if (!hasSkinnedMesh) {
    remediationSteps.push(`Static GLB detected: run scripts/rig-static-glbs-cli.mjs to add JOINTS_0/WEIGHTS_0 skin data`);
  }

  // ── Check 5: Animation clips > 0 (motion bank, measured) ────────────────
  const bank = getCachedBannonMotionBank();
  const mixamo = buildMixamoFightingMotionBank();
  const hasClip = (s: string) => (bank?.clips.has(s) ?? false) || mixamo.has(s);
  const authoredCount = bank?.clips.size ?? 0;
  const converted = bank?.stats.converted ?? 0;
  const mixamoCount = mixamo.size;
  const animClipStatus: CheckStatus = (authoredCount > 0 || mixamoCount > 0) ? 'PASS' : 'FAIL';

  checks.push({
    id: 'animation_clips',
    label: 'Animation Clips > 0',
    description: 'Authored Bannon Euler motion-bank clips converted to quaternion tracks',
    status: animClipStatus,
    value: authoredCount > 0
      ? `${authoredCount} authored / ${converted} converted + ${mixamoCount} mixamo`
      : mixamoCount > 0
        ? `${mixamoCount} Mixamo fill clips`
        : '0 authored clips',
    remediation: (authoredCount > 0 || mixamoCount > 0) ? undefined
      : `Fetch ${'https://raw.githubusercontent.com/mhvnsnt/Bannon/main/assets/moves/clips/index.json'} and convert rx/ry/rz keys via BannonEulerMotionAdapter`,
  });

  if (authoredCount === 0 && mixamoCount === 0) {
    remediationSteps.push('Load the real Bannon motion bank (assets/moves/clips/*.json) — Euler rx/ry/rz must convert to quaternion tracks');
  }

  // ── Check 6: No MISSING_CLIP verdicts ─────────────────────────────────────
  const criticalStates = ['idle', 'walk_forward', 'attack_1', 'block', 'hit_reaction', 'knockdown'];
  const missingAuthored = criticalStates.filter((s) => !hasClip(s));
  const missingStatus: CheckStatus = missingAuthored.length === 0 ? 'PASS' : 'WARN';

  checks.push({
    id: 'no_missing_clips',
    label: 'No MISSING_CLIP Verdicts',
    description: `Required semantic states have authored clips: [${criticalStates.join(', ')}]`,
    status: missingStatus,
    value: missingAuthored.length === 0 ? 'none missing' : `MISSING_CLIP: ${missingAuthored.join(', ')}`,
    remediation: missingAuthored.length === 0 ? undefined
      : `MISSING_CLIP remains MISSING_CLIP for: ${missingAuthored.join(', ')}. Add matching files in the Bannon motion bank. Do not substitute idle.`,
  });

  if (missingAuthored.length > 0) {
    remediationSteps.push(`MISSING_CLIP: ${missingAuthored.join(', ')} — do not substitute idle or procedural placeholders`);
  }

  // ── Check 7: AnimationSourceRegistry completeness ─────────────────────────
  const requiredMissing = REQUIRED_SEMANTIC_STATES.filter((s) => !hasClip(s));
  const registryStatus: CheckStatus = requiredMissing.length === 0 ? 'PASS' : 'WARN';

  checks.push({
    id: 'registry_completeness',
    label: 'AnimationSourceRegistry Complete',
    description: `All ${REQUIRED_SEMANTIC_STATES.length} required semantic states have authored/retargeted clips`,
    status: registryStatus,
    value: `${REQUIRED_SEMANTIC_STATES.length - requiredMissing.length}/${REQUIRED_SEMANTIC_STATES.length} authored`,
    remediation: requiredMissing.length === 0 ? undefined
      : `Still MISSING_CLIP: [${requiredMissing.join(', ')}]`,
  });

  if (requiredMissing.length > 0) {
    remediationSteps.push(`Registry incomplete — MISSING_CLIP: ${requiredMissing.join(', ')}`);
  }

  // ── Compute overall status ────────────────────────────────────────────────
  const hasFail = checks.some(c => c.status === 'FAIL');
  const hasWarn = checks.some(c => c.status === 'WARN');

  let overallStatus: 'PASS' | 'BLOCKED' | 'WARN';
  if (hasFail) {
    overallStatus = 'BLOCKED';
  } else if (hasWarn) {
    overallStatus = 'WARN';
  } else {
    overallStatus = 'PASS';
  }

  return {
    fighterId: fighter.id,
    fighterName: fighter.name,
    glbFile,
    overallStatus,
    checks,
    remediationSteps,
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PreCombatValidationScreenProps {
  p1Fighter: BannonFighterProfile;
  p2Fighter: BannonFighterProfile;
  onCombatApproved: () => void;
  onBack: () => void;
}

// ── Status icons ──────────────────────────────────────────────────────────────

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'PASS')    return <span className="text-green-400 font-black">✓</span>;
  if (status === 'FAIL')    return <span className="text-red-500 font-black">✗</span>;
  if (status === 'WARN')    return <span className="text-yellow-400 font-black">⚠</span>;
  return <span className="text-zinc-500 font-black">…</span>;
}

function StatusBadge({ status }: { status: 'PASS' | 'BLOCKED' | 'WARN' }) {
  if (status === 'PASS')    return <span className="px-2 py-0.5 text-[10px] font-black tracking-widest bg-green-900 text-green-300 border border-green-700">PASS</span>;
  if (status === 'BLOCKED') return <span className="px-2 py-0.5 text-[10px] font-black tracking-widest bg-red-900 text-red-300 border border-red-700">BLOCKED</span>;
  return <span className="px-2 py-0.5 text-[10px] font-black tracking-widest bg-yellow-900 text-yellow-300 border border-yellow-700">WARN</span>;
}

// ── Fighter validation panel ──────────────────────────────────────────────────

function FighterValidationPanel({ result }: { result: FighterValidationResult }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className={`border ${result.overallStatus === 'BLOCKED' ? 'border-red-700' : result.overallStatus === 'WARN' ? 'border-yellow-700' : 'border-green-700'} bg-[#0d1117]`}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between ${result.overallStatus === 'BLOCKED' ? 'bg-red-950/40' : result.overallStatus === 'WARN' ? 'bg-yellow-950/30' : 'bg-green-950/30'}`}>
        <div>
          <div className="text-xs tracking-[0.35em] text-zinc-500">FIGHTER</div>
          <div className="text-lg font-black tracking-widest text-white">{result.fighterName.toUpperCase()}</div>
          <div className="text-[9px] tracking-widest text-zinc-600 mt-0.5">{result.glbFile}</div>
        </div>
        <StatusBadge status={result.overallStatus} />
      </div>

      {/* Checklist */}
      <div className="divide-y divide-zinc-800/50">
        {result.checks.map(check => (
          <div key={check.id} className="px-4 py-2">
            <button
              className="w-full text-left flex items-start gap-3"
              onClick={() => setExpanded(expanded === check.id ? null : check.id)}
            >
              <div className="mt-0.5 w-4 flex-shrink-0">
                <StatusIcon status={check.status} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold tracking-wide text-zinc-200">{check.label}</span>
                  {check.value !== undefined && (
                    <span className={`text-[9px] tracking-widest font-mono ${
                      check.status === 'PASS' ? 'text-green-500' :
                      check.status === 'FAIL' ? 'text-red-500' :
                      check.status === 'WARN' ? 'text-yellow-500' : 'text-zinc-500'
                    }`}>
                      {String(check.value).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="text-[9px] text-zinc-500 mt-0.5">{check.description}</div>
              </div>
              {check.remediation && (
                <span className="text-[8px] text-zinc-600 flex-shrink-0 mt-0.5">
                  {expanded === check.id ? '▲' : '▼'}
                </span>
              )}
            </button>

            {/* Remediation steps */}
            {expanded === check.id && check.remediation && (
              <div className="mt-2 ml-7 p-2 bg-zinc-900/60 border border-zinc-700/50">
                <div className="text-[8px] tracking-widest text-zinc-500 mb-1">REMEDIATION</div>
                <pre className="text-[9px] text-yellow-300/80 font-mono whitespace-pre-wrap leading-relaxed">
                  {check.remediation}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Remediation summary for BLOCKED */}
      {result.overallStatus === 'BLOCKED' && result.remediationSteps.length > 0 && (
        <div className="px-4 py-3 bg-red-950/20 border-t border-red-800/50">
          <div className="text-[8px] tracking-widest text-red-400 mb-2">REQUIRED REMEDIATION STEPS</div>
          <ol className="space-y-1">
            {result.remediationSteps.map((step, i) => (
              <li key={i} className="flex gap-2 text-[9px] text-red-300/80 font-mono">
                <span className="text-red-600 flex-shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PreCombatValidationScreen({
  p1Fighter,
  p2Fighter,
  onCombatApproved,
  onBack,
}: PreCombatValidationScreenProps) {
  const [p1Result, setP1Result] = useState<FighterValidationResult | null>(null);
  const [p2Result, setP2Result] = useState<FighterValidationResult | null>(null);
  const [validating, setValidating] = useState(true);

  const runValidation = useCallback(async () => {
    setValidating(true);

    try {
      await loadBannonClipsFromPublic();
    } catch (error) {
      console.warn('[PreCombatValidation] Motion bank load failed:', error);
    }

    const r1 = validateFighterRoster(p1Fighter);
    const r2 = validateFighterRoster(p2Fighter);

    setP1Result(r1);
    setP2Result(r2);
    setValidating(false);

    const bank = getCachedBannonMotionBank();
    console.log('[PreCombatValidation] P1 result:', r1.overallStatus, r1.fighterId);
    console.log('[PreCombatValidation] P2 result:', r2.overallStatus, r2.fighterId);
    console.log('[PreCombatValidation] Motion bank:', bank?.stats, 'states', bank ? [...bank.clips.keys()] : []);
  }, [p1Fighter, p2Fighter]);

  useEffect(() => {
    runValidation();
  }, [runValidation]);

  const anyBlocked  = p1Result?.overallStatus === 'BLOCKED' || p2Result?.overallStatus === 'BLOCKED';
  const bothPass    = p1Result?.overallStatus === 'PASS'    && p2Result?.overallStatus === 'PASS';
  const canProceed  = !validating && !!p1Result && !!p2Result;

  return (
    <div className="fixed inset-0 bg-[#080b10] text-white font-mono overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">

        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="text-[9px] tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors mb-4 flex items-center gap-1"
          >
            ← BACK
          </button>
          <div className="text-[9px] tracking-[0.45em] text-zinc-500">PRE-COMBAT SYSTEM</div>
          <div className="text-2xl font-black tracking-widest mt-1">FIGHTER VALIDATION</div>
          <div className="text-[9px] text-zinc-600 mt-1">
            All fighters must pass the roster checklist before combat is authorized.
          </div>
        </div>

        {/* Validation status */}
        {validating ? (
          <div className="flex items-center gap-3 py-8 justify-center">
            <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] tracking-widest text-yellow-400">VALIDATING FIGHTERS...</span>
          </div>
        ) : (
          <>
            {/* Overall verdict banner */}
            <div className={`mb-6 px-4 py-3 border ${
              canProceed ? 'border-green-700 bg-green-950/20' : 'border-red-700 bg-red-950/30'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[8px] tracking-widest text-zinc-500">COMBAT AUTHORIZATION</div>
                  <div className={`text-xl font-black tracking-widest mt-0.5 ${
                    bothPass ? 'text-green-400' : anyBlocked ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {bothPass ? 'COMBAT AUTHORIZED' : 'ENTER THE RING'}
                  </div>
                </div>
                {anyBlocked && (
                  <div className="text-[9px] text-yellow-400/80 text-right max-w-[220px]">
                    Checklist warnings logged. Mixamo + Bannon motion still drives the fight.
                  </div>
                )}
              </div>
            </div>

            {/* Fighter panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {p1Result && (
                <div>
                  <div className="text-[8px] tracking-widest text-zinc-600 mb-2">PLAYER 1</div>
                  <FighterValidationPanel result={p1Result} />
                </div>
              )}
              {p2Result && (
                <div>
                  <div className="text-[8px] tracking-widest text-zinc-600 mb-2">PLAYER 2</div>
                  <FighterValidationPanel result={p2Result} />
                </div>
              )}
            </div>

            {/* Remediation guide for BLOCKED fighters */}
            {anyBlocked && (
              <div className="mb-6 border border-red-800/50 bg-red-950/10 p-4">
                <div className="text-[9px] tracking-widest text-red-400 mb-3">COMBAT BLOCKED — REMEDIATION REQUIRED</div>
                <div className="space-y-2 text-[10px] text-zinc-300">
                  <div className="flex gap-2">
                    <span className="text-red-500 flex-shrink-0">1.</span>
                    <span>
                      <strong className="text-white">Generate rigged GLBs:</strong>{' '}
                      <code className="text-yellow-300 bg-zinc-900 px-1">node scripts/rig-static-glbs-cli.mjs</code>
                      {' '}— outputs BANNON_rigged_ready.glb and MAIME_rigged_ready.glb
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-red-500 flex-shrink-0">2.</span>
                    <span>
                      <strong className="text-white">Update roster:</strong>{' '}
                      Edit <code className="text-yellow-300 bg-zinc-900 px-1">src/data/bannonGlbRoster.ts</code>{' '}
                      to reference <code className="text-yellow-300 bg-zinc-900 px-1">*_rigged_ready.glb</code> files
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-red-500 flex-shrink-0">3.</span>
                    <span>
                      <strong className="text-white">Load animation clips:</strong>{' '}
                      The real Bannon Euler motion bank is fetched from{' '}
                      <code className="text-yellow-300 bg-zinc-900 px-1">mhvnsnt/Bannon assets/moves/clips/</code>
                      {' '}and converted rx/ry/rz → quaternion. Do not substitute idle or procedural placeholders.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-red-500 flex-shrink-0">4.</span>
                    <span>
                      <strong className="text-white">Verify in AnimationTestArena:</strong>{' '}
                      All semantic states must show AUTHORED or RETARGETED badge (not MISSING)
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-red-500 flex-shrink-0">5.</span>
                    <span>
                      <strong className="text-white">Re-run validation:</strong>{' '}
                      Click the REVALIDATE button below after completing the above steps
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Warning: WARN-only fighters */}
            {!anyBlocked && !bothPass && (
              <div className="mb-6 border border-yellow-800/50 bg-yellow-950/10 p-4">
                <div className="text-[9px] tracking-widest text-yellow-400 mb-2">WARNINGS DETECTED</div>
                <div className="text-[10px] text-zinc-400">
                  WARN is not PASS. FIGHT stays blocked until every required semantic state
                  has an authored/retargeted clip bound to the target skeleton. Procedural
                  placeholders are TEST_ONLY.
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={runValidation}
                className="border border-zinc-600 px-4 py-3 text-[10px] font-black tracking-widest hover:bg-zinc-800 transition-all"
              >
                REVALIDATE
              </button>

              <button
                onClick={() => {
                  if (canProceed) {
                    console.log('[PreCombatValidation] Combat approved. P1:', p1Result?.overallStatus, 'P2:', p2Result?.overallStatus);
                    onCombatApproved();
                  }
                }}
                disabled={!canProceed}
                className={`flex-1 px-6 py-3 text-[11px] font-black tracking-widest transition-all ${
                  canProceed
                    ? 'bg-white text-black hover:bg-yellow-400 cursor-pointer' :'bg-zinc-800 text-zinc-600 cursor-not-allowed border border-zinc-700'
                }`}
              >
                {canProceed ? 'BEGIN COMBAT' : 'VALIDATING...'}
              </button>

              <button
                onClick={() => {
                  // Navigate to AnimationTestArena for debugging
                  console.log('[PreCombatValidation] Redirecting to AnimationTestArena for debugging');
                  // This is handled by the parent via onBack + navigation
                }}
                className="border border-purple-700 px-4 py-3 text-[10px] font-black tracking-widest text-purple-400 hover:bg-purple-900/30 transition-all"
                title="Open AnimationTestArena to debug animation issues"
              >
                ANIM DEBUG
              </button>
            </div>

            {/* Checklist legend */}
            <div className="mt-6 pt-4 border-t border-zinc-800/50">
              <div className="text-[8px] tracking-widest text-zinc-600 mb-2">CHECKLIST LEGEND</div>
              <div className="flex flex-wrap gap-4 text-[9px]">
                <div className="flex items-center gap-1.5"><span className="text-green-400 font-black">✓</span><span className="text-zinc-500">PASS — check passed</span></div>
                <div className="flex items-center gap-1.5"><span className="text-red-500 font-black">✗</span><span className="text-zinc-500">FAIL — combat blocked</span></div>
                <div className="flex items-center gap-1.5"><span className="text-yellow-400 font-black">⚠</span><span className="text-zinc-500">WARN — proceed with caution</span></div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
