import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/engine/GameEngine.ts';
import { FighterStateMachine } from '../src/engine/combat/FighterStateMachine.ts';
import { computeStrikePlayback, READABLE_TIMESCALE_CAP } from '../src/engine/combat/ClipPlaybackGate.ts';

const press = {
  up: false, down: false, left: false, right: false,
  light: true, heavy: false, guard: false,
};

test('ghost engine used to damage a fighter the player cannot see', () => {
  const ghost = new GameEngine();
  ghost.p1X = 0;
  ghost.p2X = 1.2;
  const before = ghost.p2Health;
  for (let i = 0; i < 40; i++) ghost.tick(press);
  assert.ok(ghost.p2Health < before, 'legacy tick should still land its own hit');
});

test('arena ledger does not invent a second hit', () => {
  const ledger = new GameEngine();
  ledger.arenaAuthoritative = true;
  ledger.p1X = 0;
  ledger.p2X = 1.2;
  const before = ledger.p2Health;
  for (let i = 0; i < 40; i++) ledger.tick(press);
  assert.equal(ledger.p2Health, before);
  ledger.applyIncomingHit('p2', 40, false, 0.2);
  assert.equal(ledger.p2Health, before - 40);
});

test('a long frame cannot skip a short jab active', () => {
  const sm = new FighterStateMachine();
  const idle = {
    forward: 0, strafe: 0, light: false, heavy: false, guard: false, crouch: false,
    lp: false, rp: false, lk: false, rk: false,
  };
  sm.update(idle, 1 / 60);
  sm.update({ ...idle, lp: true, light: true }, 1 / 60);
  sm.update(idle, 0.1);
  const window = sm.getHitboxWindow();
  assert.equal(window.active, true);
});

test('a long mixamo punch skips the chamber instead of smearing at 7.5x', () => {
  const jab = computeStrikePlayback(1.73, 0.32, 'BOXING');
  assert.ok(jab.startTime > 0.4);
  assert.ok(jab.timeScale <= READABLE_TIMESCALE_CAP);
  assert.ok(jab.timeScale >= 1);
  const spin = computeStrikePlayback(1.6, 1.62, 'HURRICANE_KICK');
  assert.equal(spin.startTime, 0);
  assert.ok(spin.timeScale < 1.2);
});

