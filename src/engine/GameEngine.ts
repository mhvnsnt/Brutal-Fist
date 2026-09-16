import { FighterState, FighterAnimation, FighterSnapshot, InputBitmask, FrameData, Hurtbox, Hitbox } from '../types';
import { SchwarzerblitzInputBuffer } from './SchwarzerblitzInput';
import { BannonFighterProfile, getBannonFighter } from '../data/bannonRoster';
import { GrappleSystem } from './GrappleSystem';
import { hitStopFramesForImpact } from './BannonCombatContract';
import { getMoveById } from './BrutalFistMoveCatalog';


// Re-export getMove for backward compat
export { getMoveById as getMove } from './BrutalFistMoveCatalog';

const EMPTY_INPUT: InputBitmask = { up: false, down: false, left: false, right: false, light: false, heavy: false, guard: false, grapple: false, escape: false, pin: false };
const DEFAULT_HURTBOX: Hurtbox = { offsetX: 0, offsetZ: 0, width: 0.82, depth: 0.72 };
const LIGHT = getMoveById('light');
const HEAVY = getMoveById('heavy');

export class GameEngine {
  public inputBuffer: InputBitmask[] = [];
  public currentFrame = 0;
  public readonly p1Fighter: BannonFighterProfile;
  public readonly p2Fighter: BannonFighterProfile;
  public readonly p1MaxHealth: number;
  public readonly p2MaxHealth: number;
  public p1Health: number;
  public p2Health: number;
  public p1Poise: number;
  public p2Poise: number;
  public state: FighterState = FighterState.Neutral;
  public p2State: FighterState = FighterState.Neutral;
  public stateFrameCounter = 0;
  public p2StateFrameCounter = 0;
  public currentMove: FrameData | null = null;
  public p2Move: FrameData | null = null;
  public p1X = -2.25;
  public p1Z = 0;
  public p2X = 2.25;
  public p2Z = 0;
  public p1Facing: 1 | -1 = 1;
  public p2Facing: 1 | -1 = -1;
  public p1Animation: FighterAnimation = 'idle';
  public p2Animation: FighterAnimation = 'idle';
  public readonly grapple = new GrappleSystem();
  public hitStopFrames = 0;

  private readonly maxBufferSize = 60;
  private readonly arenaX = 5.5;
  private readonly arenaZ = 2.25;
  private readonly hurtbox = DEFAULT_HURTBOX;
  private p1Hitstun = 0;
  private p2Hitstun = 0;
  private p1Blockstun = 0;
  private p2Blockstun = 0;
  private p1Guard = false;
  private p2Guard = false;
  private readonly commandBuffer = new SchwarzerblitzInputBuffer();

  constructor(p1Fighter: BannonFighterProfile = getBannonFighter('bannon')!, p2Fighter: BannonFighterProfile = getBannonFighter('maime')!) {
    this.p1Fighter = p1Fighter;
    this.p2Fighter = p2Fighter;
    this.p1MaxHealth = p1Fighter.hp;
    this.p2MaxHealth = p2Fighter.hp;
    this.p1Health = p1Fighter.hp;
    this.p2Health = p2Fighter.hp;
    this.p1Poise = p1Fighter.poise;
    this.p2Poise = p2Fighter.poise;
    for (let i = 0; i < this.maxBufferSize; i++) this.inputBuffer.push({ ...EMPTY_INPUT });
  }

  public tick(currentInput: InputBitmask) {
    if (this.isMatchOver()) return;
    this.currentFrame++;
    this.inputBuffer.shift();
    this.inputBuffer.push({ ...currentInput });
    this.commandBuffer.push(this.currentFrame, currentInput);

    if (this.hitStopFrames > 0) {
      this.hitStopFrames--;
      this.p1Animation = this.p1Animation === 'ko' ? 'ko' : this.p1Animation;
      this.p2Animation = this.p2Animation === 'ko' ? 'ko' : this.p2Animation;
      return;
    }

    this.updateFacing();
    this.updateGrapple(currentInput);
    if (this.grapple.getState().phase !== 'none' && this.grapple.getState().phase !== 'escaped') {
      this.updateGrappledStates();
      return;
    }
    if (this.grapple.getState().phase === 'escaped') this.grapple.release(this.currentFrame);
    this.updatePlayer(currentInput);
    this.updateCpu();
    this.resolveBodySeparation();
    this.updateFacing();
  }

