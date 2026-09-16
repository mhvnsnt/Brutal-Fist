/**
 * GlobalAudioManager — Howler-based audio manager for Brutal Fist
 *
 * Architecture (Tekken audio layers):
 *  - BGM channel: looping background music (menu, character select, stage fight)
 *  - UI channel: menu cursor, lock-in sounds
 *  - SFX channel: combat impacts (whiff, block, hit, counter, floor slam)
 *  - VOX channel: fighter vocals (attack grunts, pain grunts, KO scream)
 *
 * Mobile optimization:
 *  - All assets preloaded during VS screen transition
 *  - Separate Howl instances per channel to prevent music drowning out SFX
 *  - BGM crossfade: menu → stage BGM when fight loads
 *  - Web Audio API fallback for procedural SFX when files not present
 *
 * Asset paths: public/audio/
 *  - bgm/: character_select.mp3, stage_urban_night.mp3, stage_training.mp3
 *  - ui/: cursor_move.mp3, lock_in.mp3
 *  - sfx/: whiff.mp3, block.mp3, light_hit.mp3, heavy_hit.mp3, counter_hit.mp3, floor_slam.mp3
 *  - vox/: attack_grunt.mp3, pain_grunt.mp3, ko_scream.mp3
 *  - announcer/: get_ready.mp3, round_1.mp3, fight.mp3, ko.mp3, perfect.mp3, etc.
 *
 * NOTE: Audio files are referenced but use Web Audio API procedural fallback
 * when files are not present, so the game works without audio assets.
 */

'use client';

// ── Audio channel types ───────────────────────────────────────────────────────
export type AudioChannel = 'bgm' | 'ui' | 'sfx' | 'vox' | 'announcer';

// ── BGM track IDs ─────────────────────────────────────────────────────────────
export type BGMTrack =
  | 'character_select' |'stage_select' |'stage_urban_night' |'stage_training' |'menu_main';

// ── SFX event IDs ─────────────────────────────────────────────────────────────
export type SFXEvent =
  | 'whiff'
  | 'block' |'light_hit' |'heavy_hit' |'counter_hit' |'floor_slam' |'wall_splat' |'throw_connect' |'throw_break' |'heat_burst_activate' |'power_crush_absorb' |'rage_art_activate';

// ── VOX event IDs ─────────────────────────────────────────────────────────────
export type VOXEvent =
  | 'attack_grunt' |'pain_grunt' |'ko_scream' |'heat_burst_yell' |'rage_art_yell';

// ── UI sound IDs ──────────────────────────────────────────────────────────────
export type UISound = 'cursor_move' | 'lock_in' | 'menu_back' | 'menu_confirm';

// ── Announcer line IDs ────────────────────────────────────────────────────────
export type AnnouncerLine =
  | 'get_ready' |'round_1'| 'round_2' | 'round_3' |'final_round' |'fight' |'ko' |'double_ko' |'perfect' |'great' |'time_up' |'draw' |'p1_wins' |'p2_wins' |'ki_charge' |'chicken';

// ── Audio manager config ──────────────────────────────────────────────────────
export interface AudioManagerConfig {
  masterVolume: number;
  bgmVolume: number;
  sfxVolume: number;
  voxVolume: number;
  uiVolume: number;
  announcerVolume: number;
  enabled: boolean;
}

export const DEFAULT_AUDIO_CONFIG: AudioManagerConfig = {
  masterVolume: 1.0,
  bgmVolume: 0.65,
  sfxVolume: 0.9,
  voxVolume: 0.85,
  uiVolume: 0.75,
  announcerVolume: 0.95,
  enabled: true,
};

