import { buildAnimationController } from '../retarget/AnimationController';
import type { FighterMotionState } from '../retarget/AnimationController';
import { FighterStateMachine, type FighterInput } from './FighterStateMachine';

export interface FighterRuntime {
  stateMachine: FighterStateMachine;
  update(input: FighterInput, dt: number): void;
}

export type FighterAnimationController = ReturnType<typeof buildAnimationController>;

export function createFighterRuntime(
  controller: { play: (state: FighterMotionState) => void },
  animationController: FighterAnimationController
): FighterRuntime {
  const stateMachine = new FighterStateMachine();
  let previous = stateMachine.current;
  return {
    stateMachine,
    update(input, dt) {
      const next = stateMachine.update(input, dt) as FighterMotionState;
      if (next !== previous) {
        controller.play(next);
        animationController.play(next);
        previous = next;
      }
      animationController.update(dt);
    }
  };
}