  public getSnapshot(): { frame: number; p1: FighterSnapshot; p2: FighterSnapshot } {
    const grappleState = this.grapple.getState();
    return {
      frame: this.currentFrame,
      p1: this.snapshot(this.p1Health, this.p1X, this.p1Z, this.p1Facing, this.state, this.stateFrameCounter, this.p1Animation, this.currentMove, grappleState),
      p2: this.snapshot(this.p2Health, this.p2X, this.p2Z, this.p2Facing, this.p2State, this.p2StateFrameCounter, this.p2Animation, this.p2Move, grappleState)
    };
  }

  public isMatchOver() { return this.p1Health <= 0 || this.p2Health <= 0; }

  private snapshot(health: number, x: number, z: number, facing: 1 | -1, state: FighterState, stateFrame: number, animation: FighterAnimation, move: FrameData | null, grappleState: ReturnType<GrappleSystem['getState']>): FighterSnapshot {
    return { health, x, z, facing, state, stateFrame, animation, move, grapplePhase: grappleState.phase, grappleEscapeMeter: grappleState.escapeMeter };
  }

  private updateGrapple(input: InputBitmask) {
    const g = this.grapple.getState();
    if (g.phase === 'none' && input.grapple && this.state === FighterState.Neutral && this.p2State === FighterState.Neutral) {
      const distance = Math.hypot(this.p2X - this.p1X, this.p2Z - this.p1Z);
      if (this.grapple.canEngage(distance, this.p2Guard)) {
        this.grapple.engage('p1', 'p2', this.currentFrame);
        this.state = FighterState.Grappled;
        this.p2State = FighterState.Grappled;
        this.p1Animation = 'grapple';
        this.p2Animation = 'grapple';
      }
      return;
    }
    if (g.phase === 'engaged' || g.phase === 'control') {
      if (input.escape) this.grapple.applyEscapeInput(8, this.currentFrame);
      else this.grapple.advanceControl(this.currentFrame);
      if (input.pin) {
        this.grapple.attemptPin(this.currentFrame, this.measurePinContact());
      } else if (input.heavy && g.attackerId === 'p1') {
        this.grapple.advanceControl(this.currentFrame);
        this.p2Health = Math.max(0, this.p2Health - this.scaledDamage(HEAVY.damage * 1.5, this.p1Fighter));
        this.p1Animation = 'throw';
        this.p2Animation = 'hit';
        this.p2State = FighterState.Hitstun;
        this.p2Hitstun = 24;
        this.grapple.release(this.currentFrame);
      }
    }
  }

  private updateGrappledStates() {
    const g = this.grapple.getState();
    if (g.phase === 'pinned') {
      this.state = g.attackerId === 'p1' ? FighterState.Neutral : FighterState.Pinned;
      this.p2State = g.defenderId === 'p2' ? FighterState.Pinned : FighterState.Neutral;
      this.p1Animation = g.attackerId === 'p1' ? 'pin' : 'idle';
      this.p2Animation = g.defenderId === 'p2' ? 'pin' : 'idle';
      return;
    }
    this.state = g.attackerId === 'p1' ? FighterState.Grappled : FighterState.Neutral;
    this.p2State = g.defenderId === 'p2' ? FighterState.Grappled : FighterState.Neutral;
    this.p1Animation = g.attackerId === 'p1' ? 'grapple' : 'idle';
    this.p2Animation = g.defenderId === 'p2' ? 'grapple' : 'idle';
  }

  private measurePinContact() {
    const distance = Math.hypot(this.p2X - this.p1X, this.p2Z - this.p1Z);
    const ringMatContact = Math.abs(this.p2X) <= this.arenaX && Math.abs(this.p2Z) <= this.arenaZ;
    const shoulderDistance = Math.max(0, distance - 0.15);
    return { leftShoulderDistanceM: shoulderDistance, rightShoulderDistanceM: shoulderDistance, ringMatContact };
  }

  private updatePlayer(input: InputBitmask) {
    this.p1Guard = input.guard && this.state === FighterState.Neutral;
    if (this.p1Hitstun > 0) { this.p1Hitstun--; this.state = FighterState.Hitstun; this.p1Animation = 'hit'; if (!this.p1Hitstun) this.state = FighterState.Neutral; return; }
    if (this.p1Blockstun > 0) { this.p1Blockstun--; this.state = FighterState.Blockstun; this.p1Animation = 'block'; if (!this.p1Blockstun) this.state = FighterState.Neutral; return; }
    if (this.currentMove) {
      this.stateFrameCounter++;
      if (this.state === FighterState.Startup && this.stateFrameCounter >= this.currentMove.startup) { this.state = FighterState.Active; this.stateFrameCounter = 0; }
      else if (this.state === FighterState.Active) { if (this.stateFrameCounter === 1) this.tryHit(true, this.currentMove); if (this.stateFrameCounter >= this.currentMove.active) { this.state = FighterState.Recovery; this.stateFrameCounter = 0; } }
      else if (this.state === FighterState.Recovery && this.stateFrameCounter >= this.currentMove.recovery) { this.state = FighterState.Neutral; this.stateFrameCounter = 0; this.currentMove = null; }
      this.p1Animation = this.currentMove?.animation ?? 'light';
      return;
    }
    if (this.state !== FighterState.Neutral) return;
    if (this.p1Guard) { this.p1Animation = 'guard'; return; }
    if (input.light && this.canStartMove(LIGHT)) { this.startPlayerMove(LIGHT); return; }
    if (input.heavy && this.canStartMove(HEAVY)) { this.startPlayerMove(HEAVY); return; }
    this.movePlayer(input);
    this.p1Animation = (input.left || input.right || input.up || input.down) ? 'walk' : 'idle';
  }

