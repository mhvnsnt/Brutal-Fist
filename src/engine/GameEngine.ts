import { FighterState, InputBitmask, FrameData } from '../types';

export class GameEngine {
  public inputBuffer: InputBitmask[] = [];
  public currentFrame = 0;

  public p1Health = 250;
  public p2Health = 250;

  public state: FighterState = FighterState.Neutral;
  public p2State: FighterState = FighterState.Neutral;
  public stateFrameCounter = 0;
  public p2StateFrameCounter = 0;
  public currentMove: FrameData | null = null;
  public p2Move: FrameData | null = null;

  // 3D arena coordinates. X is the fighting lane, Z is the sidestep lane.
  public p1X = -2.25;
  public p1Z = 0;
  public p2X = 2.25;
  public p2Z = 0;

  private readonly maxBufferSize = 60;
  private readonly arenaX = 5.5;
  private readonly arenaZ = 2.25;
  private readonly walkSpeed = 0.075;
  private readonly sidestepSpeed = 0.055;

  constructor() {
    for (let i = 0; i < this.maxBufferSize; i++) this.inputBuffer.push(this.emptyInput());
  }

  private emptyInput(): InputBitmask {
    return { up: false, down: false, left: false, right: false, light: false, heavy: false, guard: false };
  }

  public tick(currentInput: InputBitmask) {
    this.currentFrame++;
    this.inputBuffer.shift();
    this.inputBuffer.push({ ...currentInput });

    this.updateMovement(currentInput);
    this.updatePlayerCombat(currentInput);
    this.updateCpu();
  }

  private updateMovement(input: InputBitmask) {
    // Movement is available during neutral/recovery and is locked during attacks.
    if (this.state === FighterState.Neutral || this.state === FighterState.Recovery) {
      if (input.left) this.p1X -= this.walkSpeed;
      if (input.right) this.p1X += this.walkSpeed;
      if (input.up) this.p1Z -= this.sidestepSpeed;
      if (input.down) this.p1Z += this.sidestepSpeed;
    }

    this.p1X = Math.max(-this.arenaX, Math.min(this.arenaX, this.p1X));
    this.p1Z = Math.max(-this.arenaZ, Math.min(this.arenaZ, this.p1Z));
  }

  private updatePlayerCombat(input: InputBitmask) {
    this.stateFrameCounter++;

    if (this.currentMove) {
      if (this.state === FighterState.Startup && this.stateFrameCounter >= this.currentMove.startup) {
        this.state = FighterState.Active;
        this.stateFrameCounter = 0;
      } else if (this.state === FighterState.Active) {
        if (this.stateFrameCounter === 1 && this.inRange() && !input.guard) {
          this.p2Health = Math.max(0, this.p2Health - this.currentMove.damage);
        }
        if (this.stateFrameCounter >= this.currentMove.active) {
          this.state = FighterState.Recovery;
          this.stateFrameCounter = 0;
        }
      } else if (this.state === FighterState.Recovery && this.stateFrameCounter >= this.currentMove.recovery) {
        this.state = FighterState.Neutral;
        this.stateFrameCounter = 0;
        this.currentMove = null;
      }
      return;
    }

    if (this.state !== FighterState.Neutral || input.guard) return;

    if (input.light) {
      this.executePlayerMove({ startup: 4, active: 3, recovery: 10, damage: 10, hitAdvantage: 4, blockAdvantage: -2, pushback: 0.6 });
    } else if (input.heavy) {
      this.executePlayerMove({ startup: 12, active: 4, recovery: 20, damage: 25, hitAdvantage: 2, blockAdvantage: -6, pushback: 1.1 });
    }
  }

  private executePlayerMove(move: FrameData) {
    this.state = FighterState.Startup;
    this.stateFrameCounter = 0;
    this.currentMove = move;
  }

  private updateCpu() {
    if (this.p2Health <= 0) return;

    const dx = this.p1X - this.p2X;
    const dz = this.p1Z - this.p2Z;
    const distance = Math.hypot(dx, dz);

    this.p2StateFrameCounter++;

    if (this.p2Move) {
      if (this.p2State === FighterState.Startup && this.p2StateFrameCounter >= this.p2Move.startup) {
        this.p2State = FighterState.Active;
        this.p2StateFrameCounter = 0;
      } else if (this.p2State === FighterState.Active) {
        if (this.p2StateFrameCounter === 1 && distance < 2.05) {
          this.p1Health = Math.max(0, this.p1Health - this.p2Move.damage);
        }
        if (this.p2StateFrameCounter >= this.p2Move.active) {
          this.p2State = FighterState.Recovery;
          this.p2StateFrameCounter = 0;
        }
      } else if (this.p2State === FighterState.Recovery && this.p2StateFrameCounter >= this.p2Move.recovery) {
        this.p2State = FighterState.Neutral;
        this.p2StateFrameCounter = 0;
        this.p2Move = null;
      }
      return;
    }

    if (this.p2State !== FighterState.Neutral) return;

    // Simple deterministic opponent: close distance, then alternate light/heavy attacks.
    if (distance > 2.15) {
      if (Math.abs(dx) > 0.08) this.p2X += Math.sign(dx) * this.walkSpeed * 0.78;
      if (Math.abs(dz) > 0.08) this.p2Z += Math.sign(dz) * this.sidestepSpeed * 0.5;
    } else if (this.currentFrame % 75 === 0) {
      this.p2Move = this.currentFrame % 150 === 0
        ? { startup: 12, active: 4, recovery: 20, damage: 18, hitAdvantage: 2, blockAdvantage: -6, pushback: 1.0 }
        : { startup: 5, active: 3, recovery: 12, damage: 9, hitAdvantage: 4, blockAdvantage: -2, pushback: 0.5 };
      this.p2State = FighterState.Startup;
      this.p2StateFrameCounter = 0;
    }

    this.p2X = Math.max(-this.arenaX, Math.min(this.arenaX, this.p2X));
    this.p2Z = Math.max(-this.arenaZ, Math.min(this.arenaZ, this.p2Z));
  }

  private inRange() {
    return Math.hypot(this.p1X - this.p2X, this.p1Z - this.p2Z) < 2.15;
  }
}
