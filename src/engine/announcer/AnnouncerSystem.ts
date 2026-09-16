/**
 * AnnouncerSystem — Tekken-style fight announcer
 *
 * Every voice line is hard-wired to a strict game state transition.
 * Uses Web Audio API speech synthesis (SpeechSynthesis) for zero-asset
 * announcer voice, with a procedural fallback tone for environments
 * that don't support speech.
 *
 * Trigger map (matches Tekken 3 → modern Tekken):
 *  "Get ready for the next battle." → pre-match / VS screen
 *  "Round 1 / 2 / 3!"→ start of each round *"Fight!"→ player control unlocked *"Final Round."                   → match point for both players
 *  "K.O.!"→ one player HP hits 0 *"Double K.O.!"→ both players HP hit 0 same frame *"Perfect!"→ winner took 0 damage *"Great!"→ winner won with ≤5% HP *"Time Up!"→ round timer hits 0 *"Draw."                          → timer 0 + equal HP, or double KO final round
 *  "[Name] Wins!"→ post-match victory cinematic *"Ki Charge!"→ 1+2+3+4 pressed *"Chicken!"                       → reversal of a reversal
 */

export type AnnouncerLine =
  | 'getReady' |'round1'| 'round2' | 'round3' | 'finalRound' |'fight' |'ko' | 'doubleKo'
  | 'perfect'| 'great' |'timeUp'| 'draw' |'p1Wins'| 'p2Wins' |'kiCharge' |'chicken';

export interface AnnouncerConfig {
  enabled: boolean;
  volume: number;
  /** Fighter names for "[Name] Wins!" call */
  p1Name: string;
  p2Name: string;
}

const DEFAULT_CONFIG: AnnouncerConfig = {
  enabled: true,
  volume: 0.85,
  p1Name: 'Player One',
  p2Name: 'Player Two',
};

// ── Script text for each line ─────────────────────────────────────────────────
const ANNOUNCER_SCRIPT: Record<AnnouncerLine, string> = {
  getReady:    'Get ready for the next battle.',
  round1:      'Round 1!',
  round2:      'Round 2!',
  round3:      'Round 3!',
  finalRound:  'Final Round.',
  fight:       'Fight!',
  ko:          'K.O.!',
  doubleKo:    'Double K.O.!',
  perfect:     'Perfect!',
  great:       'Great!',
  timeUp:      'Time Up!',
  draw:        'Draw.',
  p1Wins:      '', // filled dynamically
  p2Wins:      '', // filled dynamically
  kiCharge:    'Ki Charge!',
  chicken:     'Chicken!',
};

// ── Cooldown map — prevent double-firing ─────────────────────────────────────
const LINE_COOLDOWN_MS: Partial<Record<AnnouncerLine, number>> = {
  ko:        3000,
  doubleKo:  3000,
  perfect:   3000,
  great:     3000,
  timeUp:    3000,
  draw:      3000,
  p1Wins:    3000,
  p2Wins:    3000,
  fight:     2000,
  kiCharge:  2500,
  chicken:   2000,
};

export class AnnouncerSystem {
  private config: AnnouncerConfig;
  private synth: SpeechSynthesis | null = null;
  private lastFiredAt: Map<AnnouncerLine, number> = new Map();
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private audioCtx: AudioContext | null = null;
  private preferredVoice: SpeechSynthesisVoice | null = null;
  private voicesLoaded = false;

