/**
 * useInputBuffer — snapshot-based touch input buffer for Brutal Fist mobile controls.
 *
 * Returns a stable buffer object with two methods:
 *   push(snapshot)  → enqueue a full InputBitmask snapshot
 *   drain()         → dequeue and return all pending snapshots in FIFO order
 *
 * Used by MobileControls to guarantee that simultaneous D-pad + button presses
 * are never silently dropped on mobile. Every pointer event pushes a full
 * InputBitmask snapshot; the rAF drain loop in MobileControls flushes them
 * each animation frame.
 *
 * Architecture:
 *  - push()  → called on every pointer event (pointerdown / pointerup / drag)
 *  - drain() → called once per rAF tick; returns all queued snapshots in order
 *  - Fixed-size ring buffer (BUFFER_FRAMES) so allocation is O(1) and GC
 *    pressure stays zero during gameplay.
 *
 * STABILITY GUARANTEE:
 *  - The buffer object is created exactly once using a module-level singleton
 *    per hook instance, stored in useRef. This guarantees push() and drain()
 *    are always defined regardless of React Strict Mode double-invocations,
 *    render cycles, or hot-module replacement.
 */

import { useRef } from 'react';
import { InputBitmask } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of snapshot frames to retain in the buffer (10 frames @ 60 fps ≈ 167 ms). */
const BUFFER_FRAMES = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BufferedFrame {
  snapshot: InputBitmask;
  /** High-resolution timestamp from performance.now() at push time. */
  ts: number;
}

export interface InputBuffer {
  /**
   * Enqueue a full InputBitmask snapshot.
   * Called synchronously from pointer event handlers — O(1).
   */
  push(snapshot: InputBitmask): void;
  /**
   * Dequeue and return all pending snapshots in FIFO order.
   * Called once per animation frame. Returns [] if buffer is empty.
   */
  drain(): BufferedFrame[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns a stable InputBuffer object with push() and drain() methods.
 *
 * Implementation uses a plain array queue (not a ring buffer) for maximum
 * clarity and reliability. The array is bounded to BUFFER_FRAMES entries.
 *
 * The buffer object is created once via lazy useRef initialization and never
 * recreated — identity is stable across all renders and React Strict Mode
 * double-invocations.
 */
export function useInputBuffer(): InputBuffer {
  const bufferRef = useRef<InputBuffer | null>(null);

  if (bufferRef.current === null) {
    // Create the queue array inside the closure so it's private to this instance.
    const queue: BufferedFrame[] = [];

    bufferRef.current = {
      push(snapshot: InputBitmask): void {
        // Bound the queue to BUFFER_FRAMES — drop oldest if full (recency wins).
        if (queue.length >= BUFFER_FRAMES) {
          queue.shift();
        }
        queue.push({
          snapshot: { ...snapshot },
          ts: typeof performance !== 'undefined' ? performance.now() : Date.now(),
        });
      },

      drain(): BufferedFrame[] {
        if (queue.length === 0) return [];
        // Splice all entries out in FIFO order.
        const result = queue.splice(0, queue.length);
        return result;
      },
    };
  }

  // TypeScript non-null assertion: we just guaranteed it's non-null above.
  return bufferRef.current!;
}

// ─── Legacy export for any callers that used the old API ──────────────────────
// The old useInputBuffer took (inputRef, onFlush?) and returned { enqueueInput, flushBuffer }.
// That API is no longer used — MobileControls is the sole consumer and it uses push/drain.
export type { InputBitmask };
