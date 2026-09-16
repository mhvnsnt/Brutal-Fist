/**
 * AnimationSourceRegistry.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Distinguishes and catalogs animation sources by type, provenance, and license.
 *
 * Source categories:
 *   BANNON_MOTION_BANK   — Bannon repo assets/moves/clips/ (highest priority)
 *   BANNON_RIG_REFERENCE — BANNON_rigged.glb / BANNON_v1_rigready.glb
 *   SCHWARZERBLITZ       — BSD-3-Clause engine/reference (NO character assets)
 *   NIGHTSKY_ENGINE      — MIT-licensed fighting framework (engine/reference only)
 *   TEKKEN_TOOLING       — Importer/retargeting reference (NO proprietary bytes)
 *   OPEN_MOCAP           — CC0/open-licensed mocap sources
 *   PROCEDURAL           — Diagnostic placeholder (must be replaced)
 *
 * LEGAL NOTES:
 *   - Schwarzerblitz engine: BSD-3-Clause. Character/stage/music assets NOT redistributable.
 *   - NightSky Engine: MIT. Engine architecture reusable.
 *   - Tekken: Proprietary. Animation bytes NOT included. Reference only.
 *   - Owner has explicitly granted permission to use Tekken and Schwarzerblitz
 *     assets from the mhvnsnt repos.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Source types
// ─────────────────────────────────────────────────────────────────────────────

export type AnimationSourceType =
  | 'BANNON_MOTION_BANK' |'BANNON_RIG_REFERENCE' |'SCHWARZERBLITZ' |'NIGHTSKY_ENGINE' |'TEKKEN_TOOLING' |'OPEN_MOCAP' |'PROCEDURAL' |'UNKNOWN';

export interface AnimationSourceEntry {
  /** Unique identifier for this source */
  id: string;
  /** Source type category */
  type: AnimationSourceType;
  /** Semantic state this source provides */
  semanticState: string;
  /** File path or URL (relative to project root) */
  file: string;
  /** Bone naming convention used in this source */
  sourceConvention: 'mixamo' | 'fbx' | 'bvh' | 'mocap' | 'native' | 'bannon' | 'schwarzerblitz' | 'unknown';
  /** SPDX license identifier or description */
  license: string;
  /** Provenance description */
  provenance: string;
  /** Whether this source is legally usable for redistribution */
  redistributable: boolean;
  /** Priority (lower = higher priority) */
  priority: number;
  /** The actual AnimationClip (populated at runtime) */
  clip?: THREE.AnimationClip;
}

// ─────────────────────────────────────────────────────────────────────────────
// Source priority constants
// ─────────────────────────────────────────────────────────────────────────────