  private startPlayerMove(move: FrameData) { this.currentMove = move; this.state = FighterState.Startup; this.stateFrameCounter = 0; }
  private canStartMove(move: FrameData | null) { const candidate = move as SchwarzerblitzMoveDefinition | null; if (!candidate) return false; const distance = Math.hypot(this.p2X - this.p1X, this.p2Z - this.p1Z); return distance >= candidate.minRange && distance <= candidate.maxRange; }
  private movePlayer(input: InputBitmask) {
    const walkSpeed = 0.075 * (this.p1Fighter.speed / 85);
    const sidestepSpeed = 0.055 * (this.p1Fighter.speed / 85);
    if (input.left) this.p1X -= walkSpeed; if (input.right) this.p1X += walkSpeed; if (input.up) this.p1Z -= sidestepSpeed; if (input.down) this.p1Z += sidestepSpeed; this.clampP1();
  }

  private updateCpu() {
    if (this.p2Health <= 0) { this.p2State = FighterState.KO; this.p2Animation = 'ko'; return; }
    if (this.p2Hitstun > 0) { this.p2Hitstun--; this.p2State = FighterState.Hitstun; this.p2Animation = 'hit'; if (!this.p2Hitstun) this.p2State = FighterState.Neutral; return; }
    if (this.p2Blockstun > 0) { this.p2Blockstun--; this.p2State = FighterState.Blockstun; this.p2Animation = 'block'; if (!this.p2Blockstun) this.p2State = FighterState.Neutral; return; }
    const dx = this.p1X - this.p2X; const dz = this.p1Z - this.p2Z; const distance = Math.hypot(dx, dz);
    if (this.p2Move) {
      this.p2StateFrameCounter++;
      if (this.p2State === FighterState.Startup && this.p2StateFrameCounter >= this.p2Move.startup) { this.p2State = FighterState.Active; this.p2StateFrameCounter = 0; }
      else if (this.p2State === FighterState.Active) { if (this.p2StateFrameCounter === 1) this.tryHit(false, this.p2Move); if (this.p2StateFrameCounter >= this.p2Move.active) { this.p2State = FighterState.Recovery; this.p2StateFrameCounter = 0; } }
      else if (this.p2State === FighterState.Recovery && this.p2StateFrameCounter >= this.p2Move.recovery) { this.p2State = FighterState.Neutral; this.p2StateFrameCounter = 0; this.p2Move = null; }
      this.p2Animation = this.p2Move?.animation ?? 'light'; return;
    }
    this.p2Guard = false;
    const walkSpeed = 0.075 * (this.p2Fighter.speed / 85);
    const sidestepSpeed = 0.055 * (this.p2Fighter.speed / 85);
    if (this.p2State !== FighterState.Neutral) return;
    if (distance > 2.1) {
      if (Math.abs(dx) > 0.08) this.p2X += Math.sign(dx) * walkSpeed * 0.78;
      if (Math.abs(dz) > 0.08) this.p2Z += Math.sign(dz) * sidestepSpeed * 0.5;
      this.p2Animation = 'walk';
    } else if (this.currentFrame % 75 === 0) {
      const preferred = this.currentFrame % 150 === 0 ? HEAVY : LIGHT;
      if (!this.canStartCpuMove(preferred)) return;
      this.p2Move = { ...preferred, damage: this.scaledDamage(preferred.damage, this.p2Fighter) };
      this.p2State = FighterState.Startup; this.p2StateFrameCounter = 0;
    } else this.p2Animation = 'idle';
    this.clampP2();
  }

  private canStartCpuMove(move: FrameData | null) { const candidate = move as SchwarzerblitzMoveDefinition | null; if (!candidate) return false; const distance = Math.hypot(this.p2X - this.p1X, this.p2Z - this.p1Z); return distance >= candidate.minRange && distance <= candidate.maxRange; }
  private scaledDamage(base: number, fighter: BannonFighterProfile) { return Math.max(1, Math.round(base * (fighter.strength / 90))); }

