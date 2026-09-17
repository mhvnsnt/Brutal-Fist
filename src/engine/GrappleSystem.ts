import { BANNON_COMBAT_CONTRACT, isPhysicalPin } from './BannonCombatContract';

export type GrapplePhase = 'none' | 'engaged' | 'control' | 'throw' | 'pin-attempt' | 'pinned' | 'escaped';

export interface GrappleState {
  phase: GrapplePhase;
  attackerId: string | null;
  defenderId: string | null;
  frame: number;
  escapeMeter: number;
}

export interface PinMeasurement {
  leftShoulderDistanceM: number;
  rightShoulderDistanceM: number;
  ringMatContact: boolean;
}

export class GrappleSystem {
  private state: GrappleState = {
    phase: 'none',
    attackerId: null,
    defenderId: null,
    frame: 0,
    escapeMeter: 0
  };

  public getState(): GrappleState {
    return { ...this.state };
  }

  public canEngage(distanceM: number, defenderGuarding: boolean) {
    return Number.isFinite(distanceM)
      && distanceM >= 0.2
      && distanceM <= 0.95
      && !defenderGuarding
      && this.state.phase === 'none';
  }

  public engage(attackerId: string, defenderId: string, frame: number) {
    if (this.state.phase !== 'none') return false;
    this.state = {
      phase: 'engaged',
      attackerId,
      defenderId,
      frame,
      escapeMeter: 0
    };
    return true;
  }

  public advanceControl(frame: number) {
    if (this.state.phase !== 'engaged' && this.state.phase !== 'control') return;
    this.state.phase = 'control';
    this.state.frame = frame;
  }

  public applyEscapeInput(amount: number, frame: number) {
    if (this.state.phase !== 'engaged' && this.state.phase !== 'control') return false;
    this.state.escapeMeter = Math.max(0, Math.min(100, this.state.escapeMeter + Math.max(0, amount)));
    this.state.frame = frame;
    if (this.state.escapeMeter >= 100) {
      this.state.phase = 'escaped';
      return true;
    }
    return false;
  }

  public attemptPin(frame: number, measurement: PinMeasurement) {
    if (this.state.phase !== 'control' && this.state.phase !== 'throw') return false;
    const valid = measurement.ringMatContact && isPhysicalPin(
      measurement.leftShoulderDistanceM,
      measurement.rightShoulderDistanceM
    );
    this.state.phase = valid ? 'pinned' : 'control';
    this.state.frame = frame;
    return valid;
  }

  public release(frame: number) {
    this.state = {
      phase: 'none',
      attackerId: null,
      defenderId: null,
      frame,
      escapeMeter: 0
    };
  }

  public getContract() {
    return {
      maxVelocityMps: BANNON_COMBAT_CONTRACT.maxBodyVelocityMps,
      pinToleranceM: BANNON_COMBAT_CONTRACT.physicalPinShoulderToleranceM,
      nativePhysicsOwner: BANNON_COMBAT_CONTRACT.hitReaction.nativePhysicsOwner
    } as const;
  }
}
