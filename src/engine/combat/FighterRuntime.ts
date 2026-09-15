import type { AnimationController } from '../retarget/AnimationController';
import { FighterStateMachine, type FighterInput } from './FighterStateMachine';

export interface FighterRuntime {
  stateMachine:FighterStateMachine;
  update(input:FighterInput,dt:number):void;
}

export function createFighterRuntime(controller:{play:(state:any)=>void}, animationController:AnimationController):FighterRuntime {
  const stateMachine=new FighterStateMachine();
  let previous=stateMachine.current;
  return {
    stateMachine,
    update(input,dt){
      const next=stateMachine.update(input,dt);
      if(next!==previous){
        animationController.play(next);
        previous=next;
      }
      animationController.update(dt);
    }
  };
}
