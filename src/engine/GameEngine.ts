import { FighterState, InputBitmask, FrameData } from '../types';

export class GameEngine {
  // 60-frame rolling input buffer
  public inputBuffer: InputBitmask[] = [];
  public currentFrame: number = 0;
  
  public p1Health: number = 250;
  public p2Health: number = 250;
  
  // State Machine
  public state: FighterState = FighterState.Neutral;
  public stateFrameCounter: number = 0;
  public currentMove: FrameData | null = null;
  
  private maxBufferSize = 60;

  constructor() {
    // Initialize input buffer
    for (let i = 0; i < this.maxBufferSize; i++) {
      this.inputBuffer.push(this.getEmptyInput());
    }
  }

  private getEmptyInput(): InputBitmask {
    return { up: false, down: false, left: false, right: false, light: false, heavy: false, guard: false };
  }

  public tick(currentInput: InputBitmask) {
    this.currentFrame++;
    
    // Update Rolling Input Buffer
    this.inputBuffer.shift();
    this.inputBuffer.push({ ...currentInput });

    // Update State Machine
    this.updateState();
  }

  private updateState() {
    this.stateFrameCounter++;

    if (this.currentMove) {
      if (this.state === FighterState.Startup) {
        if (this.stateFrameCounter >= this.currentMove.startup) {
          this.state = FighterState.Active;
          this.stateFrameCounter = 0;
        }
      } else if (this.state === FighterState.Active) {
        if (this.stateFrameCounter === 1) {
            // Apply damage on the very first active frame (stub hit logic)
            this.p2Health = Math.max(0, this.p2Health - this.currentMove.damage);
        }
        if (this.stateFrameCounter >= this.currentMove.active) {
          this.state = FighterState.Recovery;
          this.stateFrameCounter = 0;
        }
      } else if (this.state === FighterState.Recovery) {
        if (this.stateFrameCounter >= this.currentMove.recovery) {
          this.state = FighterState.Neutral;
          this.stateFrameCounter = 0;
          this.currentMove = null;
        }
      }
    } else {
      // In Neutral, we can parse inputs to trigger a move
      if (this.state === FighterState.Neutral) {
        const latestInput = this.inputBuffer[this.inputBuffer.length - 1];
        if (latestInput.light) {
          this.executeMove({
            startup: 4,
            active: 3,
            recovery: 10,
            damage: 10,
            hitAdvantage: 4,
            blockAdvantage: -2,
            pushback: 1.5
          });
        } else if (latestInput.heavy) {
          this.executeMove({
            startup: 12,
            active: 4,
            recovery: 20,
            damage: 25,
            hitAdvantage: 2,
            blockAdvantage: -6,
            pushback: 3.0
          });
        }
      }
    }
  }

  private executeMove(moveData: FrameData) {
    this.state = FighterState.Startup;
    this.stateFrameCounter = 0;
    this.currentMove = moveData;
  }
}
