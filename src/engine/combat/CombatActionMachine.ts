/**
 * Strict fighting-game action gate (xstate).
 * Visual mixer stays in FighterMesh; this machine only forbids illegal
 * action transitions the way Castagne / Night Sky isolate state from render.
 */
import { setup, createActor, type ActorRefFrom } from 'xstate';

export type CombatAction =
  | 'idle'
  | 'walk'
  | 'startup'
  | 'active'
  | 'recovery'
  | 'guard'
  | 'hitstun'
  | 'knockdown'
  | 'wakeup'
  | 'ko';

export const combatActionMachine = setup({
  types: {
    events: {} as
      | { type: 'WALK' }
      | { type: 'ATTACK' }
      | { type: 'ACTIVE' }
      | { type: 'RECOVER' }
      | { type: 'GUARD' }
      | { type: 'HIT' }
      | { type: 'KNOCKDOWN' }
      | { type: 'WAKEUP' }
      | { type: 'KO' }
      | { type: 'IDLE' },
  },
}).createMachine({
  id: 'brutalFistCombat',
  initial: 'idle',
  states: {
    idle: {
      on: { WALK: 'walk', ATTACK: 'startup', GUARD: 'guard', HIT: 'hitstun', KO: 'ko' },
    },
    walk: {
      on: { IDLE: 'idle', ATTACK: 'startup', GUARD: 'guard', HIT: 'hitstun', KO: 'ko' },
    },
    startup: {
      on: { ACTIVE: 'active', HIT: 'hitstun', KO: 'ko' },
    },
    active: {
      on: { RECOVER: 'recovery', HIT: 'hitstun', KO: 'ko' },
    },
    recovery: {
      on: { IDLE: 'idle', GUARD: 'guard', HIT: 'hitstun', KO: 'ko' },
    },
    guard: {
      on: { IDLE: 'idle', HIT: 'hitstun', KO: 'ko' },
    },
    hitstun: {
      on: { IDLE: 'idle', KNOCKDOWN: 'knockdown', KO: 'ko' },
    },
    knockdown: {
      on: { WAKEUP: 'wakeup', KO: 'ko' },
    },
    wakeup: {
      on: { IDLE: 'idle', HIT: 'hitstun', KO: 'ko' },
    },
    ko: {},
  },
});

export function createCombatActionActor() {
  return createActor(combatActionMachine);
}

export type CombatActionActor = ActorRefFrom<typeof combatActionMachine>;

export function canFireCombatEvent(actor: CombatActionActor, type: Parameters<CombatActionActor['send']>[0]['type']) {
  const snapshot = actor.getSnapshot();
  return snapshot.can({ type } as never);
}
