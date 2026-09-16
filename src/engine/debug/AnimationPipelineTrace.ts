/**
 * Lightweight, opt-in animation pipeline tracing.
 *
 * This is diagnostic only: it never changes gameplay state, animation choice,
 * or fallback behaviour. Events are retained in memory so the test arena and
 * browser console can prove MobileControls -> FSM -> AnimationBridge -> mixer.
 */
export type AnimationTraceStage =
  | 'MobileControls'
  | 'FighterController'
  | 'FighterStateMachine'
  | 'AnimationBridge'
  | 'FighterMesh'
  | 'AnimationMixer';

export interface AnimationTraceEvent {
  time: number;
  stage: AnimationTraceStage;
  event: string;
  state?: string;
  semantic?: string;
  clip?: string;
  source?: 'AUTHORED_CLIP' | 'RETARGETED_AUTHORED_CLIP' | 'PLACEHOLDER_TEST_CLIP' | 'MISSING_CLIP' | 'UNKNOWN';
  details?: Record<string, unknown>;
}

const MAX_EVENTS = 250;
const events: AnimationTraceEvent[] = [];
let enabled = true;

export const AnimationPipelineTrace = {
  setEnabled(value: boolean) { enabled = value; },
  isEnabled() { return enabled; },
  clear() { events.length = 0; },
  snapshot(): AnimationTraceEvent[] { return events.slice(); },
  emit(event: Omit<AnimationTraceEvent, 'time'>) {
    if (!enabled || typeof performance === 'undefined') return;
    const item = { ...event, time: performance.now() };
    events.push(item);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    // One structured line makes the complete path grep-able in mobile devtools.
    console.debug(`[ANIM-TRACE] ${event.stage} ${event.event}`, {
      state: event.state,
      semantic: event.semantic,
      clip: event.clip,
      source: event.source,
      ...event.details,
    });
  },
};
