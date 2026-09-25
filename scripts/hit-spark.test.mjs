import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPARK_COLOR,
  SPARK_LIFE_S,
  sparkWorldY,
  sparkContact,
  sparkColorFor,
  createHitEffectPool,
  spawnHitEffect,
  tickHitEffectPoolInPlace,
} from '../src/engine/combat/HitEffectSystem.ts';

test('spark height is high, mid, or low, plus airborne lift', () => {
  assert.equal(sparkWorldY('mid', 0), 1.05);
  assert.equal(sparkWorldY(undefined, 0), 1.05);
  assert.equal(sparkWorldY('high', 0), 1.55);
  assert.equal(sparkWorldY('low', 0), 0.38);
  assert.ok(Math.abs(sparkWorldY('high', 0.4) - 1.95) < 1e-9);
  const hit = sparkContact(1.2, 0.2, 0.0, 0, 'low', 0);
  assert.equal(hit.attackLevel, 'low');
  assert.equal(hit.worldY, 0.38);
  assert.ok(hit.worldX > 0.8 && hit.worldX < 1.2);
});

test('sparks ignore fighter color and die in a few frames', () => {
  const pool = createHitEffectPool();
  spawnHitEffect(pool, {
    type: 'clean_hit',
    screenX: 400,
    screenY: 250,
    worldX: 0.2,
    worldY: 1.55,
    worldZ: 0,
    characterColor: '#ff00ff',
    attackLevel: 'high',
    damage: 28,
    nowMs: 0,
  });
  const slot = pool.slots.find((s) => s.active);
  assert.ok(slot);
  assert.equal(slot.characterColor, SPARK_COLOR.high);
  assert.equal(slot.maxLife, SPARK_LIFE_S.clean_hit);
  assert.ok(slot.maxLife < 0.1, 'clean hit must be shorter than a tenth of a second');
  for (let i = 0; i < 6; i++) tickHitEffectPoolInPlace(pool, 1 / 60, 0);
  assert.equal(pool.slots.some((s) => s.active), false);
});

test('block is the pale shield, counter is white, heat is shared orange', () => {
  assert.equal(sparkColorFor('block', 'high'), SPARK_COLOR.block);
  assert.equal(sparkColorFor('counter_hit', 'low'), SPARK_COLOR.counter);
  assert.equal(sparkColorFor('clean_hit', 'mid', true), SPARK_COLOR.heat);
  const pool = createHitEffectPool();
  spawnHitEffect(pool, {
    type: 'block',
    screenX: 0, screenY: 0,
    worldX: 0, worldY: 0.38, worldZ: 0,
    characterColor: '#00ff00',
    attackLevel: 'low',
    damage: 8,
    nowMs: 0,
  });
  const slot = pool.slots.find((s) => s.active);
  assert.equal(slot.characterColor, SPARK_COLOR.block);
  assert.equal(slot.attackLevel, 'low');
  assert.equal(slot.maxLife, SPARK_LIFE_S.block);
  for (let i = 0; i < 5; i++) tickHitEffectPoolInPlace(pool, 1 / 60, 0);
  assert.equal(pool.slots.some((s) => s.active), false);
});

test('a hitch or a stalled frame cannot leave a spark up', () => {
  const pool = createHitEffectPool();
  spawnHitEffect(pool, {
    type: 'clean_hit',
    screenX: 0, screenY: 0,
    worldX: 0, worldY: 1.05, worldZ: 0,
    attackLevel: 'mid',
    damage: 28,
    nowMs: 10000,
  });
  tickHitEffectPoolInPlace(pool, 0.5, 10000);
  assert.equal(pool.slots.some((s) => s.active), false);

  const stuck = createHitEffectPool();
  spawnHitEffect(stuck, {
    type: 'clean_hit',
    screenX: 0, screenY: 0,
    worldX: 0, worldY: 1.55, worldZ: 0,
    attackLevel: 'high',
    heat: true,
    damage: 40,
    nowMs: 5000,
  });
  assert.equal(stuck.slots.find((s) => s.active).characterColor, SPARK_COLOR.heat);
  tickHitEffectPoolInPlace(stuck, 0, 5000 + 200);
  assert.equal(stuck.slots.some((s) => s.active), false);
});