// ── Web Audio API procedural fallback ─────────────────────────────────────────
// Used when audio files are not present — generates sounds procedurally
class ProceduralAudio {
  private ctx: AudioContext | null = null;

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  private playNoise(duration: number, gain: number, freq: number, q: number) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration);
  }

  private playTone(freq: number, duration: number, gain: number, type: OscillatorType = 'sine', freqEnd?: number) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  whiff() { this.playNoise(0.07, 0.25, 4000, 8); }
  block() { this.playNoise(0.06, 0.4, 3500, 5); this.playTone(320, 0.05, 0.25, 'square', 280); }
  lightHit() { this.playNoise(0.08, 0.6, 2200, 3); this.playTone(180, 0.06, 0.3, 'square', 90); }
  heavyHit() {
    this.playNoise(0.14, 1.0, 800, 2);
    this.playTone(90, 0.12, 0.5, 'sawtooth', 40);
    this.playTone(55, 0.18, 0.4, 'sine', 30);
  }
  counterHit() {
    this.playNoise(0.10, 0.8, 1800, 4);
    this.playTone(440, 0.08, 0.4, 'sawtooth', 220);
    setTimeout(() => this.playTone(660, 0.06, 0.3, 'square', 330), 40);
  }
  floorSlam() {
    this.playNoise(0.18, 1.2, 200, 1);
    this.playTone(55, 0.25, 0.8, 'sine', 20);
  }
  wallSplat() {
    this.playNoise(0.12, 0.9, 600, 2);
    this.playTone(80, 0.15, 0.6, 'sawtooth', 40);
  }
  throwConnect() {
    this.playNoise(0.12, 0.7, 400, 2);
    this.playTone(70, 0.15, 0.5, 'sine', 50);
  }
  throwBreak() {
    this.playNoise(0.08, 0.5, 2000, 4);
    this.playTone(440, 0.1, 0.4, 'square', 220);
  }
  heatBurstActivate() {
    this.playTone(220, 0.3, 0.7, 'sawtooth', 440);
    setTimeout(() => this.playNoise(0.2, 0.8, 1000, 3), 100);
  }
  powerCrushAbsorb() {
    this.playNoise(0.1, 0.6, 800, 3);
    this.playTone(160, 0.12, 0.5, 'square', 80);
  }
  rageArtActivate() {
    this.playTone(55, 0.6, 0.9, 'sine', 20);
    this.playNoise(0.5, 1.2, 200, 1);
    setTimeout(() => this.playTone(880, 0.8, 0.5, 'sine', 440), 80);
    setTimeout(() => this.playNoise(1.2, 0.6, 600, 0.5), 200);
  }
  attackGrunt() { this.playNoise(0.06, 0.3, 1200, 6); this.playTone(280, 0.08, 0.2, 'sine', 200); }
  painGrunt() { this.playNoise(0.08, 0.4, 900, 5); this.playTone(200, 0.1, 0.3, 'sine', 150); }
  koScream() {
    this.playTone(300, 1.2, 0.6, 'sine', 80);
    this.playNoise(0.8, 0.5, 500, 2);
  }
  cursorMove() { this.playTone(880, 0.04, 0.3, 'square', 660); }
  lockIn() {
    this.playNoise(0.08, 0.6, 1500, 4);
    this.playTone(220, 0.12, 0.5, 'sawtooth', 110);
  }
  menuBack() { this.playTone(440, 0.06, 0.25, 'square', 330); }
  menuConfirm() {
    this.playTone(660, 0.08, 0.4, 'sine');
    setTimeout(() => this.playTone(880, 0.06, 0.3, 'sine'), 80);
  }
  roundStart() {
    this.playTone(660, 0.4, 0.7, 'sine');
    setTimeout(() => this.playTone(880, 0.3, 0.5, 'sine'), 150);
    setTimeout(() => this.playTone(1100, 0.5, 0.6, 'sine'), 280);
  }
  victory() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => setTimeout(() => this.playTone(freq, 0.3, 0.6, 'square'), i * 120));
  }
}

// ── Global Audio Manager ──────────────────────────────────────────────────────
class GlobalAudioManagerClass {
  private config: AudioManagerConfig = { ...DEFAULT_AUDIO_CONFIG };
  private procedural = new ProceduralAudio();
  private currentBGMTrack: BGMTrack | null = null;
  private bgmFadeTimer: ReturnType<typeof setTimeout> | null = null;
  private announcerQueue: string[] = [];
  private announcerPlaying = false;

  // Howler instances (lazy-loaded when files are available)
  private howlerBGM: any = null;
  private howlerSFX: Map<string, any> = new Map();
  private howlerVOX: Map<string, any> = new Map();
  private howlerUI: Map<string, any> = new Map();
  private howlerAnnouncer: Map<string, any> = new Map();
  private howlerLoaded = false;

  /** Initialize Howler — called once on client */
  async init(config?: Partial<AudioManagerConfig>) {
    if (config) this.config = { ...this.config, ...config };
    if (typeof window === 'undefined') return;

    // Try to load Howler dynamically
    try {
      const { Howl, Howler } = await import('howler');
      Howler.volume(this.config.masterVolume);
      this.howlerLoaded = true;
      this._preloadSFX(Howl);
      this._preloadUI(Howl);
    } catch {
      // Howler not available — use procedural fallback
      console.log('[AudioManager] Howler not available, using procedural audio');
    }
  }

