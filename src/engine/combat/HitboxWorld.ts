/**
 * miniplex ECS world for combat hitboxes.
 * Keeps frame data (health, active spheres, hit-stop) off the R3F render loop
 * so dropped frames do not drop inputs.
 */
import { World } from 'miniplex';

export type HitboxEntity = {
  id: 'p1' | 'p2';
  health: number;
  hitStopMs: number;
  activeSpheres: Array<{ x: number; y: number; z: number; radius: number; damage: number }>;
};

export const hitboxWorld = new World<HitboxEntity>();

export function resetHitboxWorld() {
  hitboxWorld.clear();
  hitboxWorld.add({ id: 'p1', health: 10000, hitStopMs: 0, activeSpheres: [] });
  hitboxWorld.add({ id: 'p2', health: 10000, hitStopMs: 0, activeSpheres: [] });
}

export function syncHitboxEntity(id: 'p1' | 'p2', patch: Partial<HitboxEntity>) {
  const entity = hitboxWorld.entities.find((e) => e.id === id);
  if (!entity) return;
  Object.assign(entity, patch);
}