  constructor(config: Partial<AnnouncerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis;
      this.loadVoices();
    }
  }

  private loadVoices(): void {
    if (!this.synth) return;
    const tryLoad = () => {
      const voices = this.synth!.getVoices();
      if (voices.length === 0) return;
      // Prefer deep male English voice
      const preferred = voices.find(v =>
        v.lang.startsWith('en') && (
          v.name.toLowerCase().includes('male') ||
          v.name.toLowerCase().includes('david') ||
          v.name.toLowerCase().includes('alex') ||
          v.name.toLowerCase().includes('daniel') ||
          v.name.toLowerCase().includes('fred') ||
          v.name.toLowerCase().includes('ralph')
        )
      ) ?? voices.find(v => v.lang.startsWith('en')) ?? voices[0];
      this.preferredVoice = preferred ?? null;
      this.voicesLoaded = true;
    };
    tryLoad();
    if (!this.voicesLoaded) {
      this.synth.addEventListener('voiceschanged', tryLoad, { once: true });
    }
  }

  updateConfig(config: Partial<AnnouncerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Fire a specific announcer line */
  fire(line: AnnouncerLine, overrideName?: string): void {
    if (!this.config.enabled) return;

    // Cooldown check
    const cooldown = LINE_COOLDOWN_MS[line] ?? 500;
    const lastFired = this.lastFiredAt.get(line) ?? 0;
    if (Date.now() - lastFired < cooldown) return;
    this.lastFiredAt.set(line, Date.now());

    let text = ANNOUNCER_SCRIPT[line];
    if (line === 'p1Wins') text = `${overrideName ?? this.config.p1Name} Wins!`;
    if (line === 'p2Wins') text = `${overrideName ?? this.config.p2Name} Wins!`;

    this.speak(text, line);
  }

  private speak(text: string, line: AnnouncerLine): void {
    if (!this.synth) {
      this.playToneFallback(line);
      return;
    }

    // Cancel any current speech
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = this.config.volume;
    utterance.rate = this.getRate(line);
    utterance.pitch = this.getPitch(line);
    if (this.preferredVoice) utterance.voice = this.preferredVoice;

    this.currentUtterance = utterance;
    this.synth.speak(utterance);
  }

  private getRate(line: AnnouncerLine): number {
    switch (line) {
      case 'fight':     return 1.3;  // Fast, punchy
      case 'ko':        return 0.9;  // Slow, dramatic
      case 'doubleKo':  return 0.85;
      case 'perfect':   return 1.0;
      case 'great':     return 1.1;
      case 'timeUp':    return 1.0;
      case 'kiCharge':  return 1.2;
      case 'p1Wins': case'p2Wins':    return 0.95;
      default:          return 1.0;
    }
  }

  private getPitch(line: AnnouncerLine): number {
    switch (line) {
      case 'fight':     return 1.2;  // High energy
      case 'ko':        return 0.7;  // Deep, dramatic
      case 'doubleKo':  return 0.65;
      case 'perfect':   return 1.3;  // Triumphant
      case 'great':     return 1.1;
      case 'kiCharge':  return 1.15;
      case 'p1Wins': case'p2Wins':    return 0.9;
      default:          return 0.85; // Default deep voice
    }
  }

  /** Tone fallback for environments without SpeechSynthesis */
  private playToneFallback(line: AnnouncerLine): void {
    if (typeof window === 'undefined') return;
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = this.audioCtx;
    if (ctx.state === 'suspended') ctx.resume();

    const patterns: Record<string, number[]> = {
      fight:    [440, 660, 880],
      ko:       [220, 165, 110],
      doubleKo: [220, 165, 110, 82],
      perfect:  [523, 659, 784, 1047],
      great:    [440, 554, 659],
      timeUp:   [330, 294, 262],
      draw:     [330, 330],
      kiCharge: [440, 550, 660],
    };

    const freqs = patterns[line] ?? [440];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.12;
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  stop(): void {
    this.synth?.cancel();
    this.currentUtterance = null;
  }

  destroy(): void {
    this.stop();
    this.audioCtx?.close();
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────────
let _instance: AnnouncerSystem | null = null;

export function getAnnouncerSystem(config?: Partial<AnnouncerConfig>): AnnouncerSystem {
  if (!_instance) {
    _instance = new AnnouncerSystem(config);
  } else if (config) {
    _instance.updateConfig(config);
  }
  return _instance;
}
