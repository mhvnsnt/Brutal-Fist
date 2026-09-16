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

// ─── Internal ring-buffer state ───────────────────────────────────────────────

interface RingBufferState {
  frames: (BufferedFrame | null)[];
  writeHead: number;
  readHead: number;
  count: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns a stable InputBuffer object with push() and drain() methods.
 * Uses useRef so the buffer object identity is guaranteed stable across
 * renders and React Strict Mode double-invocations.
 */
export function useInputBuffer(): InputBuffer {
  // All ring-buffer state lives in a single ref to avoid closure capture issues.
  const stateRef = useRef<RingBufferState>({
    frames: Array(BUFFER_FRAMES).fill(null) as (BufferedFrame | null)[],
    writeHead: 0,
    readHead: 0,
    count: 0,
  });

  // The buffer object itself is stored in a ref — created once, never recreated.
  const bufferRef = useRef<InputBuffer | null>(null);

  if (bufferRef.current === null) {
    bufferRef.current = {
      push(snapshot: InputBitmask): void {
        const s = stateRef.current;
        if (s.count >= BUFFER_FRAMES) {
          // Buffer full — overwrite oldest entry (recency wins in fighting games).
          s.readHead = (s.readHead + 1) % BUFFER_FRAMES;
          s.count--;
        }
        s.frames[s.writeHead] = {
          snapshot: { ...snapshot },
          ts: performance.now(),
        };
        s.writeHead = (s.writeHead + 1) % BUFFER_FRAMES;
        s.count++;
      },

      drain(): BufferedFrame[] {
        const s = stateRef.current;
        if (s.count === 0) return [];

        const result: BufferedFrame[] = [];
        while (s.count > 0) {
          const frame = s.frames[s.readHead];
          if (frame) {
            result.push(frame);
            s.frames[s.readHead] = null;
          }
          s.readHead = (s.readHead + 1) % BUFFER_FRAMES;
          s.count--;
        }
        return result;
      },
    };
  }

  return bufferRef.current;
}

// ─── Legacy export for any callers that used the old API ──────────────────────
// The old useInputBuffer took (inputRef, onFlush?) and returned { enqueueInput, flushBuffer }.
// That API is no longer used — MobileControls is the sole consumer and it uses push/drain.
export type { InputBitmask };