  private _preloadSFX(Howl: any) {
    const sfxMap: Record<string, string> = {
      whiff: '/audio/sfx/whiff.mp3',
      block: '/audio/sfx/block.mp3',
      light_hit: '/audio/sfx/light_hit.mp3',
      heavy_hit: '/audio/sfx/heavy_hit.mp3',
      counter_hit: '/audio/sfx/counter_hit.mp3',
      floor_slam: '/audio/sfx/floor_slam.mp3',
      wall_splat: '/audio/sfx/wall_splat.mp3',
      throw_connect: '/audio/sfx/throw_connect.mp3',
      throw_break: '/audio/sfx/throw_break.mp3',
      heat_burst_activate: '/audio/sfx/heat_burst_activate.mp3',
      power_crush_absorb: '/audio/sfx/power_crush_absorb.mp3',
      rage_art_activate: '/audio/sfx/rage_art_activate.mp3',
    };
    for (const [id, src] of Object.entries(sfxMap)) {
      try {
        this.howlerSFX.set(id, new Howl({ src: [src], volume: this.config.sfxVolume, preload: false }));
      } catch {}
    }
  }

  private _preloadUI(Howl: any) {
    const uiMap: Record<string, string> = {
      cursor_move: '/audio/ui/cursor_move.mp3',
      lock_in: '/audio/ui/lock_in.mp3',
      menu_back: '/audio/ui/menu_back.mp3',
      menu_confirm: '/audio/ui/menu_confirm.mp3',
    };
    for (const [id, src] of Object.entries(uiMap)) {
      try {
        this.howlerUI.set(id, new Howl({ src: [src], volume: this.config.uiVolume, preload: false }));
      } catch {}
    }
  }

  /** Preload all combat audio assets — call during VS screen transition */
  async preloadCombatAudio(stageId: string) {
    if (!this.howlerLoaded) return;
    try {
      const { Howl } = await import('howler');
      const voxMap: Record<string, string> = {
        attack_grunt: '/audio/vox/attack_grunt.mp3',
        pain_grunt: '/audio/vox/pain_grunt.mp3',
        ko_scream: '/audio/vox/ko_scream.mp3',
        heat_burst_yell: '/audio/vox/heat_burst_yell.mp3',
        rage_art_yell: '/audio/vox/rage_art_yell.mp3',
      };
      for (const [id, src] of Object.entries(voxMap)) {
        if (!this.howlerVOX.has(id)) {
          try {
            const h = new Howl({ src: [src], volume: this.config.voxVolume, preload: true });
            this.howlerVOX.set(id, h);
          } catch {}
        }
      }
      const announcerLines = [
        'get_ready', 'round_1', 'round_2', 'round_3', 'final_round',
        'fight', 'ko', 'double_ko', 'perfect', 'great', 'time_up', 'draw',
        'p1_wins', 'p2_wins', 'ki_charge', 'chicken',
      ];
      for (const line of announcerLines) {
        if (!this.howlerAnnouncer.has(line)) {
          try {
            const h = new Howl({
              src: [`/audio/announcer/${line}.mp3`],
              volume: this.config.announcerVolume,
              preload: true,
            });
            this.howlerAnnouncer.set(line, h);
          } catch {}
        }
      }
      // Preload stage BGM
      const stageBGMSrc = `/audio/bgm/stage_${stageId}.mp3`;
      try {
        const h = new Howl({ src: [stageBGMSrc], volume: this.config.bgmVolume, loop: true, preload: true });
        this.howlerSFX.set(`bgm_${stageId}`, h);
      } catch {}
    } catch {}
  }

  // ── BGM control ─────────────────────────────────────────────────────────────
  /** Play a BGM track, crossfading from current track */
  async playBGM(track: BGMTrack, fadeMs = 1500) {
    if (!this.config.enabled) return;
    if (this.currentBGMTrack === track) return;

    // Fade out current BGM
    if (this.howlerBGM) {
      const oldBGM = this.howlerBGM;
      oldBGM.fade(this.config.bgmVolume, 0, fadeMs);
      setTimeout(() => oldBGM.stop(), fadeMs + 100);
    }

    this.currentBGMTrack = track;

    if (this.howlerLoaded) {
      try {
        const { Howl } = await import('howler');
        const src = `/audio/bgm/${track}.mp3`;
        this.howlerBGM = new Howl({
          src: [src],
          volume: 0,
          loop: true,
          autoplay: true,
        });
        this.howlerBGM.fade(0, this.config.bgmVolume, fadeMs);
        return;
      } catch {}
    }

    // Procedural BGM fallback — just play round start bell as placeholder
    this.procedural.roundStart();
  }

