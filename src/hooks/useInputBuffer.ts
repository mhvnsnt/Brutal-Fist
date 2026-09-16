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
 */

import { useRef, useMemo } from 'react';
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
 * The returned object reference is stable across renders (useMemo).
 */
export function useInputBuffer(): InputBuffer {
  // Ring buffer — pre-allocated to avoid GC during gameplay.
  const frames = useRef<(BufferedFrame | null)[]>(
    Array(BUFFER_FRAMES).fill(null),
  );
  const writeHead = useRef(0);
  const readHead = useRef(0);
  const count = useRef(0);

  const buffer = useMemo<InputBuffer>(() => ({
    push(snapshot: InputBitmask): void {
      if (count.current >= BUFFER_FRAMES) {
        // Buffer full — overwrite oldest entry (recency wins in fighting games).
        readHead.current = (readHead.current + 1) % BUFFER_FRAMES;
        count.current--;
      }
      frames.current[writeHead.current] = {
        snapshot: { ...snapshot },
        ts: performance.now(),
      };
      writeHead.current = (writeHead.current + 1) % BUFFER_FRAMES;
      count.current++;
    },

    drain(): BufferedFrame[] {
      if (count.current === 0) return [];

      const result: BufferedFrame[] = [];
      while (count.current > 0) {
        const frame = frames.current[readHead.current];
        if (frame) {
          result.push(frame);
          frames.current[readHead.current] = null;
        }
        readHead.current = (readHead.current + 1) % BUFFER_FRAMES;
        count.current--;
      }
      return result;
    },
  }), []); // stable — never recreated

  return buffer;
}

// ─── Legacy export for any callers that used the old API ──────────────────────
// The old useInputBuffer took (inputRef, onFlush?) and returned { enqueueInput, flushBuffer }.
// That API is no longer used — MobileControls is the sole consumer and it uses push/drain.
export type { InputBitmask };
