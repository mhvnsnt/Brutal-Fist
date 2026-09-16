import { buildAnimationController } from '../retarget/AnimationController';
import type { FighterMotionState } from '../retarget/AnimationController';
import {
  FighterStateMachine,
  type FighterInput,
  type HitboxWindow,
  type SpecialMoveDefinition,
} from './FighterStateMachine';
import { FrameDataHitboxSystem, type CollisionResult } from './FrameDataHitbox';

export interface FighterRuntime {
  stateMachine: FighterStateMachine;
  hitboxSystem: FrameDataHitboxSystem;
  update(input: FighterInput, dt: number): void;
  checkHit(
    myX: number,
    myZ: number,
    facing: 1 | -1,
    opponentX: number,
    opponentZ: number,
    opponentIsBlocking: boolean,
  ): CollisionResult | null;
  applyStun(duration: number, isCrumple?: boolean): void;
  registerSpecialMoves(moves: SpecialMoveDefinition[]): void;
  getHitboxWindow(): HitboxWindow;
}

export type FighterAnimationController = ReturnType<typeof buildAnimationController>;

export function createFighterRuntime(
  controller: { play: (state: FighterMotionState) => void },
  animationController: FighterAnimationController,
): FighterRuntime {
  const stateMachine = new FighterStateMachine();
  const hitboxSystem = new FrameDataHitboxSystem();
  let previous: FighterMotionState = stateMachine.current;

  return {
    stateMachine,
    hitboxSystem,

    update(input: FighterInput, dt: number) {
      const next = stateMachine.update(input, dt) as FighterMotionState;

      // Update animation only on state change
      if (next !== previous) {
        controller.play(next);
        animationController.play(next);
        previous = next;
      }

      // Always advance the mixer
      animationController.update(dt);

      // Update hitbox system from current frame-data window
      const hitboxWindow = stateMachine.getHitboxWindow();
      hitboxSystem.update(hitboxWindow);
    },

    checkHit(myX, myZ, facing, opponentX, opponentZ, opponentIsBlocking) {
      const window = stateMachine.getHitboxWindow();
      return hitboxSystem.checkCollision(
        myX, myZ, facing,
        opponentX, opponentZ,
        opponentIsBlocking,
        window.currentFrame,
      );
    },

    applyStun(duration: number, isCrumple = false) {
      stateMachine.applyStun(duration, isCrumple);
      hitboxSystem.reset();
    },

    registerSpecialMoves(moves: SpecialMoveDefinition[]) {
      stateMachine.registerSpecialMoves(moves);
    },

    getHitboxWindow() {
      return stateMachine.getHitboxWindow();
    },
  };
}
