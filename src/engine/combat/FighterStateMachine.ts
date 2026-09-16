import type { FighterMotionState } from '../retarget/AnimationController';

export interface FighterInput {
  forward:number; strafe:number;
  light:boolean; heavy:boolean; guard:boolean; crouch:boolean;
}

export interface MoveWindow {
  startup:number; active:number; recovery:number;
  animation:FighterMotionState;
}

export const DEFAULT_MOVE_WINDOWS: Record<'lightAttack'|'heavyAttack',MoveWindow> = {
  lightAttack:{startup:0.12,active:0.10,recovery:0.22,animation:'lightAttack'},
  heavyAttack:{startup:0.20,active:0.14,recovery:0.38,animation:'heavyAttack'}
};

export class FighterStateMachine {
  private state:FighterMotionState='idle';
  private timer=0;
  private move:MoveWindow|null=null;

  get current(){ return this.state; }
  get phase(){ return this.move ? this.timer : 0; }

  update(input:FighterInput, dt:number){
    this.timer=Math.max(0,this.timer-dt);

    if(this.move){
      if(this.timer<=0){
        if(this.state==='lightAttack'||this.state==='heavyAttack') this.move=null;
      } else return this.state;
    }

    if(input.light){ return this.begin('lightAttack',DEFAULT_MOVE_WINDOWS.lightAttack); }
    if(input.heavy){ return this.begin('heavyAttack',DEFAULT_MOVE_WINDOWS.heavyAttack); }
    if(input.guard){ this.state='guard'; return this.state; }
    if(input.crouch){ this.state='crouch'; return this.state; }

    const f=Math.abs(input.forward), s=Math.abs(input.strafe);
    if(f>s && f>0.1){ this.state=input.forward>0?'walkForward':'walkBackward'; return this.state; }
    if(s>0.1){ this.state=input.strafe>0?'strafeRight':'strafeLeft'; return this.state; }
    this.state='idle'; return this.state;
  }

  private begin(state:FighterMotionState, move:MoveWindow){
    this.state=state;
    this.move=move;
    this.timer=move.startup+move.active+move.recovery;
    return state;
  }
}