  stopBGM(fadeMs = 1000) {
    if (this.howlerBGM) {
      this.howlerBGM.fade(this.config.bgmVolume, 0, fadeMs);
      setTimeout(() => { this.howlerBGM?.stop(); this.howlerBGM = null; }, fadeMs + 100);
    }
    this.currentBGMTrack = null;
  }

  // ── SFX triggers ─────────────────────────────────────────────────────────────
  playSFX(event: SFXEvent) {
    if (!this.config.enabled) return;

    // Try Howler first
    const howl = this.howlerSFX.get(event);
    if (howl) {
      try { howl.play(); return; } catch {}
    }

    // Procedural fallback
    switch (event) {
      case 'whiff': this.procedural.whiff(); break;
      case 'block': this.procedural.block(); break;
      case 'light_hit': this.procedural.lightHit(); break;
      case 'heavy_hit': this.procedural.heavyHit(); break;
      case 'counter_hit': this.procedural.counterHit(); break;
      case 'floor_slam': this.procedural.floorSlam(); break;
      case 'wall_splat': this.procedural.wallSplat(); break;
      case 'throw_connect': this.procedural.throwConnect(); break;
      case 'throw_break': this.procedural.throwBreak(); break;
      case 'heat_burst_activate': this.procedural.heatBurstActivate(); break;
      case 'power_crush_absorb': this.procedural.powerCrushAbsorb(); break;
      case 'rage_art_activate': this.procedural.rageArtActivate(); break;
    }
  }

  // ── VOX triggers ──────────────────────────────────────────────────────────
  playVOX(event: VOXEvent) {
    if (!this.config.enabled) return;

    const howl = this.howlerVOX.get(event);
    if (howl) {
      try { howl.play(); return; } catch {}
    }

    switch (event) {
      case 'attack_grunt': this.procedural.attackGrunt(); break;
      case 'pain_grunt': this.procedural.painGrunt(); break;
      case 'ko_scream': this.procedural.koScream(); break;
      case 'heat_burst_yell': this.procedural.heatBurstActivate(); break;
      case 'rage_art_yell': this.procedural.rageArtActivate(); break;
    }
  }

  // ── UI sounds ─────────────────────────────────────────────────────────────
  playUI(sound: UISound) {
    if (!this.config.enabled) return;

    const howl = this.howlerUI.get(sound);
    if (howl) {
      try { howl.play(); return; } catch {}
    }

    switch (sound) {
      case 'cursor_move': this.procedural.cursorMove(); break;
      case 'lock_in': this.procedural.lockIn(); break;
      case 'menu_back': this.procedural.menuBack(); break;
      case 'menu_confirm': this.procedural.menuConfirm(); break;
    }
  }

  // ── Announcer ─────────────────────────────────────────────────────────────
  playAnnouncer(line: AnnouncerLine) {
    if (!this.config.enabled) return;

    const howl = this.howlerAnnouncer.get(line);
    if (howl) {
      try { howl.play(); return; } catch {}
    }

    // Web Speech API fallback
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const textMap: Record<AnnouncerLine, string> = {
        get_ready: 'Get ready for the next battle',
        round_1: 'Round 1',
        round_2: 'Round 2',
        round_3: 'Round 3',
        final_round: 'Final Round',
        fight: 'Fight!',
        ko: 'K.O.!',
        double_ko: 'Double K.O.!',
        perfect: 'Perfect!',
        great: 'Great!',
        time_up: 'Time Up!',
        draw: 'Draw!',
        p1_wins: 'Player 1 Wins!',
        p2_wins: 'Player 2 Wins!',
        ki_charge: 'Ki Charge!',
        chicken: 'Chicken!',
      };
      const text = textMap[line];
      if (text) {
        const synth = window.speechSynthesis;
        synth.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.pitch = 0.7;
        utt.rate = 0.85;
        utt.volume = this.config.announcerVolume;
        synth.speak(utt);
      }
    }
  }

  // ── Config ────────────────────────────────────────────────────────────────
  updateConfig(config: Partial<AudioManagerConfig>) {
    this.config = { ...this.config, ...config };
  }

  setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
    if (!enabled) this.stopBGM(300);
  }

  getMasterVolume() { return this.config.masterVolume; }
  isEnabled() { return this.config.enabled; }
}

// ── Singleton export ──────────────────────────────────────────────────────────
let _instance: GlobalAudioManagerClass | null = null;

export function getGlobalAudioManager(): GlobalAudioManagerClass {
  if (!_instance) _instance = new GlobalAudioManagerClass();
  return _instance;
}

export type { GlobalAudioManagerClass };