  private tryHit(attackerIsP1: boolean, move: FrameData) {
    const hitbox = move.hitbox ?? this.legacyHitbox(move); const attackerX = attackerIsP1 ? this.p1X : this.p2X; const attackerZ = attackerIsP1 ? this.p1Z : this.p2Z; const attackerFacing = attackerIsP1 ? this.p1Facing : this.p2Facing; const defenderX = attackerIsP1 ? this.p2X : this.p1X; const defenderZ = attackerIsP1 ? this.p2Z : this.p1Z; const defenderGuard = attackerIsP1 ? this.p2Guard : this.p1Guard;
    const centerX = attackerX + attackerFacing * hitbox.offsetX; const centerZ = attackerZ + hitbox.offsetZ; const xOverlap = Math.abs(centerX - defenderX) <= (hitbox.width + this.hurtbox.width) * 0.5; const zOverlap = Math.abs(centerZ - defenderZ) <= (hitbox.depth + this.hurtbox.depth) * 0.5; if (!xOverlap || !zOverlap) return;
    const attacker = attackerIsP1 ? this.p1Fighter : this.p2Fighter; const defenderPoise = attackerIsP1 ? this.p2Poise : this.p1Poise; const damage = this.scaledDamage(hitbox.damage || move.damage, attacker); const push = hitbox.pushback || move.pushback;
    if (attackerIsP1) {
      this.p2Health = Math.max(0, this.p2Health - damage); this.p2State = defenderGuard ? FighterState.Blockstun : FighterState.Hitstun; this.p2Animation = defenderGuard ? 'block' : 'hit';
      if (defenderGuard) this.p2Blockstun = hitbox.blockstun || move.blockstun || 9;
      else { this.p2Hitstun = hitbox.hitstun || move.hitstun || 15; this.p2Poise = Math.max(0, defenderPoise - Math.max(1, Math.round(damage / 100))); }
      this.p2X += this.p1Facing * push;
    } else {
      this.p1Health = Math.max(0, this.p1Health - damage); this.state = defenderGuard ? FighterState.Blockstun : FighterState.Hitstun; this.p1Animation = defenderGuard ? 'block' : 'hit';
      if (defenderGuard) this.p1Blockstun = hitbox.blockstun || move.blockstun || 9;
      else { this.p1Hitstun = hitbox.hitstun || move.hitstun || 15; this.p1Poise = Math.max(0, this.p1Poise - Math.max(1, Math.round(damage / 100))); }
      this.p1X += this.p2Facing * push;
    }
    this.hitStopFrames = Math.max(this.hitStopFrames, hitStopFramesForImpact(damage));
    if (attackerIsP1 && this.p2Poise <= 0) this.p2Animation = 'ko';
    if (!attackerIsP1 && this.p1Poise <= 0) this.p1Animation = 'ko';
    if (attackerIsP1 && this.p2Health <= 0) { this.p2State = FighterState.KO; this.p2Animation = 'ko'; }
    if (!attackerIsP1 && this.p1Health <= 0) { this.state = FighterState.KO; this.p1Animation = 'ko'; }
  }

  private legacyHitbox(move: FrameData): Hitbox { return { offsetX: 0.9, offsetZ: 0, width: 1.2, depth: 0.8, damage: move.damage, hitstun: move.hitstun ?? 15, blockstun: move.blockstun ?? 9, pushback: move.pushback, launch: 0 }; }
  private resolveBodySeparation() { const dx = this.p2X - this.p1X; const dz = this.p2Z - this.p1Z; const distance = Math.hypot(dx, dz); const minimum = 0.72; if (distance <= 0 || distance >= minimum) return; const nx = dx / distance; const nz = dz / distance; const correction = (minimum - distance) * 0.5; this.p1X -= nx * correction; this.p1Z -= nz * correction; this.p2X += nx * correction; this.p2Z += nz * correction; this.clampP1(); this.clampP2(); }
  private updateFacing() { if (this.p2X > this.p1X + 0.01) { this.p1Facing = 1; this.p2Facing = -1; } else if (this.p2X < this.p1X - 0.01) { this.p1Facing = -1; this.p2Facing = 1; } }
  private clampP1() { this.p1X = Math.max(-this.arenaX, Math.min(this.arenaX, this.p1X)); this.p1Z = Math.max(-this.arenaZ, Math.min(this.arenaZ, this.p1Z)); }
  private clampP2() { this.p2X = Math.max(-this.arenaX, Math.min(this.arenaX, this.p2X)); this.p2Z = Math.max(-this.arenaZ, Math.min(this.arenaZ, this.p2Z)); }
}
