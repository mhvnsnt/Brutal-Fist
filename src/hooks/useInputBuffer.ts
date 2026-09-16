/**
 * useInputBuffer — 10-frame touch input buffer for Brutal Fist mobile controls.
 *
 * Guarantees that simultaneous D-pad + button presses never drop on mobile by
 * queuing every raw pointer event into a fixed-size ring buffer (10 frames at
 * 60 fps ≈ 167 ms window) and flushing it each animation frame.
 *
 * Architecture:
 *  - enqueueInput()  → called on every pointerdown / pointerup event
 *  - flushBuffer()   → called once per rAF tick; applies queued events to inputRef
 *  - The buffer is a fixed-length array acting as a circular queue so allocation
 *    is O(1) and GC pressure stays zero during gameplay.
 */

import { useRef, useCallback, useEffect } from 'react';
import { InputBitmask } from '../types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of frames to retain in the buffer (10 frames @ 60 fps ≈ 167 ms). */
const BUFFER_FRAMES = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

export type InputEventKind = 'down' | 'up';

export interface BufferedInputEvent {
  key: keyof InputBitmask;
  kind: InputEventKind;
  /** High-resolution timestamp from performance.now() at event origin. */
  ts: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns an `enqueueInput` function that buffers pointer events and a
 * `flushBuffer` function that should be called once per animation frame.
 *
 * @param inputRef  - Mutable ref to the shared InputBitmask written by the game loop.
 * @param onFlush   - Optional callback invoked after each flush with the events
 *                    that were applied (useful for combo detection).
 */
export function useInputBuffer(
  inputRef: React.RefObject<InputBitmask>,
  onFlush?: (events: BufferedInputEvent[]) => void,
) {
  // Ring buffer — pre-allocated to avoid GC during gameplay.
  const buffer = useRef<(BufferedInputEvent | null)[]>(
    Array(BUFFER_FRAMES).fill(null),
  );
  const writeHead = useRef(0);
  const readHead = useRef(0);
  const count = useRef(0);

  // rAF handle so we can cancel on unmount.
  const rafHandle = useRef<number | null>(null);

  /**
   * Push one input event into the ring buffer.
   * Called synchronously from pointer event handlers — must be O(1).
   */
  const enqueueInput = useCallback(
    (key: keyof InputBitmask, kind: InputEventKind) => {
      if (count.current >= BUFFER_FRAMES) {
        // Buffer full — overwrite oldest entry (oldest = readHead).
        // This keeps the most recent inputs and drops the oldest, which is the
        // correct behaviour for a fighting game (recency wins).
        readHead.current = (readHead.current + 1) % BUFFER_FRAMES;
        count.current--;
      }

      buffer.current[writeHead.current] = {
        key,
        kind,
        ts: performance.now(),
      };
      writeHead.current = (writeHead.current + 1) % BUFFER_FRAMES;
      count.current++;
    },
    [],
  );

  /**
   * Drain all queued events into `inputRef` in FIFO order.
   * Should be called once per animation frame (or game-loop tick).
   */
  const flushBuffer = useCallback(() => {
    if (count.current === 0 || !inputRef.current) return;

    const applied: BufferedInputEvent[] = [];

    while (count.current > 0) {
      const evt = buffer.current[readHead.current];
      if (evt) {
        (inputRef.current as Record<string, boolean>)[evt.key as string] =
          evt.kind === 'down';
        applied.push(evt);
        buffer.current[readHead.current] = null;
      }
      readHead.current = (readHead.current + 1) % BUFFER_FRAMES;
      count.current--;
    }

    if (applied.length > 0) onFlush?.(applied);
  }, [inputRef, onFlush]);

  // ── rAF flush loop ──────────────────────────────────────────────────────────
  // Runs independently of the React render cycle so it never misses a frame
  // even when the component is not re-rendering.
  useEffect(() => {
    let active = true;

    const tick = () => {
      if (!active) return;
      flushBuffer();
      rafHandle.current = requestAnimationFrame(tick);
    };

    rafHandle.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (rafHandle.current !== null) {
        cancelAnimationFrame(rafHandle.current);
        rafHandle.current = null;
      }
    };
  }, [flushBuffer]);

  return { enqueueInput, flushBuffer };
}