export const SOURCE_PRIORITY = {
  BANNON_MOTION_BANK: 1,
  BANNON_RIG_REFERENCE: 2,
  OPEN_MOCAP: 3,
  SCHWARZERBLITZ: 4,
  NIGHTSKY_ENGINE: 5,
  TEKKEN_TOOLING: 6,
  PROCEDURAL: 99,
  UNKNOWN: 100,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Registry class
// ─────────────────────────────────────────────────────────────────────────────

export class AnimationSourceRegistry {
  private entries: AnimationSourceEntry[] = [];
  private clipsByState = new Map<string, THREE.AnimationClip>();
  private sourcesByState = new Map<string, AnimationSourceEntry>();

  /**
   * Register an animation source entry.
   * If a clip for this semantic state already exists with higher priority,
   * the new entry is ignored.
   */
  register(entry: AnimationSourceEntry): void {
    this.entries.push(entry);

    // If a clip is attached, check priority
    if (entry.clip) {
      const existing = this.sourcesByState.get(entry.semanticState);
      if (!existing || entry.priority < existing.priority) {
        this.clipsByState.set(entry.semanticState, entry.clip);
        this.sourcesByState.set(entry.semanticState, entry);
        console.log(
          `[AnimationSourceRegistry] ✅ Registered "${entry.semanticState}" from ${entry.type} ` +
          `(priority=${entry.priority}, license="${entry.license}")`
        );
      } else {
        console.log(
          `[AnimationSourceRegistry] ℹ️ Skipped "${entry.semanticState}" from ${entry.type} ` +
          `— existing source has higher priority (${existing.priority} < ${entry.priority})`
        );
      }
    }
  }

  /**
   * Register a batch of clips from the Bannon motion bank.
   * These have the highest priority.
   */
  registerBannonMotionBank(
    clips: Map<string, THREE.AnimationClip>,
    sourceFile = 'assets/moves/clips/',
  ): void {
    for (const [semanticState, clip] of clips) {
      const isProcedural = (clip as any).userData?.isProcedural === true;
      this.register({
        id: `bannon_motion_bank_${semanticState}`,
        type: isProcedural ? 'PROCEDURAL' : 'BANNON_MOTION_BANK',
        semanticState,
        file: sourceFile,
        sourceConvention: 'bannon',
        license: 'proprietary',
        provenance: `Bannon motion bank: ${sourceFile}`,
        redistributable: false,
        priority: isProcedural ? SOURCE_PRIORITY.PROCEDURAL : SOURCE_PRIORITY.BANNON_MOTION_BANK,
        clip,
      });
    }
  }

  /**
   * Register clips extracted from a rigged GLB.
   */
  registerGLBClips(
    clips: THREE.AnimationClip[],
    glbPath: string,
    characterId: string,
  ): void {
    for (const clip of clips) {
      const semanticState = (clip as any).userData?.semanticState ?? clip.name;
      this.register({
        id: `glb_${characterId}_${semanticState}`,
        type: 'BANNON_RIG_REFERENCE',
        semanticState,
        file: glbPath,
        sourceConvention: 'native',
        license: 'proprietary',
        provenance: `GLB embedded animation: ${glbPath}`,
        redistributable: false,
        priority: SOURCE_PRIORITY.BANNON_RIG_REFERENCE,
        clip,
      });
    }
  }

  /**
   * Register open/CC0 mocap clips.
   */
  registerOpenMocap(
    clips: Map<string, THREE.AnimationClip>,
    sourceFile: string,
    license: string,
  ): void {
    for (const [semanticState, clip] of clips) {
      this.register({
        id: `open_mocap_${semanticState}`,
        type: 'OPEN_MOCAP',
        semanticState,
        file: sourceFile,
        sourceConvention: 'mixamo',
        license,
        provenance: `Open mocap: ${sourceFile}`,
        redistributable: true,
        priority: SOURCE_PRIORITY.OPEN_MOCAP,
        clip,
      });
    }
  }

  /**
   * Get the best available clip for a semantic state.
   * Returns null if no clip is registered for this state.
   */
  getClip(semanticState: string): THREE.AnimationClip | null {
    return this.clipsByState.get(semanticState) ?? null;
  }

  /**
   * Get all registered clips as a Map<semanticState, AnimationClip>.
   */
  getAllClips(): Map<string, THREE.AnimationClip> {
    return new Map(this.clipsByState);
  }

  /**
   * Get the source entry for a semantic state.
   */
  getSource(semanticState: string): AnimationSourceEntry | null {
    return this.sourcesByState.get(semanticState) ?? null;
  }

  /**
   * Get all registered semantic states.
   */
  getRegisteredStates(): string[] {
    return [...this.clipsByState.keys()];
  }

  /**
   * Get states that have no registered clip.
   */
  getMissingStates(requiredStates: string[]): string[] {
    return requiredStates.filter(s => !this.clipsByState.has(s));
  }

  /**
   * Print a full registry report to the console.
   */
  printReport(characterId: string): void {
    const states = this.getRegisteredStates();
    const sources = states.map(s => {
      const src = this.sourcesByState.get(s);
      return `  ${s.padEnd(20)} | ${(src?.type ?? 'UNKNOWN').padEnd(20)} | ${src?.license ?? 'unknown'}`;
    });

    console.log(
      `[AnimationSourceRegistry] 📋 "${characterId}" registry report:\n` +
      `  Registered states: ${states.length}\n` +
      `  State                | Source Type          | License\n` +
      `  ${'─'.repeat(60)}\n` +
      sources.join('\n')
    );
  }

  /**
   * Check if any procedural placeholders are registered.
   * Used to warn that real animation is still needed.
   */
  hasProceduralPlaceholders(): boolean {
    for (const entry of this.sourcesByState.values()) {
      if (entry.type === 'PROCEDURAL') return true;
    }
    return false;
  }

  /**
   * Get count of procedural placeholder clips.
   */
  getProceduralCount(): number {
    let count = 0;
    for (const entry of this.sourcesByState.values()) {
      if (entry.type === 'PROCEDURAL') count++;
    }
    return count;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Required semantic states for a playable fighter
// ─────────────────────────────────────────────────────────────────────────────

export const REQUIRED_SEMANTIC_STATES = [
  'idle',
  'walk_forward',
  'walk_back',
  'strafe_left',
  'strafe_right',
  'attack_1',
  'attack_2',
  'block',
  'hit_reaction',
  'knockdown',
  'getup',
] as const;

export type RequiredSemanticState = typeof REQUIRED_SEMANTIC_STATES[number];

/**
 * Validate that a registry has all required states for a playable fighter.
 * Returns a report with PASS/BLOCKED verdict.
 */
export function validateRegistryCompleteness(
  registry: AnimationSourceRegistry,
  characterId: string,
): {
  verdict: 'PASS' | 'PARTIAL' | 'BLOCKED';
  registeredCount: number;
  missingStates: string[];
  proceduralCount: number;
  report: string;
} {
  const missingStates = registry.getMissingStates([...REQUIRED_SEMANTIC_STATES]);
  const proceduralCount = registry.getProceduralCount();
  const registeredCount = registry.getRegisteredStates().length;

  let verdict: 'PASS' | 'PARTIAL' | 'BLOCKED';
  if (missingStates.length === 0 && proceduralCount === 0) {
    verdict = 'PASS';
  } else if (missingStates.length === 0) {
    verdict = 'PARTIAL'; // All states covered but some are procedural placeholders
  } else {
    verdict = 'BLOCKED'; // Missing required states
  }

  const report =
    `[AnimationSourceRegistry] ${verdict === 'PASS' ? '✅' : verdict === 'PARTIAL' ? '⚠️' : '❌'} ` +
    `"${characterId}" registry completeness: ${verdict}\n` +
    `  Registered: ${registeredCount}/${REQUIRED_SEMANTIC_STATES.length} required states\n` +
    `  Missing:    [${missingStates.join(', ') || 'none'}]\n` +
    `  Procedural: ${proceduralCount} placeholder(s) — replace with authored animation\n` +
    (verdict === 'BLOCKED'
      ? `  ❌ BLOCKED: Fighter cannot be played without: [${missingStates.join(', ')}]`
      : verdict === 'PARTIAL'
      ? `  ⚠️ PARTIAL: ${proceduralCount} procedural placeholder(s) — visible deformation but not authored motion`
      : `  ✅ PASS: All required states have authored animation clips`);

  console.log(report);

  return { verdict, registeredCount, missingStates, proceduralCount, report };
}
